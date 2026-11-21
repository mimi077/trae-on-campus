import { TRPCError } from "@trpc/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  GENERAL_PAGE_SIZE,
  LOST_FOUND_CATEGORY_FILTERS,
  LOST_FOUND_CATEGORIES,
  LOST_FOUND_KIND_FILTERS,
  LOST_FOUND_KINDS,
  LOST_FOUND_STATUS_FILTERS,
  LOST_FOUND_STATUSES,
  PAGE_SIZE,
} from "@/lib/constants";
import { createTRPCRouter, publicProcedure, staffProcedure } from "@/server/api/trpc";
import { getUserMap } from "@/server/api/shared";
import { db } from "@/server/db";

/**
 * 失物招领主线闭环：
 * 学生发布寻物 / 拾物信息 → 状态 PENDING → 管理员审核 → 列表展示 + 关键词筛选
 * → 查看详情 → 留言联系。
 * 未通过审核的信息只有发布者与管理员可见，绝不进入公开列表。
 */
const RECORD_SELECT = {
  id: true,
  kind: true,
  title: true,
  category: true,
  location: true,
  happenedAt: true,
  description: true,
  imageUrl: true,
  status: true,
  reviewNote: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.LostFoundSelect;

const timeInput = z
  .string()
  .min(1, "请选择物品丢失 / 捡到的时间")
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "时间格式不正确");

const lostFoundPayload = {
  kind: z.enum(LOST_FOUND_KINDS, { message: "请选择信息类型" }),
  title: z.string().trim().min(2, "标题至少 2 个字").max(60, "标题最多 60 个字符"),
  category: z.enum(LOST_FOUND_CATEGORIES, { message: "请选择物品分类" }),
  location: z.string().trim().min(2, "请填写具体地点").max(60, "地点最多 60 个字符"),
  happenedAt: timeInput,
  description: z.string().trim().max(500, "描述最多 500 个字符").optional(),
  imageUrl: z
    .string()
    .trim()
    .max(500, "图片链接最多 500 个字符")
    .refine((value) => !value || /^https?:\/\//i.test(value), "图片链接需以 http(s) 开头")
    .optional(),
  contact: z.string().trim().max(60, "联系方式最多 60 个字符").optional(),
};

/** 批量统计留言数量，避免列表逐项查询 */
async function countMessages(ids: string[]) {
  if (ids.length === 0) return new Map<string, number>();
  const rows = await db.lostFoundMessage.groupBy({
    by: ["recordId"],
    where: { recordId: { in: ids } },
    _count: { _all: true },
  });
  return new Map(rows.map((row) => [row.recordId, row._count._all]));
}

/** 详情 / 留言的可见性：已通过公开；未通过仅发布者与管理员可见 */
async function loadRecordOrThrow(id: string, userId: string, isAdmin: boolean) {
  const record = await db.lostFound.findUnique({
    where: { id },
    select: { ...RECORD_SELECT, contact: true },
  });
  if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "该失物信息不存在或已被删除" });
  const isOwner = record.userId === userId;
  if (record.status !== "APPROVED" && !isOwner && !isAdmin) {
    throw new TRPCError({ code: "NOT_FOUND", message: "该信息尚未通过审核，暂时无法查看" });
  }
  return { record, isOwner, isAdmin };
}

export const lostFoundRouter = createTRPCRouter({
  /** 公开列表：只返回审核通过的信息，支持类型 / 分类 / 关键词筛选 */
  list: publicProcedure
    .input(
      z.object({
        keyword: z.string().trim().max(40).optional(),
        kind: z.enum(LOST_FOUND_KIND_FILTERS).default("ALL"),
        category: z.enum(LOST_FOUND_CATEGORY_FILTERS).default("ALL"),
        page: z.number().int().min(1).max(1000).default(1),
        pageSize: z.number().int().min(1).max(24).default(PAGE_SIZE),
      }),
    )
    .query(async ({ input }) => {
      const where: Prisma.LostFoundWhereInput = { status: "APPROVED" };
      if (input.kind !== "ALL") where.kind = input.kind;
      if (input.category !== "ALL") where.category = input.category;
      if (input.keyword) {
        where.OR = [
          { title: { contains: input.keyword } },
          { description: { contains: input.keyword } },
          { location: { contains: input.keyword } },
        ];
      }

      const [records, total] = await db.$transaction([
        db.lostFound.findMany({
          where,
          select: RECORD_SELECT,
          orderBy: [{ happenedAt: "desc" }, { createdAt: "desc" }],
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        db.lostFound.count({ where }),
      ]);

      const [users, messageCounts] = await Promise.all([
        getUserMap(db, records.map((record) => record.userId)),
        countMessages(records.map((record) => record.id)),
      ]);

      return {
        items: records.map((record) => ({
          ...record,
          userName: users.get(record.userId)?.name ?? "匿名同学",
          messageCount: messageCounts.get(record.id) ?? 0,
        })),
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
      };
    }),

  byId: publicProcedure.input(z.object({ id: z.string().min(1) })).query(async ({ ctx, input }) => {
    const { record, isOwner, isAdmin } = await loadRecordOrThrow(
      input.id,
      ctx.userId,
      ctx.user.role === "ADMIN",
    );
    const owner = await db.user.findUnique({
      where: { id: record.userId },
      select: { name: true, campus: true },
    });
    const messageCount = await db.lostFoundMessage.count({ where: { recordId: record.id } });
    return {
      ...record,
      userName: owner?.name ?? "匿名同学",
      userCampus: owner?.campus ?? "",
      isOwner,
      isAdmin,
      messageCount,
    };
  }),

  /** 发布：一律先进入待审核，避免违规信息直接出现在公开列表 */
  create: publicProcedure.input(z.object(lostFoundPayload)).mutation(async ({ ctx, input }) => {
    const happenedAt = new Date(input.happenedAt);
    if (happenedAt.getTime() > Date.now() + 60_000) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "丢失 / 捡到的时间不能晚于当前时间" });
    }

    const duplicate = await db.lostFound.findFirst({
      where: {
        userId: ctx.userId,
        kind: input.kind,
        title: input.title,
        location: input.location,
        createdAt: { gte: new Date(Date.now() - 10_000) },
      },
      select: { id: true, status: true },
    });
    if (duplicate) return duplicate;

    return db.lostFound.create({
      data: {
        kind: input.kind,
        title: input.title,
        category: input.category,
        location: input.location,
        happenedAt,
        description: input.description?.length ? input.description : null,
        imageUrl: input.imageUrl?.length ? input.imageUrl : null,
        contact: input.contact?.length ? input.contact : null,
        status: "PENDING",
        userId: ctx.userId,
      },
      select: { id: true, status: true },
    });
  }),

  myList: publicProcedure
    .input(
      z.object({
        status: z.enum(LOST_FOUND_STATUS_FILTERS).default("ALL"),
        page: z.number().int().min(1).max(1000).default(1),
        pageSize: z.number().int().min(1).max(50).default(GENERAL_PAGE_SIZE),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where: Prisma.LostFoundWhereInput = { userId: ctx.userId };
      if (input.status !== "ALL") where.status = input.status;

      const [records, total] = await db.$transaction([
        db.lostFound.findMany({
          where,
          select: RECORD_SELECT,
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        db.lostFound.count({ where }),
      ]);
      const messageCounts = await countMessages(records.map((record) => record.id));
      const counts = await db.lostFound.groupBy({
        by: ["status"],
        where: { userId: ctx.userId },
        _count: { _all: true },
      });
      const statusCounts = Object.fromEntries(
        LOST_FOUND_STATUSES.map((status) => [
          status,
          counts.find((row) => row.status === status)?._count._all ?? 0,
        ]),
      ) as Record<(typeof LOST_FOUND_STATUSES)[number], number>;

      return {
        items: records.map((record) => ({
          ...record,
          messageCount: messageCounts.get(record.id) ?? 0,
        })),
        statusCounts,
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
      };
    }),

  /** 结束信息：仅发布者，已通过审核的信息可标记为已找到 / 已归还 */
  close: publicProcedure.input(z.object({ id: z.string().min(1) })).mutation(async ({ ctx, input }) => {
    const record = await db.lostFound.findUnique({
      where: { id: input.id },
      select: { id: true, userId: true, status: true },
    });
    if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "该失物信息不存在" });
    if (record.userId !== ctx.userId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "只能结束自己发布的信息" });
    }
    if (record.status === "CLOSED") return { status: "CLOSED" as const };
    if (record.status !== "APPROVED") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "只有审核通过的信息可以标记结束" });
    }
    await db.lostFound.update({ where: { id: record.id }, data: { status: "CLOSED" } });
    return { status: "CLOSED" as const };
  }),

  /** 留言列表：公开可见，用于失主与拾获者互相联系 */
  messages: publicProcedure.input(z.object({ id: z.string().min(1) })).query(async ({ ctx, input }) => {
    await loadRecordOrThrow(input.id, ctx.userId, ctx.user.role === "ADMIN");
    const rows = await db.lostFoundMessage.findMany({
      where: { recordId: input.id },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    const users = await getUserMap(db, rows.map((row) => row.userId));
    return rows.map((row) => ({
      ...row,
      userName: users.get(row.userId)?.name ?? "匿名同学",
      mine: row.userId === ctx.userId,
    }));
  }),

  addMessage: publicProcedure
    .input(
      z.object({
        id: z.string().min(1),
        content: z.string().trim().min(1, "留言不能为空").max(300, "留言最多 300 个字符"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { record } = await loadRecordOrThrow(input.id, ctx.userId, ctx.user.role === "ADMIN");
      if (record.status !== "APPROVED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "该信息已结束或尚未通过审核，暂时不能留言" });
      }
      if (record.userId === ctx.userId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "不能给自己的发布留言，请等待其他同学联系" });
      }
      return db.lostFoundMessage.create({
        data: { recordId: record.id, userId: ctx.userId, content: input.content },
        select: { id: true, content: true, createdAt: true },
      });
    }),

  /** 管理员审核队列 */
  adminList: staffProcedure
    .input(
      z.object({
        status: z.enum(["PENDING", "APPROVED", "REJECTED", "ALL"]).default("PENDING"),
        page: z.number().int().min(1).max(1000).default(1),
        pageSize: z.number().int().min(1).max(50).default(GENERAL_PAGE_SIZE),
      }),
    )
    .query(async ({ input }) => {
      const where: Prisma.LostFoundWhereInput = input.status === "ALL" ? {} : { status: input.status };
      const [records, total] = await db.$transaction([
        db.lostFound.findMany({
          where,
          select: { ...RECORD_SELECT, contact: true },
          orderBy: [{ status: "asc" }, { createdAt: "desc" }],
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        db.lostFound.count({ where }),
      ]);
      const users = await getUserMap(db, records.map((record) => record.userId));
      return {
        items: records.map((record) => ({
          ...record,
          userName: users.get(record.userId)?.name ?? "匿名同学",
        })),
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
      };
    }),

  /** 管理员通过 / 驳回，全部写入审计日志 */
  adminReview: staffProcedure
    .input(
      z.object({
        id: z.string().min(1),
        action: z.enum(["APPROVED", "REJECTED"]),
        note: z.string().trim().max(200, "审核备注最多 200 个字符").optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const record = await db.lostFound.findUnique({
        where: { id: input.id },
        select: { id: true, status: true, userId: true, title: true },
      });
      if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "失物信息不存在" });
      if (record.status !== "PENDING") {
        if (record.status === input.action) return { status: record.status };
        throw new TRPCError({ code: "BAD_REQUEST", message: "该信息已审核，不能重复处理" });
      }
      if (input.action === "REJECTED" && !input.note?.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "驳回时请填写原因，便于发布者修改" });
      }

      await db.$transaction([
        db.lostFound.update({
          where: { id: record.id },
          data: {
            status: input.action,
            reviewNote: input.note?.length ? input.note : null,
            reviewedBy: ctx.userId,
            reviewedAt: new Date(),
          },
        }),
        db.adminLog.create({
          data: {
            adminUserId: ctx.userId,
            action: input.action === "APPROVED" ? "APPROVE_LOST_FOUND" : "REJECT_LOST_FOUND",
            targetId: record.id,
          },
        }),
      ]);

      return { status: input.action };
    }),

  /** 管理员侧栏待审核数量 */
  pendingCount: staffProcedure.query(async () => {
    const count = await db.lostFound.count({ where: { status: "PENDING" } });
    return { count };
  }),
});
