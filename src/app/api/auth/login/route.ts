import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
  sessionExpiryDate,
  verifyPassword,
} from "@/server/auth";
import { ensureDatabase } from "@/server/bootstrap";
import { db } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 账号密码登录。
 * 学生入口 expectRole=USER，教师入口 expectRole=TEACHER，管理员入口 expectRole=ADMIN。
 * 角色以数据库为准，入口只用于防止误登录；成功后写入 httpOnly Cookie。
 */
export async function POST(req: Request) {
  await ensureDatabase();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式不正确" }, { status: 400 });
  }

  const payload = body as { studentNo?: unknown; password?: unknown; expectRole?: unknown };
  const studentNo = typeof payload.studentNo === "string" ? payload.studentNo.trim() : "";
  const password = typeof payload.password === "string" ? payload.password : "";
  const expectRole =
    payload.expectRole === "ADMIN"
      ? "ADMIN"
      : payload.expectRole === "TEACHER"
        ? "TEACHER"
        : payload.expectRole === "USER"
          ? "USER"
          : null;

  if (!studentNo || !password) {
    return NextResponse.json({ error: "请输入学号与密码" }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { studentNo },
    select: {
      id: true,
      name: true,
      role: true,
      studentNo: true,
      passwordHash: true,
      college: true,
      major: true,
      grade: true,
    },
  });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "学号或密码不正确" }, { status: 401 });
  }

  if (expectRole && user.role !== expectRole) {
    const hints: Record<string, string> = {
      ADMIN: "该账号不是管理员账号，请切换到教师或学生入口",
      TEACHER: "该账号不是教师账号，请切换到其他入口",
      USER: "教师 / 管理员账号请切换到对应入口登录",
    };
    return NextResponse.json({ error: hints[expectRole] ?? "账号角色不匹配" }, { status: 403 });
  }

  const token = createSessionToken();
  await db.session.create({
    data: { token, userId: user.id, expiresAt: sessionExpiryDate() },
  });

  const response = NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      studentNo: user.studentNo,
      college: user.college,
      major: user.major,
      grade: user.grade,
    },
  });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}
