import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { db } from "@/server/db";

/** 站内系统消息：截止提醒、审核结果、提交回执统一走这里 */
export const notificationRouter = createTRPCRouter({
  list: publicProcedure
    .input(
      z.object({
        page: z.number().int().min(1).max(200).default(1),
        pageSize: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.authenticated) {
        return { items: [], total: 0, page: 1, pageSize: input.pageSize, totalPages: 1, unread: 0 };
      }

      const where = { userId: ctx.userId };
      const [items, total, unread] = await db.$transaction([
        db.userNotification.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        db.userNotification.count({ where }),
        db.userNotification.count({ where: { userId: ctx.userId, readAt: null } }),
      ]);

      return {
        items,
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
        unread,
      };
    }),

  unreadCount: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.authenticated) return { count: 0 };
    const count = await db.userNotification.count({ where: { userId: ctx.userId, readAt: null } });
    return { count };
  }),

  markRead: publicProcedure.input(z.object({ id: z.string().min(1) })).mutation(async ({ ctx, input }) => {
    await db.userNotification.updateMany({
      where: { id: input.id, userId: ctx.userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true as const };
  }),

  markAllRead: publicProcedure.mutation(async ({ ctx }) => {
    const result = await db.userNotification.updateMany({
      where: { userId: ctx.userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }),
});
