import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { db } from "@/server/db";
import { expireStaleItems } from "@/server/expiry";

/** 首页统计：英雄区数字与通知条共用 */
export const statsRouter = createTRPCRouter({
  overview: publicProcedure.query(async () => {
    await expireStaleItems();
    const [onSale, totalItems, gifts, members, wishes] = await Promise.all([
      db.item.count({ where: { status: "ON_SALE" } }),
      db.item.count(),
      db.item.count({ where: { isGift: true } }),
      db.user.count({ where: { role: "USER" } }),
      db.wishPurchase.count({ where: { isActive: true, expireAt: { gt: new Date() } } }),
    ]);
    return { onSale, totalItems, gifts, members, wishes };
  }),
});
