/**
 * 作品提交规则（纯函数）：资格校验、倒计时拆分、提交回执文案。
 */

export const SUBMISSION_STATUS_LABEL: Record<string, string> = {
  PENDING: "待审核",
  APPROVED: "已通过",
  REJECTED: "已驳回",
};

export type SubmissionGateCode =
  | "OK"
  | "NOT_APPROVED"
  | "NO_DEADLINE"
  | "DEADLINE_PASSED"
  | "NOT_STARTED";

export type SubmissionGate = {
  allowed: boolean;
  code: SubmissionGateCode;
  reason: string;
};

export function evaluateSubmission(input: {
  registrationStatus: string | null | undefined;
  deadline: Date | string | number | null | undefined;
  now?: Date | string | number;
  /** 已存在作品状态：APPROVED 的已通过作品默认不允许覆盖，除非明确允许更新 */
  existingStatus?: string | null;
  allowResubmit?: boolean;
}): SubmissionGate {
  if (input.registrationStatus !== "APPROVED") {
    return {
      allowed: false,
      code: "NOT_APPROVED",
      reason: "仅报名审核通过的参赛者可以提交作品",
    };
  }

  if (!input.deadline) {
    return { allowed: false, code: "NO_DEADLINE", reason: "该活动暂未设置作品提交截止时间" };
  }

  const deadlineAt = new Date(input.deadline).getTime();
  const nowAt = new Date(input.now ?? Date.now()).getTime();
  if (Number.isNaN(deadlineAt)) {
    return { allowed: false, code: "NO_DEADLINE", reason: "作品提交截止时间格式不正确" };
  }
  if (Number.isNaN(nowAt)) {
    return { allowed: false, code: "NOT_STARTED", reason: "当前时间异常，请稍后重试" };
  }
  if (nowAt > deadlineAt) {
    return { allowed: false, code: "DEADLINE_PASSED", reason: "作品提交已截止" };
  }

  if (input.existingStatus === "APPROVED" && !input.allowResubmit) {
    return {
      allowed: false,
      code: "OK",
      reason: "作品已通过审核，如需修改请联系主办方",
    };
  }

  return { allowed: true, code: "OK", reason: "" };
}

export type CountdownParts = {
  expired: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** 分钟级精度展示，例如 3 天 05:12 */
  text: string;
  /** 紧凑展示，例如 03:05:12 */
  clock: string;
};

const pad = (value: number) => String(value).padStart(2, "0");

/** 倒计时拆分：前端每秒调用一次，展示精度为分钟，秒用于实时刷新 */
export function countdownParts(
  deadline: Date | string | number | null | undefined,
  now: Date | string | number = Date.now(),
): CountdownParts {
  if (!deadline) {
    return { expired: true, days: 0, hours: 0, minutes: 0, seconds: 0, text: "未设置截止时间", clock: "--:--:--" };
  }
  const deadlineAt = new Date(deadline).getTime();
  const nowAt = new Date(now).getTime();
  if (Number.isNaN(deadlineAt) || Number.isNaN(nowAt) || deadlineAt <= nowAt) {
    return { expired: true, days: 0, hours: 0, minutes: 0, seconds: 0, text: "已截止", clock: "00:00:00" };
  }

  const totalSeconds = Math.floor((deadlineAt - nowAt) / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const clock = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  const text = days > 0 ? `${days} 天 ${clock.slice(0, 5)}` : clock.slice(0, 5);

  return { expired: false, days, hours, minutes, seconds, text, clock };
}

export type SubmissionReceipt = {
  title: string;
  content: string;
  summary: string;
  submittedAt: string;
  statusText: string;
};

/** 提交成功回执：内容摘要 + 提交时间 + 审核状态说明 */
export function buildSubmissionReceipt(input: {
  activityTitle: string;
  workTitle: string;
  description?: string | null;
  submittedAt: Date | string | number;
  status: string;
}): SubmissionReceipt {
  const submitted = new Date(input.submittedAt);
  const submittedAt = Number.isNaN(submitted.getTime())
    ? "-"
    : `${submitted.getFullYear()}-${pad(submitted.getMonth() + 1)}-${pad(submitted.getDate())} ${pad(
        submitted.getHours(),
      )}:${pad(submitted.getMinutes())}`;

  const plain = (input.description ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const summary = plain ? (plain.length > 80 ? `${plain.slice(0, 80)}…` : plain) : "未填写作品描述";
  const statusText =
    input.status === "APPROVED"
      ? "作品已通过审核并在作品展示专区公开"
      : input.status === "REJECTED"
        ? "作品未通过审核，请根据驳回原因修改后重新提交"
        : "作品已提交，等待主办方审核；审核通过后会出现在作品展示专区";

  return {
    title: "作品提交成功",
    content: [
      `竞赛：${input.activityTitle}`,
      `作品：${input.workTitle}`,
      `内容摘要：${summary}`,
      `提交时间：${submittedAt}`,
      `审核状态：${statusText}`,
    ].join("\n"),
    summary,
    submittedAt,
    statusText,
  };
}
