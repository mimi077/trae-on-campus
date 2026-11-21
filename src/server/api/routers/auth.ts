import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { AVATAR_KEYS } from "@/lib/constants";
import { hashPassword, verifyPassword } from "@/server/auth";
import { isUniqueViolation } from "@/server/api/shared";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { db } from "@/server/db";

const passwordPattern = /^(?=.*[A-Za-z])(?=.*\d).{8,32}$/;

export const authRouter = createTRPCRouter({
  /** 当前登录用户：前端根据 role 条件渲染管理后台入口 */
  me: publicProcedure.query(({ ctx }) => ({
    id: ctx.user.id,
    name: ctx.user.name,
    campus: ctx.user.campus,
    role: ctx.user.role,
    studentNo: ctx.user.studentNo,
    college: ctx.user.college,
    major: ctx.user.major,
    grade: ctx.user.grade,
    className: ctx.user.className,
    authStatus: ctx.user.authStatus,
    bio: ctx.user.bio,
    avatarColor: ctx.user.avatarColor,
    isAdmin: ctx.user.role === "ADMIN",
    isStaff: ctx.user.role === "ADMIN" || ctx.user.role === "TEACHER",
    needsProfileAuth: ctx.user.role === "USER" && ctx.user.authStatus !== "AUTHED",
    authenticated: ctx.authenticated,
  })),

  /** 学生完整身份认证：学院 / 专业 / 年级 / 班级，写入后 authStatus = AUTHED */
  submitProfileAuth: publicProcedure
    .input(
      z.object({
        college: z.string().trim().min(1, "请选择学院").max(30, "学院最多 30 个字符"),
        grade: z.string().trim().min(1, "请选择年级").max(20, "年级最多 20 个字符"),
        major: z.string().trim().min(2, "请填写专业").max(30, "专业最多 30 个字符"),
        className: z.string().trim().min(2, "请填写班级").max(30, "班级最多 30 个字符"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.authenticated) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "请先登录后再进行身份认证" });
      }
      if (ctx.user.role !== "USER") {
        throw new TRPCError({ code: "FORBIDDEN", message: "教师与管理员账号无需学生身份认证" });
      }
      const updated = await db.user.update({
        where: { id: ctx.userId },
        data: {
          college: input.college,
          grade: input.grade,
          major: input.major,
          className: input.className,
          authStatus: "AUTHED",
          campus: `${input.college} · ${input.grade}`,
        },
        select: { id: true, authStatus: true, college: true, grade: true, major: true, className: true },
      });
      return updated;
    }),

  /** 个人资料编辑：学号是登录账号，修改时校验唯一性 */
  updateProfile: publicProcedure
    .input(
      z.object({
        name: z.string().trim().min(2, "姓名至少 2 个字符").max(20, "姓名最多 20 个字符"),
        studentNo: z
          .string()
          .trim()
          .regex(/^[A-Za-z0-9]{4,20}$/, "学号需为 4-20 位字母或数字"),
        college: z.string().trim().min(1, "请填写学院").max(30, "学院最多 30 个字符"),
        major: z.string().trim().max(30, "专业最多 30 个字符").optional().default(""),
        grade: z.string().trim().max(20, "年级最多 20 个字符").optional().default(""),
        bio: z.string().trim().max(120, "简介最多 120 个字符").optional().default(""),
        avatarColor: z.enum(AVATAR_KEYS),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.authenticated) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "登录后才能修改个人资料" });
      }

      try {
        const updated = await db.user.update({
          where: { id: ctx.userId },
          data: {
            name: input.name,
            studentNo: input.studentNo,
            college: input.college,
            major: input.major || null,
            grade: input.grade || null,
            bio: input.bio || null,
            avatarColor: input.avatarColor,
            campus: input.grade ? `${input.college} · ${input.grade}` : input.college,
          },
          select: {
            id: true,
            name: true,
            studentNo: true,
            college: true,
            major: true,
            grade: true,
            bio: true,
            avatarColor: true,
            campus: true,
          },
        });
        return updated;
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "该学号已被其他账号使用" });
        }
        throw error;
      }
    }),

  /** 修改密码：校验当前密码 + 新密码强度 */
  changePassword: publicProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1, "请输入当前密码"),
        newPassword: z
          .string()
          .regex(passwordPattern, "新密码需为 8-32 位，且同时包含字母与数字"),
        confirmPassword: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.authenticated) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "登录后才能修改密码" });
      }
      if (input.newPassword !== input.confirmPassword) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "两次输入的新密码不一致" });
      }
      if (input.currentPassword === input.newPassword) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "新密码不能与当前密码相同" });
      }

      const record = await db.user.findUnique({
        where: { id: ctx.userId },
        select: { passwordHash: true },
      });
      if (!record || !verifyPassword(input.currentPassword, record.passwordHash)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "当前密码不正确" });
      }

      await db.user.update({
        where: { id: ctx.userId },
        data: { passwordHash: hashPassword(input.newPassword) },
      });
      return { ok: true };
    }),

  /** 退出登录：删除服务端会话（Cookie 清理在 /api/auth/logout） */
  logout: publicProcedure.mutation(async ({ ctx }) => {
    if (ctx.sessionToken) {
      await db.session.deleteMany({ where: { token: ctx.sessionToken } });
    }
    return { ok: true };
  }),
});
