"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarCheck2, Loader2, MapPin, ShieldAlert, Users } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader, Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ACTIVITY_SOURCE_LABEL,
  ACTIVITY_STATUS_LABEL,
  ACTIVITY_TAG_LABEL,
  LOST_FOUND_KIND_LABEL,
  LOST_FOUND_STATUS_LABEL,
  type ActivitySource,
  type ActivityStatus,
  type ActivityTag,
  type LostFoundKind,
  type LostFoundStatus,
} from "@/lib/constants";
import { cn, formatDateTime } from "@/lib/utils";
import { api } from "@/trpc/react";

type Panel = "activity" | "lostfound";

const ACTIVITY_FILTERS = [
  { value: "PENDING", label: "待审核" },
  { value: "PUBLISHED", label: "已通过" },
  { value: "REJECTED", label: "已驳回" },
  { value: "ALL", label: "全部" },
] as const;

const LOST_FILTERS = [
  { value: "PENDING", label: "待审核" },
  { value: "APPROVED", label: "已通过" },
  { value: "REJECTED", label: "已驳回" },
  { value: "ALL", label: "全部" },
] as const;

const ACTIVITY_STATUS_STYLE: Record<ActivityStatus, string> = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-700",
  PUBLISHED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  ONGOING: "border-sky-200 bg-sky-50 text-sky-700",
  ENDED: "border-slate-200 bg-slate-100 text-slate-500",
  CANCELLED: "border-rose-200 bg-rose-50 text-rose-600",
  REJECTED: "border-rose-200 bg-rose-50 text-rose-600",
};

const LOST_STATUS_STYLE: Record<LostFoundStatus, string> = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-700",
  APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-600",
  REJECTED: "border-rose-200 bg-rose-50 text-rose-600",
  CLOSED: "border-slate-200 bg-slate-100 text-slate-500",
};

function ActivityReviewPanel() {
  const utils = api.useUtils();
  const [status, setStatus] = useState<(typeof ACTIVITY_FILTERS)[number]["value"]>("PENDING");
  const [page, setPage] = useState(1);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const listQuery = api.activity.adminList.useQuery({ status, page, pageSize: 10 });
  const review = api.activity.review.useMutation();

  const handleReview = async (id: string, action: "PUBLISHED" | "REJECTED") => {
    setError(null);
    try {
      await review.mutateAsync({ id, action, note: notes[id]?.trim() || undefined });
      setNotes((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await Promise.all([
        utils.activity.adminList.invalidate(),
        utils.activity.list.invalidate(),
        utils.activity.pendingCount.invalidate(),
        utils.activity.upcoming.invalidate(),
        utils.admin.logs.invalidate(),
      ]);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "处理失败，请稍后重试");
    }
  };

  const items = listQuery.data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {ACTIVITY_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => {
              setStatus(filter.value);
              setPage(1);
            }}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs transition-colors",
              status === filter.value
                ? "mint-gradient font-medium text-white"
                : "bg-white/55 text-muted-foreground hover:bg-primary-soft hover:text-primary",
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="rounded-2xl bg-[#FFE9E4] px-4 py-2.5 text-sm text-[#C4473A]">{error}</p>
      ) : null}

      {listQuery.isLoading ? (
        <div className="h-48 animate-pulse rounded-3xl bg-white/50" />
      ) : listQuery.isError ? (
        <p className="text-sm text-destructive">{listQuery.error.message}</p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<CalendarCheck2 className="h-5 w-5" />}
          title="当前筛选下没有活动"
          description="队列清空时，说明所有活动都已处理完毕。"
        />
      ) : (
        <>
          <div className="space-y-3">
            {items.map((activity) => {
              const activityStatus = activity.status as ActivityStatus;
              const source = activity.source as ActivitySource;
              return (
                <div key={activity.id} className="space-y-3 rounded-3xl bg-white/60 p-5 backdrop-blur-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px] font-medium",
                        source === "OFFICIAL"
                          ? "mint-gradient text-white"
                          : source === "SCHOOL"
                            ? "bg-[#E3F0FF] text-[#2563EB]"
                            : source === "COLLEGE"
                              ? "bg-[#F0E7FF] text-[#7C3AED]"
                              : "bg-gradient-to-r from-[#FFC9A6] to-[#FFA477] text-peach-foreground",
                      )}
                    >
                      {ACTIVITY_SOURCE_LABEL[source]}
                    </span>
                    <Badge className={ACTIVITY_STATUS_STYLE[activityStatus]}>
                      {ACTIVITY_STATUS_LABEL[activityStatus] ?? activity.status}
                    </Badge>
                    {activity.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {ACTIVITY_TAG_LABEL[tag as ActivityTag] ?? tag}
                      </Badge>
                    ))}
                    <span className="ml-auto text-xs text-muted-foreground">提交人：{activity.creatorName}</span>
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-sm font-medium text-foreground">{activity.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      主办：{activity.organizer} · 名额 {activity.isUnlimited ? "不限" : `${activity.capacity} 人`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      时间：{formatDateTime(activity.startAt)} — {formatDateTime(activity.endAt)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      地点：{activity.location} · 报名截止：{formatDateTime(activity.registrationDeadline)}
                    </p>
                    {activity.summary ? (
                      <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                        {activity.summary}
                      </p>
                    ) : null}
                    {activity.reviewNote ? (
                      <p className="text-xs text-muted-foreground">审核备注：{activity.reviewNote}</p>
                    ) : null}
                  </div>

                  {activityStatus === "PENDING" ? (
                    <div className="space-y-2">
                      <Input
                        value={notes[activity.id] ?? ""}
                        maxLength={200}
                        placeholder="驳回时请填写原因（至少 5 个字）；通过可留空"
                        onChange={(e) => setNotes((prev) => ({ ...prev, [activity.id]: e.target.value }))}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => handleReview(activity.id, "PUBLISHED")} disabled={review.isPending}>
                          通过并发布
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-destructive/30 text-destructive hover:bg-destructive/5"
                          onClick={() => handleReview(activity.id, "REJECTED")}
                          disabled={review.isPending}
                        >
                          {review.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                          驳回
                        </Button>
                        <Link
                          href={`/activities/${activity.id}`}
                          className={buttonClass({ variant: "ghost", size: "sm" })}
                        >
                          查看详情
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/admin/activities/${activity.id}/roster`}
                        className={buttonClass({ variant: "outline", size: "sm", className: "gap-1" })}
                      >
                        <Users className="h-3.5 w-3.5" />
                        报名名单
                      </Link>
                      <Link
                        href={`/activities/${activity.id}`}
                        className={buttonClass({ variant: "ghost", size: "sm" })}
                      >
                        查看详情
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <Pagination
            page={listQuery.data?.page ?? 1}
            totalPages={listQuery.data?.totalPages ?? 1}
            total={listQuery.data?.total}
            onChange={setPage}
          />
        </>
      )}
    </div>
  );
}

function LostFoundReviewPanel() {
  const utils = api.useUtils();
  const [status, setStatus] = useState<(typeof LOST_FILTERS)[number]["value"]>("PENDING");
  const [page, setPage] = useState(1);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const listQuery = api.lostFound.adminList.useQuery({ status, page, pageSize: 10 });
  const review = api.lostFound.adminReview.useMutation();

  const handleReview = async (id: string, action: "APPROVED" | "REJECTED") => {
    setError(null);
    try {
      await review.mutateAsync({ id, action, note: notes[id]?.trim() || undefined });
      setNotes((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await Promise.all([
        utils.lostFound.adminList.invalidate(),
        utils.lostFound.list.invalidate(),
        utils.lostFound.pendingCount.invalidate(),
        utils.admin.logs.invalidate(),
      ]);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "处理失败，请稍后重试");
    }
  };

  const items = listQuery.data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {LOST_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => {
              setStatus(filter.value);
              setPage(1);
            }}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs transition-colors",
              status === filter.value
                ? "mint-gradient font-medium text-white"
                : "bg-white/55 text-muted-foreground hover:bg-primary-soft hover:text-primary",
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="rounded-2xl bg-[#FFE9E4] px-4 py-2.5 text-sm text-[#C4473A]">{error}</p>
      ) : null}

      {listQuery.isLoading ? (
        <div className="h-48 animate-pulse rounded-3xl bg-white/50" />
      ) : listQuery.isError ? (
        <p className="text-sm text-destructive">{listQuery.error.message}</p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<MapPin className="h-5 w-5" />}
          title="当前筛选下没有失物信息"
          description="队列清空时，说明所有信息都已处理完毕。"
        />
      ) : (
        <>
          <div className="space-y-3">
            {items.map((record) => {
              const kind = record.kind as LostFoundKind;
              const recordStatus = record.status as LostFoundStatus;
              return (
                <div key={record.id} className="space-y-3 rounded-3xl bg-white/60 p-5 backdrop-blur-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px] font-medium",
                        kind === "FOUND"
                          ? "mint-gradient text-white"
                          : "bg-gradient-to-r from-[#FFC9A6] to-[#FFA477] text-peach-foreground",
                      )}
                    >
                      {LOST_FOUND_KIND_LABEL[kind]}
                    </span>
                    <Badge className={LOST_STATUS_STYLE[recordStatus]}>
                      {LOST_FOUND_STATUS_LABEL[recordStatus] ?? record.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{formatDateTime(record.createdAt)}</span>
                    <span className="ml-auto text-xs text-muted-foreground">发布人：{record.userName}</span>
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-sm font-medium text-foreground">{record.title}</h3>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                      {record.description || "未填写物品描述。"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      地点：{record.location} · 发生时间：{formatDateTime(record.happenedAt)}
                    </p>
                    {record.contact ? (
                      <p className="text-xs text-muted-foreground">联系方式：{record.contact}</p>
                    ) : null}
                    {record.reviewNote ? (
                      <p className="text-xs text-muted-foreground">审核备注：{record.reviewNote}</p>
                    ) : null}
                  </div>

                  {recordStatus === "PENDING" ? (
                    <div className="space-y-2">
                      <Input
                        value={notes[record.id] ?? ""}
                        maxLength={200}
                        placeholder="驳回时需要填写原因；通过时可留空"
                        onChange={(e) => setNotes((prev) => ({ ...prev, [record.id]: e.target.value }))}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => handleReview(record.id, "APPROVED")} disabled={review.isPending}>
                          通过并公开
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-destructive/30 text-destructive hover:bg-destructive/5"
                          onClick={() => handleReview(record.id, "REJECTED")}
                          disabled={review.isPending}
                        >
                          {review.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                          驳回
                        </Button>
                        <Link
                          href={`/lost-found/${record.id}`}
                          className={buttonClass({ variant: "ghost", size: "sm" })}
                        >
                          查看详情
                        </Link>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <Pagination
            page={listQuery.data?.page ?? 1}
            totalPages={listQuery.data?.totalPages ?? 1}
            total={listQuery.data?.total}
            onChange={setPage}
          />
        </>
      )}
    </div>
  );
}

export default function AdminReviewsPage() {
  const meQuery = api.auth.me.useQuery();
  const [panel, setPanel] = useState<Panel>("activity");

  if (meQuery.isLoading) {
    return <div className="h-64 animate-pulse rounded-3xl bg-white/50" />;
  }

  if (!meQuery.data?.isStaff) {
    return (
      <EmptyState
        icon={<ShieldAlert className="h-5 w-5" />}
        title="无权访问审核中心"
        description="活动与失物审核仅对教师或管理员开放。"
        action={
          <Link href="/" className="text-sm text-primary hover:underline">
            返回闲置广场
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="审核中心"
        description="活动与失物信息审核通过后才会公开展示；驳回时请填写原因，便于提交者修改。"
      />

      <div className="flex flex-wrap gap-1 rounded-full bg-white/45 p-1">
        {(
          [
            { value: "activity", label: "活动审核" },
            { value: "lostfound", label: "失物招领审核" },
          ] as const
        ).map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setPanel(item.value)}
            className={cn(
              "rounded-full px-4 py-1.5 text-xs transition-all",
              panel === item.value
                ? "mint-gradient font-medium text-white"
                : "text-muted-foreground hover:text-primary",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {panel === "activity" ? <ActivityReviewPanel /> : <LostFoundReviewPanel />}
    </div>
  );
}
