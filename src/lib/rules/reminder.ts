/**
 * 阶梯截止提醒规则（纯函数）。
 * 四个固定节点：7 天、3 天、1 天、2 小时。
 * 给定截止时间与当前时间，只返回「当前应触发的最近一个阶段」，
 * 由 DeadlineReminder 唯一索引保证同一阶段不会重复推送。
 */

export const REMINDER_STAGES = [
  { key: "D7", ms: 7 * 24 * 60 * 60 * 1000, label: "提交截止前 7 天", short: "7 天" },
  { key: "D3", ms: 3 * 24 * 60 * 60 * 1000, label: "提交截止前 3 天", short: "3 天" },
  { key: "D1", ms: 24 * 60 * 60 * 1000, label: "提交截止前 1 天", short: "1 天" },
  { key: "H2", ms: 2 * 60 * 60 * 1000, label: "提交截止前 2 小时", short: "2 小时" },
] as const;

export type ReminderStage = (typeof REMINDER_STAGES)[number];
export type ReminderStageKey = ReminderStage["key"];

export const REMINDER_STAGE_KEYS = REMINDER_STAGES.map((stage) => stage.key);

export function isReminderStageKey(value: string | null | undefined): value is ReminderStageKey {
  return REMINDER_STAGE_KEYS.includes(value as ReminderStageKey);
}

export function reminderStageOf(key: ReminderStageKey): ReminderStage {
  return REMINDER_STAGES.find((stage) => stage.key === key) ?? REMINDER_STAGES[REMINDER_STAGES.length - 1];
}

function toMillis(value: Date | string | number): number | null {
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? null : time;
}

/**
 * 返回当前时间点对应的提醒阶段；尚未进入 7 天窗口或已截止时返回 null。
 */
export function resolveReminderStage(
  deadline: Date | string | number,
  now: Date | string | number = Date.now(),
): ReminderStage | null {
  const deadlineAt = toMillis(deadline);
  const nowAt = toMillis(now);
  if (deadlineAt === null || nowAt === null) return null;

  const remain = deadlineAt - nowAt;
  if (remain <= 0) return null;

  // 从最近的时间窗口向前找：remain <= 2h 命中 H2，依此类推
  for (let index = REMINDER_STAGES.length - 1; index >= 0; index -= 1) {
    if (remain <= REMINDER_STAGES[index].ms) return REMINDER_STAGES[index];
  }
  return null;
}

export type RemainingParts = {
  expired: boolean;
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  text: string;
};

/** 把剩余毫秒拆成天/时/分/秒，供提醒文案与倒计时复用 */
export function splitRemaining(deadline: Date | string | number, now: Date | string | number = Date.now()): RemainingParts {
  const deadlineAt = toMillis(deadline);
  const nowAt = toMillis(now);
  if (deadlineAt === null || nowAt === null) {
    return { expired: true, totalMs: 0, days: 0, hours: 0, minutes: 0, seconds: 0, text: "已截止" };
  }
  const diff = deadlineAt - nowAt;
  if (diff <= 0) {
    return { expired: true, totalMs: 0, days: 0, hours: 0, minutes: 0, seconds: 0, text: "已截止" };
  }

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const segments: string[] = [];
  if (days > 0) segments.push(`${days} 天`);
  if (hours > 0 || days > 0) segments.push(`${hours} 小时`);
  segments.push(`${minutes} 分钟`);

  return {
    expired: false,
    totalMs: diff,
    days,
    hours,
    minutes,
    seconds,
    text: segments.join(" "),
  };
}

export type ReminderContentInput = {
  activityTitle: string;
  stage: ReminderStageKey;
  deadline: Date | string | number;
  now?: Date | string | number;
  /** 站内消息使用的相对路径，避免线上出现 localhost 链接 */
  submitPath: string;
  /** 邮件使用的绝对链接 */
  submitUrl: string;
  /** 收件人展示名，用于邮件抬头 */
  userName?: string | null;
};

export type ReminderContent = {
  title: string;
  content: string;
  emailSubject: string;
  emailContent: string;
};

/**
 * 生成站内消息与邮件正文：必须包含竞赛名称、剩余提交时长、提交入口直达链接。
 */
export function buildReminderContent(input: ReminderContentInput): ReminderContent {
  const stage = reminderStageOf(input.stage);
  const remaining = splitRemaining(input.deadline, input.now ?? Date.now());
  const greeting = input.userName ? `${input.userName} 同学，你好：` : "同学，你好：";
  const stageText = stage.label;

  const title = `【提交提醒】${input.activityTitle} 距离提交截止还有 ${remaining.text}`;
  const content = [
    greeting,
    `你报名的「${input.activityTitle}」${stageText}，剩余提交时长 ${remaining.text}。`,
    `请在截止前完成作品提交，避免错过评审：${input.submitPath}`,
  ].join("\n");

  const emailSubject = `${title}`;
  const emailContent = [
    greeting,
    "",
    `竞赛名称：${input.activityTitle}`,
    `提醒节点：${stageText}`,
    `剩余提交时长：${remaining.text}`,
    `提交入口：${input.submitUrl}`,
    "",
    "如已完成提交，可忽略本提醒。本邮件由校园集自动发送，请勿直接回复。",
  ].join("\n");

  return { title, content, emailSubject, emailContent };
}
