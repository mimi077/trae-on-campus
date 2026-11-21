import { describe, expect, it } from "vitest";
import {
  REMINDER_STAGES,
  buildReminderContent,
  isReminderStageKey,
  reminderStageOf,
  resolveReminderStage,
  splitRemaining,
} from "@/lib/rules/reminder";

const NOW = new Date("2026-11-21T10:00:00.000Z");
const plus = (ms: number) => new Date(NOW.getTime() + ms);
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

describe("resolveReminderStage", () => {
  it("进入 7 天窗口命中 D7", () => {
    expect(resolveReminderStage(plus(7 * DAY), NOW)?.key).toBe("D7");
    expect(resolveReminderStage(plus(6 * DAY), NOW)?.key).toBe("D7");
  });

  it("进入 3 天窗口命中 D3", () => {
    expect(resolveReminderStage(plus(3 * DAY), NOW)?.key).toBe("D3");
    expect(resolveReminderStage(plus(2 * DAY), NOW)?.key).toBe("D3");
  });

  it("进入 1 天窗口命中 D1", () => {
    expect(resolveReminderStage(plus(DAY), NOW)?.key).toBe("D1");
    expect(resolveReminderStage(plus(5 * HOUR), NOW)?.key).toBe("D1");
  });

  it("进入 2 小时窗口命中 H2", () => {
    expect(resolveReminderStage(plus(2 * HOUR), NOW)?.key).toBe("H2");
    expect(resolveReminderStage(plus(5 * 60 * 1000), NOW)?.key).toBe("H2");
  });

  it("尚未进入 7 天窗口或已经截止时返回 null", () => {
    expect(resolveReminderStage(plus(8 * DAY), NOW)).toBeNull();
    expect(resolveReminderStage(plus(-1), NOW)).toBeNull();
    expect(resolveReminderStage(NOW, NOW)).toBeNull();
  });

  it("支持字符串 / 数字时间与非法输入", () => {
    expect(resolveReminderStage(plus(DAY).toISOString(), NOW.getTime())?.key).toBe("D1");
    expect(resolveReminderStage("not-a-date", NOW)).toBeNull();
    expect(resolveReminderStage(plus(DAY), "not-a-date")).toBeNull();
  });
});

describe("阶段元数据", () => {
  it("阶段 key 与文案一一对应", () => {
    expect(REMINDER_STAGES.map((stage) => stage.key)).toEqual(["D7", "D3", "D1", "H2"]);
    expect(reminderStageOf("H2").label).toBe("提交截止前 2 小时");
    expect(reminderStageOf("D3").short).toBe("3 天");
  });

  it("stage 白名单校验", () => {
    expect(isReminderStageKey("D7")).toBe(true);
    expect(isReminderStageKey("D2")).toBe(false);
    expect(isReminderStageKey(null)).toBe(false);
  });
});

describe("splitRemaining", () => {
  it("拆分天 / 时 / 分 / 秒", () => {
    const remaining = splitRemaining(plus(DAY + 2 * HOUR + 3 * 60 * 1000 + 4 * 1000), NOW);
    expect(remaining).toMatchObject({ expired: false, days: 1, hours: 2, minutes: 3, seconds: 4 });
    expect(remaining.text).toBe("1 天 2 小时 3 分钟");
  });

  it("不足一天时只显示小时与分钟", () => {
    const remaining = splitRemaining(plus(5 * HOUR + 9 * 60 * 1000), NOW);
    expect(remaining.text).toBe("5 小时 9 分钟");
  });

  it("已截止与非法时间", () => {
    expect(splitRemaining(plus(-1000), NOW).expired).toBe(true);
    expect(splitRemaining("bad", NOW).text).toBe("已截止");
    expect(splitRemaining(plus(1000), "bad").text).toBe("已截止");
  });
});

describe("buildReminderContent", () => {
  it("站内消息与邮件均包含竞赛名称、剩余时长与提交链接", () => {
    const content = buildReminderContent({
      activityTitle: "校园程序设计新生赛",
      stage: "D1",
      deadline: plus(DAY),
      now: NOW,
      submitPath: "/activities/act_1/submit",
      submitUrl: "https://campus.example.com/activities/act_1/submit",
      userName: "林小夏",
    });

    expect(content.title).toContain("校园程序设计新生赛");
    expect(content.title).toContain("1 天");
    expect(content.content).toContain("林小夏");
    expect(content.content).toContain("提交截止前 1 天");
    expect(content.content).toContain("/activities/act_1/submit");
    expect(content.content).not.toContain("https://campus.example.com");
    expect(content.emailSubject).toBe(content.title);
    expect(content.emailContent).toContain("竞赛名称：校园程序设计新生赛");
    expect(content.emailContent).toContain("剩余提交时长：1 天 0 小时 0 分钟");
    expect(content.emailContent).toContain("提交入口：https://campus.example.com/activities/act_1/submit");
  });

  it("未提供用户昵称时使用通用问候语", () => {
    const content = buildReminderContent({
      activityTitle: "作品赛",
      stage: "H2",
      deadline: plus(2 * HOUR),
      now: NOW,
      submitPath: "/activities/act_2/submit",
      submitUrl: "https://campus.example.com/activities/act_2/submit",
    });
    expect(content.content.startsWith("同学，你好：")).toBe(true);
    expect(content.content).toContain("剩余提交时长 2 小时 0 分钟");
  });
});
