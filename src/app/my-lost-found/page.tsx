"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Loader2, MapPin, MessageSquare, Plus, Search } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { LostFoundFormDialog } from "@/components/lost-found-form-dialog";
import { PageHeader, Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { Dialog, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import {
  LOST_FOUND_KIND_LABEL,
  LOST_FOUND_STATUS_LABEL,
  type LostFoundKind,
  type LostFoundStatus,
} from "@/lib/constants";
import { cn, formatDateTime } from "@/lib/utils";
import { api } from "@/trpc/react";

type StatusFilter = "ALL" | LostFoundStatus;

const STATUS_STYLE: Record<LostFoundStatus, string> = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-700",
  APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REJECTED: "border-rose-200 bg-rose-50 text-rose-600",
  CLOSED: "border-slate-200 bg-slate-100 text-slate-500",
};

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "全部" },
  { value: "PENDING", label: "待审核" },
  { value: "APPROVED", label: "已通过" },
  { value: "REJECTED", label: "已驳回" },
  { value: "CLOSED", label: "已结束" },
];

export default function MyLostFoundPage() {
  const utils = api.useUtils();
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [page, setPage] = useState(1);
  const [openCreate, setOpenCreate] = useState(false);
  const [closeTarget, setCloseTarget] = useState<{ id: string; title: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const listQuery = api.lostFound.myList.useQuery({ status, page });
  const closeRecord = api.lostFound.close.useMutation();

  const items = listQuery.data?.items ?? [];
  const counts = listQuery.data?.statusCounts;

  const handleClose = async () => {
    if (!closeTarget) return;
    setError(null);
    try {
      await closeRecord.mutateAsync({ id: closeTarget.id });
      await Promise.all([
        utils.lostFound.myList.invalidate(),
        utils.lostFound.list.invalidate(),
        utils.lostFound.byId.invalidate({ id: closeTarget.id }),
      ]);
      setCloseTarget(null);
    } catch (closeError) {
      setError(closeError instanceof Error ? closeError.message : "操作失败，请稍后重试");
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="我的失物发布"
        description="查看审核状态与同学留言；物品已找到或已归还时可以标记结束。"
        actions={
          <Button onClick={() => setOpenCreate(true)} className="gap-1.5 active:scale-[0.97]">
            <Plus className="h-4 w-4" />
            发布失物信息
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-1 rounded-full bg-white/45 p-1">
        {STATUS_TABS.map((tab) => {
          const count = tab.value === "ALL" ? undefined : counts?.[tab.value];
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                setStatus(tab.value);
                setPage(1);
              }}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs transition-all",
                status === tab.value
                  ? "mint-gradient font-medium text-white"
                  : "text-muted-foreground hover:text-primary",
              )}
            >
              {tab.label}
              {count ? ` ${count}` : ""}
            </button>
          );
        })}
        <span className="ml-auto px-2 text-xs text-muted-foreground">共 {listQuery.data?.total ?? 0} 条</span>
      </div>

      {error ? (
        <p className="rounded-2xl bg-[#FFE9E4] px-4 py-2.5 text-sm text-[#C4473A]">{error}</p>
      ) : null}

      {listQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-36 animate-pulse rounded-3xl bg-white/50" />
          ))}
        </div>
      ) : listQuery.isError ? (
        <EmptyState
          icon={<MapPin className="h-5 w-5" />}
          title="加载失败"
          description={listQuery.error.message}
          action={
            <Button variant="outline" onClick={() => void listQuery.refetch()}>
              重新加载
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Search className="h-5 w-5" />}
          title={status === "ALL" ? "你还没有发布失物信息" : "当前状态下没有记录"}
          description={
            status === "ALL"
              ? "丢了东西或捡到东西，都可以发一条信息，让同学帮你留意。"
              : "切换其他状态看看，或发布一条新的信息。"
          }
          action={
            <Button onClick={() => setOpenCreate(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              发布失物信息
            </Button>
          }
        />
      ) : (
        <>
          <div className="space-y-3">
            {items.map((record) => {
              const recordStatus = record.status as LostFoundStatus;
              const kind = record.kind as LostFoundKind;
              return (
                <div key={record.id} className="rounded-3xl bg-white/60 p-5 backdrop-blur-sm">
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
                    <span className="ml-auto text-xs text-muted-foreground">
                      发布于 {formatDateTime(record.createdAt)}
                    </span>
                  </div>

                  <Link
                    href={`/lost-found/${record.id}`}
                    className="mt-3 block text-base font-medium text-foreground transition-colors hover:text-primary"
                  >
                    {record.title}
                  </Link>

                  <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-muted-foreground">
                    {record.description || "未填写物品描述。"}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {record.location}
                    </span>
                    <span>{formatDateTime(record.happenedAt)}</span>
                    <span className="inline-flex items-center gap-1">
                      <MessageSquare className="h-3.5 w-3.5" />
                      {record.messageCount} 条留言
                    </span>
                  </div>

                  {recordStatus === "REJECTED" && record.reviewNote ? (
                    <p className="mt-3 rounded-2xl bg-rose-50 px-3.5 py-2.5 text-xs leading-5 text-rose-700">
                      驳回原因：{record.reviewNote}
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Link
                      href={`/lost-found/${record.id}`}
                      className={buttonClass({ variant: "outline", size: "sm" })}
                    >
                      查看详情
                    </Link>
                    {recordStatus === "APPROVED" ? (
                      <Button
                        size="sm"
                        variant="subtle"
                        className="gap-1"
                        onClick={() => setCloseTarget({ id: record.id, title: record.title })}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        标记结束
                      </Button>
                    ) : null}
                    {recordStatus === "PENDING" ? (
                      <span className="text-xs text-muted-foreground">管理员审核通过后自动公开</span>
                    ) : null}
                  </div>
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

      <LostFoundFormDialog open={openCreate} onOpenChange={setOpenCreate} defaultKind="FOUND" />

      <Dialog open={Boolean(closeTarget)} onOpenChange={(next) => (!next ? setCloseTarget(null) : null)}>
        <DialogHeader
          title="确认结束这条失物信息？"
          description="结束后信息仍可查看，但不再接受新的留言。"
          onClose={() => setCloseTarget(null)}
        />
        <div className="px-6 py-4">
          <p className="text-sm text-foreground">{closeTarget?.title}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setCloseTarget(null)}>
            取消
          </Button>
          <Button onClick={handleClose} disabled={closeRecord.isPending} className="gap-1.5">
            {closeRecord.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            确认结束
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
