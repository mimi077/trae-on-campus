import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "@/server/api/trpc";
import { getUserMap } from "@/server/api/shared";
import { db } from "@/server/db";

/** 管理员：审计日志只读查询 + 直接处置入口（全部强制写日志） */
export const adminRouter = createTRPCRouter({
  logs: adminProcedure
    .input(
      z.object({
        page: z.number().int().min(1).max(1000).default(1),
        pageSize: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ input }) => {
      const [logs, total] = await db.$transaction([
        db.adminLog.findMany({
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        db.adminLog.count(),
      ]);
      const admins = await getUserMap(db, logs.map((log) => log.adminUserId));
      return {
        items: logs.map((log) => ({
          ...log,
          adminName: admins.get(log.adminUserId)?.name ?? "管理员",
        })),
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
      };
    }),

  offShelfItem: adminProcedure
    .input(z.object({ itemId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const item = await db.item.findUnique({
        where: { id: input.itemId },
        select: { id: true, status: true },
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "商品不存在" });
      await db.$transaction([
        db.item.update({ where: { id: item.id }, data: { status: "SOLD_OUT" } }),
        db.adminLog.create({
          data: { adminUserId: ctx.userId, action: "ADMIN_OFF_SHELF_ITEM", targetId: item.id },
        }),
      ]);
      return { status: "SOLD_OUT" as const };
    }),

  closeWish: adminProcedure
    .input(z.object({ wishId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const wish = await db.wishPurchase.findUnique({
        where: { id: input.wishId },
        select: { id: true },
      });
      if (!wish) throw new TRPCError({ code: "NOT_FOUND", message: "求购心愿不存在" });
      await db.$transaction([
        db.wishPurchase.update({ where: { id: wish.id }, data: { isActive: false } }),
        db.adminLog.create({
          data: { adminUserId: ctx.userId, action: "ADMIN_CLOSE_WISH", targetId: wish.id },
        }),
      ]);
      return { isActive: false as const };
    }),
});
