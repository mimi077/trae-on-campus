import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { getUserMap, isUniqueViolation } from "@/server/api/shared";
import { db } from "@/server/db";

/**
 * 静默议价出价：
 * - 仅 SILENT_BID 商品可出价；
 * - 同一用户对同一商品只能出价一次（数据库唯一索引兜底，重复调用幂等返回）；
 * - 卖家接受后才能解锁聊天。
 */
export const bidRouter = createTRPCRouter({
  submit: publicProcedure
    .input(
      z.object({
        itemId: z.string().min(1),
        price: z
          .number({ invalid_type_error: "请输入有效的出价" })
          .finite()
          .min(0, "出价不能为负数")
          .max(1_000_000, "出价超出合理范围"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const item = await db.item.findUnique({
        where: { id: input.itemId },
        select: { id: true, userId: true, status: true, bargainMode: true },
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "商品不存在或已被删除" });
      if (item.userId === ctx.userId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "不能对自己发布的商品出价" });
      }
      if (item.status !== "ON_SALE") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: item.status === "EXPIRED" ? "商品已到期下架，无法提交出价" : "商品已下架，无法提交出价",
        });
      }
      if (item.bargainMode !== "SILENT_BID") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "该商品未开启静默出价模式" });
      }

      const existing = await db.bid.findUnique({
        where: { userId_itemId: { userId: ctx.userId, itemId: item.id } },
      });
      if (existing) {
        return { bid: { price: existing.price, status: existing.status }, duplicated: true };
      }

      try {
        const bid = await db.bid.create({
          data: { itemId: item.id, userId: ctx.userId, price: input.price, status: "PENDING" },
        });
        return { bid: { price: bid.price, status: bid.status }, duplicated: false };
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        const current = await db.bid.findUniqueOrThrow({
          where: { userId_itemId: { userId: ctx.userId, itemId: item.id } },
        });
        return { bid: { price: current.price, status: current.status }, duplicated: true };
      }
    }),

  myBidForItem: publicProcedure
    .input(z.object({ itemId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const bid = await db.bid.findUnique({
        where: { userId_itemId: { userId: ctx.userId, itemId: input.itemId } },
        select: { price: true, status: true, createdAt: true },
      });
      return bid;
    }),

  /** 卖家查看商品收到的全部出价（仅商品发布者可调用） */
  listForOwner: publicProcedure
    .input(z.object({ itemId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const item = await db.item.findUnique({
        where: { id: input.itemId },
        select: { userId: true },
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "商品不存在或已被删除" });
      if (item.userId !== ctx.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "仅商品发布者可查看出价" });
      }
      const bids = await db.bid.findMany({
        where: { itemId: input.itemId },
        orderBy: [{ price: "desc" }, { createdAt: "desc" }],
      });
      const users = await getUserMap(db, bids.map((bid) => bid.userId));
      return bids.map((bid) => ({
        ...bid,
        userName: users.get(bid.userId)?.name ?? "匿名同学",
      }));
    }),

  /** 卖家接受 / 拒绝出价：仅 PENDING 可处理，重复相同操作幂等 */
  decide: publicProcedure
    .input(
      z.object({
        bidId: z.string().min(1),
        action: z.enum(["ACCEPTED", "REJECTED"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const bid = await db.bid.findUnique({
        where: { id: input.bidId },
        select: { id: true, itemId: true, status: true },
      });
      if (!bid) throw new TRPCError({ code: "NOT_FOUND", message: "出价记录不存在" });

      const item = await db.item.findUnique({
        where: { id: bid.itemId },
        select: { userId: true },
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "商品不存在或已被删除" });
      if (item.userId !== ctx.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "仅商品发布者可处理出价" });
      }
      if (bid.status !== "PENDING") {
        if (bid.status === input.action) return { status: bid.status };
        throw new TRPCError({ code: "BAD_REQUEST", message: "该出价已处理，不能重复修改" });
      }

      await db.bid.update({ where: { id: bid.id }, data: { status: input.action } });
      return { status: input.action };
    }),
});
