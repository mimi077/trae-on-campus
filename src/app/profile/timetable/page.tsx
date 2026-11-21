"use client";

import { useRef, useState } from "react";
import { CalendarDays, Download, FileUp, Loader2, Trash2, Upload } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/pagination";
import { Button, buttonClass } from "@/components/ui/button";
import {
  TIMETABLE_MAX_BYTES,
  WEEKDAY_LABELS,
  WEEK_TYPE_LABEL,
  buildTimetableTemplate,
  formatSectionRange,
  formatWeekRange,
  parseTimetableCsv,
  type TimetableCourseInput,
  type WeekType,
} from "@/lib/rules/timetable";
import { cn, formatDateTime } from "@/lib/utils";
import { api } from "@/trpc/react";

type Course = {
  id: string;
  name: string;
  teacher: string | null;
  location: string | null;
  weekday: number;
  startSection: number;
  endSection: number;
  startWeek: number;
  endWeek: number;
  weekType: string;
  createdAt: string | Date;
};

type PreviewState =
  | { status: "idle" }
  | { status: "error"; message: string; fileName: string }
  | { status: "ready"; rows: TimetableCourseInput[]; fileName: string; csv: string };

export default function TimetablePage() {
  const utils = api.useUtils();
  const listQuery = api.timetable.list.useQuery();
  const importMutation = api.timetable.importCsv.useMutation();
  const clearMutation = api.timetable.clear.useMutation();

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<PreviewState>({ status: "idle" });
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const courses = (listQuery.data?.courses ?? []) as Course[];

  const resetFile = () => {
    setPreview({ status: "idle" });
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setMessage(null);

    if (file.size > TIMETABLE_MAX_BYTES) {
      setPreview({
        status: "error",
        fileName: file.name,
        message: `课表文件不能超过 ${Math.round(TIMETABLE_MAX_BYTES / 1024)}KB，请精简后重新上传`,
      });
      return;
    }

    try {
      const csv = await file.text();
      const parsed = parseTimetableCsv(csv);
      if (!parsed.ok) {
        setPreview({ status: "error", fileName: file.name, message: parsed.error });
        return;
      }
      setPreview({ status: "ready", rows: parsed.rows, fileName: file.name, csv });
    } catch {
      setPreview({ status: "error", fileName: file.name, message: "文件读取失败，请确认是 UTF-8 编码的 CSV 文件" });
    }
  };

  const handleImport = async () => {
    if (preview.status !== "ready") return;
    setMessage(null);
    try {
      const result = await importMutation.mutateAsync({ csv: preview.csv });
      await utils.timetable.list.invalidate();
      setMessage({ tone: "ok", text: `已导入 ${result.count} 门课程，课表已更新。` });
      resetFile();
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "导入失败，请检查文件格式后重试",
      });
    }
  };

  const handleClear = async () => {
    if (!window.confirm("确认清空已导入的课表？清空后可以重新导入。")) return;
    setMessage(null);
    try {
      await clearMutation.mutateAsync();
      await utils.timetable.list.invalidate();
      setMessage({ tone: "ok", text: "课表已清空。" });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "清空失败，请稍后重试" });
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([`\uFEFF${buildTimetableTemplate()}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "课表导入模板.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const maxSection = Math.max(8, ...courses.map((course) => course.endSection));
  const courseStarts = new Map<string, Course>();
  const coveredCells = new Set<string>();
  for (const course of courses) {
    courseStarts.set(`${course.weekday}-${course.startSection}`, course);
    for (let section = course.startSection + 1; section <= course.endSection; section += 1) {
      coveredCells.add(`${course.weekday}-${section}`);
    }
  }

  return (
    <div className="space-y-5">
      <BackLink href="/profile" label="返回个人中心" />
      <PageHeader
        title="我的课表"
        description="上传 CSV 课表文件，导入后按周展示课程；课表仅自己可见，重新导入会整份覆盖。"
        actions={
          courses.length > 0 ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={clearMutation.isPending}
              onClick={() => void handleClear()}
            >
              {clearMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              清空课表
            </Button>
          ) : null
        }
      />

      <section className="rounded-3xl bg-white/55 p-6 backdrop-blur-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary-soft text-primary">
            <FileUp className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-base font-semibold">导入课表</h3>
            <p className="text-xs text-muted-foreground">
              支持 UTF-8 编码 CSV，最多 200 门课程 / {Math.round(TIMETABLE_MAX_BYTES / 1024)}KB。
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className={cn(buttonClass({ variant: "outline", size: "sm" }), "cursor-pointer gap-1.5")}>
            <Upload className="h-3.5 w-3.5" />
            选择课表文件
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => void handleFile(event)}
            />
          </label>
          <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={downloadTemplate}>
            <Download className="h-3.5 w-3.5" />
            下载模板
          </Button>
          {preview.status === "ready" ? (
            <Button
              size="sm"
              className="ml-auto gap-1.5"
              disabled={importMutation.isPending}
              onClick={() => void handleImport()}
            >
              {importMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              确认导入 {preview.rows.length} 门课程
            </Button>
          ) : null}
        </div>

        {preview.status === "error" ? (
          <p className="mt-3 rounded-2xl bg-[#FFE9E4] px-4 py-2.5 text-xs text-[#C4473A]">
            {preview.fileName}：{preview.message}
          </p>
        ) : null}

        {preview.status === "ready" ? (
          <div className="mt-3 rounded-2xl bg-white/60 p-3.5">
            <p className="text-xs font-medium text-foreground">
              预览：{preview.fileName} · 共 {preview.rows.length} 门课程
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {preview.rows.slice(0, 8).map((row, index) => (
                <span
                  key={`${row.name}-${index}`}
                  className="rounded-full bg-primary-soft/70 px-2.5 py-1 text-[11px] text-primary"
                >
                  {WEEKDAY_LABELS[row.weekday - 1]} {formatSectionRange(row.startSection, row.endSection)} · {row.name}
                </span>
              ))}
              {preview.rows.length > 8 ? (
                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] text-muted-foreground">
                  还有 {preview.rows.length - 8} 门…
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        {message ? (
          <p
            className={cn(
              "mt-3 rounded-2xl px-4 py-2.5 text-xs",
              message.tone === "ok" ? "bg-primary-soft text-primary-dark" : "bg-[#FFE9E4] text-[#C4473A]",
            )}
          >
            {message.text}
          </p>
        ) : null}

        <div className="mt-4 rounded-2xl bg-white/45 p-3.5 text-[11px] leading-5 text-muted-foreground">
          <p className="mb-1 text-xs font-medium text-foreground">CSV 格式说明</p>
          <p>表头固定为：课程名称,任课教师,上课地点,星期,开始节次,结束节次,开始周,结束周,周类型</p>
          <p>星期填写 1-7 或「周一-周日」；节次 1-12；周次 1-30；周类型支持全周 / 单周 / 双周（留空按全周）。</p>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
            <CalendarDays className="h-4 w-4 text-primary" />
            周课表
          </h2>
          <span className="text-xs text-muted-foreground">
            {listQuery.isLoading ? "正在加载…" : `共 ${courses.length} 门课程`}
          </span>
        </div>

        {listQuery.isLoading ? (
          <div className="h-64 animate-pulse rounded-3xl bg-white/50" />
        ) : courses.length === 0 ? (
          <div className="rounded-3xl bg-white/45 p-8 text-center text-sm text-muted-foreground">
            还没有导入课表。下载模板填写后上传，即可在个人中心查看每周课程。
          </div>
        ) : (
          <div className="overflow-x-auto rounded-3xl bg-white/55 p-3 backdrop-blur-sm">
            <table className="w-full min-w-[820px] border-separate border-spacing-1">
              <thead>
                <tr>
                  <th className="w-12 rounded-xl bg-white/60 py-2 text-[11px] font-medium text-muted-foreground">节次</th>
                  {WEEKDAY_LABELS.map((label) => (
                    <th key={label} className="rounded-xl bg-white/60 py-2 text-[11px] font-medium text-muted-foreground">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: maxSection }, (_, index) => index + 1).map((section) => (
                  <tr key={section}>
                    <td className="rounded-xl bg-white/45 py-1 text-center text-[11px] text-muted-foreground">
                      {section}
                    </td>
                    {WEEKDAY_LABELS.map((label, dayIndex) => {
                      const weekday = dayIndex + 1;
                      const key = `${weekday}-${section}`;
                      if (coveredCells.has(key)) return null;
                      const course = courseStarts.get(key);
                      if (!course) {
                        return <td key={label} className="h-12 rounded-xl bg-white/30" />;
                      }
                      return (
                        <td
                          key={label}
                          rowSpan={course.endSection - course.startSection + 1}
                          className="rounded-xl border border-primary/10 bg-primary-soft/70 p-2 align-top"
                        >
                          <p className="text-xs font-medium leading-5 text-foreground">{course.name}</p>
                          <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">
                            {formatWeekRange(course.startWeek, course.endWeek)} ·{" "}
                            {WEEK_TYPE_LABEL[course.weekType as WeekType] ?? "每周"}
                          </p>
                          <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">
                            {formatSectionRange(course.startSection, course.endSection)}
                            {course.location ? ` · ${course.location}` : ""}
                          </p>
                          {course.teacher ? (
                            <p className="text-[10px] leading-4 text-muted-foreground">{course.teacher}</p>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {courses.length > 0 ? (
          <p className="text-[11px] text-muted-foreground">
            最近导入时间：{formatDateTime(courses[0].createdAt)}
          </p>
        ) : null}
      </section>
    </div>
  );
}
