import { TRPCError } from "@trpc/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { WORK_CATEGORY_MAX, WORK_MEDIA_MAX, WORK_MEDIA_TYPES, WORK_PAGE_SIZE } from "@/lib/constants";
import { capacityView } from "@/lib/rules/capacity";
import { sanitizeRichText, toPlainText } from "@/lib/rules/richtext";
import { buildSubmissionReceipt, evaluateSubmission } from "@/lib/rules/submission";
import { isHttpUrl } from "@/lib/rules/validation";
import { createTRPCRouter, publicProcedure, staffProcedure } from "@/server/api/trpc";
import { db } from "@/server/db";

const mediaSchema = z
  .array(
    z.object({
      type: z.enum(WORK_MEDIA_TYPES),
      url: z
        .string()
        .trim()
        .max(500, "资源链接最多 500 个字符")
        .refine((value) => isHttpUrl(value), "资源链接需以 http(s) 开头"),
      name: z.string().trim().max(80).optional(),
    }),
  )
  .max(WORK_MEDIA_MAX, `最多上传 ${WORK_MEDIA_MAX} 个多媒体资源`)
  .default([]);

type WorkMediaItem = { type: string; url: string; name?: string };

function parseMedia(raw: string | null | undefined): WorkMediaItem[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is WorkMediaItem => Boolean(item) && typeof item === "object")
      .map((item) => ({ type: String(item.type ?? "FILE"), url: String(item.url ?? ""), name: item.name }))
      .filter((item) => item.url.length > 0);
  } catch {
    return [];
  }
}

function normalizeMedia(input: { type: string; url: string; name?: string }[]): string {
  const seen = new Set<string>();
  const items: WorkMediaItem[] = [];
  for (const item of input) {
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    items.push({ type: item.type, url: item.url, name: item.name?.slice(0, 80) });
  }
  return JSON.stringify(items);
}

/** 发布者本人或管理员可以管理作品专区 */
async function assertCanManage(activityId: string, ctx: { userId: string; user: { role: string } }) {
  const activity = await db.activity.findUnique({
    where: { id: activityId },
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      createdBy: true,
      showcaseEnabled: true,
      submissionDeadline: true,
      endAt: true,
      capacity: true,
      isUnlimited: true,
    },
  });
  if (!activity) throw new TRPCError({ code: "NOT_FOUND", message: "活动不存在" });
  if (ctx.user.role !== "ADMIN" && activity.createdBy !== ctx.userId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "只有竞赛发布者或管理员可以管理作品展示专区" });
  }
  return activity;
}

const WORK_SELECT = {
  id: true,
  activityId: true,
  categoryId: true,
  createdBy: true,
  authorName: true,
  title: true,
  description: true,
  workUrl: true,
  coverUrl: true,
  media: true,
  status: true,
  reviewNote: true,
  featured: true,
  pinned: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ShowcaseWorkSelect;

function serializeWork<T extends { media: string }>(work: T) {
  return { ...work, media: parseMedia(work.media) };
}

export const showcaseRouter = createTRPCRouter({
  /** 公开：作品专区概览（分类 + 已通过作品数） */
  overview: publicProcedure
    .input(z.object({ activityId: z.string().min(1) }))
    .query(async ({ input }) => {
      const activity = await db.activity.findUnique({
        where: { id: input.activityId },
        select: {
          id: true,
          title: true,
          type: true,
          organizer: true,
          showcaseEnabled: true,
          submissionDeadline: true,
          endAt: true,
          capacity: true,
          isUnlimited: true,
        },
      });
      if (!activity) throw new TRPCError({ code: "NOT_FOUND", message: "活动不存在" });

      const [categories, approved, featured] = await Promise.all([
        db.workCategory.findMany({
          where: { activityId: activity.id },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: { id: true, name: true, sortOrder: true, _count: { select: { works: { where: { status: "APPROVED" } } } } },
        }),
        db.showcaseWork.count({ where: { activityId: activity.id, status: "APPROVED" } }),
        db.showcaseWork.count({ where: { activityId: activity.id, status: "APPROVED", featured: true } }),
      ]);

      return {
        activity: { ...activity, capacityView: capacityView({ capacity: activity.capacity, isUnlimited: activity.isUnlimited, occupied: 0 }) },
        categories: categories.map((category) => ({
          id: category.id,
          name: category.name,
          sortOrder: category.sortOrder,
          count: category._count.works,
        })),
        approvedCount: approved,
        featuredCount: featured,
      };
    }),

  /** 公开：作品列表（仅 APPROVED；置顶 > 精选 > 自定义排序 > 最新） */
  list: publicProcedure
    .input(
      z.object({
        activityId: z.string().min(1),
        categoryId: z.string().min(1).optional(),
        keyword: z.string().trim().max(40).optional(),
        page: z.number().int().min(1).max(200).default(1),
        pageSize: z.number().int().min(1).max(24).default(WORK_PAGE_SIZE),
      }),
    )
    .query(async ({ input }) => {
      const where: Prisma.ShowcaseWorkWhereInput = {
        activityId: input.activityId,
        status: "APPROVED",
      };
      if (input.categoryId) where.categoryId = input.categoryId;
      if (input.keyword) {
        where.OR = [
          { title: { contains: input.keyword } },
          { authorName: { contains: input.keyword } },
          { description: { contains: input.keyword } },
        ];
      }

      const [items, total, categories] = await Promise.all([
        db.showcaseWork.findMany({
          where,
          select: WORK_SELECT,
          orderBy: [{ pinned: "desc" }, { featured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        db.showcaseWork.count({ where }),
        db.workCategory.findMany({
          where: { activityId: input.activityId },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: { id: true, name: true },
        }),
      ]);

      const categoryMap = new Map(categories.map((category) => [category.id, category.name]));

      return {
        items: items.map((work) => ({
          ...serializeWork(work),
          excerpt: toPlainText(work.description, 120),
          categoryName: work.categoryId ? (categoryMap.get(work.categoryId) ?? "未分类") : "未分类",
        })),
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
        categories,
      };
    }),

  /** 首页 / 活动详情：精选作品（不足时用最新作品补齐） */
  featured: publicProcedure
    .input(z.object({ activityId: z.string().min(1), take: z.number().int().min(1).max(8).default(4) }))
    .query(async ({ input }) => {
      const items = await db.showcaseWork.findMany({
        where: { activityId: input.activityId, status: "APPROVED" },
        select: WORK_SELECT,
        orderBy: [{ pinned: "desc" }, { featured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
        take: input.take,
      });
      return items.map((work) => ({ ...serializeWork(work), excerpt: toPlainText(work.description, 100) }));
    }),

  /** 作品详情：已通过公开；作者本人与管理员可查看未通过作品 */
  byId: publicProcedure.input(z.object({ id: z.string().min(1) })).query(async ({ ctx, input }) => {
    const work = await db.showcaseWork.findUnique({
      where: { id: input.id },
      select: {
        ...WORK_SELECT,
        activity: { select: { id: true, title: true, organizer: true, endAt: true, submissionDeadline: true } },
      },
    });
    if (!work) throw new TRPCError({ code: "NOT_FOUND", message: "作品不存在" });

    const canSee = work.status === "APPROVED" || work.createdBy === ctx.userId || ctx.user.role === "ADMIN";
    if (!canSee) throw new TRPCError({ code: "NOT_FOUND", message: "作品不存在或尚未通过审核" });

    return {
      ...serializeWork(work),
      plainText: toPlainText(work.description),
      categoryName: work.categoryId
        ? (
            await db.workCategory.findUnique({ where: { id: work.categoryId }, select: { name: true } })
          )?.name ?? "未分类"
        : "未分类",
    };
  }),

  /** 我的提交：返回当前用户在该活动下的作品（任意状态） */
  mySubmission: publicProcedure.input(z.object({ activityId: z.string().min(1) })).query(async ({ ctx, input }) => {
    if (!ctx.authenticated) return null;
    const work = await db.showcaseWork.findUnique({
      where: { activityId_createdBy: { activityId: input.activityId, createdBy: ctx.userId } },
      select: { ...WORK_SELECT, activity: { select: { id: true, title: true, submissionDeadline: true, endAt: true, showcaseEnabled: true } } },
    });
    if (!work) return null;
    return { ...serializeWork(work), excerpt: toPlainText(work.description, 120) };
  }),

  /** 提交 / 修改作品：报名通过 + 截止时间 + 富文本净化 + 回执 */
  submit: publicProcedure
    .input(
      z.object({
        activityId: z.string().min(1),
        title: z.string().trim().min(2, "作品标题至少 2 个字").max(80, "作品标题最多 80 个字符"),
        authorName: z.string().trim().min(1, "请填写作者信息").max(40, "作者信息最多 40 个字符"),
        description: z.string().max(5000, "作品描述最多 5000 个字符").optional(),
        workUrl: z
          .string()
          .trim()
          .max(500)
          .refine((value) => !value || isHttpUrl(value), "作品链接需以 http(s) 开头")
          .optional(),
        coverUrl: z
          .string()
          .trim()
          .max(500)
          .refine((value) => !value || isHttpUrl(value), "封面链接需以 http(s) 开头")
          .optional(),
        categoryId: z.string().min(1).optional(),
        media: mediaSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const activity = await db.activity.findUnique({
        where: { id: input.activityId },
        select: {
          id: true,
          title: true,
          status: true,
          showcaseEnabled: true,
          submissionDeadline: true,
          endAt: true,
        },
      });
      if (!activity) throw new TRPCError({ code: "NOT_FOUND", message: "活动不存在" });
      if (!activity.showcaseEnabled) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "主办方暂未开启该活动的作品提交" });
      }

      const [registration, existing] = await Promise.all([
        db.registration.findUnique({
          where: { userId_activityId: { userId: ctx.userId, activityId: activity.id } },
          select: { status: true },
        }),
        db.showcaseWork.findUnique({
          where: { activityId_createdBy: { activityId: activity.id, createdBy: ctx.userId } },
          select: { id: true, status: true },
        }),
      ]);

      const gate = evaluateSubmission({
        registrationStatus: registration?.status,
        deadline: activity.submissionDeadline ?? activity.endAt,
        existingStatus: existing?.status,
      });
      if (!gate.allowed) throw new TRPCError({ code: "BAD_REQUEST", message: gate.reason });

      if (input.categoryId) {
        const category = await db.workCategory.findFirst({
          where: { id: input.categoryId, activityId: activity.id },
          select: { id: true },
        });
        if (!category) throw new TRPCError({ code: "BAD_REQUEST", message: "作品分类不属于该活动" });
      }

      const data = {
        title: input.title,
        authorName: input.authorName,
        description: input.description?.trim() ? sanitizeRichText(input.description) : null,
        workUrl: input.workUrl?.trim() || null,
        coverUrl: input.coverUrl?.trim() || null,
        categoryId: input.categoryId ?? null,
        media: normalizeMedia(input.media),
        status: "PENDING",
        reviewNote: null,
        updatedAt: new Date(),
      };

      const work = existing
        ? await db.showcaseWork.update({
            where: { id: existing.id },
            data,
            select: { id: true, status: true, createdAt: true, updatedAt: true },
          })
        : await db.showcaseWork.create({
            data: { ...data, activityId: activity.id, createdBy: ctx.userId },
            select: { id: true, status: true, createdAt: true, updatedAt: true },
          });

      const receipt = buildSubmissionReceipt({
        activityTitle: activity.title,
        workTitle: input.title,
        description: data.description,
        submittedAt: new Date(),
        status: work.status,
      });

      await db.userNotification.create({
        data: {
          userId: ctx.userId,
          type: "RECEIPT",
          title: `【提交回执】${activity.title}`,
          content: receipt.content,
          link: `/activities/${activity.id}/submit`,
        },
      });

      return {
        id: work.id,
        status: work.status,
        updated: Boolean(existing),
        receipt,
      };
    }),

  /** 24 小时弹窗资格：已通过报名、未提交、截止前 24 小时内 */
  popupState: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.authenticated) return { items: [] as never[] };
    const now = new Date();
    const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const activities = await db.activity.findMany({
      where: {
        status: { in: ["PUBLISHED", "ONGOING"] },
        showcaseEnabled: true,
        OR: [
          { submissionDeadline: { gt: now, lte: horizon } },
          { submissionDeadline: null, endAt: { gt: now, lte: horizon } },
        ],
        registrations: { some: { userId: ctx.userId, status: "APPROVED" } },
      },
      select: { id: true, title: true, submissionDeadline: true, endAt: true },
      take: 5,
    });
    if (activities.length === 0) return { items: [] as never[] };

    const works = await db.showcaseWork.findMany({
      where: { createdBy: ctx.userId, activityId: { in: activities.map((activity) => activity.id) } },
      select: { activityId: true },
    });
    const submitted = new Set(works.map((work) => work.activityId));

    const items = activities
      .filter((activity) => !submitted.has(activity.id))
      .map((activity) => ({
        id: activity.id,
        title: activity.title,
        deadline: activity.submissionDeadline ?? activity.endAt,
        submitPath: `/activities/${activity.id}/submit`,
      }));

    return { items };
  }),

  /** 发布者开启 / 关闭作品专区 */
  setShowcaseEnabled: staffProcedure
    .input(z.object({ activityId: z.string().min(1), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await assertCanManage(input.activityId, ctx);
      const updated = await db.activity.update({
        where: { id: input.activityId },
        data: { showcaseEnabled: input.enabled },
        select: { id: true, showcaseEnabled: true },
      });
      return updated;
    }),

  /** 管理端：可管理的活动列表（管理员看全部，教师看自己发布的） */
  adminActivities: staffProcedure.query(async ({ ctx }) => {
    const where = ctx.user.role === "ADMIN" ? {} : { createdBy: ctx.userId };
    const activities = await db.activity.findMany({
      where,
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        startAt: true,
        endAt: true,
        showcaseEnabled: true,
        submissionDeadline: true,
        createdBy: true,
        _count: { select: { works: true, workCategories: true, registrations: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const pending = await db.showcaseWork.groupBy({
      by: ["activityId"],
      where: { activityId: { in: activities.map((activity) => activity.id) }, status: "PENDING" },
      _count: { _all: true },
    });
    const pendingMap = new Map(pending.map((item) => [item.activityId, item._count._all]));

    return activities.map((activity) => ({
      ...activity,
      workCount: activity._count.works,
      categoryCount: activity._count.workCategories,
      registrationCount: activity._count.registrations,
      pendingCount: pendingMap.get(activity.id) ?? 0,
    }));
  }),

  /** 管理端：作品审核队列 */
  adminList: staffProcedure
    .input(
      z.object({
        activityId: z.string().min(1).optional(),
        status: z.enum(["ALL", "PENDING", "APPROVED", "REJECTED"]).default("PENDING"),
        page: z.number().int().min(1).max(200).default(1),
        pageSize: z.number().int().min(1).max(50).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const activityWhere = ctx.user.role === "ADMIN" ? {} : { createdBy: ctx.userId };
      const manageable = await db.activity.findMany({ where: activityWhere, select: { id: true, title: true } });
      const allowedIds = new Set(manageable.map((activity) => activity.id));

      const where: Prisma.ShowcaseWorkWhereInput = {
        activityId: input.activityId ? input.activityId : { in: Array.from(allowedIds) },
        ...(input.status === "ALL" ? {} : { status: input.status }),
      };
      if (input.activityId && !allowedIds.has(input.activityId)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "无权管理该活动的作品" });
      }

      const [items, total, categories] = await Promise.all([
        db.showcaseWork.findMany({
          where,
          select: WORK_SELECT,
          orderBy: [{ pinned: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        db.showcaseWork.count({ where }),
        db.workCategory.findMany({
          where: { activityId: input.activityId ?? { in: Array.from(allowedIds) } },
          select: { id: true, name: true, activityId: true },
        }),
      ]);

      const categoryMap = new Map(categories.map((category) => [category.id, category.name]));
      const activityMap = new Map(manageable.map((activity) => [activity.id, activity.title]));

      return {
        items: items.map((work) => ({
          ...serializeWork(work),
          excerpt: toPlainText(work.description, 100),
          categoryName: work.categoryId ? (categoryMap.get(work.categoryId) ?? "未分类") : "未分类",
          activityTitle: activityMap.get(work.activityId) ?? "活动",
        })),
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
      };
    }),

  /** 管理端：作品审核（通过 / 驳回），驳回必填原因并通知作者 */
  review: staffProcedure
    .input(
      z.object({
        id: z.string().min(1),
        action: z.enum(["APPROVED", "REJECTED"]),
        note: z.string().trim().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const work = await db.showcaseWork.findUnique({
        where: { id: input.id },
        select: { id: true, activityId: true, createdBy: true, title: true, status: true },
      });
      if (!work) throw new TRPCError({ code: "NOT_FOUND", message: "作品不存在" });
      const activity = await assertCanManage(work.activityId, ctx);
      if (input.action === "REJECTED" && (input.note?.length ?? 0) < 5) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "驳回原因至少 5 个字，便于参赛者修改" });
      }

      await db.$transaction([
        db.showcaseWork.update({
          where: { id: work.id },
          data: { status: input.action, reviewNote: input.note?.length ? input.note : null },
        }),
        db.userNotification.create({
          data: {
            userId: work.createdBy,
            type: "REVIEW",
            title: input.action === "APPROVED" ? `【作品通过】${work.title}` : `【作品驳回】${work.title}`,
            content:
              input.action === "APPROVED"
                ? `你的作品「${work.title}」已通过「${activity.title}」审核，现已在作品展示专区公开。`
                : `你的作品「${work.title}」未通过「${activity.title}」审核。驳回原因：${input.note ?? ""}。请修改后重新提交。`,
            link: input.action === "APPROVED" ? `/activities/${work.activityId}/works` : `/activities/${work.activityId}/submit`,
          },
        }),
        db.adminLog.create({
          data: {
            adminUserId: ctx.userId,
            action: input.action === "APPROVED" ? "APPROVE_WORK" : "REJECT_WORK",
            targetId: work.id,
          },
        }),
      ]);

      return { status: input.action };
    }),

  /** 管理端：精选 / 置顶 / 自定义排序 */
  toggleFeatured: staffProcedure
    .input(z.object({ id: z.string().min(1), featured: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const work = await db.showcaseWork.findUnique({ where: { id: input.id }, select: { activityId: true } });
      if (!work) throw new TRPCError({ code: "NOT_FOUND", message: "作品不存在" });
      await assertCanManage(work.activityId, ctx);
      return db.showcaseWork.update({
        where: { id: input.id },
        data: { featured: input.featured },
        select: { id: true, featured: true },
      });
    }),

  togglePinned: staffProcedure
    .input(z.object({ id: z.string().min(1), pinned: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const work = await db.showcaseWork.findUnique({ where: { id: input.id }, select: { activityId: true } });
      if (!work) throw new TRPCError({ code: "NOT_FOUND", message: "作品不存在" });
      await assertCanManage(work.activityId, ctx);
      return db.showcaseWork.update({
        where: { id: input.id },
        data: { pinned: input.pinned },
        select: { id: true, pinned: true },
      });
    }),

  updateSort: staffProcedure
    .input(z.object({ id: z.string().min(1), sortOrder: z.number().int().min(0).max(9999) }))
    .mutation(async ({ ctx, input }) => {
      const work = await db.showcaseWork.findUnique({ where: { id: input.id }, select: { activityId: true } });
      if (!work) throw new TRPCError({ code: "NOT_FOUND", message: "作品不存在" });
      await assertCanManage(work.activityId, ctx);
      return db.showcaseWork.update({
        where: { id: input.id },
        data: { sortOrder: input.sortOrder },
        select: { id: true, sortOrder: true },
      });
    }),

  /** 分类管理 */
  createCategory: staffProcedure
    .input(
      z.object({
        activityId: z.string().min(1),
        name: z.string().trim().min(1, "请填写分类名称").max(20, "分类名称最多 20 个字符"),
        sortOrder: z.number().int().min(0).max(999).default(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCanManage(input.activityId, ctx);
      const count = await db.workCategory.count({ where: { activityId: input.activityId } });
      if (count >= WORK_CATEGORY_MAX) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `每个活动最多维护 ${WORK_CATEGORY_MAX} 个作品分类` });
      }
      const duplicate = await db.workCategory.findFirst({
        where: { activityId: input.activityId, name: input.name },
        select: { id: true },
      });
      if (duplicate) throw new TRPCError({ code: "BAD_REQUEST", message: "该分类已存在" });
      return db.workCategory.create({
        data: { activityId: input.activityId, name: input.name, sortOrder: input.sortOrder },
        select: { id: true, name: true, sortOrder: true },
      });
    }),

  updateCategory: staffProcedure
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().trim().min(1).max(20).optional(),
        sortOrder: z.number().int().min(0).max(999).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const category = await db.workCategory.findUnique({ where: { id: input.id }, select: { activityId: true } });
      if (!category) throw new TRPCError({ code: "NOT_FOUND", message: "分类不存在" });
      await assertCanManage(category.activityId, ctx);
      return db.workCategory.update({
        where: { id: input.id },
        data: {
          ...(input.name ? { name: input.name } : {}),
          ...(typeof input.sortOrder === "number" ? { sortOrder: input.sortOrder } : {}),
        },
        select: { id: true, name: true, sortOrder: true },
      });
    }),

  deleteCategory: staffProcedure.input(z.object({ id: z.string().min(1) })).mutation(async ({ ctx, input }) => {
    const category = await db.workCategory.findUnique({ where: { id: input.id }, select: { activityId: true } });
    if (!category) throw new TRPCError({ code: "NOT_FOUND", message: "分类不存在" });
    await assertCanManage(category.activityId, ctx);
    await db.workCategory.delete({ where: { id: input.id } });
    return { id: input.id };
  }),

  /** 管理端铃铛：待审核作品数 */
  pendingCount: staffProcedure.query(async ({ ctx }) => {
    const activityWhere = ctx.user.role === "ADMIN" ? {} : { createdBy: ctx.userId };
    const ids = await db.activity.findMany({ where: activityWhere, select: { id: true } });
    const count = await db.showcaseWork.count({
      where: { activityId: { in: ids.map((activity) => activity.id) }, status: "PENDING" },
    });
    return { count };
  }),
});
