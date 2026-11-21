import { z } from "zod";
import { createTRPCRouter, staffProcedure } from "@/server/api/trpc";
import { db } from "@/server/db";
import { getUserMap } from "@/server/api/shared";
import { runDeadlineReminders } from "@/server/reminders";

/** 阶梯截止提醒：手动触发 + 台账查询（系统级定时任务见 src/server/scheduler.ts） */
export const reminderRouter = createTRPCRouter({
  /** 管理端手动执行一次扫描，便于演示与补偿；重复执行由唯一索引兜底 */
  run: staffProcedure
    .input(z.object({ activityId: z.string().min(1).optional() }).default({}))
    .mutation(async ({ input }) => {
      return runDeadlineReminders({ activityId: input.activityId });
    }),

  logs: staffProcedure
    .input(
      z.object({
        activityId: z.string().min(1).optional(),
        page: z.number().int().min(1).max(200).default(1),
        pageSize: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ input }) => {
      const where = input.activityId ? { activityId: input.activityId } : {};
      const stageKeys = ["D7", "D3", "D1", "H2"];
      const [items, total, ...stageCounts] = await db.$transaction([
        db.deadlineReminder.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        db.deadlineReminder.count({ where }),
        ...stageKeys.map((stage) => db.deadlineReminder.count({ where: { ...where, stage } })),
      ]);

      const users = await getUserMap(db, items.map((item) => item.userId));
      const activities = await db.activity.findMany({
        where: { id: { in: Array.from(new Set(items.map((item) => item.activityId))) } },
        select: { id: true, title: true },
      });
      const activityMap = new Map(activities.map((activity) => [activity.id, activity.title]));

      return {
        items: items.map((item) => ({
          ...item,
          userName: users.get(item.userId)?.name ?? "同学",
          activityTitle: activityMap.get(item.activityId) ?? "活动",
        })),
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
        stages: Object.fromEntries(stageKeys.map((key, index) => [key, stageCounts[index] ?? 0])),
      };
    }),

  /** 邮件发件箱：便于管理员核对提醒是否真实发出 */
  outbox: staffProcedure
    .input(
      z.object({
        status: z.enum(["ALL", "PENDING", "SENT", "SIMULATED", "FAILED"]).default("ALL"),
        page: z.number().int().min(1).max(200).default(1),
        pageSize: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ input }) => {
      const where = input.status === "ALL" ? {} : { status: input.status };
      const [items, total] = await db.$transaction([
        db.emailOutbox.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        db.emailOutbox.count({ where }),
      ]);
      return {
        items,
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
      };
    }),
});
