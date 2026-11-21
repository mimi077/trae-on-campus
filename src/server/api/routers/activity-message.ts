import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { isStaffRole } from "@/lib/constants";
import { getUserMap } from "@/server/api/shared";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { db } from "@/server/db";

export const activityMessageRouter = createTRPCRouter({
  list: publicProcedure.input(z.object({ activityId: z.string().min(1) })).query(async ({ ctx, input }) => {
    const activity = await db.activity.findUnique({
      where: { id: input.activityId },
      select: { id: true, status: true, createdBy: true },
    });
    if (!activity) throw new TRPCError({ code: "NOT_FOUND", message: "活动不存在" });

    const visible =
      ["PUBLISHED", "ONGOING", "ENDED", "CANCELLED"].includes(activity.status) ||
      activity.createdBy === ctx.userId ||
      isStaffRole(ctx.user.role);
    if (!visible) throw new TRPCError({ code: "NOT_FOUND", message: "该活动尚未通过审核" });

    const rows = await db.activityMessage.findMany({
      where: { activityId: activity.id },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    const users = await getUserMap(db, rows.map((row) => row.userId));
    return rows.map((row) => ({
      ...row,
      userName: users.get(row.userId)?.name ?? "匿名同学",
      mine: row.userId === ctx.userId,
    }));
  }),

  create: publicProcedure
    .input(
      z.object({
        activityId: z.string().min(1),
        content: z.string().trim().min(1, "留言不能为空").max(300, "留言最多 300 个字符"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const activity = await db.activity.findUnique({
        where: { id: input.activityId },
        select: { id: true, status: true },
      });
      if (!activity) throw new TRPCError({ code: "NOT_FOUND", message: "活动不存在" });
      if (!["PUBLISHED", "ONGOING"].includes(activity.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "活动已结束、已取消或尚未通过审核，暂时不能留言",
        });
      }
      return db.activityMessage.create({
        data: { activityId: activity.id, userId: ctx.userId, content: input.content },
        select: { id: true, content: true, createdAt: true },
      });
    }),
});
