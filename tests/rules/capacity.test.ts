import { describe, expect, it } from "vitest";
import {
  CAPACITY_MAX,
  CAPACITY_MIN,
  UNLIMITED_CAPACITY_PLACEHOLDER,
  capacityView,
  isCapacityFull,
  normalizeCapacity,
} from "@/lib/rules/capacity";

describe("normalizeCapacity", () => {
  it("无限名额统一写入占位值", () => {
    expect(normalizeCapacity(50, true)).toBe(UNLIMITED_CAPACITY_PLACEHOLDER);
    expect(normalizeCapacity(0, true)).toBe(UNLIMITED_CAPACITY_PLACEHOLDER);
  });

  it("普通名额限制在 1-2000 并取整", () => {
    expect(normalizeCapacity(0, false)).toBe(CAPACITY_MIN);
    expect(normalizeCapacity(-10, false)).toBe(CAPACITY_MIN);
    expect(normalizeCapacity(3000, false)).toBe(CAPACITY_MAX);
    expect(normalizeCapacity(50.9, false)).toBe(50);
  });

  it("非数字输入回落到最小值", () => {
    expect(normalizeCapacity(Number.NaN, false)).toBe(CAPACITY_MIN);
    expect(normalizeCapacity(Number.POSITIVE_INFINITY, false)).toBe(CAPACITY_MIN);
  });
});

describe("capacityView", () => {
  it("普通名额正确计算剩余与百分比", () => {
    const view = capacityView({ capacity: 100, occupied: 30 });
    expect(view.remaining).toBe(70);
    expect(view.isFull).toBe(false);
    expect(view.percent).toBe(30);
    expect(view.ratioText).toBe("30 / 100");
    expect(view.capacityText).toBe("100");
  });

  it("报名人数达到上限时标记已满", () => {
    const view = capacityView({ capacity: 10, occupied: 10 });
    expect(view.remaining).toBe(0);
    expect(view.isFull).toBe(true);
    expect(view.percent).toBe(100);
  });

  it("超额报名时剩余兜底为 0，百分比不超过 100", () => {
    const view = capacityView({ capacity: 10, occupied: 15 });
    expect(view.remaining).toBe(0);
    expect(view.percent).toBe(100);
  });

  it("无限名额不显示剩余，永远不满", () => {
    const view = capacityView({ capacity: 0, isUnlimited: true, occupied: 999 });
    expect(view.remaining).toBeNull();
    expect(view.isFull).toBe(false);
    expect(view.ratioText).toBe("999 / 不限");
    expect(view.capacityText).toBe("不限");
  });

  it("零容量与负数报名数安全降级", () => {
    const view = capacityView({ capacity: 0, occupied: -5 });
    expect(view.percent).toBe(0);
    expect(view.occupied).toBe(0);
  });
});

describe("isCapacityFull", () => {
  it("普通名额满员判断", () => {
    expect(isCapacityFull({ capacity: 10, occupied: 9 })).toBe(false);
    expect(isCapacityFull({ capacity: 10, occupied: 10 })).toBe(true);
  });

  it("无限名额永远不满", () => {
    expect(isCapacityFull({ capacity: 0, isUnlimited: true, occupied: 100000 })).toBe(false);
  });
});
