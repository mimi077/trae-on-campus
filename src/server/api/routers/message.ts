import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { getUserMap } from "@/server/api/shared";
import { db } from "@/server/db";

const targetInput = {
  peerId: z.string().min(1),
  itemId: z.string().min(1).optional(),
  wishId: z.string().min(1).optional(),
};

function threadWhere(me: string, peerId: string, itemId?: string, wishId?: string) {
  return {
    OR: [
      { fromUserId: me, toUserId: peerId },
      { fromUserId: peerId, toUserId: me },
    ],
    ...(itemId ? { relatedItemId: itemId } : {}),
    ...(wishId ? { relatedWishId: wishId } : {}),
    ...(!itemId && !wishId ? { relatedItemId: null, relatedWishId: null } : {}),
  };
}

async function loadTarget(itemId?: string, wishId?: string) {
  if (itemId) {
    const item = await db.item.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        title: true,
        userId: true,
        status: true,
        bargainMode: true,
      },
    });
    if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "关联商品不存在" });
    return { kind: "item" as const, item };
  }
  if (wishId) {
    const wish = await db.wishPurchase.findUnique({
      where: { id: wishId },
      select: { id: true, title: true, userId: true, isActive: true, expireAt: true },
    });
    if (!wish) throw new TRPCError({ code: "NOT_FOUND", message: "关联求购心愿不存在" });
    return { kind: "wish" as const, wish };
  }
  throw new TRPCError({ code: "BAD_REQUEST", message: "缺少会话关联的商品或心愿" });
}

/**
 * 会话锁规则：
 * - 静默出价商品：非卖家需有 ACCEPTED 出价才能发言；
 * - 已下架商品：允许继续已有会话，但不能再发起新会话；
 * - 求购心愿：过期/关闭后允许查看历史，不能发起新会话。
 * 全部在服务端校验，前端输入框置灰只是体验层。
 */
async function assertCanSend(me: string, peerId: string, itemId?: string, wishId?: string) {
  if (me === peerId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "不能与自己发起会话" });
  }
  const peer = await db.user.findUnique({ where: { id: peerId }, select: { id: true, name: true } });
  if (!peer) throw new TRPCError({ code: "NOT_FOUND", message: "会话对方不存在" });

  const target = await loadTarget(itemId, wishId);
  const targetOwnerId = target.kind === "item" ? target.item.userId : target.wish.userId;

  if (me !== targetOwnerId && peerId !== targetOwnerId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "会话对象与关联商品/心愿不匹配" });
  }

  const threadCount = await db.message.count({
    where: threadWhere(me, peerId, itemId, wishId),
  });

  if (target.kind === "item") {
    if (target.item.status !== "ON_SALE" && threadCount === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          target.item.status === "EXPIRED" ? "商品已到期下架，无法发起新的对话" : "商品已下架，无法发起新的对话",
      });
    }
    if (target.item.bargainMode === "SILENT_BID" && me !== targetOwnerId) {
      const bid = await db.bid.findUnique({
        where: { userId_itemId: { userId: me, itemId: target.item.id } },
        select: { status: true },
      });
      if (bid?.status !== "ACCEPTED") {
        throw new TRPCError({ code: "FORBIDDEN", message: "等待卖家接受你的出价后方可对话" });
      }
    }
  } else {
    const expired = !target.wish.isActive || target.wish.expireAt.getTime() <= Date.now();
    if (expired && threadCount === 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "该求购心愿已过期或关闭，无法发起新的对话" });
    }
  }

  return { peer, target };
}

export const messageRouter = createTRPCRouter({
  /** 会话列表：按「对方 + 关联来源」聚合，取最后一条消息作为摘要 */
  conversations: publicProcedure.query(async ({ ctx }) => {
    const messages = await db.message.findMany({
      where: {
        OR: [{ fromUserId: ctx.userId }, { toUserId: ctx.userId }],
      },
      orderBy: { createdAt: "desc" },
    });
    if (messages.length === 0) return [];

    const groups = new Map<
      string,
      {
        peerId: string;
        itemId: string | null;
        wishId: string | null;
        lastMessage: string;
        lastAt: Date;
      }
    >();

    for (const message of messages) {
      const peerId = message.fromUserId === ctx.userId ? message.toUserId : message.fromUserId;
      const key = `${peerId}|${message.relatedItemId ?? ""}|${message.relatedWishId ?? ""}`;
      if (groups.has(key)) continue;
      groups.set(key, {
        peerId,
        itemId: message.relatedItemId,
        wishId: message.relatedWishId,
        lastMessage: message.content,
        lastAt: message.createdAt,
      });
    }

    const rows = Array.from(groups.values());
    const users = await getUserMap(db, rows.map((row) => row.peerId));
    const itemIds = rows.map((row) => row.itemId).filter((id): id is string => Boolean(id));
    const wishIds = rows.map((row) => row.wishId).filter((id): id is string => Boolean(id));

    const [items, wishes] = await Promise.all([
      itemIds.length
        ? db.item.findMany({ where: { id: { in: itemIds } }, select: { id: true, title: true } })
        : Promise.resolve([]),
      wishIds.length
        ? db.wishPurchase.findMany({
            where: { id: { in: wishIds } },
            select: { id: true, title: true },
          })
        : Promise.resolve([]),
    ]);
    const itemMap = new Map(items.map((item) => [item.id, item.title]));
    const wishMap = new Map(wishes.map((wish) => [wish.id, wish.title]));

    return rows.map((row) => ({
      ...row,
      peerName: users.get(row.peerId)?.name ?? "匿名同学",
      itemTitle: row.itemId ? (itemMap.get(row.itemId) ?? "商品已删除") : null,
      wishTitle: row.wishId ? (wishMap.get(row.wishId) ?? "心愿已删除") : null,
    }));
  }),

  list: publicProcedure.input(z.object(targetInput)).query(async ({ ctx, input }) => {
    const messages = await db.message.findMany({
      where: threadWhere(ctx.userId, input.peerId, input.itemId, input.wishId),
      orderBy: { createdAt: "asc" },
    });
    return messages.map((message) => ({
      ...message,
      mine: message.fromUserId === ctx.userId,
    }));
  }),

  /** 聊天编辑状态：输入框是否可用、锁定原因、对方与来源信息 */
  chatState: publicProcedure.input(z.object(targetInput)).query(async ({ ctx, input }) => {
    const peer = await db.user.findUnique({
      where: { id: input.peerId },
      select: { id: true, name: true, campus: true },
    });
    if (!peer) throw new TRPCError({ code: "NOT_FOUND", message: "会话对方不存在" });

    const target = await loadTarget(input.itemId, input.wishId);
    const threadCount = await db.message.count({
      where: threadWhere(ctx.userId, input.peerId, input.itemId, input.wishId),
    });

    let canSend = true;
    let reason: string | null = null;
    if (ctx.userId === input.peerId) {
      canSend = false;
      reason = "不能与自己发起会话";
    } else if (target.kind === "item") {
      if (target.item.status !== "ON_SALE" && threadCount === 0) {
        canSend = false;
        reason =
          target.item.status === "EXPIRED" ? "商品已到期下架，无法发起新的对话" : "商品已下架，无法发起新的对话";
      } else if (target.item.bargainMode === "SILENT_BID" && ctx.userId !== target.item.userId) {
        const bid = await db.bid.findUnique({
          where: { userId_itemId: { userId: ctx.userId, itemId: target.item.id } },
          select: { status: true },
        });
        if (bid?.status !== "ACCEPTED") {
          canSend = false;
          reason = "等待卖家接受你的出价后方可对话";
        }
      }
    } else {
      const expired = !target.wish.isActive || target.wish.expireAt.getTime() <= Date.now();
      if (expired && threadCount === 0) {
        canSend = false;
        reason = "该求购心愿已过期或关闭，无法发起新的对话";
      }
    }

    return {
      peer,
      targetTitle: target.kind === "item" ? target.item.title : target.wish.title,
      targetKind: target.kind,
      canSend,
      reason,
      threadCount,
    };
  }),

  send: publicProcedure
    .input(
      z.object({
        ...targetInput,
        content: z.string().trim().min(1, "消息不能为空").max(500, "消息最多 500 个字符"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCanSend(ctx.userId, input.peerId, input.itemId, input.wishId);
      return db.message.create({
        data: {
          fromUserId: ctx.userId,
          toUserId: input.peerId,
          content: input.content,
          relatedItemId: input.itemId ?? null,
          relatedWishId: input.wishId ?? null,
        },
      });
    }),
});
