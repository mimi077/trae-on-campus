/**
 * 提交前 24 小时全局弹窗规则（纯函数）。
 * 同一用户单天最多触发 3 次，计数存 localStorage，服务端不做持久化。
 */

export const POPUP_DAILY_LIMIT = 3;
export const POPUP_WINDOW_HOURS = 24;

export function submissionPopupEligible(input: {
  registrationStatus: string | null | undefined;
  hasSubmission: boolean;
  deadline: Date | string | number | null | undefined;
  now?: Date | string | number;
  windowHours?: number;
}): { eligible: boolean; remainingMs: number } {
  if (input.registrationStatus !== "APPROVED") return { eligible: false, remainingMs: 0 };
  if (input.hasSubmission) return { eligible: false, remainingMs: 0 };
  if (!input.deadline) return { eligible: false, remainingMs: 0 };

  const deadlineAt = new Date(input.deadline).getTime();
  const nowAt = new Date(input.now ?? Date.now()).getTime();
  if (Number.isNaN(deadlineAt) || Number.isNaN(nowAt)) return { eligible: false, remainingMs: 0 };

  const remain = deadlineAt - nowAt;
  const windowHours = input.windowHours ?? POPUP_WINDOW_HOURS;
  if (remain <= 0 || remain > windowHours * 60 * 60 * 1000) {
    return { eligible: false, remainingMs: Math.max(0, remain) };
  }
  return { eligible: true, remainingMs: remain };
}

/** 本地日期键：同一天内共享计数 */
export function popupDayKey(date: Date | string | number = new Date()): string {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "invalid";
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
    value.getDate(),
  ).padStart(2, "0")}`;
}

export type PopupCounter = Record<string, number>;

/** 解析 localStorage 中的计数，异常数据一律降级为空对象 */
export function parsePopupCounter(raw: string | null | undefined): PopupCounter {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const result: PopupCounter = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
        result[key] = Math.trunc(value);
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function countForDay(counter: PopupCounter, dayKey: string): number {
  return Math.max(0, Math.trunc(counter[dayKey] ?? 0));
}

export function canShowPopup(count: number, limit: number = POPUP_DAILY_LIMIT): boolean {
  return count < limit;
}

export function incrementCounter(counter: PopupCounter, dayKey: string): PopupCounter {
  return { ...counter, [dayKey]: countForDay(counter, dayKey) + 1 };
}
