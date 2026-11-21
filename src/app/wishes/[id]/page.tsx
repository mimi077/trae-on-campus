"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { CalendarClock, Flag, Loader2, MessageSquare, Sparkles, XCircle } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { EmptyState } from "@/components/empty-state";
import { ReportDialog } from "@/components/report-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { formatDateTime, formatPrice } from "@/lib/utils";
import { api } from "@/trpc/react";

export default function WishDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : "";
  const utils = api.useUtils();

  const wishQuery = api.wish.byId.useQuery({ id }, { enabled: Boolean(id) });
  const closeWish = api.wish.close.useMutation();

  const [reportOpen, setReportOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wish = wishQuery.data;

  const handleClose = async () => {
    if (!wish) return;
    setError(null);
    try {
      await closeWish.mutateAsync({ id: wish.id });
      await Promise.all([
        utils.wish.byId.invalidate({ id }),
        utils.wish.list.invalidate(),
        utils.wish.myWishes.invalidate(),
      ]);
    } catch (closeError) {
      setError(closeError instanceof Error ? closeError.message : "关闭心愿失败，请稍后重试");
    }
  };

  return (
    <div className="space-y-5">
      <BackLink href="/wishes" label="返回心愿广场" />

      {wishQuery.isLoading ? (
        <div className="h-[360px] animate-pulse rounded-xl border border-border bg-white" />
      ) : wishQuery.isError || !wish ? (
        <EmptyState
          icon={<Sparkles className="h-5 w-5" />}
          title="求购心愿不存在"
          description={wishQuery.error?.message ?? "该心愿可能已被删除。"}
          action={
            <Button variant="outline" onClick={() => void wishQuery.refetch()}>
              重新加载
            </Button>
          }
        />
      ) : (
        <div className="space-y-5 rounded-xl border border-primary/15 bg-slate-50/80 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{wish.category}</Badge>
            <Badge
              className={
                wish.expired
                  ? "border-slate-200 bg-slate-100 text-slate-500"
                  : "border-emerald-200 bg-emerald-50 text-emerald-600"
              }
            >
              {wish.expired ? "已过期归档" : "有效"}
            </Badge>
            {wish.isOwner ? <Badge>我发布的</Badge> : null}
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-semibold leading-8 text-foreground">{wish.title}</h1>
            <p className="text-2xl font-semibold text-primary">心理价 {formatPrice(wish.expectPrice)}</p>
          </div>

          <div className="grid gap-4 rounded-lg bg-white/80 px-4 py-3 text-sm sm:grid-cols-3">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">发布人</p>
              <p className="font-medium text-foreground">{wish.userName}</p>
              <p className="text-[11px] text-muted-foreground">{wish.userCampus}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">发布时间</p>
              <p className="font-medium text-foreground">{formatDateTime(wish.createdAt)}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">到期时间</p>
              <p className="inline-flex items-center gap-1 font-medium text-foreground">
                <CalendarClock className="h-3.5 w-3.5 text-primary" />
                {formatDateTime(wish.expireAt)}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <h2 className="text-sm font-medium text-foreground">需求描述</h2>
            <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              {wish.description || "发布者暂未填写需求描述。"}
            </p>
          </div>

          {error ? (
            <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 border-t border-primary/15 pt-4">
            {wish.canChat ? (
              <Link
                href={`/messages?peer=${wish.userId}&wish=${wish.id}`}
                className={buttonClass({ className: "gap-1.5" })}
              >
                <MessageSquare className="h-4 w-4" />
                发起聊天
              </Link>
            ) : (
              <span className="rounded-lg bg-white px-3 py-2 text-xs text-amber-700">
                该心愿已过期归档，不能再发起新的对话，历史会话仍会在消息页保留。
              </span>
            )}

            <Button variant="outline" onClick={() => setReportOpen(true)} disabled={wish.expired} className="gap-1.5">
              <Flag className="h-4 w-4" />
              举报
            </Button>

            {wish.isOwner ? (
              <Button
                variant="outline"
                className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/5"
                onClick={handleClose}
                disabled={wish.expired || closeWish.isPending}
              >
                {closeWish.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                {wish.isActive ? "关闭心愿" : "已关闭"}
              </Button>
            ) : null}

            <Link href="/wishes" className={buttonClass({ variant: "outline" })}>
              返回心愿广场
            </Link>
          </div>
        </div>
      )}

      {wish ? <ReportDialog open={reportOpen} onOpenChange={setReportOpen} targetWishId={wish.id} /> : null}
    </div>
  );
}
