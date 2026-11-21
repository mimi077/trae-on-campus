import { describe, expect, it } from "vitest";
import { buildSubmissionReceipt, countdownParts, evaluateSubmission } from "@/lib/rules/submission";

const NOW = new Date("2026-11-21T10:00:00.000Z");
const plus = (ms: number) => new Date(NOW.getTime() + ms);
const HOUR = 60 * 60 * 1000;

describe("evaluateSubmission", () => {
  it("未报名或报名未通过时拒绝提交", () => {
    expect(evaluateSubmission({ registrationStatus: null, deadline: plus(HOUR), now: NOW }).code).toBe("NOT_APPROVED");
    expect(evaluateSubmission({ registrationStatus: "PENDING", deadline: plus(HOUR), now: NOW }).code).toBe(
      "NOT_APPROVED",
    );
    expect(evaluateSubmission({ registrationStatus: "CANCELLED", deadline: plus(HOUR), now: NOW }).code).toBe(
      "NOT_APPROVED",
    );
  });

  it("缺少截止时间或格式错误时拒绝提交", () => {
    expect(evaluateSubmission({ registrationStatus: "APPROVED", deadline: null, now: NOW }).code).toBe("NO_DEADLINE");
    expect(
      evaluateSubmission({ registrationStatus: "APPROVED", deadline: "not-a-date", now: NOW }).code,
    ).toBe("NO_DEADLINE");
  });

  it("超过截止时间后拒绝提交", () => {
    const gate = evaluateSubmission({ registrationStatus: "APPROVED", deadline: plus(-1000), now: NOW });
    expect(gate.allowed).toBe(false);
    expect(gate.code).toBe("DEADLINE_PASSED");
    expect(gate.reason).toBe("作品提交已截止");
  });

  it("当前时间异常时安全拒绝", () => {
    expect(
      evaluateSubmission({ registrationStatus: "APPROVED", deadline: plus(HOUR), now: "bad" }).allowed,
    ).toBe(false);
  });

  it("报名通过且截止前允许提交", () => {
    const gate = evaluateSubmission({ registrationStatus: "APPROVED", deadline: plus(HOUR), now: NOW });
    expect(gate.allowed).toBe(true);
    expect(gate.reason).toBe("");
  });

  it("已通过审核的作品默认锁定，允许时才能覆盖", () => {
    const locked = evaluateSubmission({
      registrationStatus: "APPROVED",
      deadline: plus(HOUR),
      now: NOW,
      existingStatus: "APPROVED",
    });
    expect(locked.allowed).toBe(false);

    const unlocked = evaluateSubmission({
      registrationStatus: "APPROVED",
      deadline: plus(HOUR),
      now: NOW,
      existingStatus: "APPROVED",
      allowResubmit: true,
    });
    expect(unlocked.allowed).toBe(true);
  });

  it("待审核 / 已驳回的作品可以继续修改", () => {
    expect(
      evaluateSubmission({
        registrationStatus: "APPROVED",
        deadline: plus(HOUR),
        now: NOW,
        existingStatus: "PENDING",
      }).allowed,
    ).toBe(true);
    expect(
      evaluateSubmission({
        registrationStatus: "APPROVED",
        deadline: plus(HOUR),
        now: NOW,
        existingStatus: "REJECTED",
      }).allowed,
    ).toBe(true);
  });
});

describe("countdownParts", () => {
  it("拆分天 / 时 / 分 / 秒并生成分钟级文案", () => {
    const parts = countdownParts(plus(3 * 24 * HOUR + 5 * HOUR + 12 * 60 * 1000 + 33 * 1000), NOW);
    expect(parts).toMatchObject({ expired: false, days: 3, hours: 5, minutes: 12, seconds: 33 });
    expect(parts.text).toBe("3 天 05:12");
    expect(parts.clock).toBe("05:12:33");
  });

  it("不足一天时只显示 HH:MM", () => {
    const parts = countdownParts(plus(2 * HOUR + 7 * 60 * 1000), NOW);
    expect(parts.text).toBe("02:07");
  });

  it("已截止与未设置截止时间", () => {
    expect(countdownParts(plus(-1), NOW)).toMatchObject({ expired: true, text: "已截止", clock: "00:00:00" });
    expect(countdownParts(null, NOW)).toMatchObject({ expired: true, text: "未设置截止时间" });
    expect(countdownParts("bad", NOW).expired).toBe(true);
  });
});

describe("buildSubmissionReceipt", () => {
  it("回执包含作品摘要、提交时间与审核状态说明", () => {
    const receipt = buildSubmissionReceipt({
      activityTitle: "校园程序设计新生赛",
      workTitle: "二手书漂流地图",
      description: "<p>这是一个 <strong>校内二手书</strong> 交换地图，支持扫码登记。</p>",
      submittedAt: new Date("2026-11-21T10:30:00"),
      status: "PENDING",
    });

    expect(receipt.title).toBe("作品提交成功");
    expect(receipt.summary).toBe("这是一个 校内二手书 交换地图，支持扫码登记。");
    expect(receipt.submittedAt).toBe("2026-11-21 10:30");
    expect(receipt.content).toContain("竞赛：校园程序设计新生赛");
    expect(receipt.content).toContain("作品：二手书漂流地图");
    expect(receipt.content).toContain("内容摘要：这是一个 校内二手书 交换地图，支持扫码登记。");
    expect(receipt.content).toContain("审核状态：作品已提交，等待主办方审核");
  });

  it("长描述截断并补充省略号，空描述使用兜底文案", () => {
    const long = buildSubmissionReceipt({
      activityTitle: "A",
      workTitle: "B",
      description: "x".repeat(200),
      submittedAt: NOW,
      status: "APPROVED",
    });
    expect(long.summary.endsWith("…")).toBe(true);
    expect(long.summary.length).toBeLessThanOrEqual(81);
    expect(long.statusText).toContain("已通过审核");

    const empty = buildSubmissionReceipt({
      activityTitle: "A",
      workTitle: "B",
      description: null,
      submittedAt: NOW,
      status: "REJECTED",
    });
    expect(empty.summary).toBe("未填写作品描述");
    expect(empty.statusText).toContain("未通过审核");
  });

  it("提交时间异常时安全显示 -", () => {
    const receipt = buildSubmissionReceipt({
      activityTitle: "A",
      workTitle: "B",
      description: "",
      submittedAt: "bad",
      status: "PENDING",
    });
    expect(receipt.submittedAt).toBe("-");
  });
});
