/**
 * 学生课表导入规则（纯函数，前后端共用）
 * 指定格式为带表头的 CSV：课程名称、任课教师、上课地点、星期、开始节次、结束节次、开始周、结束周、周类型。
 * 服务端再次解析同一份文本，前端解析仅用于导入前预览，避免伪造预览绕过校验。
 */

export const TIMETABLE_MAX_ROWS = 200;
export const TIMETABLE_MAX_BYTES = 100 * 1024;
export const TIMETABLE_MAX_SECTIONS = 12;
export const TIMETABLE_MAX_WEEKS = 30;

export const TIMETABLE_HEADERS = [
  "课程名称",
  "任课教师",
  "上课地点",
  "星期",
  "开始节次",
  "结束节次",
  "开始周",
  "结束周",
  "周类型",
] as const;

export type TimetableHeader = (typeof TIMETABLE_HEADERS)[number];

export const WEEKDAY_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"] as const;

export const WEEK_TYPES = ["ALL", "ODD", "EVEN"] as const;
export type WeekType = (typeof WEEK_TYPES)[number];

export const WEEK_TYPE_LABEL: Record<WeekType, string> = {
  ALL: "每周",
  ODD: "单周",
  EVEN: "双周",
};

export type TimetableCourseInput = {
  name: string;
  teacher: string | null;
  location: string | null;
  weekday: number;
  startSection: number;
  endSection: number;
  startWeek: number;
  endWeek: number;
  weekType: WeekType;
};

export type TimetableParseResult =
  | { ok: true; rows: TimetableCourseInput[] }
  | { ok: false; error: string };

const WEEKDAY_ALIASES: Record<string, number> = {
  周一: 1,
  星期一: 1,
  礼拜一: 1,
  一: 1,
  周二: 2,
  星期二: 2,
  礼拜二: 2,
  二: 2,
  周三: 3,
  星期三: 3,
  礼拜三: 3,
  三: 3,
  周四: 4,
  星期四: 4,
  礼拜四: 4,
  四: 4,
  周五: 5,
  星期五: 5,
  礼拜五: 5,
  五: 5,
  周六: 6,
  星期六: 6,
  礼拜六: 6,
  六: 6,
  周日: 7,
  周天: 7,
  星期日: 7,
  星期天: 7,
  礼拜日: 7,
  礼拜天: 7,
  日: 7,
  天: 7,
};

const WEEK_TYPE_ALIASES: Record<string, WeekType> = {
  "": "ALL",
  全周: "ALL",
  每周: "ALL",
  每周都上: "ALL",
  ALL: "ALL",
  W: "ALL",
  单周: "ODD",
  ODD: "ODD",
  O: "ODD",
  双周: "EVEN",
  EVEN: "EVEN",
  E: "EVEN",
};

/** 支持逗号分隔、双引号包裹与转义引号（""）的轻量 CSV 单行切分 */
export function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

export function normalizeWeekday(raw: string): number | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^[1-7]$/.test(value)) return Number(value);
  return WEEKDAY_ALIASES[value] ?? null;
}

export function normalizeWeekType(raw: string): WeekType | null {
  const value = raw.trim().toUpperCase();
  return WEEK_TYPE_ALIASES[value] ?? WEEK_TYPE_ALIASES[raw.trim()] ?? null;
}

function toInt(raw: string): number {
  if (!/^\d+$/.test(raw.trim())) return Number.NaN;
  return Number(raw.trim());
}

/** 解析并校验课表 CSV；任何一行不合法都整体失败，避免导入半份课表 */
export function parseTimetableCsv(raw: string): TimetableParseResult {
  const text = raw.replace(/^\uFEFF/, "");
  const bytes = new TextEncoder().encode(text).length;
  if (bytes === 0) return { ok: false, error: "课表文件内容为空" };
  if (bytes > TIMETABLE_MAX_BYTES) {
    return { ok: false, error: `课表文件不能超过 ${Math.round(TIMETABLE_MAX_BYTES / 1024)}KB` };
  }

  const lines = text
    .split(/\r?\n/)
    .map((line, index) => ({ text: line, lineNo: index + 1 }))
    .filter((line) => line.text.trim().length > 0);

  if (lines.length < 2) {
    return { ok: false, error: "课表至少需要 1 行表头和 1 行课程数据" };
  }

  const headerCells = splitCsvLine(lines[0].text).map((cell) => cell.replace(/\s+/g, ""));
  const columnIndex = new Map<string, number>();
  headerCells.forEach((cell, index) => {
    if (!columnIndex.has(cell)) columnIndex.set(cell, index);
  });

  const missing = TIMETABLE_HEADERS.filter((header) => !columnIndex.has(header));
  if (missing.length > 0) {
    return { ok: false, error: `表头缺少字段：${missing.join("、")}。请下载模板后按格式填写` };
  }

  const dataLines = lines.slice(1);
  if (dataLines.length > TIMETABLE_MAX_ROWS) {
    return { ok: false, error: `单次最多导入 ${TIMETABLE_MAX_ROWS} 门课程` };
  }

  const rows: TimetableCourseInput[] = [];

  for (const line of dataLines) {
    const cells = splitCsvLine(line.text);
    const read = (header: TimetableHeader) => {
      const index = columnIndex.get(header);
      return index === undefined ? "" : (cells[index] ?? "").trim();
    };
    const fail = (message: string): TimetableParseResult => ({
      ok: false,
      error: `第 ${line.lineNo} 行：${message}`,
    });

    const name = read("课程名称");
    if (!name) return fail("课程名称不能为空");
    if (name.length > 40) return fail("课程名称最多 40 个字符");

    const teacher = read("任课教师") || null;
    if (teacher && teacher.length > 20) return fail("任课教师最多 20 个字符");

    const location = read("上课地点") || null;
    if (location && location.length > 40) return fail("上课地点最多 40 个字符");

    const weekday = normalizeWeekday(read("星期"));
    if (weekday === null) return fail("星期需填写 1-7 或「周一」至「周日」");

    const startSection = toInt(read("开始节次"));
    const endSection = toInt(read("结束节次"));
    if (!Number.isInteger(startSection) || startSection < 1 || startSection > TIMETABLE_MAX_SECTIONS) {
      return fail(`开始节次需为 1-${TIMETABLE_MAX_SECTIONS} 的整数`);
    }
    if (!Number.isInteger(endSection) || endSection < 1 || endSection > TIMETABLE_MAX_SECTIONS) {
      return fail(`结束节次需为 1-${TIMETABLE_MAX_SECTIONS} 的整数`);
    }
    if (endSection < startSection) return fail("结束节次不能早于开始节次");

    const startWeek = toInt(read("开始周"));
    const endWeek = toInt(read("结束周"));
    if (!Number.isInteger(startWeek) || startWeek < 1 || startWeek > TIMETABLE_MAX_WEEKS) {
      return fail(`开始周需为 1-${TIMETABLE_MAX_WEEKS} 的整数`);
    }
    if (!Number.isInteger(endWeek) || endWeek < 1 || endWeek > TIMETABLE_MAX_WEEKS) {
      return fail(`结束周需为 1-${TIMETABLE_MAX_WEEKS} 的整数`);
    }
    if (endWeek < startWeek) return fail("结束周不能早于开始周");

    const weekType = normalizeWeekType(read("周类型"));
    if (weekType === null) return fail("周类型仅支持：全周 / 单周 / 双周");

    rows.push({
      name,
      teacher,
      location,
      weekday,
      startSection,
      endSection,
      startWeek,
      endWeek,
      weekType,
    });
  }

  return { ok: true, rows };
}

/** 下载模板内容：带 BOM，Excel 打开中文不乱码 */
export function buildTimetableTemplate(): string {
  return [
    TIMETABLE_HEADERS.join(","),
    "高等数学,张老师,教学楼A203,周一,1,2,1,16,全周",
    "大学英语,李老师,外语楼B101,周三,3,4,1,16,单周",
  ].join("\r\n");
}

export function formatWeekRange(startWeek: number, endWeek: number): string {
  return startWeek === endWeek ? `第${startWeek}周` : `${startWeek}-${endWeek}周`;
}

export function formatSectionRange(startSection: number, endSection: number): string {
  return startSection === endSection ? `第${startSection}节` : `${startSection}-${endSection}节`;
}

export function weekdayLabel(weekday: number): string {
  return WEEKDAY_LABELS[weekday - 1] ?? `周${weekday}`;
}
