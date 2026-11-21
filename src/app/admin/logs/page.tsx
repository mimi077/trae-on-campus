"use client";

import Link from "next/link";
import { useState } from "react";
import { ClipboardList, ShieldAlert } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader, Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { api } from "@/trpc/react";

const ACTION_LABEL: Record<string, string> = {
  OFF_SHELF_ITEM: "下架商品（举报处理）",
  CLOSE_WISH: "关闭求购心愿（举报处理）",
  REJECT_REPORT: "驳回举报",
  ADMIN_OFF_SHELF_ITEM: "管理员主动下架商品",
  ADMIN_CLOSE_WISH: "管理员主动关闭心愿",
};

export default function AdminLogsPage() {
  const meQuery = api.auth.me.useQuery();
  const [page, setPage] = useState(1);
  const allowed = Boolean(meQuery.data?.isAdmin);
  const logsQuery = api.admin.logs.useQuery({ page, pageSize: 20 }, { enabled: allowed });

  if (meQuery.isLoading) {
    return <div className="h-64 animate-pulse rounded-xl border border-border bg-white" />;
  }

  if (!allowed) {
    return (
      <EmptyState
        icon={<ShieldAlert className="h-5 w-5" />}
        title="无权访问审计日志"
        description="审计日志仅对管理员角色开放，普通用户不可见不可访问。"
        action={
          <Link href="/" className="text-sm text-primary hover:underline">
            返回闲置广场
          </Link>
        }
      />
    );
  }

  const items = logsQuery.data?.items ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="管理员操作审计日志"
        description="只读记录，不可编辑或删除；所有管理员处置动作都会自动写入。"
      />

      <div className="overflow-hidden rounded-xl border border-primary/15 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">管理员</th>
                <th className="px-4 py-3 font-medium">操作行为</th>
                <th className="px-4 py-3 font-medium">操作对象 ID</th>
                <th className="px-4 py-3 font-medium">时间</th>
              </tr>
            </thead>
            <tbody>
              {logsQuery.isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index} className="border-b border-border last:border-b-0">
                    <td colSpan={4} className="px-4 py-4">
                      <div className="h-5 w-full animate-pulse rounded bg-muted" />
                    </td>
                  </tr>
                ))
              ) : logsQuery.isError ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm text-destructive">
                    {logsQuery.error.message}
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10">
                    <EmptyState
                      className="border-0 bg-transparent py-6"
                      icon={<ClipboardList className="h-5 w-5" />}
                      title="还没有审计记录"
                      description="在举报处理队列执行一次操作后，这里会自动出现记录。"
                    />
                  </td>
                </tr>
              ) : (
                items.map((log) => (
                  <tr key={log.id} className="border-b border-border last:border-b-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-foreground">{log.adminName}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{ACTION_LABEL[log.action] ?? log.action}</Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{log.targetId}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {formatDateTime(log.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(logsQuery.data?.totalPages ?? 1) > 1 ? (
        <Pagination
          page={logsQuery.data?.page ?? 1}
          totalPages={logsQuery.data?.totalPages ?? 1}
          total={logsQuery.data?.total}
          onChange={setPage}
        />
      ) : null}
    </div>
  );
}
