import { TRPCError } from "@trpc/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  ACTIVITY_PAGE_SIZE,
  ACTIVITY_SOURCE_FILTERS,
  ACTIVITY_SOURCES,
  ACTIVITY_TAG_FILTERS,
  ACTIVITY_TIME_FILTERS,
  ACTIVITY_TYPE_FILTERS,
  ACTIVITY_TYPES,
  isStaffRole,
} from "@/lib/constants";
import { getUserMap } from "@/server/api/shared";
import { createTRPCRouter, publicProcedure, staffProcedure } from "@/server/api/trpc";
import { db } from "@/server/db";
import { capacityView, normalizeCapacity } from "@/lib/rules/capacity";
import { normalizeSubmissionDeadline } from "@/lib/rules/validation";

export const ACTIVITY_SELECT = {
  id: true,
  title: true,
  type: true,
  source: true,
  organizer: true,
  startAt: true,
  endAt: true,
  registrationDeadline: true,
  location: true,
  capacity: true,
  isUnlimited: true,
  submissionDeadline: true,
  showcaseEnabled: true,
  registrationMode: true,
  externalUrl: true,
  summary: true,
  description: true,
  coverUrl: true,
  tags: true,
  creditPoints: true,
  publisherContact: true,
  qqGroup: true,
  targetCollege: true,
  targetGrade: true,
  targetMajor: true,
  targetClass: true,
  status: true,
  reviewNote: true,
  createdBy: true,
  createdAt: true,
} satisfies Prisma.ActivitySelect;

/** 活动开始 / 结束的惰性流转；30 秒节流，避免每次列表请求都写库 */
let lastStatusSync = 0;
export async function syncActivityStatus(force = false) {
  const now = Date.now();
  if (!force && now - lastStatusSync < 30_000) return;
  lastStatusSync = now;
  const current = new Date(now);
  await db.activity.updateMany({
    where: { status: "PUBLISHED", startAt: { lte: current } },
    data: { status: "ONGOING" },
  });
  await db.activity.updateMany({
    where: { status: { in: ["PUBLISHED", "ONGOING"] }, endAt: { lte: current } },
    data: { status: "ENDED" },
  });
}

export function parseActivityTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((tag): tag is string => typeof tag === "string");
  } catch {
    return [];
  }
}

/** 已占用名额 = PENDING + APPROVED 报名数（全文唯一口径） */
export async function occupiedMap(ids: string[]) {
  if (ids.length === 0) return new Map<string, number>();
  const rows = await db.registration.groupBy({
    by: ["activityId"],
    where: { activityId: { in: ids }, status: { in: ["PENDING", "APPROVED"] } },
    _count: { _all: true },
  });
  return new Map(rows.map((row) => [row.activityId, row._count._all]));
}

const activityPayload = {
  title: z.string().trim().min(2, "活动标题至少 2 个字").max(60, "标题最多 60 个字符"),
  type: z.enum(ACTIVITY_TYPES, { message: "请选择活动类型" }),
  source: z.enum(ACTIVITY_SOURCES, { message: "请选择活动来源" }),
  organizer: z.string().trim().min(2, "请填写主办方").max(40, "主办方最多 40 个字符"),
  startAt: z.string().min(1, "请选择开始时间"),
  endAt: z.string().min(1, "请选择结束时间"),
  registrationDeadline: z.string().min(1, "请选择报名截止时间"),
  location: z.string().trim().min(2, "请填写活动地点").max(60, "地点最多 60 个字符"),
  capacity: z.number().int().min(0, "名额不能为负数").max(2000, "名额最多 2000 人"),
  /** V8：无限名额；勾选后 capacity 仅作占位 */
  isUnlimited: z.boolean().default(false),
  /** V8：作品提交截止时间，缺省回落到活动结束时间 */
  submissionDeadline: z.string().optional(),
  /** V8：是否开启作品展示专区；竞赛类默认开启 */
  showcaseEnabled: z.boolean().optional(),
  registrationMode: z.enum(["INTERNAL", "EXTERNAL", "BOTH"]),
  externalUrl: z
    .string()
    .trim()
    .max(500)
    .refine((value) => !value || /^https?:\/\//i.test(value), "报名链接需以 http(s) 开头")
    .optional(),
  summary: z.string().trim().max(500, "简介最多 500 个字符").optional(),
  description: z.string().trim().max(5000, "详情最多 5000 个字符").optional(),
  coverUrl: z
    .string()
    .trim()
    .max(500)
    .refine((value) => !value || /^https?:\/\//i.test(value), "封面链接需以 http(s) 开头")
    .optional(),
  tags: z.array(z.enum(["CREDIT", "HOURS", "PRIZE", "AUDIT", "MEAL"])).max(5).default([]),
  creditPoints: z.number().min(0, "学分不能为负数").max(20, "学分最多 20").nullable().optional(),
  publisherContact: z.string().trim().max(60, "联系方式最多 60 个字符").optional(),
  qqGroup: z
    .string()
    .trim()
    .max(20)
    .refine((value) => !value || /^\d{5,15}$/.test(value), "QQ 群号需为 5-15 位数字")
    .optional(),
  targetCollege: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  targetGrade: z.array(z.string().trim().min(1).max(20)).max(10).default([]),
  targetMajor: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  targetClass: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
};

function parseDate(value: string, label: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `${label}格式不正确` });
  }
  return date;
}

export const activityRouter = createTRPCRouter({
  /** 活动广场：只返回公开状态；已结束单独排序，不混在即将开始之前 */
  list: publicProcedure
    .input(
      z.object({
        keyword: z.string().trim().max(40).optional(),
        type: z.enum(ACTIVITY_TYPE_FILTERS).default("ALL"),
        source: z.enum(ACTIVITY_SOURCE_FILTERS).default("ALL"),
        tag: z.enum(ACTIVITY_TAG_FILTERS).default("ALL"),
        time: z.enum(ACTIVITY_TIME_FILTERS).default("ALL"),
        page: z.number().int().min(1).max(500).default(1),
        pageSize: z.number().int().min(1).max(20).default(ACTIVITY_PAGE_SIZE),
      }),
    )
    .query(async ({ input }) => {
      await syncActivityStatus();

      const now = new Date();
      const base: Prisma.ActivityWhereInput = {};
      if (input.type !== "ALL") base.type = input.type;
      if (input.source !== "ALL") base.source = input.source;
      if (input.tag !== "ALL") base.tags = { contains: `"${input.tag}"` };
      if (input.keyword) {
        base.OR = [
          { title: { contains: input.keyword } },
          { organizer: { contains: input.keyword } },
          { location: { contains: input.keyword } },
        ];
      }
      if (input.time === "TODAY") {
        const dayStart = new Date(now);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        base.startAt = { gte: dayStart, lt: dayEnd };
      } else if (input.time === "WEEK") {
        base.startAt = { gte: now, lt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) };
      } else if (input.time === "CLOSING") {
        base.registrationDeadline = { gte: now, lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) };
      }

      const activeWhere: Prisma.ActivityWhereInput = {
        ...base,
        status: { in: ["PUBLISHED", "ONGOING"] },
      };
      const endedWhere: Prisma.ActivityWhereInput = { ...base, status: "ENDED" };
      const includeEnded = input.time === "ALL";

      const offset = (input.page - 1) * input.pageSize;
      const [activeCount, endedCount] = await Promise.all([
        db.activity.count({ where: activeWhere }),
        includeEnded ? db.activity.count({ where: endedWhere }) : Promise.resolve(0),
      ]);
      const total = activeCount + endedCount;

      let records: Awaited<ReturnType<typeof db.activity.findMany<{ select: typeof ACTIVITY_SELECT }>>> = [];
      if (offset < activeCount) {
        records = await db.activity.findMany({
          where: activeWhere,
          select: ACTIVITY_SELECT,
          orderBy: { startAt: "asc" },
          skip: offset,
          take: input.pageSize,
        });
        if (records.length < input.pageSize && includeEnded) {
          const extra = await db.activity.findMany({
            where: endedWhere,
            select: ACTIVITY_SELECT,
            orderBy: { startAt: "desc" },
            take: input.pageSize - records.length,
          });
          records = records.concat(extra);
        }
      } else if (includeEnded) {
        records = await db.activity.findMany({
          where: endedWhere,
          select: ACTIVITY_SELECT,
          orderBy: { startAt: "desc" },
          skip: offset - activeCount,
          take: input.pageSize,
        });
      }

      const [users, occupied] = await Promise.all([
        getUserMap(db, records.map((record) => record.createdBy)),
        occupiedMap(records.map((record) => record.id)),
      ]);

      return {
        items: records.map((record) => {
          const used = occupied.get(record.id) ?? 0;
          const view = capacityView({
            capacity: record.capacity,
            isUnlimited: record.isUnlimited,
            occupied: used,
          });
          return {
            ...record,
            tags: parseActivityTags(record.tags),
            occupied: used,
            remaining: view.remaining,
            capacityView: view,
            creatorName: users.get(record.createdBy)?.name ?? "活动事务处",
          };
        }),
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
      };
    }),

  byId: publicProcedure.input(z.object({ id: z.string().min(1) })).query(async ({ ctx, input }) => {
    await syncActivityStatus();
    const activity = await db.activity.findUnique({
      where: { id: input.id },
      select: { ...ACTIVITY_SELECT, reviewedAt: true },
    });
    if (!activity) throw new TRPCError({ code: "NOT_FOUND", message: "活动不存在或已被删除" });

    const staff = isStaffRole(ctx.user.role);
    const isOwner = activity.createdBy === ctx.userId;
    const isPublic = ["PUBLISHED", "ONGOING", "ENDED", "CANCELLED"].includes(activity.status);
    if (!isPublic && !isOwner && !staff) {
      throw new TRPCError({ code: "NOT_FOUND", message: "该活动尚未通过审核，暂时无法查看" });
    }

    const [occupied, mine, messageCount, creator, workCount, myWork] = await Promise.all([
      db.registration.count({
        where: { activityId: activity.id, status: { in: ["PENDING", "APPROVED"] } },
      }),
      db.registration.findUnique({
        where: { userId_activityId: { userId: ctx.userId, activityId: activity.id } },
        select: { status: true, createdAt: true },
      }),
      db.activityMessage.count({ where: { activityId: activity.id } }),
      db.user.findUnique({ where: { id: activity.createdBy }, select: { name: true, college: true } }),
      db.showcaseWork.count({ where: { activityId: activity.id, status: "APPROVED" } }),
      db.showcaseWork.findUnique({
        where: { activityId_createdBy: { activityId: activity.id, createdBy: ctx.userId } },
        select: { id: true, status: true, title: true },
      }),
    ]);

    const view = capacityView({
      capacity: activity.capacity,
      isUnlimited: activity.isUnlimited,
      occupied,
    });

    return {
      ...activity,
      tags: parseActivityTags(activity.tags),
      occupied,
      remaining: view.remaining,
      capacityView: view,
      myRegistration: mine?.status ?? null,
      myRegistrationAt: mine?.createdAt ?? null,
      messageCount,
      workCount,
      myWork,
      creatorName: creator?.name ?? "活动事务处",
      creatorCollege: creator?.college ?? "",
      isOwner,
      isStaff: staff,
    };
  }),

  /** 教师直接发布为 PUBLISHED；学生 / 社团提交进入 PENDING，来源强制为社团活动 */
  create: publicProcedure.input(z.object(activityPayload)).mutation(async ({ ctx, input }) => {
    const staff = isStaffRole(ctx.user.role);
    const startAt = parseDate(input.startAt, "开始时间");
    const endAt = parseDate(input.endAt, "结束时间");
    const deadline = parseDate(input.registrationDeadline, "报名截止时间");
    if (endAt.getTime() <= startAt.getTime()) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "结束时间必须晚于开始时间" });
    }
    if (deadline.getTime() > startAt.getTime()) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "报名截止时间不能晚于活动开始时间" });
    }
    if (startAt.getTime() < Date.now() - 60_000) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "活动开始时间不能早于当前时间" });
    }
    if (input.registrationMode !== "INTERNAL" && !input.externalUrl) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "外链或双通道报名需填写报名链接" });
    }
    if (!input.isUnlimited && input.capacity < 1) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "名额至少 1 人，或勾选「无限」" });
    }
    const showcaseEnabled = input.showcaseEnabled ?? input.type === "COMPETITION";
    const submissionDeadline = input.submissionDeadline?.trim()
      ? normalizeSubmissionDeadline(input.submissionDeadline, null)
      : showcaseEnabled
        ? endAt
        : null;
    if (submissionDeadline && submissionDeadline.getTime() > endAt.getTime()) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "作品提交截止时间不能晚于活动结束时间" });
    }

    const duplicate = await db.activity.findFirst({
      where: {
        createdBy: ctx.userId,
        title: input.title,
        startAt,
        createdAt: { gte: new Date(Date.now() - 10_000) },
      },
      select: { id: true, status: true },
    });
    if (duplicate) return duplicate;

    return db.activity.create({
      data: {
        title: input.title,
        type: input.type,
        source: staff ? input.source : "CLUB",
        organizer: input.organizer,
        startAt,
        endAt,
        registrationDeadline: deadline,
        location: input.location,
        capacity: normalizeCapacity(input.capacity, input.isUnlimited),
        isUnlimited: input.isUnlimited,
        submissionDeadline,
        showcaseEnabled,
        registrationMode: input.registrationMode,
        externalUrl: input.externalUrl?.length ? input.externalUrl : null,
        summary: input.summary?.length ? input.summary : null,
        description: input.description?.length ? input.description : null,
        coverUrl: input.coverUrl?.length ? input.coverUrl : null,
        tags: JSON.stringify(input.tags),
        creditPoints: input.creditPoints ?? null,
        publisherContact: input.publisherContact?.length ? input.publisherContact : null,
        qqGroup: input.qqGroup?.length ? input.qqGroup : null,
        targetCollege: JSON.stringify(input.targetCollege),
        targetGrade: JSON.stringify(input.targetGrade),
        targetMajor: JSON.stringify(input.targetMajor),
        targetClass: JSON.stringify(input.targetClass),
        status: staff ? "PUBLISHED" : "PENDING",
        createdBy: ctx.userId,
      },
      select: { id: true, status: true },
    });
  }),

  /** 取消活动：发布者或教师，报名联动取消 */
  cancel: publicProcedure.input(z.object({ id: z.string().min(1) })).mutation(async ({ ctx, input }) => {
    const activity = await db.activity.findUnique({
      where: { id: input.id },
      select: { id: true, createdBy: true, status: true, title: true },
    });
    if (!activity) throw new TRPCError({ code: "NOT_FOUND", message: "活动不存在" });
    const staff = isStaffRole(ctx.user.role);
    if (activity.createdBy !== ctx.userId && !staff) {
      throw new TRPCError({ code: "FORBIDDEN", message: "只能取消自己发布的活动" });
    }
    if (activity.status === "CANCELLED") return { status: "CANCELLED" as const };
    if (!["PUBLISHED", "ONGOING"].includes(activity.status)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "只有报名中或进行中的活动可以取消" });
    }

    await db.$transaction([
      db.activity.update({ where: { id: activity.id }, data: { status: "CANCELLED" } }),
      db.registration.updateMany({
        where: { activityId: activity.id, status: { in: ["PENDING", "APPROVED"] } },
        data: { status: "CANCELLED" },
      }),
      db.adminLog.create({
        data: { adminUserId: ctx.userId, action: "CANCEL_ACTIVITY", targetId: activity.id },
      }),
    ]);
    return { status: "CANCELLED" as const };
  }),

  /** 教师审核：PENDING → PUBLISHED / REJECTED，驳回必填原因并写审计 */
  review: staffProcedure
    .input(
      z.object({
        id: z.string().min(1),
        action: z.enum(["PUBLISHED", "REJECTED"]),
        note: z.string().trim().max(200, "审核备注最多 200 个字符").optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const activity = await db.activity.findUnique({
        where: { id: input.id },
        select: { id: true, status: true, title: true, createdBy: true },
      });
      if (!activity) throw new TRPCError({ code: "NOT_FOUND", message: "活动不存在" });
      if (activity.status !== "PENDING") {
        if (activity.status === input.action) return { status: activity.status };
        throw new TRPCError({ code: "BAD_REQUEST", message: "该活动已审核，不能重复处理" });
      }
      if (input.action === "REJECTED" && (input.note?.length ?? 0) < 5) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "驳回原因至少 5 个字，便于提交者修改" });
      }

      await db.$transaction([
        db.activity.update({
          where: { id: activity.id },
          data: {
            status: input.action,
            reviewNote: input.note?.length ? input.note : null,
            reviewedBy: ctx.userId,
            reviewedAt: new Date(),
          },
        }),
        db.userNotification.create({
          data: {
            userId: activity.createdBy,
            type: "REVIEW",
            title:
              input.action === "PUBLISHED"
                ? `【活动通过】${activity.title}`
                : `【活动驳回】${activity.title}`,
            content:
              input.action === "PUBLISHED"
                ? `你提交的活动「${activity.title}」已通过审核，现已在活动广场开放报名。`
                : `你提交的活动「${activity.title}」未通过审核。驳回原因：${input.note ?? ""}。请修改后重新提交。`,
            link: `/activities/${activity.id}`,
          },
        }),
        db.adminLog.create({
          data: {
            adminUserId: ctx.userId,
            action: input.action === "PUBLISHED" ? "APPROVE_ACTIVITY" : "REJECT_ACTIVITY",
            targetId: activity.id,
          },
        }),
      ]);
      return { status: input.action };
    }),

  /** 教师管理端：审核队列 */
  adminList: staffProcedure
    .input(
      z.object({
        status: z.enum(["PENDING", "PUBLISHED", "REJECTED", "ALL"]).default("PENDING"),
        page: z.number().int().min(1).max(500).default(1),
        pageSize: z.number().int().min(1).max(50).default(10),
      }),
    )
    .query(async ({ input }) => {
      await syncActivityStatus();
      const where: Prisma.ActivityWhereInput =
        input.status === "ALL" ? {} : { status: input.status };
      const [records, total] = await db.$transaction([
        db.activity.findMany({
          where,
          select: ACTIVITY_SELECT,
          orderBy: [{ status: "asc" }, { createdAt: "desc" }],
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        db.activity.count({ where }),
      ]);
      const users = await getUserMap(db, records.map((record) => record.createdBy));
      return {
        items: records.map((record) => ({
          ...record,
          tags: parseActivityTags(record.tags),
          creatorName: users.get(record.createdBy)?.name ?? "匿名同学",
        })),
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
      };
    }),

  pendingCount: staffProcedure.query(async () => {
    const count = await db.activity.count({ where: { status: "PENDING" } });
    return { count };
  }),

  /** 首页 / 通知聚合：今日与近期活动 */
  upcoming: publicProcedure
    .input(z.object({ take: z.number().int().min(1).max(6).default(3) }))
    .query(async ({ input }) => {
      await syncActivityStatus();
      const now = new Date();
      const records = await db.activity.findMany({
        where: { status: { in: ["PUBLISHED", "ONGOING"] }, startAt: { gte: now } },
        select: ACTIVITY_SELECT,
        orderBy: { startAt: "asc" },
        take: input.take,
      });
      const occupied = await occupiedMap(records.map((record) => record.id));
      return records.map((record) => {
        const used = occupied.get(record.id) ?? 0;
        const view = capacityView({
          capacity: record.capacity,
          isUnlimited: record.isUnlimited,
          occupied: used,
        });
        return {
          ...record,
          tags: parseActivityTags(record.tags),
          occupied: used,
          remaining: view.remaining,
          capacityView: view,
        };
      });
    }),

  /**
   * 「为你推荐」：纯后端标签规则，不调用任何大模型。
   * 未认证学生直接返回 needsAuth，前端提示完成身份认证；
   * 已认证用户按学院 / 年级 / 专业 / 班级逐项匹配（空数组 = 不限），
   * 命中维度越多排序越靠前。
   */
  recommended: publicProcedure
    .input(z.object({ take: z.number().int().min(1).max(8).default(6) }))
    .query(async ({ ctx, input }) => {
      await syncActivityStatus();
      if (ctx.user.role === "USER" && ctx.user.authStatus !== "AUTHED") {
        return { needsAuth: true, items: [] as never[], matched: 0 };
      }

      const records = await db.activity.findMany({
        where: { status: "PUBLISHED", startAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        select: ACTIVITY_SELECT,
        orderBy: { startAt: "asc" },
        take: 40,
      });

      const scored = records
        .map((record) => ({ record, score: audienceScore(record, ctx.user) }))
        .filter((entry) => entry.score >= 0)
        .sort((a, b) => b.score - a.score || a.record.startAt.getTime() - b.record.startAt.getTime());

      const selected = scored.slice(0, input.take).map((entry) => entry.record);
      const occupied = await occupiedMap(selected.map((record) => record.id));

      return {
        needsAuth: false,
        matched: scored.length,
        items: selected.map((record) => {
          const used = occupied.get(record.id) ?? 0;
          const view = capacityView({
            capacity: record.capacity,
            isUnlimited: record.isUnlimited,
            occupied: used,
          });
          return {
            ...record,
            tags: parseActivityTags(record.tags),
            targetCollege: parseActivityTags(record.targetCollege),
            targetGrade: parseActivityTags(record.targetGrade),
            targetMajor: parseActivityTags(record.targetMajor),
            targetClass: parseActivityTags(record.targetClass),
            occupied: used,
            remaining: view.remaining,
            capacityView: view,
          };
        }),
      };
    }),
});

/**
 * 受众匹配得分：返回 -1 表示不匹配；0 表示面向全部学生；>0 为命中的定向维度数量。
 * 规则与行政通知一致：已填写的维度必须全部与用户身份一致。
 */
function audienceScore(
  record: {
    targetCollege: string;
    targetGrade: string;
    targetMajor: string;
    targetClass: string;
  },
  user: { college: string | null; grade: string | null; major: string | null; className: string | null },
) {
  const dims = [
    { values: parseActivityTags(record.targetCollege), mine: user.college },
    { values: parseActivityTags(record.targetGrade), mine: user.grade },
    { values: parseActivityTags(record.targetMajor), mine: user.major },
    { values: parseActivityTags(record.targetClass), mine: user.className },
  ];
  let score = 0;
  for (const dim of dims) {
    if (dim.values.length === 0) continue;
    if (!dim.mine || !dim.values.includes(dim.mine)) return -1;
    score += 1;
  }
  return score;
}
