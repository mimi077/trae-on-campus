import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { TIMETABLE_MAX_BYTES, parseTimetableCsv } from "@/lib/rules/timetable";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { db } from "@/server/db";

/**
 * 学生课表：个人数据，读写均按登录用户隔离。
 * 导入为「整份覆盖」，重复导入不会产生重复课程。
 */
export const timetableRouter = createTRPCRouter({
  list: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.authenticated) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "请先登录后查看课表" });
    }
    const courses = await db.timetableCourse.findMany({
      where: { userId: ctx.userId },
      orderBy: [{ weekday: "asc" }, { startSection: "asc" }, { createdAt: "asc" }],
    });
    return { courses };
  }),

  importCsv: publicProcedure
    .input(z.object({ csv: z.string().min(1, "课表内容不能为空").max(TIMETABLE_MAX_BYTES) }))
    .mutation(async ({ ctx, input }) => {
      const parsed = parseTimetableCsv(input.csv);
      if (!parsed.ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: parsed.error });
      }

      await db.$transaction([
        db.timetableCourse.deleteMany({ where: { userId: ctx.userId } }),
        db.timetableCourse.createMany({
          data: parsed.rows.map((row) => ({ ...row, userId: ctx.userId })),
        }),
      ]);

      return { count: parsed.rows.length };
    }),

  clear: publicProcedure.mutation(async ({ ctx }) => {
    const result = await db.timetableCourse.deleteMany({ where: { userId: ctx.userId } });
    return { count: result.count };
  }),
});
