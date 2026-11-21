/**
 * 受众匹配规则（纯函数）：活动与行政通知共用。
 * 约定：某个维度为空数组表示「不限」；已填写的维度必须全部命中才可见 / 可推荐。
 */

export function parseStringArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return [];
  }
}

export type AudienceTarget = {
  targetCollege?: string | null;
  targetGrade?: string | null;
  targetMajor?: string | null;
  targetClass?: string | null;
};

export type AudienceUser = {
  college?: string | null;
  grade?: string | null;
  major?: string | null;
  className?: string | null;
};

/**
 * 返回 -1 表示不匹配；0 表示面向全部学生；>0 为命中的定向维度数量。
 */
export function audienceScore(target: AudienceTarget, user: AudienceUser): number {
  const dims = [
    { values: parseStringArray(target.targetCollege), mine: user.college },
    { values: parseStringArray(target.targetGrade), mine: user.grade },
    { values: parseStringArray(target.targetMajor), mine: user.major },
    { values: parseStringArray(target.targetClass), mine: user.className },
  ];

  let score = 0;
  for (const dim of dims) {
    if (dim.values.length === 0) continue;
    if (!dim.mine || !dim.values.includes(dim.mine)) return -1;
    score += 1;
  }
  return score;
}

export function matchesAudience(target: AudienceTarget, user: AudienceUser): boolean {
  return audienceScore(target, user) >= 0;
}
