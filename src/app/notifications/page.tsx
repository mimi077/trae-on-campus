"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell, BellRing, CheckCheck, Loader2, Megaphone } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader, Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { NOTIFICATION_TYPE_LABEL, type NotificationType } from "@/lib/constants";
import { cn, formatDateTime } from "@/lib/utils";
import { api } from "@/trpc/react";

const TYPE_STYLE: Record<string, string> = {
  REMINDER: "border-amber-200 bg-amber-50 text-amber-700",
  REVIEW: "border-sky-200 bg-sky-50 text-sky-700",
  RECEIPT: "border-emerald-200 bg-emerald-50 text-emerald-700",
  SYSTEM: "border-slate-200 bg-slate-100 text-slate-600",
};

export default function NotificationsPage() {
  const utils = api.useUtils();
  const [page, setPage] = useState(1);
  const listQuery = api.notification.list.useQuery({ page, pageSize: 20 });
  const noticeDigest = api.notice.latest.useQuery({ take: 5 }, { refetchInterval: 30_000 });
  const markRead = api.notification.markRead.useMutation();
  const markAllRead = api.notification.markAllRead.useMutation();

  const items = listQuery.data?.items ?? [];
  const unread = listQuery.data?.unread ?? 0;
  const notices = noticeDigest.data?.items ?? [];
  const noticeUnread = noticeDigest.data?.unread ?? 0;

  const refresh = async () => {
    await Promise.all([utils.notification.list.invalidate(), utils.notification.unreadCount.invalidate()]);
  };

  const handleRead = async (id: string) => {
    await markRead.mutateAsync({ id });
    await refresh();
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="消息中心"
        description="行政通知、截止提醒、作品审核结果与提交回执都在这里；行政通知发布后会实时同步到消息提示栏。"
        actions={
          unread > 0 ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={markAllRead.isPending}
              onClick={async () => {
                await markAllRead.mutateAsync();
                await refresh();
              }}
            >
              {markAllRead.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
              全部标为已读
            </Button>
          ) : null
        }
      />

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <BellRing className={cn("h-4 w-4", unread > 0 ? "text-primary" : "text-muted-foreground")} />
        共 {listQuery.data?.total ?? 0} 条系统通知，未读 {unread} 条
      </div>

      {notices.length > 0 ? (
        <section className="rounded-3xl bg-white/55 p-5 backdrop-blur-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary-soft text-primary">
              <Megaphone className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-foreground">行政通知</h2>
              <p className="text-[11px] text-muted-foreground">
                {noticeUnread > 0 ? `${noticeUnread} 条未读` : "全部已读"}
              </p>
            </div>
            <Link
              href="/notices"
              className="ml-auto text-xs text-primary transition-colors hover:text-primary-dark"
            >
              查看全部
            </Link>
          </div>
          <div className="mt-3 space-y-1.5">
            {notices.map((notice) => (
              <Link
                key={notice.id}
                href={`/notices/${notice.id}`}
                className="flex items-center gap-2.5 rounded-2xl bg-white/60 px-3 py-2.5 transition-colors hover:bg-white/90"
              >
                {!notice.read ? (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#E86B8A]" aria-label="未读" />
                ) : (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-transparent" />
                )}
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-xs",
                    notice.read ? "text-foreground/75" : "font-semibold text-foreground",
                  )}
                >
                  {notice.title}
                </span>
                <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:block">{notice.dept}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{formatDateTime(notice.publishAt)}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {listQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-3xl bg-white/50" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-5 w-5" />}
          title="暂无系统通知"
          description="报名竞赛后，截止提醒与作品审核结果会在这里出现。"
          action={
            <Link href="/activities" className={buttonClass({ variant: "outline", size: "sm" })}>
              去活动广场
            </Link>
          }
        />
      ) : (
        <>
          <div className="space-y-3">
            {items.map((item) => {
              const type = item.type as NotificationType;
              const unreadItem = !item.readAt;
              return (
                <div
                  key={item.id}
                  className={cn(
                    "space-y-2 rounded-3xl p-5 backdrop-blur-sm transition-colors",
                    unreadItem ? "bg-white/80 shadow-[0_16px_36px_-34px_rgba(14,143,116,0.55)]" : "bg-white/45",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={TYPE_STYLE[type] ?? TYPE_STYLE.SYSTEM}>
                      {NOTIFICATION_TYPE_LABEL[type] ?? "系统消息"}
                    </Badge>
                    {unreadItem ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-medium text-primary">
                        未读
                      </span>
                    ) : null}
                    <span className="ml-auto text-[11px] text-muted-foreground">{formatDateTime(item.createdAt)}</span>
                  </div>
                  <h3 className={cn("text-sm leading-6", unreadItem ? "font-semibold text-foreground" : "font-medium text-foreground/85")}>
                    {item.title}
                  </h3>
                  <p className="whitespace-pre-wrap text-xs leading-6 text-muted-foreground">{item.content}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {item.link ? (
                      <Link
                        href={item.link}
                        onClick={() => {
                          if (unreadItem) void handleRead(item.id);
                        }}
                        className={buttonClass({ variant: "subtle", size: "sm" })}
                      >
                        查看详情
                      </Link>
                    ) : null}
                    {unreadItem ? (
                      <Button size="sm" variant="ghost" disabled={markRead.isPending} onClick={() => void handleRead(item.id)}>
                        标为已读
                      </Button>
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
    </div>
  );
}
