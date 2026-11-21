"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import {
  ACTIVITY_MODE_LABEL,
  ACTIVITY_MODES,
  ACTIVITY_SOURCES,
  ACTIVITY_SOURCE_LABEL,
  ACTIVITY_TAG_LABEL,
  ACTIVITY_TAGS,
  ACTIVITY_TYPES,
  ACTIVITY_TYPE_LABEL,
  COLLEGES,
  GRADES,
  type ActivityMode,
  type ActivitySource,
  type ActivityTag,
  type ActivityType,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

function toLocalInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function defaultTimes() {  const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
  start.setHours(14, 0, 0, 0);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const deadline = new Date(start.getTime() - 2 * 60 * 60 * 1000);
  return { start: toLocalInput(start), end: toLocalInput(end), deadline: toLocalInput(deadline) };
}

/** 受众标签输入：支持中英文逗号 / 顿号 / 空格分隔，去重后提交 */
function parseList(raw: string) {
  return Array.from(
    new Set(
      raw
        .split(/[,，、\s]+/)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ).slice(0, 10);
}

type FormState = {
  title: string;
  type: ActivityType;
  source: ActivitySource;
  organizer: string;
  startAt: string;
  endAt: string;
  registrationDeadline: string;
  location: string;
  capacity: string;
  isUnlimited: boolean;
  submissionDeadline: string;
  showcaseEnabled: boolean;
  registrationMode: ActivityMode;
  externalUrl: string;
  summary: string;
  description: string;
  coverUrl: string;
  tags: ActivityTag[];
  creditPoints: string;
  publisherContact: string;
  qqGroup: string;
  targetCollege: string[];
  targetGrade: string[];
  targetMajorText: string;
  targetClassText: string;
};

function emptyForm(): FormState {
  const times = defaultTimes();
  return {
    title: "",
    type: "LECTURE",
    source: "CLUB",
    organizer: "",
    startAt: times.start,
    endAt: times.end,
    registrationDeadline: times.deadline,
    location: "",
    capacity: "50",
    isUnlimited: false,
    submissionDeadline: "",
    showcaseEnabled: false,
    registrationMode: "INTERNAL",
    externalUrl: "",
    summary: "",
    description: "",
    coverUrl: "",
    tags: [],
    creditPoints: "",
    publisherContact: "",
    qqGroup: "",
    targetCollege: [],
    targetGrade: [],
    targetMajorText: "",
    targetClassText: "",
  };
}

export function ActivityFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = api.useUtils();
  const meQuery = api.auth.me.useQuery();
  const isStaff = Boolean(meQuery.data?.isStaff);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedStatus, setSubmittedStatus] = useState<string | null>(null);
  const createActivity = api.activity.create.useMutation();

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm());
    setError(null);
    setSubmitting(false);
    setSubmittedStatus(null);
  }, [open]);

  const toggleTag = (tag: ActivityTag) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter((item) => item !== tag) : [...prev.tags, tag],
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const capacity = Number(form.capacity);
    if (!form.isUnlimited && (!Number.isInteger(capacity) || capacity < 1)) {
      setError("请填写有效的活动名额，或勾选「不限名额」");
      return;
    }
    if (!form.title.trim() || form.title.trim().length < 2) {
      setError("请填写至少 2 个字的活动标题");
      return;
    }
    if (!form.organizer.trim()) {
      setError("请填写主办方");
      return;
    }
    if (!form.location.trim()) {
      setError("请填写活动地点");
      return;
    }
    const start = new Date(form.startAt);
    const end = new Date(form.endAt);
    const deadline = new Date(form.registrationDeadline);
    if ([start, end, deadline].some((date) => Number.isNaN(date.getTime()))) {
      setError("请选择有效的时间");
      return;
    }
    if (end.getTime() <= start.getTime()) {
      setError("结束时间必须晚于开始时间");
      return;
    }
    if (deadline.getTime() > start.getTime()) {
      setError("报名截止时间不能晚于活动开始时间");
      return;
    }
    const submissionDeadline = form.submissionDeadline ? new Date(form.submissionDeadline) : null;
    if (submissionDeadline && Number.isNaN(submissionDeadline.getTime())) {
      setError("请选择有效的作品提交截止时间");
      return;
    }
    if (submissionDeadline && submissionDeadline.getTime() > end.getTime()) {
      setError("作品提交截止时间不能晚于活动结束时间");
      return;
    }
    const credit = form.creditPoints.trim() ? Number(form.creditPoints) : null;
    if (credit !== null && (!Number.isFinite(credit) || credit < 0 || credit > 20)) {
      setError("学分需为 0-20 之间的数字");
      return;
    }
    if (form.qqGroup.trim() && !/^\d{5,15}$/.test(form.qqGroup.trim())) {
      setError("QQ 群号需为 5-15 位数字");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await createActivity.mutateAsync({
        title: form.title.trim(),
        type: form.type,
        source: isStaff ? form.source : "CLUB",
        organizer: form.organizer.trim(),
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        registrationDeadline: deadline.toISOString(),
        location: form.location.trim(),
        capacity: form.isUnlimited ? 0 : capacity,
        isUnlimited: form.isUnlimited,
        submissionDeadline: submissionDeadline ? submissionDeadline.toISOString() : undefined,
        showcaseEnabled: form.showcaseEnabled,
        registrationMode: form.registrationMode,
        externalUrl: form.externalUrl.trim() || undefined,
        summary: form.summary.trim() || undefined,
        description: form.description.trim() || undefined,
        coverUrl: form.coverUrl.trim() || undefined,
        tags: form.tags,
        creditPoints: credit,
        publisherContact: form.publisherContact.trim() || undefined,
        qqGroup: form.qqGroup.trim() || undefined,
        targetCollege: form.targetCollege,
        targetGrade: form.targetGrade,
        targetMajor: parseList(form.targetMajorText),
        targetClass: parseList(form.targetClassText),
      });
      await Promise.all([
        utils.activity.list.invalidate(),
        utils.activity.adminList.invalidate(),
        utils.activity.pendingCount.invalidate(),
        utils.activity.upcoming.invalidate(),
        utils.activity.recommended.invalidate(),
      ]);
      setSubmittedStatus(result.status);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "提交失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (!submitting ? onOpenChange(next) : null)}>
      {submittedStatus ? (
        <>
          <DialogHeader
            title={submittedStatus === "PUBLISHED" ? "活动已发布" : "已提交，等待老师审核"}
            onClose={() => onOpenChange(false)}
          />
          <div className="space-y-4 px-6 py-6">
            <div className="flex items-start gap-3 rounded-2xl bg-primary-soft/70 px-4 py-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="space-y-1 text-sm">
                <p className="font-medium text-foreground">
                  {submittedStatus === "PUBLISHED"
                    ? "活动已经进入活动广场，学生可以开始报名。"
                    : "审核通过后会出现在活动广场。"}
                </p>
                <p className="text-xs leading-5 text-muted-foreground">
                  {submittedStatus === "PUBLISHED"
                    ? "你可以在活动详情页查看报名人数与名单。"
                    : "你可以在「我的活动」里查看审核状态，驳回时会附上原因。"}
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>知道了</Button>
          </DialogFooter>
        </>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <DialogHeader
            title={isStaff ? "发布校园活动" : "提交活动申请"}
            description={
              isStaff
                ? "教师发布的活动直接进入活动广场；请准确填写时间、地点与名额。"
                : "学生 / 社团提交的活动需老师审核，通过后才会公开展示。"
            }
            onClose={() => !submitting && onOpenChange(false)}
          />
          <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5 scrollbar-thin">
            {!isStaff ? (
              <p className="rounded-2xl bg-accent/60 px-4 py-3 text-xs leading-5 text-peach-foreground">
                提交后活动来源为「社团活动」，由活动事务处老师审核。
              </p>
            ) : null}

            <div>
              <Label htmlFor="act-title" required>
                活动标题
              </Label>
              <Input
                id="act-title"
                value={form.title}
                maxLength={60}
                placeholder="例如：AI 时代的学习方式主题讲座"
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="act-type" required>
                  活动类型
                </Label>
                <Select
                  value={form.type}
                  onChange={(value) => setForm({ ...form, type: value as ActivityType })}
                  options={ACTIVITY_TYPES.map((type) => ({ value: type, label: ACTIVITY_TYPE_LABEL[type] }))}
                  ariaLabel="活动类型"
                />
              </div>
              {isStaff ? (
                <div>
                  <Label htmlFor="act-source" required>
                    活动来源
                  </Label>
                  <Select
                    value={form.source}
                    onChange={(value) => setForm({ ...form, source: value as ActivitySource })}
                    options={ACTIVITY_SOURCES.map((source) => ({
                      value: source,
                      label: ACTIVITY_SOURCE_LABEL[source],
                    }))}
                    ariaLabel="活动来源"
                  />
                </div>
              ) : (
                <div>
                  <Label htmlFor="act-organizer" required>
                    主办方
                  </Label>
                  <Input
                    id="act-organizer"
                    value={form.organizer}
                    maxLength={40}
                    placeholder="例如：摄影协会"
                    onChange={(e) => setForm({ ...form, organizer: e.target.value })}
                  />
                </div>
              )}
            </div>

            {isStaff ? (
              <div>
                <Label htmlFor="act-organizer2" required>
                  主办方
                </Label>
                <Input
                  id="act-organizer2"
                  value={form.organizer}
                  maxLength={40}
                  placeholder="例如：学生事务中心 / 计算机学院"
                  onChange={(e) => setForm({ ...form, organizer: e.target.value })}
                />
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="act-start" required>
                  开始时间
                </Label>
                <Input
                  id="act-start"
                  type="datetime-local"
                  value={form.startAt}
                  onChange={(e) => setForm({ ...form, startAt: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="act-end" required>
                  结束时间
                </Label>
                <Input
                  id="act-end"
                  type="datetime-local"
                  value={form.endAt}
                  onChange={(e) => setForm({ ...form, endAt: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="act-deadline" required>
                  报名截止
                </Label>
                <Input
                  id="act-deadline"
                  type="datetime-local"
                  value={form.registrationDeadline}
                  onChange={(e) => setForm({ ...form, registrationDeadline: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="act-location" required>
                  活动地点
                </Label>
                <Input
                  id="act-location"
                  value={form.location}
                  maxLength={60}
                  placeholder="例如：图书馆报告厅 A101"
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="act-capacity" required={!form.isUnlimited}>
                  活动名额
                </Label>
                <Input
                  id="act-capacity"
                  type="number"
                  min={1}
                  max={2000}
                  value={form.capacity}
                  disabled={form.isUnlimited}
                  placeholder={form.isUnlimited ? "无限名额" : "例如 50"}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                />
                <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-[#2FBFA0]"
                    checked={form.isUnlimited}
                    onChange={(e) => setForm({ ...form, isUnlimited: e.target.checked })}
                  />
                  不限人数（无上限）
                </label>
              </div>
            </div>

            <div className="grid gap-4 rounded-2xl bg-white/50 p-3.5 sm:grid-cols-2">
              <div>
                <Label htmlFor="act-submission-deadline">作品提交截止</Label>
                <Input
                  id="act-submission-deadline"
                  type="datetime-local"
                  value={form.submissionDeadline}
                  onChange={(e) => setForm({ ...form, submissionDeadline: e.target.value })}
                />
                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                  留空默认使用活动结束时间；截止前 7 天 / 3 天 / 1 天 / 2 小时自动提醒已报名同学。
                </p>
              </div>
              <div>
                <Label>作品展示专区</Label>
                <label className="flex cursor-pointer items-start gap-2 rounded-2xl bg-white/70 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-3.5 w-3.5 accent-[#2FBFA0]"
                    checked={form.showcaseEnabled}
                    onChange={(e) => setForm({ ...form, showcaseEnabled: e.target.checked })}
                  />
                  开启作品提交与展示（竞赛类建议开启，发布后仍可在「作品专区管理」调整）
                </label>
              </div>
            </div>

            <div>
              <Label required>报名方式</Label>
              <div className="grid grid-cols-3 gap-2">
                {ACTIVITY_MODES.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setForm({ ...form, registrationMode: mode })}
                    className={cn(
                      "rounded-full px-3 py-2 text-xs transition-colors",
                      form.registrationMode === mode
                        ? "mint-gradient font-medium text-white"
                        : "bg-white/60 text-muted-foreground hover:bg-primary-soft hover:text-primary",
                    )}
                  >
                    {ACTIVITY_MODE_LABEL[mode]}
                  </button>
                ))}
              </div>
            </div>

            {form.registrationMode !== "INTERNAL" ? (
              <div>
                <Label htmlFor="act-external">报名链接</Label>
                <Input
                  id="act-external"
                  value={form.externalUrl}
                  maxLength={500}
                  placeholder="https:// 开头的主办方报名地址"
                  onChange={(e) => setForm({ ...form, externalUrl: e.target.value })}
                />
              </div>
            ) : null}

            <div>
              <Label>活动标签</Label>
              <div className="flex flex-wrap gap-2">
                {ACTIVITY_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs transition-colors",
                      form.tags.includes(tag)
                        ? "bg-gradient-to-r from-[#FFC9A6] to-[#FFA477] font-medium text-peach-foreground"
                        : "bg-white/60 text-muted-foreground hover:bg-accent/60",
                    )}
                  >
                    {ACTIVITY_TAG_LABEL[tag]}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 rounded-2xl bg-white/50 p-3.5">
              <p className="text-xs font-medium text-foreground">学分与联系信息（选填）</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label htmlFor="act-credit">可获得学分</Label>
                  <Input
                    id="act-credit"
                    type="number"
                    min={0}
                    max={20}
                    step={0.1}
                    value={form.creditPoints}
                    placeholder="例如 0.5"
                    onChange={(e) => setForm({ ...form, creditPoints: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="act-contact">发布人联系方式</Label>
                  <Input
                    id="act-contact"
                    value={form.publisherContact}
                    maxLength={60}
                    placeholder="例如：李老师 010-6234 8801"
                    onChange={(e) => setForm({ ...form, publisherContact: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="act-qq">活动 QQ 群</Label>
                  <Input
                    id="act-qq"
                    value={form.qqGroup}
                    maxLength={15}
                    inputMode="numeric"
                    placeholder="5-15 位群号"
                    onChange={(e) => setForm({ ...form, qqGroup: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl bg-white/50 p-3.5">
              <div>
                <p className="text-xs font-medium text-foreground">受众标签（用于「为你推荐」）</p>
                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                  全部留空表示面向全校学生；填写后只会推荐给身份匹配的同学。
                </p>
              </div>
              <div>
                <Label>面向学院</Label>
                <div className="flex flex-wrap gap-1.5">
                  {COLLEGES.map((college) => {
                    const active = form.targetCollege.includes(college);
                    return (
                      <button
                        key={college}
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            targetCollege: active
                              ? form.targetCollege.filter((item) => item !== college)
                              : [...form.targetCollege, college],
                          })
                        }
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[11px] transition-colors",
                          active
                            ? "mint-gradient font-medium text-white"
                            : "bg-white/70 text-muted-foreground hover:bg-primary-soft hover:text-primary",
                        )}
                      >
                        {college}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label>面向年级</Label>
                <div className="flex flex-wrap gap-1.5">
                  {GRADES.map((grade) => {
                    const active = form.targetGrade.includes(grade);
                    return (
                      <button
                        key={grade}
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            targetGrade: active
                              ? form.targetGrade.filter((item) => item !== grade)
                              : [...form.targetGrade, grade],
                          })
                        }
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[11px] transition-colors",
                          active
                            ? "bg-gradient-to-r from-[#FFC9A6] to-[#FFA477] font-medium text-peach-foreground"
                            : "bg-white/70 text-muted-foreground hover:bg-accent/60",
                        )}
                      >
                        {grade}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="act-target-major">面向专业</Label>
                  <Input
                    id="act-target-major"
                    value={form.targetMajorText}
                    placeholder="多个用逗号分隔，留空不限"
                    onChange={(e) => setForm({ ...form, targetMajorText: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="act-target-class">面向班级</Label>
                  <Input
                    id="act-target-class"
                    value={form.targetClassText}
                    placeholder="例如：师范1234班，留空不限"
                    onChange={(e) => setForm({ ...form, targetClassText: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="act-summary">活动简介</Label>
              <Textarea
                id="act-summary"
                value={form.summary}
                maxLength={500}
                placeholder="一句话说明活动内容，会展示在卡片上（选填）"
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="act-description">活动详情</Label>
              <Textarea
                id="act-description"
                value={form.description}
                maxLength={5000}
                placeholder="活动流程、参与要求、注意事项等（选填）"
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="act-cover">封面图片链接</Label>
              <Input
                id="act-cover"
                value={form.coverUrl}
                maxLength={500}
                placeholder="https:// 开头的图片地址（选填）"
                onChange={(e) => setForm({ ...form, coverUrl: e.target.value })}
              />
            </div>

            {error ? (
              <p className="rounded-2xl bg-[#FFE9E4] px-4 py-2.5 text-sm text-[#C4473A]">{error}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              取消
            </Button>
            <Button type="submit" disabled={submitting} className="gap-1.5">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : isStaff ? <ShieldCheck className="h-4 w-4" /> : null}
              {isStaff ? "发布活动" : "提交审核"}
            </Button>
          </DialogFooter>
        </form>
      )}
    </Dialog>
  );
}
