import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, adminProcedure, publicProcedure } from "@/server/api/trpc";
import { getUserMap } from "@/server/api/shared";
import { db } from "@/server/db";

/**
 * 举报与管理员处理：
 * - 任意用户可提交举报；过期/关闭的心愿不允许新举报；
 * - 管理员查看待处理队列，驳回或执行下架/关闭；
 * - 管理员每一次处理都写入 AdminLog 审计日志，不可绕过。
 */
export const reportRouter = createTRPCRouter({
  create: publicProcedure
    .input(
      z
        .object({
          targetItemId: z.string().min(1).optional(),
          targetWishId: z.string().min(1).optional(),
          reason: z.string().trim().min(2, "请填写至少 2 个字的举报理由").max(200, "举报理由最多 200 个字符"),
        })
        .refine((value) => Boolean(value.targetItemId) !== Boolean(value.targetWishId), {
          message: "举报对象必须且只能是商品或心愿其中之一",
        }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.targetItemId) {
        const item = await db.item.findUnique({
          where: { id: input.targetItemId },
          select: { id: true },
        });
        if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "被举报商品不存在" });
      }
      if (input.targetWishId) {
        const wish = await db.wishPurchase.findUnique({
          where: { id: input.targetWishId },
          select: { id: true, isActive: true, expireAt: true },
        });
        if (!wish) throw new TRPCError({ code: "NOT_FOUND", message: "被举报心愿不存在" });
        if (!wish.isActive || wish.expireAt.getTime() <= Date.now()) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "该求购心愿已过期或关闭，无法举报" });
        }
      }

      // 短时间重复提交幂等：避免连续点击产生重复举报
      const duplicate = await db.report.findFirst({
        where: {
          reporterUserId: ctx.userId,
          targetItemId: input.targetItemId ?? null,
          targetWishId: input.targetWishId ?? null,
          reason: input.reason,
          createdAt: { gte: new Date(Date.now() - 10_000) },
        },
        select: { id: true, status: true },
      });
      if (duplicate) return duplicate;

      return db.report.create({
        data: {
          reporterUserId: ctx.userId,
          targetItemId: input.targetItemId ?? null,
          targetWishId: input.targetWishId ?? null,
          reason: input.reason,
          status: "PENDING",
        },
        select: { id: true, status: true },
      });
    }),

  adminList: adminProcedure
    .input(
      z.object({
        status: z.enum(["PENDING", "RESOLVED", "REJECTED", "ALL"]).default("PENDING"),
        page: z.number().int().min(1).max(1000).default(1),
        pageSize: z.number().int().min(1).max(50).default(10),
      }),
    )
    .query(async ({ input }) => {
      const where = input.status === "ALL" ? {} : { status: input.status };
      const [reports, total] = await db.$transaction([
        db.report.findMany({
          where,
          orderBy: [{ status: "asc" }, { createdAt: "desc" }],
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        db.report.count({ where }),
      ]);

      const users = await getUserMap(db, reports.map((report) => report.reporterUserId));
      const itemIds = reports
        .map((report) => report.targetItemId)
        .filter((id): id is string => Boolean(id));
      const wishIds = reports
        .map((report) => report.targetWishId)
        .filter((id): id is string => Boolean(id));
      const [items, wishes] = await Promise.all([
        itemIds.length
          ? db.item.findMany({
              where: { id: { in: itemIds } },
              select: { id: true, title: true, status: true },
            })
          : Promise.resolve([]),
        wishIds.length
          ? db.wishPurchase.findMany({
              where: { id: { in: wishIds } },
              select: { id: true, title: true, isActive: true },
            })
          : Promise.resolve([]),
      ]);
      const itemMap = new Map(items.map((item) => [item.id, item]));
      const wishMap = new Map(wishes.map((wish) => [wish.id, wish]));

      return {
        items: reports.map((report) => ({
          ...report,
          reporterName: users.get(report.reporterUserId)?.name ?? "匿名同学",
          targetType: report.targetItemId ? ("ITEM" as const) : ("WISH" as const),
          targetTitle: report.targetItemId
            ? (itemMap.get(report.targetItemId)?.title ?? "商品已删除")
            : (wishMap.get(report.targetWishId ?? "")?.title ?? "心愿已删除"),
          targetStatus: report.targetItemId
            ? (itemMap.get(report.targetItemId)?.status ?? "MISSING")
            : wishMap.get(report.targetWishId ?? "")?.isActive
              ? "ACTIVE"
              : "CLOSED",
        })),
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
      };
    }),

  /** 管理员处理举报：驳回 / 执行下架或关闭，并写入审计日志 */
  adminResolve: adminProcedure
    .input(
      z.object({
        id: z.string().min(1),
        action: z.enum(["REJECTED", "RESOLVED"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const report = await db.report.findUnique({ where: { id: input.id } });
      if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "举报记录不存在" });
      if (report.status !== "PENDING") {
        if (report.status === input.action) return { status: report.status };
        throw new TRPCError({ code: "BAD_REQUEST", message: "该举报已处理，不能重复操作" });
      }

      const targetId = report.targetItemId ?? report.targetWishId ?? report.id;
      const action = input.action === "REJECTED"
        ? "REJECT_REPORT"
        : report.targetItemId
          ? "OFF_SHELF_ITEM"
          : "CLOSE_WISH";

      await db.$transaction(async (tx) => {
        await tx.report.update({
          where: { id: report.id },
          data: { status: input.action },
        });

        if (input.action === "RESOLVED") {
          if (report.targetItemId) {
            await tx.item.updateMany({
              where: { id: report.targetItemId },
              data: { status: "SOLD_OUT" },
            });
          }
          if (report.targetWishId) {
            await tx.wishPurchase.updateMany({
              where: { id: report.targetWishId },
              data: { isActive: false },
            });
          }
        }

        await tx.adminLog.create({
          data: {
            adminUserId: ctx.userId,
            action,
            targetId,
          },
        });
      });

      return { status: input.action };
    }),
});
