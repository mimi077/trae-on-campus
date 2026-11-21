import { TRPCError } from "@trpc/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { isStaffRole } from "@/lib/constants";
import { getUserMap } from "@/server/api/shared";
import { adminProcedure, createTRPCRouter, publicProcedure, staffProcedure } from "@/server/api/trpc";
import { db } from "@/server/db";

const NOTICE_SELECT = {
  id: true,
  title: true,
  content: true,
  dept: true,
  targetCollege: true,
  targetGrade: true,
  targetMajor: true,
  targetClass: true,
  createdBy: true,
  isActive: true,
  publishAt: true,
  createdAt: true,
} satisfies Prisma.AdminNoticeSelect;

type NoticeRecord = Prisma.AdminNoticeGetPayload<{ select: typeof NOTICE_SELECT }>;

const targetField = z
  .string()
  .trim()
  .max(30, "筛选条件最多 30 个字符")
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

/** 计划发布时间：不传即立即发布；教师可预约未来时间，未到点不会出现在学生消息栏 */
const publishAtField = z.coerce
  .date({ invalid_type_error: "发布时间格式不正确", required_error: "发布时间格式不正确" })
  .optional();

const noticePayload = {
  title: z.string().trim().min(2, "通知标题至少 2 个字").max(80, "标题最多 80 个字符"),
  content: z.string().trim().min(2, "通知正文至少 2 个字").max(3000, "正文最多 3000 个字符"),
  dept: z.string().trim().min(2, "请填写发布部门").max(30, "发布部门最多 30 个字符"),
  targetCollege: targetField,
  targetGrade: targetField,
  targetMajor: targetField,
  targetClass: targetField,
  publishAt: publishAtField,
};

function isTargeted(notice: {
  targetCollege: string | null;
  targetGrade: string | null;
  targetMajor: string | null;
  targetClass: string | null;
}) {
  return Boolean(notice.targetCollege || notice.targetGrade || notice.targetMajor || notice.targetClass);
}

/** 通知可见性：所有已填写的筛选维度必须与用户身份完全一致 */
export function noticeVisibleTo(
  notice: {
    targetCollege: string | null;
    targetGrade: string | null;
    targetMajor: string | null;
    targetClass: string | null;
  },
  user: { college: string | null; grade: string | null; major: string | null; className: string | null; authStatus: string },
) {
  const dims: [string | null, string | null][] = [
    [notice.targetCollege, user.college],
    [notice.targetGrade, user.grade],
    [notice.targetMajor, user.major],
    [notice.targetClass, user.className],
  ];
  const targeted = dims.some(([target]) => Boolean(target));
  if (!targeted) return true;
  if (user.authStatus !== "AUTHED") return false;
  return dims.every(([target, mine]) => !target || target === mine);
}

/** 数据库层过滤：把不可见通知直接排除，禁止前端过滤 */
function noticeWhereForUser(user: {
  role: string;
  college: string | null;
  grade: string | null;
  major: string | null;
  className: string | null;
  authStatus: string;
}): Prisma.AdminNoticeWhereInput {
  const now = new Date();
  if (isStaffRole(user.role)) return { isActive: true, publishAt: { lte: now } };
  if (user.role === "USER" && user.authStatus !== "AUTHED") {
    return {
      isActive: true,
      publishAt: { lte: now },
      targetCollege: null,
      targetGrade: null,
      targetMajor: null,
      targetClass: null,
    };
  }
  return {
    isActive: true,
    publishAt: { lte: now },
    AND: [
      { OR: [{ targetCollege: null }, { targetCollege: user.college ?? "__none__" }] },
      { OR: [{ targetGrade: null }, { targetGrade: user.grade ?? "__none__" }] },
      { OR: [{ targetMajor: null }, { targetMajor: user.major ?? "__none__" }] },
      { OR: [{ targetClass: null }, { targetClass: user.className ?? "__none__" }] },
    ],
  };
}

/** 单条通知是否已到发布时间：未到点的定时通知对学生不可见 */
function isReleased(notice: { publishAt: Date }) {
  return notice.publishAt.getTime() <= Date.now();
}

function serialize(notice: NoticeRecord) {
  return {
    ...notice,
    isTargeted: isTargeted(notice),
    isScheduled: notice.publishAt.getTime() > Date.now(),
  };
}

export const noticeRouter = createTRPCRouter({
  /** 普通用户通知列表：后端按身份过滤，未认证学生只能看到全员通知 */
  list: publicProcedure
    .input(
      z.object({
        page: z.number().int().min(1).max(200).default(1),
        pageSize: z.number().int().min(1).max(30).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.authenticated) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "请先登录后查看通知" });
      }
      const where = noticeWhereForUser(ctx.user);
      const [records, total, reads] = await Promise.all([
        db.adminNotice.findMany({
          where,
          select: NOTICE_SELECT,
          orderBy: [{ publishAt: "desc" }, { createdAt: "desc" }],
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        db.adminNotice.count({ where }),
        db.userNoticeRead.findMany({ where: { userId: ctx.userId }, select: { noticeId: true } }),
      ]);
      const readSet = new Set(reads.map((row) => row.noticeId));
      return {
        items: records.map((record) => ({ ...serialize(record), read: readSet.has(record.id) })),
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
      };
    }),

  /** 首页最新通知：复用后端可见性过滤 */
  latest: publicProcedure
    .input(z.object({ take: z.number().int().min(1).max(6).default(4) }))
    .query(async ({ ctx, input }) => {
      if (!ctx.authenticated) return { items: [], unread: 0 };
      const where = noticeWhereForUser(ctx.user);
      const [records, reads] = await Promise.all([
        db.adminNotice.findMany({
          where,
          select: NOTICE_SELECT,
          orderBy: [{ publishAt: "desc" }, { createdAt: "desc" }],
          take: input.take,
        }),
        db.userNoticeRead.findMany({ where: { userId: ctx.userId }, select: { noticeId: true } }),
      ]);
      const readSet = new Set(reads.map((row) => row.noticeId));
      const items = records.map((record) => ({ ...serialize(record), read: readSet.has(record.id) }));
      return { items, unread: items.filter((item) => !item.read).length };
    }),

  unreadCount: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.authenticated) return { count: 0 };
    const where = noticeWhereForUser(ctx.user);
    const [notices, reads] = await Promise.all([
      db.adminNotice.findMany({ where, select: { id: true } }),
      db.userNoticeRead.findMany({ where: { userId: ctx.userId }, select: { noticeId: true } }),
    ]);
    const readSet = new Set(reads.map((row) => row.noticeId));
    return { count: notices.filter((notice) => !readSet.has(notice.id)).length };
  }),

  /** 详情：越权访问直接 404，不暴露“存在但不可见”的信息 */
  byId: publicProcedure.input(z.object({ id: z.string().min(1) })).query(async ({ ctx, input }) => {
    if (!ctx.authenticated) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "请先登录后查看通知" });
    }
    const notice = await db.adminNotice.findUnique({ where: { id: input.id }, select: NOTICE_SELECT });
    if (!notice || !notice.isActive) {
      throw new TRPCError({ code: "NOT_FOUND", message: "通知不存在或已下架" });
    }
    if (!isStaffRole(ctx.user.role) && (!isReleased(notice) || !noticeVisibleTo(notice, ctx.user))) {
      throw new TRPCError({ code: "NOT_FOUND", message: "通知不存在或已下架" });
    }
    const read = await db.userNoticeRead.findUnique({
      where: { userId_noticeId: { userId: ctx.userId, noticeId: notice.id } },
      select: { id: true },
    });
    const creator = await db.user.findUnique({ where: { id: notice.createdBy }, select: { name: true } });
    return {
      ...serialize(notice),
      read: Boolean(read),
      creatorName: creator?.name ?? "平台管理员",
    };
  }),

  markRead: publicProcedure.input(z.object({ id: z.string().min(1) })).mutation(async ({ ctx, input }) => {
    const notice = await db.adminNotice.findUnique({ where: { id: input.id }, select: NOTICE_SELECT });
    if (!notice || !notice.isActive) {
      throw new TRPCError({ code: "NOT_FOUND", message: "通知不存在或已下架" });
    }
    if (!isStaffRole(ctx.user.role) && (!isReleased(notice) || !noticeVisibleTo(notice, ctx.user))) {
      throw new TRPCError({ code: "NOT_FOUND", message: "通知不存在或已下架" });
    }
    await db.userNoticeRead.upsert({
      where: { userId_noticeId: { userId: ctx.userId, noticeId: notice.id } },
      create: { userId: ctx.userId, noticeId: notice.id },
      update: { readAt: new Date() },
    });
    return { ok: true };
  }),

  /** 管理端列表：教师只看自己发布的通知，管理员看全部（含已下架） */
  adminList: staffProcedure
    .input(z.object({ page: z.number().int().min(1).max(200).default(1), pageSize: z.number().int().min(1).max(50).default(10) }))
    .query(async ({ ctx, input }) => {
      const where: Prisma.AdminNoticeWhereInput =
        ctx.user.role === "ADMIN" ? {} : { createdBy: ctx.userId };
      const [records, total] = await Promise.all([
        db.adminNotice.findMany({
          where,
          select: NOTICE_SELECT,
          orderBy: [{ publishAt: "desc" }, { createdAt: "desc" }],
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        db.adminNotice.count({ where }),
      ]);
      const users = await getUserMap(db, records.map((record) => record.createdBy));
      return {
        items: records.map((record) => ({
          ...serialize(record),
          creatorName: users.get(record.createdBy)?.name ?? "管理员",
        })),
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
        canTarget: ctx.user.role === "ADMIN",
      };
    }),

  /** 发布通知：教师只能发布全员通知，定向条件仅管理员可填 */
  create: staffProcedure.input(z.object(noticePayload)).mutation(async ({ ctx, input }) => {
    const targeted = Boolean(input.targetCollege || input.targetGrade || input.targetMajor || input.targetClass);
    if (targeted && ctx.user.role !== "ADMIN") {
      throw new TRPCError({ code: "FORBIDDEN", message: "只有管理员可以发布班级 / 学院定向通知" });
    }
    const notice = await db.adminNotice.create({
      data: {
        title: input.title,
        content: input.content,
        dept: input.dept,
        targetCollege: input.targetCollege,
        targetGrade: input.targetGrade,
        targetMajor: input.targetMajor,
        targetClass: input.targetClass,
        publishAt: input.publishAt ?? new Date(),
        createdBy: ctx.userId,
      },
      select: { id: true },
    });
    await db.adminLog.create({
      data: { adminUserId: ctx.userId, action: "CREATE_NOTICE", targetId: notice.id },
    });
    return { id: notice.id };
  }),

  /** 编辑通知：教师可编辑自己发布的通知，管理员可编辑全部；支持改标题 / 正文 / 部门 / 发布时间 */
  update: staffProcedure
    .input(z.object({ id: z.string().min(1), ...noticePayload }))
    .mutation(async ({ ctx, input }) => {
      const exists = await db.adminNotice.findUnique({
        where: { id: input.id },
        select: { id: true, createdBy: true },
      });
      if (!exists) throw new TRPCError({ code: "NOT_FOUND", message: "通知不存在" });
      if (ctx.user.role !== "ADMIN" && exists.createdBy !== ctx.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "只能编辑自己发布的通知" });
      }

      const targeted = Boolean(input.targetCollege || input.targetGrade || input.targetMajor || input.targetClass);
      if (targeted && ctx.user.role !== "ADMIN") {
        throw new TRPCError({ code: "FORBIDDEN", message: "只有管理员可以设置定向条件" });
      }

      await db.adminNotice.update({
        where: { id: input.id },
        data: {
          title: input.title,
          content: input.content,
          dept: input.dept,
          targetCollege: input.targetCollege,
          targetGrade: input.targetGrade,
          targetMajor: input.targetMajor,
          targetClass: input.targetClass,
          ...(input.publishAt ? { publishAt: input.publishAt } : {}),
        },
      });
      await db.adminLog.create({
        data: { adminUserId: ctx.userId, action: "UPDATE_NOTICE", targetId: input.id },
      });
      return { ok: true };
    }),

  /** 下架通知：仅管理员；软删除，保留审计痕迹 */
  remove: adminProcedure.input(z.object({ id: z.string().min(1) })).mutation(async ({ ctx, input }) => {
    const exists = await db.adminNotice.findUnique({ where: { id: input.id }, select: { id: true } });
    if (!exists) throw new TRPCError({ code: "NOT_FOUND", message: "通知不存在" });
    await db.adminNotice.update({ where: { id: input.id }, data: { isActive: false } });
    await db.adminLog.create({
      data: { adminUserId: ctx.userId, action: "REMOVE_NOTICE", targetId: input.id },
    });
    return { ok: true };
  }),
});
