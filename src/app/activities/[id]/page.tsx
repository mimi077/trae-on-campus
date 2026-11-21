"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  MapPin,
  MessageSquare,
  Phone,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import { BackLink } from "@/components/back-link";
import { EmptyState } from "@/components/empty-state";
import { ItemImage } from "@/components/item-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import {
  ACTIVITY_SOURCE_LABEL,
  ACTIVITY_STATUS_LABEL,
  ACTIVITY_TAG_LABEL,
  REGISTRATION_CANCEL_HOURS,
  type ActivitySource,
  type ActivityStatus,
  type ActivityTag,
} from "@/lib/constants";
import { cn, formatDateTime } from "@/lib/utils";
import { api } from "@/trpc/react";

const STATUS_STYLE: Record<ActivityStatus, string> = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-700",
  PUBLISHED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  ONGOING: "border-sky-200 bg-sky-50 text-sky-700",
  ENDED: "border-slate-200 bg-slate-100 text-slate-500",
  CANCELLED: "border-rose-200 bg-rose-50 text-rose-600",
  REJECTED: "border-rose-200 bg-rose-50 text-rose-600",
};

export default function ActivityDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : "";
  const utils = api.useUtils();

  const detailQuery = api.activity.byId.useQuery({ id }, { enabled: Boolean(id) });
  const messagesQuery = api.activityMessage.list.useQuery({ activityId: id }, { enabled: Boolean(id) });
  const featuredWorksQuery = api.showcase.featured.useQuery(
    { activityId: id, take: 4 },
    { enabled: Boolean(id) },
  );
  const signup = api.registration.create.useMutation();
  const cancelSignup = api.registration.cancel.useMutation();
  const addMessage = api.activityMessage.create.useMutation();

  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmExternal, setConfirmExternal] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [copiedQq, setCopiedQq] = useState(false);

  const data = detailQuery.data;
  const status = (data?.status ?? "PENDING") as ActivityStatus;
  const source = (data?.source ?? "CLUB") as ActivitySource;

  const refresh = async () => {
    await Promise.all([
      utils.activity.byId.invalidate({ id }),
      utils.activity.list.invalidate(),
      utils.activity.upcoming.invalidate(),
      utils.registration.mine.invalidate(),
      utils.activityMessage.list.invalidate({ activityId: id }),
    ]);
  };

  const handleSignup = async () => {
    if (!data) return;
    setError(null);
    setNotice(null);
    try {
      const result = await signup.mutateAsync({ activityId: data.id });
      setNotice(result.status === "PENDING" ? "报名已提交，等待主办方审核" : "报名成功，记得按时参加");
      await refresh();
    } catch (signupError) {
      setError(signupError instanceof Error ? signupError.message : "报名失败，请稍后重试");
    }
  };

  const handleCancel = async () => {
    if (!data) return;
    setError(null);
    setNotice(null);
    try {
      await cancelSignup.mutateAsync({ activityId: data.id });
      setConfirmCancel(false);
      setNotice("已取消报名，名额已释放");
      await refresh();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "取消失败，请稍后重试");
    }
  };

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = content.trim();
    if (!value || addMessage.isPending) return;
    setError(null);
    try {
      await addMessage.mutateAsync({ activityId: id, content: value });
      setContent("");
      await Promise.all([
        utils.activityMessage.list.invalidate({ activityId: id }),
        utils.activity.byId.invalidate({ id }),
      ]);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "留言失败，请稍后重试");
    }
  };

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-4">
        <BackLink href="/activities" label="返回活动广场" />
        <div className="h-72 animate-pulse rounded-3xl bg-white/50" />
      </div>
    );
  }

  if (detailQuery.isError || !data) {
    return (
      <div className="space-y-4">
        <BackLink href="/activities" label="返回活动广场" />
        <EmptyState
          icon={<CalendarDays className="h-5 w-5" />}
          title="活动不存在或尚未通过审核"
          description={detailQuery.error?.message ?? "该活动可能已被删除，去看看其他活动吧。"}
          action={
            <Button variant="outline" onClick={() => void detailQuery.refetch()}>
              重新加载
            </Button>
          }
        />
      </div>
    );
  }

  const now = Date.now();
  const deadlinePassed = new Date(data.registrationDeadline).getTime() < now;
  const started = new Date(data.startAt).getTime() <= now;
  const isFull = data.capacityView?.isFull ?? false;
  const unlimited = Boolean(data.isUnlimited);
  const my = data.myRegistration;
  const isExternal = data.registrationMode === "EXTERNAL";
  const canSignup =
    status === "PUBLISHED" && !deadlinePassed && !started && !isFull && !data.isOwner && !isExternal;
  const hoursLeft = (new Date(data.startAt).getTime() - now) / 3_600_000;
  const canCancel =
    (my === "APPROVED" || my === "PENDING") && status !== "CANCELLED" && hoursLeft >= REGISTRATION_CANCEL_HOURS;
  const messages = messagesQuery.data ?? [];
  const canComment = status === "PUBLISHED" || status === "ONGOING";

  const renderPrimaryAction = () => {
    if (data.isOwner) {
      return (
        <div className="space-y-2">
          <Button className="w-full" variant="subtle" disabled>
            <ShieldCheck className="h-4 w-4" />
            这是你发布的活动
          </Button>
          {data.isStaff ? (
            <a
              href={`/admin/activities/${data.id}/roster`}
              className="block text-center text-xs text-primary hover:underline"
            >
              查看报名名单
            </a>
          ) : null}
        </div>
      );
    }
    if (my === "APPROVED") {
      return (
        <div className="space-y-2">
          <Button className="w-full" variant="subtle" disabled>
            <CheckCircle2 className="h-4 w-4" />
            已报名
          </Button>
          {canCancel ? (
            <Button className="w-full" variant="outline" size="sm" onClick={() => setConfirmCancel(true)}>
              取消报名
            </Button>
          ) : (
            <p className="text-center text-[11px] leading-4 text-muted-foreground">
              距活动开始不足 {REGISTRATION_CANCEL_HOURS} 小时，无法取消
            </p>
          )}
        </div>
      );
    }
    if (my === "PENDING") {
      return (
        <div className="space-y-2">
          <Button className="w-full" variant="subtle" disabled>
            <Clock3 className="h-4 w-4" />
            报名审核中
          </Button>
          {canCancel ? (
            <Button className="w-full" variant="outline" size="sm" onClick={() => setConfirmCancel(true)}>
              取消报名
            </Button>
          ) : null}
        </div>
      );
    }
    if (status === "CANCELLED") {
      return (
        <Button className="w-full" variant="outline" disabled>
          活动已取消
        </Button>
      );
    }
    if (status === "ENDED") {
      return (
        <Button className="w-full" variant="outline" disabled>
          活动已结束
        </Button>
      );
    }
    if (status === "ONGOING" || started) {
      return (
        <Button className="w-full" variant="outline" disabled>
          活动已开始
        </Button>
      );
    }
    if (deadlinePassed) {
      return (
        <Button className="w-full" variant="outline" disabled>
          报名已截止
        </Button>
      );
    }
    if (isFull) {
      return (
        <Button className="w-full" variant="outline" disabled>
          名额已满
        </Button>
      );
    }
    if (isExternal) {
      return (
        <Button className="w-full gap-1.5" onClick={() => setConfirmExternal(true)}>
          <ExternalLink className="h-4 w-4" />
          前往主办方报名
        </Button>
      );
    }
    return (
      <Button className="w-full" onClick={handleSignup} disabled={signup.isPending || !canSignup}>
        {signup.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        立即报名
      </Button>
    );
  };

  return (
    <div className="space-y-6">
      <BackLink href="/activities" label="返回活动广场" />

      {status !== "PUBLISHED" ? (
        <div
          className={cn(
            "flex items-start gap-2.5 rounded-3xl px-4 py-3 text-sm",
            status === "PENDING" && "bg-amber-50 text-amber-800",
            status === "ONGOING" && "bg-sky-50 text-sky-800",
            status === "ENDED" && "bg-slate-100 text-slate-600",
            (status === "CANCELLED" || status === "REJECTED") && "bg-rose-50 text-rose-700",
          )}
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-1">
            <p className="font-medium">
              {status === "PENDING" && "该活动正在等待老师审核，通过后才会公开展示。"}
              {status === "ONGOING" && "活动正在进行中，报名已关闭。"}
              {status === "ENDED" && "活动已结束，报名与留言已关闭。"}
              {status === "CANCELLED" && "该活动已被取消，已报名同学的报名状态已同步取消。"}
              {status === "REJECTED" && "该活动未通过审核，只有提交者与老师可以看到。"}
            </p>
            {data.reviewNote ? <p className="text-xs leading-5">审核备注：{data.reviewNote}</p> : null}
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-5">
          <div className="overflow-hidden rounded-3xl bg-white/60 backdrop-blur-sm">
            <div className="aspect-[16/9] w-full">
              <ItemImage src={data.coverUrl} alt={data.title} category="其他" iconClassName="h-12 w-12" />
            </div>
            <div className="space-y-4 p-6">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium",
                    source === "OFFICIAL"
                      ? "mint-gradient text-white"
                      : source === "SCHOOL"
                        ? "bg-[#E3F0FF] text-[#2563EB]"
                        : source === "COLLEGE"
                          ? "bg-[#F0E7FF] text-[#7C3AED]"
                          : "bg-gradient-to-r from-[#FFC9A6] to-[#FFA477] text-peach-foreground",
                  )}
                >
                  {source === "OFFICIAL" ? <ShieldCheck className="h-3 w-3" /> : null}
                  {ACTIVITY_SOURCE_LABEL[source]}
                </span>
                <Badge className={STATUS_STYLE[status]}>{ACTIVITY_STATUS_LABEL[status]}</Badge>
                {data.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {ACTIVITY_TAG_LABEL[tag as ActivityTag] ?? tag}
                  </Badge>
                ))}
                {data.creditPoints ? (
                  <Badge className="border-amber-200 bg-amber-50 text-amber-700">
                    {data.creditPoints} 学分
                  </Badge>
                ) : null}
              </div>

              <h1 className="text-2xl font-semibold leading-8 text-foreground">{data.title}</h1>
              {data.summary ? (
                <p className="text-sm leading-7 text-muted-foreground">{data.summary}</p>
              ) : null}

              <div className="grid gap-3 rounded-2xl bg-primary-soft/40 p-4 text-sm sm:grid-cols-2">
                <div className="flex items-start gap-2">
                  <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
                  <div>
                    <p className="text-xs text-muted-foreground">活动时间</p>
                    <p className="font-medium text-foreground">
                      {formatDateTime(data.startAt)} — {formatDateTime(data.endAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
                  <div>
                    <p className="text-xs text-muted-foreground">活动地点</p>
                    <p className="font-medium text-foreground">{data.location}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
                  <div>
                    <p className="text-xs text-muted-foreground">主办方</p>
                    <p className="font-medium text-foreground">{data.organizer}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
                  <div>
                    <p className="text-xs text-muted-foreground">报名截止</p>
                    <p className="font-medium text-foreground">{formatDateTime(data.registrationDeadline)}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-foreground">活动详情</h2>
                <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                  {data.description || "主办方暂未填写详细说明。"}
                </p>
              </div>
            </div>
          </div>

          <section className="rounded-3xl bg-white/60 p-5 backdrop-blur-sm">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold text-foreground">作品展示专区</h2>
              <span className="text-xs text-muted-foreground">共 {data.workCount} 件已通过作品</span>
              <Link
                href={`/activities/${data.id}/works`}
                className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                查看全部作品
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>

            {featuredWorksQuery.isLoading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="h-40 animate-pulse rounded-2xl bg-muted/60" />
                <div className="h-40 animate-pulse rounded-2xl bg-muted/60" />
              </div>
            ) : (featuredWorksQuery.data ?? []).length === 0 ? (
              <div className="rounded-2xl bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
                还没有公开作品，报名通过的同学可以进入专区提交作品。
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {(featuredWorksQuery.data ?? []).map((work) => (
                  <Link
                    key={work.id}
                    href={`/activities/${data.id}/works/${work.id}`}
                    className="group overflow-hidden rounded-2xl bg-white/70 transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-30px_rgba(14,143,116,0.55)]"
                  >
                    <div className="relative h-32 w-full overflow-hidden bg-primary-soft/40">
                      {work.coverUrl ? (
                        <img
                          src={work.coverUrl}
                          alt={work.title}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="grid h-full place-items-center text-xs text-muted-foreground">暂无封面</div>
                      )}
                      <div className="absolute left-2 top-2 flex gap-1">
                        {work.pinned ? (
                          <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                            置顶
                          </span>
                        ) : null}
                        {work.featured ? (
                          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-peach-foreground">
                            精选
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="space-y-1 p-3">
                      <p className="line-clamp-1 text-sm font-medium text-foreground">{work.title}</p>
                      <p className="line-clamp-1 text-[11px] text-muted-foreground">{work.authorName}</p>
                      <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">{work.excerpt}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-3xl bg-white/60 p-5 backdrop-blur-sm">
            <div className="mb-4 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold text-foreground">活动答疑</h2>
              <span className="text-xs text-muted-foreground">共 {messages.length} 条</span>
            </div>

            {messagesQuery.isLoading ? (
              <div className="h-20 animate-pulse rounded-2xl bg-muted/60" />
            ) : messages.length === 0 ? (
              <p className="rounded-2xl bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
                还没有留言，有疑问可以在下方提问。
              </p>
            ) : (
              <div className="space-y-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "rounded-2xl px-4 py-3",
                      message.mine ? "bg-gradient-to-r from-primary-soft/90 to-accent/50" : "bg-white/70",
                    )}
                  >
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {message.userName}
                        {message.mine ? "（我）" : ""}
                      </span>
                      <span>{formatDateTime(message.createdAt)}</span>
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-foreground">
                      {message.content}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {canComment ? (
              <form onSubmit={handleSend} className="mt-4 space-y-2">
                <Textarea
                  value={content}
                  maxLength={300}
                  placeholder="对活动有疑问？在这里提问，主办方会回复…"
                  onChange={(e) => setContent(e.target.value)}
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{content.length} / 300</span>
                  <Button type="submit" size="sm" disabled={!content.trim() || addMessage.isPending} className="gap-1.5">
                    {addMessage.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    发布留言
                  </Button>
                </div>
              </form>
            ) : (
              <p className="mt-4 rounded-2xl bg-muted/40 px-4 py-3 text-xs leading-5 text-muted-foreground">
                活动已结束或已取消，留言区已关闭。
              </p>
            )}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div className="space-y-4 rounded-3xl bg-white/60 p-5 backdrop-blur-sm">
            <div>
              <div className="flex items-end justify-between">
                <p className="text-xs text-muted-foreground">报名人数</p>
                <p className="text-sm font-semibold text-foreground">
                  {data.occupied}{" "}
                  <span className="text-muted-foreground">/ {unlimited ? "不限" : data.capacity}</span>
                </p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-primary-soft/70">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    isFull ? "bg-slate-400" : "bg-gradient-to-r from-[#2FBFA0] to-[#7FDFC8]",
                  )}
                  style={{ width: `${data.capacityView?.percent ?? 0}%` }}
                />
              </div>
              <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                {unlimited ? "名额不限 · 均可报名" : `剩余 ${data.remaining ?? 0} 个名额 · ${isFull ? "已满" : "可报名"}`}
              </p>
            </div>

            {notice ? (
              <p className="rounded-2xl bg-primary-soft/70 px-3 py-2 text-xs leading-5 text-primary">{notice}</p>
            ) : null}
            {error ? (
              <p className="rounded-2xl bg-[#FFE9E4] px-3 py-2 text-xs leading-5 text-[#C4473A]">{error}</p>
            ) : null}

            {renderPrimaryAction()}

            {data.showcaseEnabled ? (
              <div className="space-y-2 rounded-2xl bg-white/55 p-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  作品提交
                </div>
                <p className="text-[11px] leading-5 text-muted-foreground">
                  提交截止：{formatDateTime(data.submissionDeadline ?? data.endAt)}
                </p>
                {data.myWork?.status === "APPROVED" ? (
                  <p className="rounded-xl bg-primary-soft/60 px-2.5 py-1.5 text-[11px] text-primary">
                    作品已通过审核并公开展示
                  </p>
                ) : my === "APPROVED" ? (
                  <Link
                    href={`/activities/${data.id}/submit`}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition hover:opacity-90"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {data.myWork ? "修改我的作品" : "提交我的作品"}
                  </Link>
                ) : (
                  <p className="text-[11px] leading-5 text-muted-foreground">
                    报名审核通过后即可提交作品。
                  </p>
                )}
                {data.isOwner || data.isStaff ? (
                  <Link
                    href={`/admin/works?activityId=${data.id}`}
                    className="block text-center text-[11px] text-primary hover:underline"
                  >
                    管理作品专区与分类
                  </Link>
                ) : null}
              </div>
            ) : null}

            {data.creditPoints || data.qqGroup || data.publisherContact ? (
              <div className="space-y-2 rounded-2xl bg-white/55 p-3 text-xs">
                {data.creditPoints ? (
                  <p className="flex items-center justify-between">
                    <span className="text-muted-foreground">可获得学分</span>
                    <span className="font-semibold text-amber-700">{data.creditPoints} 学分</span>
                  </p>
                ) : null}
                {data.qqGroup ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">活动 QQ 群</span>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(data.qqGroup ?? "");
                          setCopiedQq(true);
                          window.setTimeout(() => setCopiedQq(false), 1500);
                        } catch {
                          setError("复制失败，请手动选中群号复制");
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-full bg-primary-soft/80 px-2.5 py-1 font-medium text-primary transition hover:bg-primary-soft"
                    >
                      {data.qqGroup}
                      {copiedQq ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                ) : null}
                {data.publisherContact ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5"
                    onClick={() => setContactOpen(true)}
                  >
                    <Phone className="h-3.5 w-3.5" />
                    联系发布人
                  </Button>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-1 border-t border-dashed border-primary/15 pt-3 text-[11px] leading-5 text-muted-foreground">
              <p>发布者：{data.creatorName}</p>
              <p>发布学院：{data.creatorCollege || "活动事务处"}</p>
              <p>报名方式：{data.registrationMode === "EXTERNAL" ? "外链报名（以主办方为准）" : "站内报名"}</p>
            </div>
          </div>

          <p className="rounded-3xl bg-accent/50 px-4 py-3 text-xs leading-5 text-peach-foreground">
            报名后请按时参加；如无法到场，请在活动开始前 {REGISTRATION_CANCEL_HOURS} 小时取消，把名额留给其他同学。
          </p>
        </aside>
      </div>

      <Dialog open={confirmExternal} onOpenChange={setConfirmExternal}>
        <DialogHeader
          title="即将跳转到主办方页面"
          description="报名结果与名额以主办方系统为准，平台仅提供活动信息展示。"
          onClose={() => setConfirmExternal(false)}
        />
        <div className="px-6 py-4">
          <p className="break-all rounded-2xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            {data.externalUrl}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setConfirmExternal(false)}>
            取消
          </Button>
          <Button
            onClick={() => {
              setConfirmExternal(false);
              if (data.externalUrl) window.open(data.externalUrl, "_blank", "noopener,noreferrer");
            }}
            className="gap-1.5"
          >
            <ExternalLink className="h-4 w-4" />
            继续前往
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogHeader
          title="联系发布人"
          description="以下为发布方填写的联系信息，请在工作时间联系，勿用于其他用途。"
          onClose={() => setContactOpen(false)}
        />
        <div className="space-y-2 px-6 py-4">
          <p className="text-sm font-medium text-foreground">{data.organizer}</p>
          <p className="break-all rounded-2xl bg-muted/50 px-3 py-2 text-sm text-foreground">
            {data.publisherContact}
          </p>
        </div>
        <DialogFooter>
          <Button onClick={() => setContactOpen(false)}>知道了</Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogHeader
          title="确认取消报名？"
          description="取消后名额会释放给其他同学，如仍想参加需要重新报名。"
          onClose={() => setConfirmCancel(false)}
        />
        <div className="px-6 py-4">
          <p className="text-sm text-foreground">{data.title}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setConfirmCancel(false)}>
            再想想
          </Button>
          <Button onClick={handleCancel} disabled={cancelSignup.isPending} className="gap-1.5">
            {cancelSignup.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            确认取消
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
