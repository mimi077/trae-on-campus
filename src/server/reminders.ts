import { Prisma } from "@prisma/client";
import { buildReminderContent, resolveReminderStage } from "@/lib/rules/reminder";
import { buildSubmitPath } from "@/lib/rules/validation";
import { db } from "./db";
import { flushEmailOutbox } from "./mailer";

export const REMINDER_ACTIVITY_HORIZON_MS = 7 * 24 * 60 * 60 * 1000;

export type ReminderRunResult = {
  /** 进入 7 天窗口且命中某一阶段的活动数 */
  activities: number;
  /** 新写入的提醒记录数（站内消息 + 邮件各一条） */
  created: number;
  /** 因幂等校验跳过的数量 */
  skipped: number;
  stages: Record<string, number>;
  mail: { sent: number; simulated: number; failed: number };
};

function appBaseUrl(): string {
  const raw = process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

/**
 * 扫描所有已发布活动的提交截止时间，按 7 天 / 3 天 / 1 天 / 2 小时四档生成提醒。
 * 幂等性由 DeadlineReminder 的 (activityId, userId, stage) 唯一索引保证：
 * 同一用户同一阶段重复执行只会跳过，不会重复推送。
 */
export async function runDeadlineReminders(
  options: { now?: Date; activityId?: string } = {},
): Promise<ReminderRunResult> {
  const now = options.now ?? new Date();

  const activities = await db.activity.findMany({
    where: {
      status: { in: ["PUBLISHED", "ONGOING"] },
      ...(options.activityId ? { id: options.activityId } : {}),
      OR: [{ submissionDeadline: { not: null } }, { showcaseEnabled: true }],
    },
    select: {
      id: true,
      title: true,
      submissionDeadline: true,
      endAt: true,
      showcaseEnabled: true,
    },
  });

  let matched = 0;
  let created = 0;
  let skipped = 0;
  const stages: Record<string, number> = { D7: 0, D3: 0, D1: 0, H2: 0 };
  const baseUrl = appBaseUrl();

  for (const activity of activities) {
    const deadline = activity.submissionDeadline ?? (activity.showcaseEnabled ? activity.endAt : null);
    if (!deadline) continue;

    const stage = resolveReminderStage(deadline, now);
    if (!stage) continue;
    matched += 1;

    const registrations = await db.registration.findMany({
      where: { activityId: activity.id, status: "APPROVED" },
      select: { userId: true },
    });
    if (registrations.length === 0) continue;

    const users = await db.user.findMany({
      where: { id: { in: registrations.map((item) => item.userId) } },
      select: { id: true, name: true, email: true, studentNo: true },
    });
    const userMap = new Map(users.map((user) => [user.id, user]));
    const submitPath = buildSubmitPath(activity.id);

    for (const registration of registrations) {
      const user = userMap.get(registration.userId);
      if (!user) continue;

      const reminder = buildReminderContent({
        activityTitle: activity.title,
        stage: stage.key,
        deadline,
        now,
        submitPath,
        submitUrl: `${baseUrl}${submitPath}`,
        userName: user.name,
      });
      const email = user.email ?? (user.studentNo ? `${user.studentNo}@campus.edu.cn` : null);

      // 先做一次轻量幂等预检，正常重复执行不会触发数据库唯一冲突日志；
      // 并发写入仍由唯一索引 + P2002 兜底。
      const alreadySent = await db.deadlineReminder.findUnique({
        where: {
          activityId_userId_stage: { activityId: activity.id, userId: user.id, stage: stage.key },
        },
        select: { id: true },
      });
      if (alreadySent) {
        skipped += 1;
        continue;
      }

      try {
        await db.$transaction(async (tx) => {
          // 先占幂等台账，唯一冲突会让整个事务回滚
          await tx.deadlineReminder.create({
            data: { activityId: activity.id, userId: user.id, stage: stage.key },
          });
          await tx.userNotification.create({
            data: {
              userId: user.id,
              type: "REMINDER",
              title: reminder.title,
              content: reminder.content,
              link: submitPath,
            },
          });
          if (email) {
            await tx.emailOutbox.create({
              data: {
                toEmail: email,
                subject: reminder.emailSubject,
                content: reminder.emailContent,
              },
            });
          }
        });
        created += 1;
        stages[stage.key] = (stages[stage.key] ?? 0) + 1;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          skipped += 1;
          continue;
        }
        throw error;
      }
    }
  }

  const mail = await flushEmailOutbox();

  return { activities: matched, created, skipped, stages, mail };
}
