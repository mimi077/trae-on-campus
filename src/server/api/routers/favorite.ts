import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { ITEM_SELECT, isUniqueViolation, serializeItem } from "@/server/api/shared";
import { db } from "@/server/db";

export const favoriteRouter = createTRPCRouter({
  /**
   * 收藏（每人一票）：
   * 1. 商品已下架 → 拒绝新增收藏；
   * 2. 已收藏 → 幂等返回成功，不重复写库；
   * 3. 并发插入 → 由 @@unique([userId, itemId]) 兜底，P2002 视为已收藏。
   */
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
        message: item.status === "EXPIRED" ? "商品已到期下架，无法新增收藏" : "商品已下架，无法新增收藏",
      });
    }

    const existing = await db.favorite.findUnique({
      where: { userId_itemId: { userId: ctx.userId, itemId: item.id } },
      select: { id: true },
    });
    if (existing) return { favorited: true as const };

    try {
      await db.favorite.create({ data: { userId: ctx.userId, itemId: item.id } });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }

    return { favorited: true as const };
  }),

  /** 取消收藏：记录不存在时直接返回成功（幂等），已下架商品的历史收藏仍可取消 */
  remove: publicProcedure
    .input(z.object({ itemId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await db.favorite.deleteMany({ where: { userId: ctx.userId, itemId: input.itemId } });
      return { favorited: false as const };
    }),

  /** 我的普通收藏：按收藏时间倒序，已下架商品保留展示 */
  list: publicProcedure
    .input(
      z.object({
        page: z.number().int().min(1).max(1000).default(1),
        pageSize: z.number().int().min(1).max(24).default(12),
      }),
    )
    .query(async ({ ctx, input }) => {
      const [favorites, total] = await db.$transaction([
        db.favorite.findMany({
          where: { userId: ctx.userId },
          include: { item: { select: ITEM_SELECT } },
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        db.favorite.count({ where: { userId: ctx.userId } }),
      ]);

      return {
        items: favorites.map((favorite) => ({
          ...serializeItem(favorite.item),
          favoritedAt: favorite.createdAt,
        })),
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
      };
    }),
});
