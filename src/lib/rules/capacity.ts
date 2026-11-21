/**
 * 名额规则（纯函数）。
 * V8 新增「无限」名额：isUnlimited 为 true 时不再做满员判断，
 * capacity 仅作为历史数据保留，不参与展示与计算。
 */

export const CAPACITY_MIN = 1;
export const CAPACITY_MAX = 2000;
/** 无限名额在数据库中的占位值，保证旧接口的 Int 约束不被破坏 */
export const UNLIMITED_CAPACITY_PLACEHOLDER = 0;

export type CapacityView = {
  occupied: number;
  /** 无限名额时为 null */
  remaining: number | null;
  isFull: boolean;
  percent: number;
  /** 用于列表 / 详情页展示 */
  ratioText: string;
  capacityText: string;
};

export function normalizeCapacity(capacity: number, isUnlimited: boolean): number {
  if (isUnlimited) return UNLIMITED_CAPACITY_PLACEHOLDER;
  if (!Number.isFinite(capacity)) return CAPACITY_MIN;
  return Math.min(CAPACITY_MAX, Math.max(CAPACITY_MIN, Math.trunc(capacity)));
}

export function capacityView(input: {
  capacity: number;
  isUnlimited?: boolean | null;
  occupied: number;
}): CapacityView {
  const occupied = Math.max(0, Math.trunc(input.occupied || 0));

  if (input.isUnlimited) {
    return {
      occupied,
      remaining: null,
      isFull: false,
      percent: 0,
      ratioText: `${occupied} / 不限`,
      capacityText: "不限",
    };
  }

  const capacity = Math.max(0, Math.trunc(input.capacity || 0));
  const remaining = Math.max(capacity - occupied, 0);
  const percent = capacity > 0 ? Math.min(100, Math.round((occupied / capacity) * 100)) : 0;

  return {
    occupied,
    remaining,
    isFull: remaining <= 0,
    percent,
    ratioText: `${occupied} / ${capacity}`,
    capacityText: String(capacity),
  };
}

/** 报名写入前的满员判定：无限名额永远返回 false */
export function isCapacityFull(input: {
  capacity: number;
  isUnlimited?: boolean | null;
  occupied: number;
}): boolean {
  if (input.isUnlimited) return false;
  return input.occupied >= Math.max(0, Math.trunc(input.capacity || 0));
}
