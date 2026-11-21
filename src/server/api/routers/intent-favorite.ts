import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { ITEM_SELECT, isUniqueViolation, serializeItem } from "@/server/api/shared";
import { db } from "@/server/db";

/**
 * 意向收藏：与普通收藏完全独立的两套数据。
 * 卖家只能看到统计数字，看不到具体用户；用于匿名表达关注度。
 */
export const intentFavoriteRouter = createTRPCRouter({
  add: publicProcedure.input(z.object({ itemId: z.string().min(1) })).mutation(async ({ ctx, input }) => {
    const item = await db.item.findUnique({
      where: { id: input.itemId },
      select: { id: true, status: true },
    });
    if (!item) {
      throw new TRPCError({ code: "NOT_FOUND", message: "商品不存在或已被删除" });
    }
    if (item.status !== "ON_SALE") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          item.status === "EXPIRED" ? "商品已到期下架，无法新增意向标记" : "商品已下架，无法新增意向标记",
      });
    }

    const existing = await db.intentFavorite.findUnique({
      where: { userId_itemId: { userId: ctx.userId, itemId: item.id } },
      select: { id: true },
    });
    if (existing) return { intentFavorited: true as const };

    try {
      await db.intentFavorite.create({ data: { userId: ctx.userId, itemId: item.id } });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
    return { intentFavorited: true as const };
  }),

  remove: publicProcedure
    .input(z.object({ itemId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await db.intentFavorite.deleteMany({ where: { userId: ctx.userId, itemId: input.itemId } });
      return { intentFavorited: false as const };
    }),

  list: publicProcedure
    .input(
      z.object({
        page: z.number().int().min(1).max(1000).default(1),
        pageSize: z.number().int().min(1).max(24).default(12),
      }),
    )
    .query(async ({ ctx, input }) => {
      const [favorites, total] = await db.$transaction([
        db.intentFavorite.findMany({
          where: { userId: ctx.userId },
          include: { item: { select: ITEM_SELECT } },
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        db.intentFavorite.count({ where: { userId: ctx.userId } }),
      ]);

      return {
        items: favorites.map((favorite) => ({
          ...serializeItem(favorite.item),
          markedAt: favorite.createdAt,
        })),
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
      };
    }),
});
