import { ITEM_EXPIRE_MS } from "@/lib/constants";
import { db } from "./db";

/**
 * 惰性清理：在读取列表/详情/统计前，把超过有效期的在售闲置标记为 EXPIRED。
 * 不依赖定时任务，Serverless 与本地单进程都能生效。
 */
export async function expireStaleItems() {
  await db.item.updateMany({
    where: { status: "ON_SALE", expiresAt: { lt: new Date() } },
    data: { status: "EXPIRED" },
  });
}

export function nextExpiryDate(from: Date = new Date()) {
  return new Date(from.getTime() + ITEM_EXPIRE_MS);
}
