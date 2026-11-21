import { describe, expect, it } from "vitest";
import {
  POPUP_DAILY_LIMIT,
  canShowPopup,
  countForDay,
  incrementCounter,
  parsePopupCounter,
  popupDayKey,
  submissionPopupEligible,
} from "@/lib/rules/popup";

const NOW = new Date("2026-11-21T10:00:00.000Z");
const plus = (ms: number) => new Date(NOW.getTime() + ms);
const HOUR = 60 * 60 * 1000;

describe("submissionPopupEligible", () => {
  it("已报名、未提交且截止前 24 小时内才触发", () => {
    expect(
      submissionPopupEligible({
        registrationStatus: "APPROVED",
        hasSubmission: false,
        deadline: plus(20 * HOUR),
        now: NOW,
      }),
    ).toEqual({ eligible: true, remainingMs: 20 * HOUR });
  });

  it("未报名或已提交不触发", () => {
    expect(
      submissionPopupEligible({
        registrationStatus: "PENDING",
        hasSubmission: false,
        deadline: plus(HOUR),
        now: NOW,
      }).eligible,
    ).toBe(false);
    expect(
      submissionPopupEligible({
        registrationStatus: "APPROVED",
        hasSubmission: true,
        deadline: plus(HOUR),
        now: NOW,
      }).eligible,
    ).toBe(false);
  });

  it("超过 24 小时或已截止不触发", () => {
    expect(
      submissionPopupEligible({
        registrationStatus: "APPROVED",
        hasSubmission: false,
        deadline: plus(25 * HOUR),
        now: NOW,
      }).eligible,
    ).toBe(false);
    const passed = submissionPopupEligible({
      registrationStatus: "APPROVED",
      hasSubmission: false,
      deadline: plus(-HOUR),
      now: NOW,
    });
    expect(passed.eligible).toBe(false);
    expect(passed.remainingMs).toBe(0);
  });

  it("缺少截止时间或时间非法不触发", () => {
    expect(
      submissionPopupEligible({ registrationStatus: "APPROVED", hasSubmission: false, deadline: null }).eligible,
    ).toBe(false);
    expect(
      submissionPopupEligible({
        registrationStatus: "APPROVED",
        hasSubmission: false,
        deadline: "bad",
        now: NOW,
      }).eligible,
    ).toBe(false);
  });

  it("支持自定义窗口", () => {
    expect(
      submissionPopupEligible({
        registrationStatus: "APPROVED",
        hasSubmission: false,
        deadline: plus(5 * HOUR),
        now: NOW,
        windowHours: 6,
      }).eligible,
    ).toBe(true);
  });
});

describe("每日弹窗计数", () => {
  it("日期键按本地日期生成", () => {
    expect(popupDayKey(new Date(2026, 10, 21, 23, 59))).toBe("2026-11-21");
    expect(popupDayKey("bad")).toBe("invalid");
  });

  it("解析异常存储降级为空对象", () => {
    expect(parsePopupCounter(null)).toEqual({});
    expect(parsePopupCounter("not-json")).toEqual({});
    expect(parsePopupCounter("[1,2]")).toEqual({});
    expect(parsePopupCounter('{"2026-11-21":2,"bad":-1,"x":"3"}')).toEqual({ "2026-11-21": 2 });
  });

  it("同一天最多触发 3 次", () => {
    expect(canShowPopup(0)).toBe(true);
    expect(canShowPopup(2)).toBe(true);
    expect(canShowPopup(POPUP_DAILY_LIMIT)).toBe(false);
    expect(canShowPopup(3, 5)).toBe(true);
  });

  it("计数递增且不影响其他日期", () => {
    const counter = incrementCounter({ "2026-11-20": 3 }, "2026-11-21");
    expect(countForDay(counter, "2026-11-21")).toBe(1);
    expect(countForDay(counter, "2026-11-20")).toBe(3);
    expect(countForDay(incrementCounter(counter, "2026-11-21"), "2026-11-21")).toBe(2);
  });
});
