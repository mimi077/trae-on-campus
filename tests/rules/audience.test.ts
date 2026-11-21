import { describe, expect, it } from "vitest";
import { audienceScore, matchesAudience, parseStringArray } from "@/lib/rules/audience";

describe("parseStringArray", () => {
  it("解析合法 JSON 数组并过滤非字符串", () => {
    expect(parseStringArray('["计算机学院","大三",1,null]')).toEqual(["计算机学院", "大三"]);
  });

  it("空值与异常 JSON 返回空数组", () => {
    expect(parseStringArray(null)).toEqual([]);
    expect(parseStringArray("")).toEqual([]);
    expect(parseStringArray("not-json")).toEqual([]);
    expect(parseStringArray('{"a":1}')).toEqual([]);
  });
});

describe("audienceScore", () => {
  const user = {
    college: "数学与统计学院",
    grade: "大三",
    major: "数学与应用数学",
    className: "师范1234班",
  };

  it("所有维度为空表示面向全部学生", () => {
    expect(audienceScore({}, user)).toBe(0);
    expect(audienceScore({ targetCollege: "[]", targetGrade: "[]" }, user)).toBe(0);
  });

  it("命中维度越多得分越高", () => {
    expect(audienceScore({ targetCollege: '["数学与统计学院"]' }, user)).toBe(1);
    expect(
      audienceScore(
        {
          targetCollege: '["数学与统计学院"]',
          targetGrade: '["大三"]',
          targetMajor: '["数学与应用数学"]',
        },
        user,
      ),
    ).toBe(3);
  });

  it("任一维度不匹配直接返回 -1", () => {
    expect(audienceScore({ targetCollege: '["计算机学院"]' }, user)).toBe(-1);
    expect(audienceScore({ targetGrade: '["大一"]' }, user)).toBe(-1);
  });

  it("用户缺少对应身份时无法命中已填写的维度", () => {
    expect(audienceScore({ targetClass: '["师范1234班"]' }, { ...user, className: null })).toBe(-1);
  });
});

describe("matchesAudience", () => {
  it("与 audienceScore 判定保持一致", () => {
    const user = { college: "计算机学院", grade: "大二", major: "软件工程", className: "计算机2301班" };
    expect(matchesAudience({ targetCollege: '["计算机学院"]' }, user)).toBe(true);
    expect(matchesAudience({ targetCollege: '["外国语学院"]' }, user)).toBe(false);
    expect(matchesAudience({}, user)).toBe(true);
  });
});
