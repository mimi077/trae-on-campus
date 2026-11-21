"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader, Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GENERAL_PAGE_SIZE, REPORT_STATUS_LABEL, type ReportStatus } from "@/lib/constants";
import { formatDateTime, cn } from "@/lib/utils";
import { api } from "@/trpc/react";

type StatusFilter = "PENDING" | "RESOLVED" | "REJECTED" | "ALL";

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "PENDING", label: "待处理" },
  { value: "RESOLVED", label: "已处理" },
  { value: "REJECTED", label: "已驳回" },
  { value: "ALL", label: "全部" },
];

export default function AdminReportsPage() {
  const utils = api.useUtils();
  const meQuery = api.auth.me.useQuery();
  const [status, setStatus] = useState<StatusFilter>("PENDING");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const allowed = Boolean(meQuery.data?.isAdmin);
  const listQuery = api.report.adminList.useQuery(
    { status, page, pageSize: GENERAL_PAGE_SIZE },
    { enabled: allowed },
  );
  const resolve = api.report.adminResolve.useMutation();

  const handleResolve = async (id: string, action: "RESOLVED" | "REJECTED") => {
    setError(null);
    try {
      await resolve.mutateAsync({ id, action });
      await Promise.all([
        utils.report.adminList.invalidate(),
        utils.admin.logs.invalidate(),
        utils.item.list.invalidate(),
        utils.wish.list.invalidate(),
      ]);
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : "处理失败，请稍后重试");
    }
  };

  if (meQuery.isLoading) {
    return <div className="h-64 animate-pulse rounded-xl border border-border bg-white" />;
  }

  if (!allowed) {
    return (
      <EmptyState
        icon={<ShieldAlert className="h-5 w-5" />}
        title="无权访问管理后台"
        description="管理后台仅对管理员角色开放。可在右上角将演示身份切换为「管理员」后重试。"
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
        title="举报处理队列"
        description="驳回或执行下架/关闭，每一次操作都会自动写入管理员审计日志。"
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
              "rounded-lg border px-3 py-1.5 text-sm transition-colors",
              status === filter.value
                ? "border-primary/30 bg-primary-soft font-medium text-primary"
                : "border-border bg-white text-muted-foreground hover:bg-muted",
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {listQuery.isLoading ? (
        <div className="h-48 animate-pulse rounded-xl border border-border bg-white" />
      ) : listQuery.isError ? (
        <p className="text-sm text-destructive">{listQuery.error.message}</p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ShieldAlert className="h-5 w-5" />}
          title="当前筛选下没有举报"
          description="队列清空时，说明所有举报都已处理完毕。"
        />
      ) : (
        <>
          <div className="space-y-3">
            {items.map((report) => (
              <div key={report.id} className="space-y-3 rounded-xl border border-primary/15 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{report.targetType === "ITEM" ? "商品举报" : "心愿举报"}</Badge>
                  <Badge
                    className={
                      report.status === "PENDING"
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : report.status === "RESOLVED"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                          : "border-slate-200 bg-slate-100 text-slate-500"
                    }
                  >
                    {REPORT_STATUS_LABEL[report.status as ReportStatus] ?? report.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{formatDateTime(report.createdAt)}</span>
                  <span className="ml-auto text-xs text-muted-foreground">举报人：{report.reporterName}</span>
                </div>

                <div className="space-y-1">
                  <Link
                    href={report.targetItemId ? `/items/${report.targetItemId}` : `/wishes/${report.targetWishId}`}
                    className="text-sm font-medium text-foreground hover:text-primary"
                  >
                    {report.targetTitle}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    对象当前状态：{report.targetStatus === "ON_SALE" || report.targetStatus === "ACTIVE" ? "有效" : "已下架/已关闭"}
                  </p>
                  <p className="whitespace-pre-wrap rounded-lg bg-muted/60 px-3 py-2 text-sm text-foreground">
                    {report.reason}
                  </p>
                </div>

                {report.status === "PENDING" ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleResolve(report.id, "RESOLVED")}
                      disabled={resolve.isPending}
                    >
                      {report.targetType === "ITEM" ? "执行下架商品" : "执行关闭心愿"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-destructive/30 text-destructive hover:bg-destructive/5"
                      onClick={() => handleResolve(report.id, "REJECTED")}
                      disabled={resolve.isPending}
                    >
                      {resolve.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      驳回举报
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
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
