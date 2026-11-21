import { TRPCError } from "@trpc/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  BARGAIN_MODES,
  CATEGORIES,
  DEAL_TAGS,
  PAGE_SIZE,
  SCENE_TAGS,
} from "@/lib/constants";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { ITEM_SELECT, serializeItem } from "@/server/api/shared";
import { db } from "@/server/db";
import { expireStaleItems, nextExpiryDate } from "@/server/expiry";

const priceRange = z
  .number({ invalid_type_error: "价格区间需为数字" })
  .min(0, "价格不能为负数")
  .max(1_000_000)
  .optional();

const itemPayload = {
  title: z.string().trim().min(1, "标题不能为空").max(60, "标题最多 60 个字符"),
  category: z.enum(CATEGORIES, { message: "请选择有效的物品分类" }),
  sceneTags: z.array(z.enum(SCENE_TAGS)).max(SCENE_TAGS.length).default([]),
  dealTags: z.array(z.enum(DEAL_TAGS)).max(DEAL_TAGS.length).default([]),
  isGift: z.boolean().default(false),
  bargainMode: z.enum(BARGAIN_MODES).default("FREE_BARGAIN"),
  isbn: z.string().trim().max(32, "ISBN 最多 32 个字符").optional(),
  price: z
    .number({ invalid_type_error: "请输入有效的售价" })
    .finite()
    .min(0, "价格不能为负数")
    .max(1_000_000, "价格超出合理范围"),
  description: z.string().trim().max(500, "描述最多 500 个字符").optional(),
  imageUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .refine((value) => !value || /^https?:\/\//i.test(value), "图片链接需以 http(s):// 开头"),
};

type ItemPayload = {
  isGift: boolean;
  price: number;
  title: string;
  category: string;
  sceneTags: string[];
  dealTags: string[];
  bargainMode: string;
  isbn?: string;
  description?: string;
  imageUrl?: string;
};

/** 善意赠予必须 0 元：后端强制校验，抓包改价直接拒绝 */
function assertGiftPrice(payload: Pick<ItemPayload, "isGift" | "price">) {
  if (payload.isGift && payload.price !== 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "善意赠予的商品售价必须为 0 元" });
  }
}

export const itemRouter = createTRPCRouter({
  /** 闲置广场：只读查询，支持并发访问 */
  list: publicProcedure
    .input(
      z.object({
        keyword: z.string().trim().max(40).optional(),
        category: z.union([z.enum(CATEGORIES), z.literal("ALL")]).optional(),
        minPrice: priceRange,
        maxPrice: priceRange,
        isGift: z.boolean().optional(),
        sceneTag: z.enum(SCENE_TAGS).optional(),
        status: z.enum(["ON_SALE", "SOLD_OUT", "EXPIRED", "ALL"]).default("ALL"),
        page: z.number().int().min(1).max(1000).default(1),
        pageSize: z.number().int().min(1).max(24).default(PAGE_SIZE),
      }),
    )
    .query(async ({ input }) => {
      await expireStaleItems();
      const where: Prisma.ItemWhereInput = {};

      if (input.keyword) {
        where.OR = [
          { title: { contains: input.keyword } },
          { description: { contains: input.keyword } },
        ];
      }
      if (input.category && input.category !== "ALL") {
        where.category = input.category;
      }
      if (input.isGift === true) where.isGift = true;
      if (input.sceneTag) where.sceneTags = { contains: input.sceneTag };
      if (input.status === "ALL") where.status = { not: "EXPIRED" };
      else where.status = input.status;

      let min = input.minPrice;
      let max = input.maxPrice;
      if (typeof min === "number" && typeof max === "number" && min > max) {
        [min, max] = [max, min];
      }
      if (typeof min === "number" || typeof max === "number") {
        where.price = {
          ...(typeof min === "number" ? { gte: min } : {}),
          ...(typeof max === "number" ? { lte: max } : {}),
        };
      }

      const [items, total] = await db.$transaction([
        db.item.findMany({
          where,
          select: ITEM_SELECT,
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        db.item.count({ where }),
      ]);

      return {
        items: items.map(serializeItem),
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
      };
    }),

  /** 商品详情：附带收藏、意向收藏、出价与聊天锁状态 */
  byId: publicProcedure.input(z.object({ id: z.string().min(1) })).query(async ({ ctx, input }) => {
    await expireStaleItems();
    const item = await db.item.findUnique({ where: { id: input.id }, select: ITEM_SELECT });
    if (!item) {
      throw new TRPCError({ code: "NOT_FOUND", message: "商品不存在或已被删除" });
    }

    const [favorite, intentFavorite, intentCount, giftApprovalCount, myApproval, myBid, owner, threadCount] =
      await Promise.all([
        db.favorite.findUnique({
          where: { userId_itemId: { userId: ctx.userId, itemId: item.id } },
          select: { id: true },
        }),
        db.intentFavorite.findUnique({
          where: { userId_itemId: { userId: ctx.userId, itemId: item.id } },
          select: { id: true },
        }),
        db.intentFavorite.count({ where: { itemId: item.id } }),
        db.giftApproval.count({ where: { giftItemId: item.id } }),
        db.giftApproval.findUnique({
          where: { userId_giftItemId: { userId: ctx.userId, giftItemId: item.id } },
          select: { id: true },
        }),
        db.bid.findUnique({
          where: { userId_itemId: { userId: ctx.userId, itemId: item.id } },
          select: { price: true, status: true },
        }),
        db.user.findUnique({ where: { id: item.userId }, select: { name: true, campus: true } }),
        db.message.count({
          where: {
            relatedItemId: item.id,
            OR: [
              { fromUserId: ctx.userId, toUserId: item.userId },
              { fromUserId: item.userId, toUserId: ctx.userId },
            ],
          },
        }),
      ]);

    const isOwner = item.userId === ctx.userId;
    let chatUnlocked = true;
    let chatLockReason: string | null = null;
    if (!isOwner) {
      if (item.status !== "ON_SALE" && threadCount === 0) {
        chatUnlocked = false;
        chatLockReason = item.status === "EXPIRED" ? "商品已到期下架，无法发起新的对话" : "商品已下架，无法发起新的对话";
      } else if (item.bargainMode === "SILENT_BID" && myBid?.status !== "ACCEPTED") {
        chatUnlocked = false;
        chatLockReason = "等待卖家接受你的出价后方可对话";
      }
    }

    return {
      ...serializeItem(item),
      ownerName: owner?.name ?? "匿名同学",
      ownerCampus: owner?.campus ?? "",
      isOwner,
      isFavorited: Boolean(favorite),
      isIntentFavorited: Boolean(intentFavorite),
      intentCount,
      giftApprovalCount,
      hasApprovedGift: Boolean(myApproval),
      myBid: myBid ?? null,
      chatUnlocked,
      chatLockReason,
    };
  }),

  /** 同分类相似商品推荐：排除自己与已下架商品 */
  related: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ input }) => {
      await expireStaleItems();
      const item = await db.item.findUnique({
        where: { id: input.id },
        select: { id: true, category: true },
      });
      if (!item) return [];
      const items = await db.item.findMany({
        where: {
          id: { not: item.id },
          category: item.category,
          status: "ON_SALE",
        },
        select: ITEM_SELECT,
        orderBy: { createdAt: "desc" },
        take: 4,
      });
      return items.map(serializeItem);
    }),

  /** 我的发布：仅返回当前 userId 的商品，并附匿名意向收藏总数 */
  myItems: publicProcedure
    .input(
      z.object({
        keyword: z.string().trim().max(40).optional(),
        status: z.enum(["ALL", "EXPIRED"]).default("ALL"),
        page: z.number().int().min(1).max(1000).default(1),
        pageSize: z.number().int().min(1).max(50).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      await expireStaleItems();
      const where: Prisma.ItemWhereInput = { userId: ctx.userId };
      if (input.status === "EXPIRED") where.status = "EXPIRED";
      if (input.keyword) {
        where.OR = [
          { title: { contains: input.keyword } },
          { description: { contains: input.keyword } },
        ];
      }

      const [items, total] = await db.$transaction([
        db.item.findMany({
          where,
          select: ITEM_SELECT,
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        db.item.count({ where }),
      ]);

      const ids = items.map((item) => item.id);
      const grouped = ids.length
        ? await db.intentFavorite.groupBy({
            by: ["itemId"],
            where: { itemId: { in: ids } },
            _count: { _all: true },
          })
        : [];
      const intentMap = new Map(grouped.map((row) => [row.itemId, row._count._all]));

      return {
        items: items.map((item) => ({
          ...serializeItem(item),
          intentCount: intentMap.get(item.id) ?? 0,
        })),
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
      };
    }),

  /** 发布闲置：后端校验 + 短时间重复提交幂等防护 */
  create: publicProcedure.input(z.object(itemPayload)).mutation(async ({ ctx, input }) => {
    assertGiftPrice(input);
    const description = input.description?.length ? input.description : null;
    const imageUrl = input.imageUrl?.length ? input.imageUrl : null;
    const isbn = input.isbn?.length ? input.isbn : null;

    // 幂等兜底：同一用户 10 秒内提交完全相同的商品，直接返回已存在的记录
    const duplicate = await db.item.findFirst({
      where: {
        userId: ctx.userId,
        title: input.title,
        category: input.category,
        price: input.price,
        isGift: input.isGift,
        createdAt: { gte: new Date(Date.now() - 10_000) },
      },
      select: ITEM_SELECT,
      orderBy: { createdAt: "desc" },
    });
    if (duplicate) return serializeItem(duplicate);

    const created = await db.item.create({
      data: {
        title: input.title,
        category: input.category,
        sceneTags: JSON.stringify(input.sceneTags),
        dealTags: JSON.stringify(input.dealTags),
        isGift: input.isGift,
        bargainMode: input.bargainMode,
        isbn,
        price: input.price,
        description,
        imageUrl,
        status: "ON_SALE",
        expiresAt: nextExpiryDate(),
        userId: ctx.userId,
      },
      select: ITEM_SELECT,
    });
    return serializeItem(created);
  }),

  /** 编辑闲置：校验归属与状态，已下架商品不允许编辑 */
  update: publicProcedure
    .input(z.object({ id: z.string().min(1), ...itemPayload }))
    .mutation(async ({ ctx, input }) => {
      assertGiftPrice(input);
      const item = await db.item.findUnique({
        where: { id: input.id },
        select: { userId: true, status: true },
      });
      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "商品不存在或已被删除" });
      }
      if (item.userId !== ctx.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "无权编辑他人发布的商品" });
      }
      if (item.status !== "ON_SALE") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "仅上架中的商品可编辑，已到期请先重新上架" });
      }

      const updated = await db.item.update({
        where: { id: input.id },
        data: {
          title: input.title,
          category: input.category,
          sceneTags: JSON.stringify(input.sceneTags),
          dealTags: JSON.stringify(input.dealTags),
          isGift: input.isGift,
          bargainMode: input.bargainMode,
          isbn: input.isbn?.length ? input.isbn : null,
          price: input.price,
          description: input.description?.length ? input.description : null,
          imageUrl: input.imageUrl?.length ? input.imageUrl : null,
        },
        select: ITEM_SELECT,
      });
      return serializeItem(updated);
    }),

  /** 下架：ON_SALE → SOLD_OUT 单向流转，重复下架幂等返回成功 */
  offShelf: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const item = await db.item.findUnique({ where: { id: input.id }, select: ITEM_SELECT });
      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "商品不存在或已被删除" });
      }
      if (item.userId !== ctx.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "无权下架他人发布的商品" });
      }
      if (item.status === "SOLD_OUT") return serializeItem(item);

      const updated = await db.item.update({
        where: { id: item.id },
        data: { status: "SOLD_OUT" },
        select: ITEM_SELECT,
      });
      return serializeItem(updated);
    }),

  /** 到期重新上架：续期 14 天，仅本人可操作 */
  relist: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const item = await db.item.findUnique({
        where: { id: input.id },
        select: { id: true, userId: true, status: true },
      });
      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "商品不存在或已被删除" });
      }
      if (item.userId !== ctx.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "无权操作他人发布的商品" });
      }
      if (item.status !== "EXPIRED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "只有已到期的商品需要重新上架" });
      }
      const updated = await db.item.update({
        where: { id: item.id },
        data: { status: "ON_SALE", expiresAt: nextExpiryDate() },
        select: ITEM_SELECT,
      });
      return serializeItem(updated);
    }),

  /** 删除自己发布的闲置：清理关联记录后硬删除，避免遗留孤儿数据 */
  remove: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const item = await db.item.findUnique({
        where: { id: input.id },
        select: { id: true, userId: true },
      });
      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "商品不存在或已被删除" });
      }
      if (item.userId !== ctx.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "无权删除他人发布的商品" });
      }
      await db.$transaction([
        db.favorite.deleteMany({ where: { itemId: item.id } }),
        db.intentFavorite.deleteMany({ where: { itemId: item.id } }),
        db.bid.deleteMany({ where: { itemId: item.id } }),
        db.giftApproval.deleteMany({ where: { giftItemId: item.id } }),
        db.message.updateMany({
          where: { relatedItemId: item.id },
          data: { relatedItemId: null },
        }),
        db.report.updateMany({
          where: { targetItemId: item.id },
          data: { targetItemId: null },
        }),
        db.item.delete({ where: { id: item.id } }),
      ]);
      return { ok: true };
    }),

  /** 顶栏到期提醒角标 */
  expiredCount: publicProcedure.query(async ({ ctx }) => {
    await expireStaleItems();
    const count = await db.item.count({
      where: { userId: ctx.userId, status: "EXPIRED" },
    });
    return { count };
  }),
});
