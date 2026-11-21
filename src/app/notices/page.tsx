"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BellRing, Megaphone, ShieldCheck, Users } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader, Pagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { NOTICE_PAGE_SIZE } from "@/lib/constants";
import { cn, formatDateTime } from "@/lib/utils";
import { api } from "@/trpc/react";

export default function NoticesPage() {
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<"ALL" | "UNREAD">("ALL");
  const listQuery = api.notice.list.useQuery({ page, pageSize: NOTICE_PAGE_SIZE });

  const items = listQuery.data?.items ?? [];
  const visible = useMemo(
    () => (tab === "UNREAD" ? items.filter((item) => !item.read) : items),
    [items, tab],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="行政通知"
        description="学生事务中心、学院与图书馆发布的正式通知；定向通知只会出现在符合身份的同学这里。"
      />

      <div className="flex flex-wrap items-center gap-2 rounded-3xl bg-white/45 p-3 backdrop-blur-sm">
        {[
          { key: "ALL" as const, label: "全部通知", icon: Megaphone },
          { key: "UNREAD" as const, label: "未读通知", icon: BellRing },
        ].map((item) => {
          const Icon = item.icon;
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs transition-colors",
                active
                  ? "mint-gradient font-medium text-white"
                  : "bg-white/60 text-muted-foreground hover:bg-primary-soft hover:text-primary",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          );
        })}
        <span className="ml-auto text-xs text-muted-foreground">
          共 {listQuery.data?.total ?? 0} 条通知
        </span>
      </div>

      {listQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-3xl bg-white/50" />
          ))}
        </div>
      ) : listQuery.isError ? (
        <EmptyState
          icon={<Megaphone className="h-5 w-5" />}
          title="加载失败"
          description={listQuery.error.message}
          action={
            <Button variant="outline" onClick={() => void listQuery.refetch()}>
              重新加载
            </Button>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="h-5 w-5" />}
          title={tab === "UNREAD" ? "没有未读通知" : "暂无通知"}
          description={tab === "UNREAD" ? "所有通知都已阅读，保持关注即可。" : "暂时没有与你相关的通知。"}
        />
      ) : (
        <>
          <div className="space-y-3">
            {visible.map((notice) => (
              <Link
                key={notice.id}
                href={`/notices/${notice.id}`}
                className="group flex items-start gap-4 rounded-3xl bg-white/60 p-4 shadow-[0_18px_40px_-36px_rgba(14,143,116,0.45)] backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-white/85"
              >
                <span
                  className={cn(
                    "mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-2xl",
                    notice.isTargeted ? "bg-[#F0E7FF] text-[#7C3AED]" : "bg-primary-soft text-primary",
                  )}
                >
                  {notice.isTargeted ? <Users className="h-5 w-5" /> : <Megaphone className="h-5 w-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3
                      className={cn(
                        "truncate text-sm transition-colors group-hover:text-primary",
                        notice.read ? "font-medium text-foreground" : "font-semibold text-foreground",
                      )}
                    >
                      {notice.title}
                    </h3>
                    {!notice.read ? (
                      <span className="rounded-full bg-[#FFE1D6] px-2 py-0.5 text-[10px] font-medium text-[#C4473A]">
                        未读
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px]",
                        notice.isTargeted
                          ? "bg-[#F0E7FF] text-[#7C3AED]"
                          : "bg-primary-soft/80 text-primary",
                      )}
                    >
                      {notice.isTargeted ? "定向通知" : "全员通知"}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {notice.content}
                  </p>
                  <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" />
                      {notice.dept}
                    </span>
                    <span>{formatDateTime(notice.publishAt)}</span>
                  </p>
                </div>
              </Link>
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
