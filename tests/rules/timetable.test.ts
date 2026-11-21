import { describe, expect, it } from "vitest";
import {
  TIMETABLE_MAX_ROWS,
  buildTimetableTemplate,
  formatSectionRange,
  formatWeekRange,
  normalizeWeekday,
  normalizeWeekType,
  parseTimetableCsv,
  splitCsvLine,
  weekdayLabel,
} from "@/lib/rules/timetable";

const HEADER = "课程名称,任课教师,上课地点,星期,开始节次,结束节次,开始周,结束周,周类型";

function csv(...lines: string[]) {
  return [HEADER, ...lines].join("\n");
}

describe("splitCsvLine", () => {
  it("支持引号包裹的逗号与转义引号", () => {
    expect(splitCsvLine('高等数学,张老师,"教学楼A203, 三层",周一,1,2,1,16,全周')).toEqual([
      "高等数学",
      "张老师",
      "教学楼A203, 三层",
      "周一",
      "1",
      "2",
      "1",
      "16",
      "全周",
    ]);
    expect(splitCsvLine('"他说""你好""",1')).toEqual(['他说"你好"', "1"]);
  });
});

describe("normalizeWeekday", () => {
  it("支持数字与中文别名", () => {
    expect(normalizeWeekday("1")).toBe(1);
    expect(normalizeWeekday("7")).toBe(7);
    expect(normalizeWeekday("周三")).toBe(3);
    expect(normalizeWeekday("星期五")).toBe(5);
    expect(normalizeWeekday("周天")).toBe(7);
    expect(normalizeWeekday("8")).toBeNull();
    expect(normalizeWeekday("周八")).toBeNull();
    expect(normalizeWeekday("")).toBeNull();
  });
});

describe("normalizeWeekType", () => {
  it("空值与全周等价，支持英文别名", () => {
    expect(normalizeWeekType("")).toBe("ALL");
    expect(normalizeWeekType("全周")).toBe("ALL");
    expect(normalizeWeekType("odd")).toBe("ODD");
    expect(normalizeWeekType("双周")).toBe("EVEN");
    expect(normalizeWeekType("每周三")).toBeNull();
  });
});

describe("parseTimetableCsv", () => {
  it("解析合法课表并去掉首尾空白", () => {
    const result = parseTimetableCsv(
      csv(
        "高等数学, 张老师 ,教学楼A203,星期一,1,2,1,16,全周",
        '"大学英语",李老师,"外语楼B101, 二层",3,3,4,1,16,单周',
      ),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({
      name: "高等数学",
      teacher: "张老师",
      location: "教学楼A203",
      weekday: 1,
      startSection: 1,
      endSection: 2,
      startWeek: 1,
      endWeek: 16,
      weekType: "ALL",
    });
    expect(result.rows[1].weekday).toBe(3);
    expect(result.rows[1].location).toBe("外语楼B101, 二层");
    expect(result.rows[1].weekType).toBe("ODD");
  });

  it("支持表头顺序调整与空周类型", () => {
    const reordered = [
      "星期,课程名称,任课教师,上课地点,开始节次,结束节次,开始周,结束周,周类型",
      "周二,线性代数,,,5,6,1,8,",
    ].join("\r\n");
    const result = parseTimetableCsv(reordered);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0]).toMatchObject({ weekday: 2, teacher: null, location: null, weekType: "ALL" });
  });

  it("兼容 BOM 与模板文件", () => {
    const result = parseTimetableCsv(`\uFEFF${buildTimetableTemplate()}`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(2);
  });

  it("内容为空或只有表头时报错", () => {
    expect(parseTimetableCsv("")).toEqual({ ok: false, error: "课表文件内容为空" });
    expect(parseTimetableCsv(HEADER).ok).toBe(false);
  });

  it("缺少表头字段时报错", () => {
    const result = parseTimetableCsv("课程名称,星期\n高数,周一");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("表头缺少字段");
  });

  it("非法行会指出具体行号", () => {
    const result = parseTimetableCsv(csv("高数,张老师,A101,9,1,2,1,16,全周"));
    expect(result).toEqual({ ok: false, error: "第 2 行：星期需填写 1-7 或「周一」至「周日」" });

    const section = parseTimetableCsv(csv("高数,张老师,A101,周一,6,5,1,16,全周"));
    expect(section.ok).toBe(false);
    if (!section.ok) expect(section.error).toContain("结束节次不能早于开始节次");

    const week = parseTimetableCsv(csv("高数,张老师,A101,周一,1,2,20,10,全周"));
    expect(week.ok).toBe(false);
    if (!week.ok) expect(week.error).toContain("结束周不能早于开始周");
  });

  it("校验课程名称、节次、周次与周类型边界", () => {
    expect(parseTimetableCsv(csv(",张老师,A101,周一,1,2,1,16,全周")).ok).toBe(false);
    expect(parseTimetableCsv(csv("高数,张老师,A101,周一,0,2,1,16,全周")).ok).toBe(false);
    expect(parseTimetableCsv(csv("高数,张老师,A101,周一,1,13,1,16,全周")).ok).toBe(false);
    expect(parseTimetableCsv(csv("高数,张老师,A101,周一,1,2,31,31,全周")).ok).toBe(false);
    const type = parseTimetableCsv(csv("高数,张老师,A101,周一,1,2,1,16,隔周"));
    expect(type.ok).toBe(false);
    if (!type.ok) expect(type.error).toContain("周类型");
    expect(parseTimetableCsv(csv(`${"课".repeat(41)},张老师,A101,周一,1,2,1,16,全周`)).ok).toBe(false);
  });

  it("限制单次导入行数与文件大小", () => {
    const lines = Array.from({ length: TIMETABLE_MAX_ROWS + 1 }, (_, index) => `课程${index},,,周一,1,2,1,16,全周`);
    const result = parseTimetableCsv(csv(...lines));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("最多导入");

    const oversized = `${HEADER}\n${"课".repeat(110 * 1024)}`;
    const tooBig = parseTimetableCsv(oversized);
    expect(tooBig.ok).toBe(false);
    if (!tooBig.ok) expect(tooBig.error).toContain("不能超过");
  });
});

describe("展示辅助函数", () => {
  it("格式化周次与节次", () => {
    expect(formatWeekRange(1, 16)).toBe("1-16周");
    expect(formatWeekRange(5, 5)).toBe("第5周");
    expect(formatSectionRange(1, 2)).toBe("1-2节");
    expect(formatSectionRange(3, 3)).toBe("第3节");
    expect(weekdayLabel(3)).toBe("周三");
    expect(weekdayLabel(9)).toBe("周9");
  });
});
