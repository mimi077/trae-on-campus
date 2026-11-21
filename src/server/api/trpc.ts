import { initTRPC, TRPCError } from "@trpc/server";
import { cookies } from "next/headers";
import superjson from "superjson";
import { ZodError } from "zod";
import { isStaffRole } from "@/lib/constants";
import { SESSION_COOKIE } from "@/server/auth";
import { db } from "@/server/db";

export type SessionUser = {
  id: string;
  name: string;
  campus: string;
  role: string;
  studentNo: string | null;
  college: string | null;
  major: string | null;
  grade: string | null;
  className: string | null;
  authStatus: string;
  bio: string | null;
  avatarColor: string | null;
};

export type Context = {
  userId: string;
  user: SessionUser;
  headers: Headers;
  /** 当前请求是否携带了有效登录会话（Cookie） */
  authenticated: boolean;
  /** 当前会话 token，用于退出登录 / 修改密码时定位记录 */
  sessionToken: string | null;
};

/** 未登录访客：不再回退到某个真实用户，避免匿名请求冒用他人身份读写数据 */
const GUEST_USER: SessionUser = {
  id: "guest",
  name: "访客",
  campus: "",
  role: "GUEST",
  studentNo: null,
  college: null,
  major: null,
  grade: null,
  className: null,
  authStatus: "UNAUTH",
  bio: null,
  avatarColor: null,
};

/**
 * 身份来源（安全约定）：
 * 1. 正式登录：httpOnly Cookie `campus_session` → Session 表校验有效期 → 用户；
 * 2. 冒烟测试：仅在显式设置 `ALLOW_TEST_HEADER=1` 时允许 `x-user-id`，生产环境默认关闭；
 * 3. 其余情况一律视为访客，不冒用任何真实账号。
 * 角色与 userId 一律从数据库读取，绝不信任前端传入的角色字段。
 */
export async function createTRPCContext(opts: { headers: Headers }): Promise<Context> {
  let token: string | null = null;
  try {
    const jar = await cookies();
    token = jar.get(SESSION_COOKIE)?.value ?? null;
  } catch {
    token = null;
  }

  let sessionUserId: string | null = null;
  if (token) {
    const session = await db.session.findUnique({
      where: { token },
      select: { userId: true, expiresAt: true },
    });
    if (session && session.expiresAt.getTime() > Date.now()) {
      sessionUserId = session.userId;
    }
  }

  const allowTestHeader = process.env.ALLOW_TEST_HEADER === "1";
  const headerUserId = allowTestHeader ? opts.headers.get("x-user-id") : null;
  const userId = sessionUserId ?? headerUserId ?? null;

  const select = {
    id: true,
    name: true,
    campus: true,
    role: true,
    studentNo: true,
    college: true,
    major: true,
    grade: true,
    className: true,
    authStatus: true,
    bio: true,
    avatarColor: true,
  } as const;

  const record = userId ? await db.user.findUnique({ where: { id: userId }, select }) : null;
  const user: SessionUser = record ?? GUEST_USER;

  return {
    userId: user.id,
    user,
    headers: opts.headers,
    authenticated: Boolean(record && (sessionUserId || headerUserId)),
    sessionToken: token,
  };
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;

/**
 * 写操作按用户节流：单实例内存计数，60 秒内最多 60 次。
 * 用于抵御脚本刷报名 / 刷发布，正常用户远低于该阈值。
 */
const mutationBuckets = new Map<string, { count: number; resetAt: number }>();
const MUTATION_LIMIT = 60;
const MUTATION_WINDOW_MS = 60_000;

function checkMutationRate(userId: string) {
  const now = Date.now();
  if (mutationBuckets.size > 5_000) {
    for (const [key, bucket] of mutationBuckets) {
      if (now > bucket.resetAt) mutationBuckets.delete(key);
    }
  }
  const bucket = mutationBuckets.get(userId);
  if (!bucket || now > bucket.resetAt) {
    mutationBuckets.set(userId, { count: 1, resetAt: now + MUTATION_WINDOW_MS });
    return;
  }
  bucket.count += 1;
  if (bucket.count > MUTATION_LIMIT) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "操作过于频繁，请稍后再试" });
  }
}

/**
 * 所有写操作必须登录：未认证请求即使绕过页面守卫直接调用接口，也无法写入数据。
 * 在 tRPC 中间件层统一拦截，避免逐个 router 遗漏。
 */
const baseProcedure = t.procedure.use(async ({ ctx, type, next }) => {
  if (type === "mutation") {
    if (!ctx.authenticated) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "请先登录后再操作" });
    }
    checkMutationRate(ctx.userId);
  }
  return next();
});

export const publicProcedure = baseProcedure;

/** 教师 / 管理员接口：活动审核、失物审核、报名名单等管理端能力 */
export const staffProcedure = baseProcedure.use(async ({ ctx, next }) => {
  if (!isStaffRole(ctx.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "仅教师或管理员可执行该操作" });
  }
  return next({ ctx });
});

/** 管理员接口：服务端强制校验 role，普通用户抓包调用会直接 FORBIDDEN */
export const adminProcedure = baseProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== "ADMIN") {
    throw new TRPCError({ code: "FORBIDDEN", message: "仅管理员可执行该操作" });
  }
  return next({ ctx });
});
