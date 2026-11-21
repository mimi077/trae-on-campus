import { TRPCError } from "@trpc/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { HOT_ACTIVITY_MAX } from "@/lib/constants";
import { ACTIVITY_SELECT, occupiedMap, parseActivityTags } from "@/server/api/routers/activity";
import { adminProcedure, createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { db } from "@/server/db";

const urlPattern = /^https?:\/\//i;
const HOT_SELECT = {
  id: true,
  sortOrder: true,
  isExternal: true,
  externalUrl: true,
  activityId: true,
  title: true,
  coverUrl: true,
  createdAt: true,
} satisfies Prisma.HotActivitySelect;

async function nextSortOrder() {
  const last = await db.hotActivity.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  return (last?.sortOrder ?? 0) + 1;
}

export const hotActivityRouter = createTRPCRouter({
  /** 首页热门活动：只返回仍公开的内部活动；外部活动按管理员录入顺序展示 */
  list: publicProcedure.query(async () => {
    const rows = await db.hotActivity.findMany({ select: HOT_SELECT, orderBy: { sortOrder: "asc" } });
    const internalIds = rows
      .filter((row) => !row.isExternal && row.activityId)
      .map((row) => row.activityId as string);

    const [activities, occupied] = await Promise.all([
      internalIds.length
        ? db.activity.findMany({
            where: { id: { in: internalIds }, status: { in: ["PUBLISHED", "ONGOING"] } },
            select: ACTIVITY_SELECT,
          })
        : Promise.resolve([]),
      occupiedMap(internalIds),
    ]);
    const activityMap = new Map(activities.map((activity) => [activity.id, activity]));

    return rows
      .map((row) => {
        if (row.isExternal) {
          return {
            id: row.id,
            isExternal: true as const,
            externalUrl: row.externalUrl,
            activityId: null,
            title: row.title,
            coverUrl: row.coverUrl,
            activity: null,
          };
        }
        const activity = row.activityId ? activityMap.get(row.activityId) : undefined;
        if (!activity) return null;
        const used = occupied.get(activity.id) ?? 0;
        return {
          id: row.id,
          isExternal: false as const,
          externalUrl: null,
          activityId: activity.id,
          title: activity.title,
          coverUrl: activity.coverUrl,
          activity: {
            ...activity,
            tags: parseActivityTags(activity.tags),
            occupied: used,
            remaining: activity.isUnlimited ? null : Math.max(activity.capacity - used, 0),
          },
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }),

  /** 管理端：热门池 + 关联活动状态 */
  adminList: adminProcedure.query(async () => {
    const rows = await db.hotActivity.findMany({ select: HOT_SELECT, orderBy: { sortOrder: "asc" } });
    const ids = rows.filter((row) => row.activityId).map((row) => row.activityId as string);
    const activities = ids.length
      ? await db.activity.findMany({
          where: { id: { in: ids } },
          select: { id: true, title: true, status: true, startAt: true, location: true },
        })
      : [];
    const activityMap = new Map(activities.map((activity) => [activity.id, activity]));
    return {
      items: rows.map((row) => ({
        ...row,
        activity: row.activityId ? activityMap.get(row.activityId) ?? null : null,
      })),
      max: HOT_ACTIVITY_MAX,
    };
  }),

  /** 管理端：可加入热门池的公开活动（排除已在池内的） */
  candidates: adminProcedure.query(async () => {
    const pool = await db.hotActivity.findMany({ where: { activityId: { not: null } }, select: { activityId: true } });
    const takenIds = pool.map((row) => row.activityId as string);
    return db.activity.findMany({
      where: { status: "PUBLISHED", id: { notIn: takenIds.length ? takenIds : ["__none__"] } },
      select: { id: true, title: true, startAt: true, location: true, organizer: true },
      orderBy: { startAt: "asc" },
      take: 30,
    });
  }),

  addInternal: adminProcedure
    .input(z.object({ activityId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const count = await db.hotActivity.count();
      if (count >= HOT_ACTIVITY_MAX) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `热门活动最多 ${HOT_ACTIVITY_MAX} 条，请先移除多余条目` });
      }
      const activity = await db.activity.findUnique({
        where: { id: input.activityId },
        select: { id: true, title: true, coverUrl: true, status: true },
      });
      if (!activity || activity.status !== "PUBLISHED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "只能将报名中的公开活动加入热门池" });
      }
      const exists = await db.hotActivity.findFirst({ where: { activityId: activity.id }, select: { id: true } });
      if (exists) throw new TRPCError({ code: "BAD_REQUEST", message: "该活动已在热门池中" });

      const row = await db.hotActivity.create({
        data: {
          activityId: activity.id,
          title: activity.title,
          coverUrl: activity.coverUrl,
          sortOrder: await nextSortOrder(),
        },
        select: { id: true },
      });
      return { id: row.id };
    }),

  addExternal: adminProcedure
    .input(
      z.object({
        title: z.string().trim().min(2, "标题至少 2 个字").max(60, "标题最多 60 个字符"),
        externalUrl: z
          .string()
          .trim()
          .max(500)
          .refine((value) => urlPattern.test(value), "外部活动链接需以 http(s) 开头"),
        coverUrl: z
          .string()
          .trim()
          .max(500)
          .refine((value) => !value || urlPattern.test(value), "封面链接需以 http(s) 开头")
          .optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const count = await db.hotActivity.count();
      if (count >= HOT_ACTIVITY_MAX) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `热门活动最多 ${HOT_ACTIVITY_MAX} 条，请先移除多余条目` });
      }
      const row = await db.hotActivity.create({
        data: {
          isExternal: true,
          externalUrl: input.externalUrl,
          title: input.title,
          coverUrl: input.coverUrl?.length ? input.coverUrl : null,
          sortOrder: await nextSortOrder(),
        },
        select: { id: true },
      });
      return { id: row.id };
    }),

  /** 调整顺序：传入按新顺序排列的完整 id 列表 */
  reorder: adminProcedure
    .input(z.object({ ids: z.array(z.string().min(1)).min(1).max(HOT_ACTIVITY_MAX) }))
    .mutation(async ({ input }) => {
      const rows = await db.hotActivity.findMany({ select: { id: true } });
      const owned = new Set(rows.map((row) => row.id));
      if (input.ids.some((id) => !owned.has(id))) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "热门池条目已变化，请刷新后重试" });
      }
      await db.$transaction(
        input.ids.map((id, index) =>
          db.hotActivity.update({ where: { id }, data: { sortOrder: index + 1 } }),
        ),
      );
      return { ok: true };
    }),

  remove: adminProcedure.input(z.object({ id: z.string().min(1) })).mutation(async ({ input }) => {
    const exists = await db.hotActivity.findUnique({ where: { id: input.id }, select: { id: true } });
    if (!exists) throw new TRPCError({ code: "NOT_FOUND", message: "热门池条目不存在" });
    await db.hotActivity.delete({ where: { id: input.id } });
    return { ok: true };
  }),
});
