import { TRPCError } from "@trpc/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { CATEGORIES, PAGE_SIZE } from "@/lib/constants";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import {
  WISH_SELECT,
  getUserMap,
  serializeWish,
  wishIsExpired,
} from "@/server/api/shared";
import { db } from "@/server/db";

const wishPayload = {
  title: z.string().trim().min(1, "求购标题不能为空").max(60, "标题最多 60 个字符"),
  category: z.enum(CATEGORIES, { message: "请选择有效的分类" }),
  expectPrice: z
    .number({ invalid_type_error: "请输入有效的心理价位" })
    .finite()
    .min(0, "价格不能为负数")
    .max(1_000_000, "价格超出合理范围"),
  description: z.string().trim().max(500, "描述最多 500 个字符").optional(),
};

export const wishRouter = createTRPCRouter({
  list: publicProcedure
    .input(
      z.object({
        keyword: z.string().trim().max(40).optional(),
        category: z.union([z.enum(CATEGORIES), z.literal("ALL")]).optional(),
        page: z.number().int().min(1).max(1000).default(1),
        pageSize: z.number().int().min(1).max(24).default(PAGE_SIZE),
      }),
    )
    .query(async ({ input }) => {
      const where: Prisma.WishPurchaseWhereInput = {};
      if (input.keyword) {
        where.OR = [
          { title: { contains: input.keyword } },
          { description: { contains: input.keyword } },
        ];
      }
      if (input.category && input.category !== "ALL") where.category = input.category;

      const [wishes, total] = await db.$transaction([
        db.wishPurchase.findMany({
          where,
          select: WISH_SELECT,
          orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        db.wishPurchase.count({ where }),
      ]);

      const users = await getUserMap(db, wishes.map((wish) => wish.userId));
      return {
        items: wishes.map((wish) => ({
          ...serializeWish(wish),
          userName: users.get(wish.userId)?.name ?? "匿名同学",
        })),
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
      };
    }),

  byId: publicProcedure.input(z.object({ id: z.string().min(1) })).query(async ({ ctx, input }) => {
    const wish = await db.wishPurchase.findUnique({ where: { id: input.id }, select: WISH_SELECT });
    if (!wish) {
      throw new TRPCError({ code: "NOT_FOUND", message: "求购心愿不存在或已被删除" });
    }
    const owner = await db.user.findUnique({
      where: { id: wish.userId },
      select: { name: true, campus: true },
    });
    const serialized = serializeWish(wish);
    return {
      ...serialized,
      userName: owner?.name ?? "匿名同学",
      userCampus: owner?.campus ?? "",
      isOwner: wish.userId === ctx.userId,
      canChat: !serialized.expired,
    };
  }),

  myWishes: publicProcedure
    .input(
      z.object({
        page: z.number().int().min(1).max(1000).default(1),
        pageSize: z.number().int().min(1).max(50).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const [wishes, total] = await db.$transaction([
        db.wishPurchase.findMany({
          where: { userId: ctx.userId },
          select: WISH_SELECT,
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        db.wishPurchase.count({ where: { userId: ctx.userId } }),
      ]);
      return {
        items: wishes.map(serializeWish),
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
      };
    }),

  create: publicProcedure
    .input(z.object({ ...wishPayload, validDays: z.union([z.literal(7), z.literal(14)]) }))
    .mutation(async ({ ctx, input }) => {
      const description = input.description?.length ? input.description : null;

      const duplicate = await db.wishPurchase.findFirst({
        where: {
          userId: ctx.userId,
          title: input.title,
          category: input.category,
          expectPrice: input.expectPrice,
          createdAt: { gte: new Date(Date.now() - 10_000) },
        },
        select: WISH_SELECT,
      });
      if (duplicate) return serializeWish(duplicate);

      const created = await db.wishPurchase.create({
        data: {
          userId: ctx.userId,
          title: input.title,
          category: input.category,
          expectPrice: input.expectPrice,
          description,
          expireAt: new Date(Date.now() + input.validDays * 86_400_000),
          isActive: true,
        },
        select: WISH_SELECT,
      });
      return serializeWish(created);
    }),

  /** 关闭心愿：仅发布者，已关闭时幂等返回成功 */
  close: publicProcedure.input(z.object({ id: z.string().min(1) })).mutation(async ({ ctx, input }) => {
    const wish = await db.wishPurchase.findUnique({
      where: { id: input.id },
      select: { userId: true, isActive: true },
    });
    if (!wish) {
      throw new TRPCError({ code: "NOT_FOUND", message: "求购心愿不存在或已被删除" });
    }
    if (wish.userId !== ctx.userId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "无权关闭他人发布的求购心愿" });
    }
    if (!wish.isActive) {
      const current = await db.wishPurchase.findUniqueOrThrow({
        where: { id: input.id },
        select: WISH_SELECT,
      });
      return serializeWish(current);
    }
    const updated = await db.wishPurchase.update({
      where: { id: input.id },
      data: { isActive: false },
      select: WISH_SELECT,
    });
    return serializeWish(updated);
  }),

  /** 供聊天模块复用：判断心愿是否仍可发起对话 */
  chatState: publicProcedure.input(z.object({ id: z.string().min(1) })).query(async ({ ctx, input }) => {
    const wish = await db.wishPurchase.findUnique({ where: { id: input.id }, select: WISH_SELECT });
    if (!wish) throw new TRPCError({ code: "NOT_FOUND", message: "求购心愿不存在" });
    const owner = await db.user.findUnique({ where: { id: wish.userId }, select: { name: true } });
    return {
      id: wish.id,
      userId: wish.userId,
      userName: owner?.name ?? "匿名同学",
      title: wish.title,
      isOwner: wish.userId === ctx.userId,
      expired: wishIsExpired(wish),
    };
  }),
});
