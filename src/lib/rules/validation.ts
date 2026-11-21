/**
 * 通用校验与字段归一化（纯函数）。
 */

export function isValidQqGroup(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^\d{5,15}$/.test(value.trim());
}

export function isValidEmail(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isHttpUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^https?:\/\/[^\s]+$/i.test(value.trim());
}

/** 把逗号 / 中文逗号 / 顿号 / 空格分隔的输入切成去重数组 */
export function parseList(raw: string | null | undefined, max = 10): string[] {
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(/[,，、\s]+/)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ).slice(0, max);
}

/**
 * 作品提交截止时间归一化：显式填写优先，否则回落到活动结束时间。
 * 返回值统一为 Date | null，便于路由层直接写库。
 */
export function normalizeSubmissionDeadline(
  raw: string | Date | null | undefined,
  fallback: string | Date | null | undefined,
): Date | null {
  const candidate = raw ? new Date(raw) : null;
  if (candidate && !Number.isNaN(candidate.getTime())) return candidate;
  const fallbackDate = fallback ? new Date(fallback) : null;
  if (fallbackDate && !Number.isNaN(fallbackDate.getTime())) return fallbackDate;
  return null;
}

/** 站内提醒链接：统一走相对路径，避免被构造成外链钓鱼 */
export function buildSubmitPath(activityId: string): string {
  return `/activities/${encodeURIComponent(activityId)}/submit`;
}
