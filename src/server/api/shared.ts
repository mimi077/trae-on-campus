import type { Prisma, PrismaClient } from "@prisma/client";
import { Prisma as PrismaNamespace } from "@prisma/client";

export const ITEM_SELECT = {
  id: true,
  title: true,
  category: true,
  sceneTags: true,
  dealTags: true,
  isGift: true,
  bargainMode: true,
  isbn: true,
  price: true,
  description: true,
  imageUrl: true,
  status: true,
  expiresAt: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ItemSelect;

export const WISH_SELECT = {
  id: true,
  userId: true,
  title: true,
  category: true,
  expectPrice: true,
  description: true,
  expireAt: true,
  isActive: true,
  createdAt: true,
} satisfies Prisma.WishPurchaseSelect;

export function isUniqueViolation(error: unknown) {
  return error instanceof PrismaNamespace.PrismaClientKnownRequestError && error.code === "P2002";
}

export function parseSceneTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((tag): tag is string => typeof tag === "string");
  } catch {
    return [];
  }
}

/** 把数据库中的 sceneTags / dealTags JSON 字符串转成数组后再返回给前端 */
export function serializeItem<T extends { sceneTags: string; dealTags?: string | null }>(item: T) {
  return {
    ...item,
    sceneTags: parseSceneTags(item.sceneTags),
    dealTags: parseSceneTags(item.dealTags),
  };
}

export function wishIsExpired(wish: { isActive: boolean; expireAt: Date }) {
  return !wish.isActive || wish.expireAt.getTime() <= Date.now();
}

export function serializeWish<T extends { isActive: boolean; expireAt: Date }>(wish: T) {
  const expired = wishIsExpired(wish);
  return { ...wish, expired, status: expired ? ("EXPIRED" as const) : ("ACTIVE" as const) };
}

/** 批量取用户名，避免为每个列表项单独查询 */
export async function getUserMap(db: PrismaClient, ids: string[]) {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return new Map<string, { name: string; campus: string; role: string }>();
  const users = await db.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true, campus: true, role: true },
  });
  return new Map(users.map((user) => [user.id, { name: user.name, campus: user.campus, role: user.role }]));
}
