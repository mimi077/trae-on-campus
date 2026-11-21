import { flushEmailOutbox } from "./mailer";
import { runDeadlineReminders } from "./reminders";

/**
 * 系统级定时任务：每分钟扫描一次截止时间，命中 7 天 / 3 天 / 1 天 / 2 小时节点时
 * 为已通过报名的参赛者写入站内消息与邮件。幂等性由数据库唯一索引兜底。
 * 由 ensureDatabase() 在数据库初始化完成后启动，globalThis 标记保证只启动一次。
 */
const globalForScheduler = globalThis as unknown as {
  __campusReminderTimer?: ReturnType<typeof setInterval>;
  __campusReminderRunning?: boolean;
};

async function tick() {
  if (globalForScheduler.__campusReminderRunning) return;
  globalForScheduler.__campusReminderRunning = true;
  try {
    await runDeadlineReminders();
    await flushEmailOutbox();
  } catch (error) {
    console.error("[campus-reminder] 定时提醒执行失败", error);
  } finally {
    globalForScheduler.__campusReminderRunning = false;
  }
}

export function startReminderScheduler() {
  if (globalForScheduler.__campusReminderTimer) return;
  if (process.env.DISABLE_REMINDER_SCHEDULER === "1") return;

  const intervalMs = Number(process.env.REMINDER_INTERVAL_MS ?? 60_000);
  const firstRun = setTimeout(() => void tick(), 15_000);
  if (typeof firstRun.unref === "function") firstRun.unref();

  const timer = setInterval(() => void tick(), Math.max(30_000, intervalMs));
  if (typeof timer.unref === "function") timer.unref();
  globalForScheduler.__campusReminderTimer = timer;
}
