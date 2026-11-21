import { describe, expect, it } from "vitest";
import {
  buildSubmitPath,
  isHttpUrl,
  isValidEmail,
  isValidQqGroup,
  normalizeSubmissionDeadline,
  parseList,
} from "@/lib/rules/validation";

describe("isValidQqGroup", () => {
  it("5-15 位纯数字才合法", () => {
    expect(isValidQqGroup("12345")).toBe(true);
    expect(isValidQqGroup("123456789012345")).toBe(true);
    expect(isValidQqGroup("1234")).toBe(false);
    expect(isValidQqGroup("1234567890123456")).toBe(false);
    expect(isValidQqGroup("12345a")).toBe(false);
    expect(isValidQqGroup(null)).toBe(false);
  });
});

describe("isValidEmail", () => {
  it("基础邮箱格式校验", () => {
    expect(isValidEmail("student@campus.edu.cn")).toBe(true);
    expect(isValidEmail("a.b+c@example.com")).toBe(true);
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail(null)).toBe(false);
  });
});

describe("isHttpUrl", () => {
  it("仅接受 http(s) 绝对地址", () => {
    expect(isHttpUrl("https://example.com/a")).toBe(true);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("/relative")).toBe(false);
    expect(isHttpUrl("")).toBe(false);
  });
});

describe("parseList", () => {
  it("支持多种分隔符并去重", () => {
    expect(parseList("计算机学院，数学与统计学院、外国语学院 计算机学院")).toEqual([
      "计算机学院",
      "数学与统计学院",
      "外国语学院",
    ]);
  });

  it("按上限截断且忽略空值", () => {
    expect(parseList("a,b,c,d", 2)).toEqual(["a", "b"]);
    expect(parseList("   ")).toEqual([]);
    expect(parseList(null)).toEqual([]);
  });
});

describe("normalizeSubmissionDeadline", () => {
  it("优先使用显式填写的时间", () => {
    const result = normalizeSubmissionDeadline("2026-12-01T10:00:00.000Z", "2026-12-05T10:00:00.000Z");
    expect(result?.toISOString()).toBe("2026-12-01T10:00:00.000Z");
  });

  it("显式时间缺失或非法时回落到结束时间", () => {
    const fallback = "2026-12-05T10:00:00.000Z";
    expect(normalizeSubmissionDeadline(null, fallback)?.toISOString()).toBe(fallback);
    expect(normalizeSubmissionDeadline("bad", fallback)?.toISOString()).toBe(fallback);
    expect(normalizeSubmissionDeadline("", fallback)?.toISOString()).toBe(fallback);
  });

  it("两者都非法时返回 null", () => {
    expect(normalizeSubmissionDeadline(null, null)).toBeNull();
    expect(normalizeSubmissionDeadline("bad", "bad")).toBeNull();
  });
});

describe("buildSubmitPath", () => {
  it("生成站内相对路径并编码特殊字符", () => {
    expect(buildSubmitPath("act_1")).toBe("/activities/act_1/submit");
    expect(buildSubmitPath("a/b")).toBe("/activities/a%2Fb/submit");
  });
});
