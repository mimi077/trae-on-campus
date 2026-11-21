"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2, MapPin, ShieldAlert } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { ItemImage } from "@/components/item-image";
import { PageHeader, Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  GENERAL_PAGE_SIZE,
  LOST_FOUND_ICON_CATEGORY,
  LOST_FOUND_KIND_LABEL,
  LOST_FOUND_STATUS_LABEL,
  type LostFoundKind,
  type LostFoundStatus,
} from "@/lib/constants";
import { cn, formatDateTime } from "@/lib/utils";
import { api } from "@/trpc/react";

type StatusFilter = "PENDING" | "APPROVED" | "REJECTED" | "ALL";

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "PENDING", label: "待审核" },
  { value: "APPROVED", label: "已通过" },
  { value: "REJECTED", label: "已驳回" },
  { value: "ALL", label: "全部" },
];

const STATUS_STYLE: Record<LostFoundStatus, string> = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-700",
  APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-600",
  REJECTED: "border-rose-200 bg-rose-50 text-rose-600",
  CLOSED: "border-slate-200 bg-slate-100 text-slate-500",
};

export default function AdminLostFoundPage() {
  const utils = api.useUtils();
  const meQuery = api.auth.me.useQuery();
  const [status, setStatus] = useState<StatusFilter>("PENDING");
  const [page, setPage] = useState(1);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const allowed = Boolean(meQuery.data?.isAdmin);
  const listQuery = api.lostFound.adminList.useQuery(
    { status, page, pageSize: GENERAL_PAGE_SIZE },
    { enabled: allowed },
  );
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
        utils.lostFound.myList.invalidate(),
      ]);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "处理失败，请稍后重试");
    }
  };

  if (meQuery.isLoading) {
    return <div className="h-64 animate-pulse rounded-3xl bg-white/50" />;
  }

  if (!allowed) {
    return (
      <EmptyState
        icon={<ShieldAlert className="h-5 w-5" />}
        title="无权访问管理后台"
        description="失物招领审核仅对管理员角色开放。"
        action={
          <Link href="/" className="text-sm text-primary hover:underline">
            返回闲置广场
          </Link>
        }
      />
    );
  }

  const items = listQuery.data?.items ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="失物招领审核"
        description="审核通过后信息才会进入公开列表；驳回时请填写原因，便于同学修改后重新发布。"
      />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
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
                    <Badge variant="outline">{record.category}</Badge>
                    <Badge className={STATUS_STYLE[recordStatus]}>
                      {LOST_FOUND_STATUS_LABEL[recordStatus] ?? record.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{formatDateTime(record.createdAt)}</span>
                    <span className="ml-auto text-xs text-muted-foreground">发布人：{record.userName}</span>
                  </div>

                  <div className="flex gap-4">
                    {record.imageUrl ? (
                      <div className="h-24 w-36 shrink-0 overflow-hidden rounded-2xl">
                        <ItemImage
                          src={record.imageUrl}
                          alt={record.title}
                          category={LOST_FOUND_ICON_CATEGORY[record.category] ?? "其他"}
                        />
                      </div>
                    ) : null}
                    <div className="min-w-0 space-y-1.5">
                      <Link
                        href={`/lost-found/${record.id}`}
                        className="text-sm font-medium text-foreground hover:text-primary"
                      >
                        {record.title}
                      </Link>
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
                        <Button
                          size="sm"
                          onClick={() => handleReview(record.id, "APPROVED")}
                          disabled={review.isPending}
                        >
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
