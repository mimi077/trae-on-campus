import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { ITEM_SELECT, isUniqueViolation, serializeItem } from "@/server/api/shared";
import { db } from "@/server/db";

/**
 * 善意赠予认可：
 * - 仅 isGift=true 的商品可被认可；
 * - 同一用户对同一赠予物只能认可一次（数据库唯一索引兜底，重复调用幂等）；
 * - 不能给自己的赠予物点认可。
 */
export const giftRouter = createTRPCRouter({
  approve: publicProcedure.input(z.object({ itemId: z.string().min(1) })).mutation(async ({ ctx, input }) => {
    const item = await db.item.findUnique({
      where: { id: input.itemId },
      select: { id: true, userId: true, isGift: true },
    });
    if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "商品不存在或已被删除" });
    if (!item.isGift) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "只有善意赠予的商品才能提交善意认可" });
    }
    if (item.userId === ctx.userId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "不能认可自己赠予的物品" });
    }

    const existing = await db.giftApproval.findUnique({
      where: { userId_giftItemId: { userId: ctx.userId, giftItemId: item.id } },
      select: { id: true },
    });
    if (existing) {
      const count = await db.giftApproval.count({ where: { giftItemId: item.id } });
      return { approved: true as const, count };
    }

    try {
      await db.giftApproval.create({
        data: { giftItemId: item.id, userId: ctx.userId },
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
    const count = await db.giftApproval.count({ where: { giftItemId: item.id } });
    return { approved: true as const, count };
  }),

  /** 我赠予的物品：展示收到的善意认可数量 */
  myGiven: publicProcedure.query(async ({ ctx }) => {
    const items = await db.item.findMany({
      where: { userId: ctx.userId, isGift: true },
      select: ITEM_SELECT,
      orderBy: { createdAt: "desc" },
    });
    const ids = items.map((item) => item.id);
    const grouped = ids.length
      ? await db.giftApproval.groupBy({
          by: ["giftItemId"],
          where: { giftItemId: { in: ids } },
          _count: { _all: true },
        })
      : [];
    const countMap = new Map(grouped.map((row) => [row.giftItemId, row._count._all]));
    return items.map((item) => ({
      ...serializeItem(item),
      approvalCount: countMap.get(item.id) ?? 0,
    }));
  }),

  /** 我点过的善意认可记录 */
  myApprovals: publicProcedure.query(async ({ ctx }) => {
    const approvals = await db.giftApproval.findMany({
      where: { userId: ctx.userId },
      orderBy: { createdAt: "desc" },
    });
    if (approvals.length === 0) return [];
    const items = await db.item.findMany({
      where: { id: { in: approvals.map((approval) => approval.giftItemId) } },
      select: ITEM_SELECT,
    });
    const itemMap = new Map(items.map((item) => [item.id, serializeItem(item)]));
    return approvals
      .map((approval) => {
        const item = itemMap.get(approval.giftItemId);
        if (!item) return null;
        return { id: approval.id, approvedAt: approval.createdAt, item };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
  }),
});
