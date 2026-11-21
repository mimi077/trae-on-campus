"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { AlertCircle, Megaphone, ShieldCheck, Users } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { cn, formatDateTime } from "@/lib/utils";
import { api } from "@/trpc/react";

export default function NoticeDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : "";
  const utils = api.useUtils();
  const detailQuery = api.notice.byId.useQuery({ id }, { enabled: Boolean(id) });
  const markRead = api.notice.markRead.useMutation();

  useEffect(() => {
    if (!detailQuery.data || detailQuery.data.read) return;
    markRead.mutate(
      { id },
      {
        onSuccess: () => {
          void utils.notice.unreadCount.invalidate();
          void utils.notice.list.invalidate();
        },
      },
    );
    // 只在首次加载到未读通知时标记已读
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailQuery.data?.id, detailQuery.data?.read]);

  const data = detailQuery.data;

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-4">
        <BackLink href="/notices" label="返回行政通知" />
        <div className="h-64 animate-pulse rounded-3xl bg-white/50" />
      </div>
    );
  }

  if (detailQuery.isError || !data) {
    return (
      <div className="space-y-4">
        <BackLink href="/notices" label="返回行政通知" />
        <EmptyState
          icon={<Megaphone className="h-5 w-5" />}
          title="通知不存在或已下架"
          description={detailQuery.error?.message ?? "这条通知可能已被发布方下架。"}
          action={
            <Button variant="outline" onClick={() => void detailQuery.refetch()}>
              重新加载
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <BackLink href="/notices" label="返回行政通知" />

      <article className="rounded-3xl bg-white/65 p-6 backdrop-blur-sm sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium",
              data.isTargeted ? "bg-[#F0E7FF] text-[#7C3AED]" : "mint-gradient text-white",
            )}
          >
            {data.isTargeted ? <Users className="h-3 w-3" /> : <Megaphone className="h-3 w-3" />}
            {data.isTargeted ? "定向通知" : "全员通知"}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3" />
            {data.dept}
          </span>
          <span className="text-[11px] text-muted-foreground">发布时间 {formatDateTime(data.publishAt)}</span>
        </div>

        <h1 className="mt-4 text-2xl font-semibold leading-9 text-foreground">{data.title}</h1>
        <p className="mt-1 text-xs text-muted-foreground">发布人：{data.creatorName}</p>

        {data.isTargeted ? (
          <div className="mt-4 flex flex-wrap items-center gap-1.5 rounded-2xl bg-[#F0E7FF]/60 px-4 py-3 text-[11px] text-[#5B3E9E]">
            <AlertCircle className="h-3.5 w-3.5" />
            本通知仅对符合以下身份的同学可见：
            {[
              data.targetCollege ? `学院 ${data.targetCollege}` : null,
              data.targetGrade ? `年级 ${data.targetGrade}` : null,
              data.targetMajor ? `专业 ${data.targetMajor}` : null,
              data.targetClass ? `班级 ${data.targetClass}` : null,
            ]
              .filter(Boolean)
              .map((label) => (
                <span key={label} className="rounded-full bg-white/70 px-2 py-0.5">
                  {label}
                </span>
              ))}
          </div>
        ) : null}

        <div className="mt-6 whitespace-pre-wrap border-t border-dashed border-primary/15 pt-5 text-sm leading-7 text-foreground">
          {data.content}
        </div>
      </article>
    </div>
  );
}
