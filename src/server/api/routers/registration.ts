import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { REGISTRATION_CANCEL_HOURS, REGISTRATION_MAX_ACTIVE } from "@/lib/constants";
import { parseActivityTags, syncActivityStatus } from "@/server/api/routers/activity";
import { getUserMap } from "@/server/api/shared";
import { createTRPCRouter, publicProcedure, staffProcedure } from "@/server/api/trpc";
import { db } from "@/server/db";

const ACTIVE_STATUSES = ["PENDING", "APPROVED"] as const;

/** 名单脱敏：只保留姓氏首字，其余用星号替代 */
function maskName(name: string) {
  if (!name) return "匿名";
  return `${name.slice(0, 1)}${"*".repeat(Math.max(1, name.length - 1))}`;
}

export const registrationRouter = createTRPCRouter({
  /** 报名：事务内复核名额，已满直接失败；重复报名幂等返回已有记录 */
  create: publicProcedure
    .input(z.object({ activityId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await syncActivityStatus(true);

      return db.$transaction(async (tx) => {
        const activity = await tx.activity.findUnique({
          where: { id: input.activityId },
          select: {
            id: true,
            createdBy: true,
            status: true,
            capacity: true,
            isUnlimited: true,
            registrationMode: true,
            registrationDeadline: true,
            startAt: true,
            tags: true,
          },
        });
        if (!activity) {
          throw new TRPCError({ code: "NOT_FOUND", message: "活动不存在或已被删除" });
        }
        if (activity.createdBy === ctx.userId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "不能报名自己发布的活动" });
        }
        if (activity.registrationMode === "EXTERNAL") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "该活动采用外链报名，请前往主办方页面完成报名",
          });
        }
        if (activity.status === "CANCELLED") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "活动已取消，无法报名" });
        }
        if (activity.status !== "PUBLISHED") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: activity.status === "ONGOING" ? "活动已开始，无法报名" : "活动当前不接受报名",
          });
        }
        const now = Date.now();
        if (now > activity.registrationDeadline.getTime()) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "报名已截止" });
        }
        if (now >= activity.startAt.getTime()) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "活动已开始，无法报名" });
        }

        const existing = await tx.registration.findUnique({
          where: { userId_activityId: { userId: ctx.userId, activityId: activity.id } },
        });
        if (existing && (ACTIVE_STATUSES as readonly string[]).includes(existing.status)) {
          return { id: existing.id, status: existing.status, created: false };
        }

        const activeCount = await tx.registration.count({
          where: { userId: ctx.userId, status: { in: [...ACTIVE_STATUSES] } },
        });
        if (activeCount >= REGISTRATION_MAX_ACTIVE) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `同时报名的活动不能超过 ${REGISTRATION_MAX_ACTIVE} 场，请先取消部分报名`,
          });
        }

        const occupied = await tx.registration.count({
          where: { activityId: activity.id, status: { in: [...ACTIVE_STATUSES] } },
        });
        if (!activity.isUnlimited && occupied >= activity.capacity) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "名额已满" });
        }

        const nextStatus = parseActivityTags(activity.tags).includes("AUDIT") ? "PENDING" : "APPROVED";
        if (existing) {
          const updated = await tx.registration.update({
            where: { id: existing.id },
            data: { status: nextStatus },
            select: { id: true, status: true },
          });
          return { ...updated, created: true };
        }
        const created = await tx.registration.create({
          data: { activityId: activity.id, userId: ctx.userId, status: nextStatus },
          select: { id: true, status: true },
        });
        return { ...created, created: true };
      });
    }),

  /** 取消报名：活动开始前 2 小时内不可取消；取消即释放名额 */
  cancel: publicProcedure
    .input(z.object({ activityId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await syncActivityStatus(true);
      const registration = await db.registration.findUnique({
        where: { userId_activityId: { userId: ctx.userId, activityId: input.activityId } },
        select: { id: true, status: true },
      });
      if (!registration || !(ACTIVE_STATUSES as readonly string[]).includes(registration.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "当前没有可取消的报名" });
      }
      const activity = await db.activity.findUnique({
        where: { id: input.activityId },
        select: { startAt: true, status: true },
      });
      if (!activity) throw new TRPCError({ code: "NOT_FOUND", message: "活动不存在" });

      if (activity.status !== "CANCELLED") {
        const hoursLeft = (activity.startAt.getTime() - Date.now()) / 3_600_000;
        if (hoursLeft < REGISTRATION_CANCEL_HOURS) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `活动开始前 ${REGISTRATION_CANCEL_HOURS} 小时内不能取消报名`,
          });
        }
      }

      await db.registration.update({
        where: { id: registration.id },
        data: { status: "CANCELLED" },
      });
      return { status: "CANCELLED" as const };
    }),

  /** 我的活动：全部 / 待审核 / 已报名 / 已取消 / 已结束 */
  mine: publicProcedure
    .input(
      z.object({
        tab: z.enum(["ALL", "PENDING", "APPROVED", "CANCELLED", "ENDED"]).default("ALL"),
        page: z.number().int().min(1).max(500).default(1),
        pageSize: z.number().int().min(1).max(50).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      await syncActivityStatus();

      const where = (
        input.tab === "ENDED"
          ? { userId: ctx.userId, activity: { status: "ENDED" } }
          : input.tab === "ALL"
            ? { userId: ctx.userId }
            : { userId: ctx.userId, status: input.tab }
      ) as {
        userId: string;
        status?: string;
        activity?: { status: string };
      };

      const [records, total] = await db.$transaction([
        db.registration.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          select: {
            id: true,
            status: true,
            createdAt: true,
            activity: {
              select: {
                id: true,
                title: true,
                type: true,
                source: true,
                organizer: true,
                startAt: true,
                endAt: true,
                location: true,
                capacity: true,
                status: true,
                coverUrl: true,
                tags: true,
              },
            },
          },
        }),
        db.registration.count({ where }),
      ]);

      const [statusRows, endedCount] = await Promise.all([
        db.registration.groupBy({
          by: ["status"],
          where: { userId: ctx.userId },
          _count: { _all: true },
        }),
        db.registration.count({ where: { userId: ctx.userId, activity: { status: "ENDED" } } }),
      ]);

      const counts = {
        ALL: statusRows.reduce((sum, row) => sum + row._count._all, 0),
        PENDING: statusRows.find((row) => row.status === "PENDING")?._count._all ?? 0,
        APPROVED: statusRows.find((row) => row.status === "APPROVED")?._count._all ?? 0,
        CANCELLED: statusRows.find((row) => row.status === "CANCELLED")?._count._all ?? 0,
        ENDED: endedCount,
      };

      return {
        items: records.map((record) => ({
          ...record,
          activity: { ...record.activity, tags: parseActivityTags(record.activity.tags) },
        })),
        counts,
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
      };
    }),

  /** 报名名单：仅教师 / 管理员；姓名脱敏 + 学院分布 */
  roster: staffProcedure
    .input(z.object({ activityId: z.string().min(1) }))
    .query(async ({ input }) => {
      await syncActivityStatus(true);
      const activity = await db.activity.findUnique({
        where: { id: input.activityId },
        select: { id: true, title: true, capacity: true, isUnlimited: true, status: true, startAt: true },
      });
      if (!activity) throw new TRPCError({ code: "NOT_FOUND", message: "活动不存在" });

      const registrations = await db.registration.findMany({
        where: { activityId: activity.id, status: { in: [...ACTIVE_STATUSES] } },
        orderBy: { createdAt: "asc" },
        select: { id: true, userId: true, status: true, createdAt: true },
      });
      const users = await getUserMap(db, registrations.map((row) => row.userId));

      const collegeCounts = new Map<string, number>();
      const items = registrations.map((row) => {
        const user = users.get(row.userId);
        const college = user?.campus || "未填写学院";
        const shortCollege = college.split("·")[0]?.trim() || college;
        collegeCounts.set(shortCollege, (collegeCounts.get(shortCollege) ?? 0) + 1);
        return {
          id: row.id,
          name: maskName(user?.name ?? "匿名"),
          college: shortCollege,
          status: row.status,
          createdAt: row.createdAt,
        };
      });

      return {
        activity,
        items,
        total: items.length,
        remaining: activity.isUnlimited ? null : Math.max(activity.capacity - items.length, 0),
        colleges: Array.from(collegeCounts.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count),
      };
    }),
});
