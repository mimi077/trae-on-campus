"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlarmClock,
  ArrowRight,
  CheckCircle2,
  ImagePlus,
  Loader2,
  Send,
  Trash2,
} from "lucide-react";
import { BackLink } from "@/components/back-link";
import { EmptyState } from "@/components/empty-state";
import { RichTextEditor } from "@/components/rich-text-editor";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { Dialog, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { WORK_MEDIA_MAX, WORK_MEDIA_TYPES, WORK_MEDIA_TYPE_LABEL } from "@/lib/constants";
import { countdownParts, evaluateSubmission, type SubmissionReceipt } from "@/lib/rules/submission";
import { cn, formatDateTime } from "@/lib/utils";
import { api } from "@/trpc/react";

type MediaRow = { type: "IMAGE" | "VIDEO" | "FILE"; url: string; name: string };

type FormState = {
  title: string;
  authorName: string;
  description: string;
  workUrl: string;
  coverUrl: string;
  categoryId: string;
  media: MediaRow[];
};

const EMPTY_FORM: FormState = {
  title: "",
  authorName: "",
  description: "",
  workUrl: "",
  coverUrl: "",
  categoryId: "",
  media: [],
};

export default function SubmitWorkPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : "";
  const utils = api.useUtils();

  const activityQuery = api.activity.byId.useQuery({ id }, { enabled: Boolean(id) });
  const overviewQuery = api.showcase.overview.useQuery({ activityId: id }, { enabled: Boolean(id) });
  const mineQuery = api.showcase.mySubmission.useQuery({ activityId: id }, { enabled: Boolean(id) });
  const meQuery = api.auth.me.useQuery();
  const submitMutation = api.showcase.submit.useMutation();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<SubmissionReceipt | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const me = meQuery.data;
  useEffect(() => {
    if (!me?.authenticated) return;
    setForm((prev) => (prev.authorName ? prev : { ...prev, authorName: me.name }));
  }, [me]);

  useEffect(() => {
    const work = mineQuery.data;
    if (!work) return;
    setForm({
      title: work.title,
      authorName: work.authorName,
      description: work.description ?? "",
      workUrl: work.workUrl ?? "",
      coverUrl: work.coverUrl ?? "",
      categoryId: work.categoryId ?? "",
      media: (work.media ?? []).map((item) => ({
        type: (WORK_MEDIA_TYPES.includes(item.type as MediaRow["type"]) ? item.type : "FILE") as MediaRow["type"],
        url: item.url,
        name: item.name ?? "",
      })),
    });
  }, [mineQuery.data]);

  const data = activityQuery.data;
  const deadline = data ? (data.submissionDeadline ?? data.endAt) : null;
  const countdown = countdownParts(deadline, now);
  const categories = overviewQuery.data?.categories ?? [];

  const gate = useMemo(
    () =>
      evaluateSubmission({
        registrationStatus: data?.myRegistration,
        deadline,
        now,
        existingStatus: mineQuery.data?.status,
      }),
    [data?.myRegistration, deadline, now, mineQuery.data?.status],
  );

  const updateMedia = (index: number, patch: Partial<MediaRow>) => {
    setForm((prev) => ({
      ...prev,
      media: prev.media.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  };

  const addMedia = () => {
    setForm((prev) =>
      prev.media.length >= WORK_MEDIA_MAX
        ? prev
        : { ...prev, media: [...prev.media, { type: "IMAGE", url: "", name: "" }] },
    );
  };

  const removeMedia = (index: number) => {
    setForm((prev) => ({ ...prev, media: prev.media.filter((_, i) => i !== index) }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!data) return;
    if (submitMutation.isPending) return;
    setError(null);

    if (form.title.trim().length < 2) {
      setError("请填写至少 2 个字的作品标题");
      return;
    }
    if (!form.authorName.trim()) {
      setError("请填写作者信息");
      return;
    }
    const invalidMedia = form.media.find((item) => item.url.trim() && !/^https?:\/\//i.test(item.url.trim()));
    if (invalidMedia) {
      setError("多媒体资源链接需以 http(s) 开头");
      return;
    }

    try {
      const result = await submitMutation.mutateAsync({
        activityId: data.id,
        title: form.title.trim(),
        authorName: form.authorName.trim(),
        description: form.description.trim() || undefined,
        workUrl: form.workUrl.trim() || undefined,
        coverUrl: form.coverUrl.trim() || undefined,
        categoryId: form.categoryId || undefined,
        media: form.media
          .filter((item) => item.url.trim())
          .map((item) => ({ type: item.type, url: item.url.trim(), name: item.name.trim() || undefined })),
      });
      setReceipt(result.receipt);
      setReceiptOpen(true);
      await Promise.all([
        utils.showcase.mySubmission.invalidate({ activityId: data.id }),
        utils.showcase.list.invalidate(),
        utils.showcase.featured.invalidate({ activityId: data.id }),
        utils.notification.unreadCount.invalidate(),
        utils.activity.byId.invalidate({ id: data.id }),
      ]);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "提交失败，请稍后重试");
    }
  };

  if (activityQuery.isLoading) {
    return (
      <div className="space-y-4">
        <BackLink href="/activities" label="返回活动广场" />
        <div className="h-72 animate-pulse rounded-3xl bg-white/50" />
      </div>
    );
  }

  if (activityQuery.isError || !data) {
    return (
      <div className="space-y-4">
        <BackLink href="/activities" label="返回活动广场" />
        <EmptyState
          icon={<Send className="h-5 w-5" />}
          title="活动不存在或未开启作品提交"
          description={activityQuery.error?.message ?? "请返回活动广场重新选择。"}
        />
      </div>
    );
  }

  const myWork = mineQuery.data;

  return (
    <div className="space-y-5">
      <BackLink href={`/activities/${data.id}`} label="返回活动详情" />

      <div
        className={cn(
          "sticky top-16 z-20 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl px-4 py-3 backdrop-blur-xl",
          countdown.expired
            ? "bg-rose-50/95 text-rose-700"
            : countdown.days === 0
              ? "bg-amber-50/95 text-amber-800"
              : "bg-primary-soft/85 text-primary",
        )}
      >
        <span className="inline-flex items-center gap-2 text-sm font-medium">
          <AlarmClock className="h-4 w-4" />
          {countdown.expired ? "作品提交已截止" : "距离作品提交截止"}
        </span>
        <span className="text-2xl font-semibold tabular-nums tracking-tight">
          {countdown.expired ? "--:--" : countdown.text}
        </span>
        <span className="text-xs opacity-80">
          {countdown.expired ? "已停止接收新作品" : `精确到分钟 · 每秒刷新 · 截止 ${deadline ? formatDateTime(deadline) : "未设置"}`}
        </span>
      </div>

      <div className="rounded-3xl bg-white/60 p-5 backdrop-blur-sm sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-foreground">{data.title}</h1>
          <Badge variant="outline">作品提交</Badge>
          {myWork ? (
            <Badge
              className={cn(
                myWork.status === "APPROVED" && "border-emerald-200 bg-emerald-50 text-emerald-700",
                myWork.status === "PENDING" && "border-amber-200 bg-amber-50 text-amber-700",
                myWork.status === "REJECTED" && "border-rose-200 bg-rose-50 text-rose-600",
              )}
            >
              {myWork.status === "APPROVED" ? "已通过" : myWork.status === "REJECTED" ? "已驳回" : "待审核"}
            </Badge>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          报名审核通过后即可提交；同一竞赛可反复修改，审核通过后作品将公开展示。
        </p>
        {myWork?.status === "REJECTED" && myWork.reviewNote ? (
          <p className="mt-3 rounded-2xl bg-rose-50 px-4 py-2.5 text-xs leading-5 text-rose-700">
            驳回原因：{myWork.reviewNote}
          </p>
        ) : null}
        {myWork?.status === "APPROVED" ? (
          <p className="mt-3 rounded-2xl bg-emerald-50 px-4 py-2.5 text-xs leading-5 text-emerald-700">
            你的作品已通过审核，当前不可再次修改；如需调整请联系主办方。
          </p>
        ) : null}
      </div>

      {!gate.allowed && myWork?.status !== "APPROVED" ? (
        <EmptyState
          icon={<CheckCircle2 className="h-5 w-5" />}
          title="暂不可提交作品"
          description={gate.reason}
          action={
            <Link href={`/activities/${data.id}`} className={buttonClass({ variant: "outline", size: "sm" })}>
              返回活动详情
            </Link>
          }
        />
      ) : gate.allowed ? (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl bg-white/60 p-5 backdrop-blur-sm sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="work-title" required>
                作品标题
              </Label>
              <Input
                id="work-title"
                value={form.title}
                maxLength={80}
                placeholder="例如：校园二手书漂流地图"
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="work-author" required>
                作者信息
              </Label>
              <Input
                id="work-author"
                value={form.authorName}
                maxLength={40}
                placeholder="姓名 · 学院 / 年级"
                onChange={(event) => setForm({ ...form, authorName: event.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="work-category">作品分类</Label>
              <Select
                value={form.categoryId}
                onChange={(value) => setForm({ ...form, categoryId: value })}
                options={[{ value: "", label: "未分类" }, ...categories.map((item) => ({ value: item.id, label: item.name }))]}
                ariaLabel="作品分类"
              />
            </div>
            <div>
              <Label htmlFor="work-url">作品访问链接</Label>
              <Input
                id="work-url"
                value={form.workUrl}
                maxLength={500}
                placeholder="https:// 开头的作品地址（选填）"
                onChange={(event) => setForm({ ...form, workUrl: event.target.value })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="work-cover">封面图片链接</Label>
            <Input
              id="work-cover"
              value={form.coverUrl}
              maxLength={500}
              placeholder="https:// 开头的图片地址（选填，列表页懒加载展示）"
              onChange={(event) => setForm({ ...form, coverUrl: event.target.value })}
            />
          </div>

          <div>
            <Label>作品描述（富文本）</Label>
            <RichTextEditor
              value={form.description}
              onChange={(html) => setForm((prev) => ({ ...prev, description: html }))}
              placeholder="介绍作品创意、实现方式与亮点，支持加粗、列表、引用与链接…"
            />
          </div>

          <div className="space-y-2 rounded-2xl bg-white/50 p-3.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-foreground">多媒体资源（图片 / 视频 / 附件）</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addMedia}
                disabled={form.media.length >= WORK_MEDIA_MAX}
                className="gap-1"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                添加资源
              </Button>
            </div>
            {form.media.length === 0 ? (
              <p className="text-[11px] leading-5 text-muted-foreground">
                最多 {WORK_MEDIA_MAX} 个资源，链接需以 http(s) 开头，建议图片使用 CDN 地址以支持懒加载。
              </p>
            ) : (
              <div className="space-y-2">
                {form.media.map((item, index) => (
                  <div key={index} className="grid gap-2 sm:grid-cols-[110px_minmax(0,1fr)_140px_36px]">
                    <Select
                      value={item.type}
                      onChange={(value) => updateMedia(index, { type: value as MediaRow["type"] })}
                      options={WORK_MEDIA_TYPES.map((type) => ({ value: type, label: WORK_MEDIA_TYPE_LABEL[type] }))}
                      ariaLabel="资源类型"
                    />
                    <Input
                      value={item.url}
                      placeholder="https://…"
                      onChange={(event) => updateMedia(index, { url: event.target.value })}
                    />
                    <Input
                      value={item.name}
                      placeholder="资源名称（选填）"
                      maxLength={80}
                      onChange={(event) => updateMedia(index, { name: event.target.value })}
                    />
                    <button
                      type="button"
                      aria-label="删除该资源"
                      onClick={() => removeMedia(index)}
                      className="grid h-10 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="rounded-2xl bg-primary-soft/40 px-4 py-3 text-xs leading-6 text-muted-foreground">
              提交后系统会立即发送提交成功回执，包含作品摘要、提交时间与审核状态说明；审核结果也会通过站内消息通知。
            </p>
          </div>

          {error ? (
            <p className="rounded-2xl bg-[#FFE9E4] px-4 py-2.5 text-sm text-[#C4473A]">{error}</p>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link href={`/activities/${data.id}/works`} className={buttonClass({ variant: "outline", size: "sm" })}>
              查看作品专区
            </Link>
            <Button type="submit" disabled={submitMutation.isPending} className="gap-1.5">
              {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {myWork ? "更新并重新提交" : "提交作品"}
            </Button>
          </div>
        </form>
      ) : null}

      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogHeader
          title={receipt?.title ?? "提交成功"}
          description="提交回执已同步写入站内通知，可随时在「系统通知」中查看。"
          onClose={() => setReceiptOpen(false)}
        />
        <div className="space-y-3 px-6 py-4">
          <p className="whitespace-pre-wrap rounded-2xl bg-primary-soft/60 px-4 py-3 text-sm leading-7 text-foreground">
            {receipt?.content}
          </p>
          {receipt ? (
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>内容摘要：{receipt.summary}</span>
              <span>提交时间：{receipt.submittedAt}</span>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Link href={`/activities/${data.id}/works`} className={buttonClass({ variant: "outline", size: "sm" })}>
            查看作品专区
          </Link>
          <Button onClick={() => setReceiptOpen(false)} className="gap-1">
            完成
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
