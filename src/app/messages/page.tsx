"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, MessageSquare, Send } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatDateTime } from "@/lib/utils";
import { api } from "@/trpc/react";

function ChatPanel({
  peerId,
  itemId,
  wishId,
  onSent,
}: {
  peerId: string;
  itemId?: string;
  wishId?: string;
  onSent: () => void;
}) {
  const utils = api.useUtils();
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const stateQuery = api.message.chatState.useQuery({ peerId, itemId, wishId });
  const listQuery = api.message.list.useQuery({ peerId, itemId, wishId });
  const send = api.message.send.useMutation();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [listQuery.data?.length]);

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = content.trim();
    if (!value || send.isPending) return;
    setError(null);
    try {
      await send.mutateAsync({ peerId, itemId, wishId, content: value });
      setContent("");
      await Promise.all([
        utils.message.list.invalidate({ peerId, itemId, wishId }),
        utils.message.conversations.invalidate(),
        utils.message.chatState.invalidate({ peerId, itemId, wishId }),
      ]);
      onSent();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "发送失败，请稍后重试");
    }
  };

  const state = stateQuery.data;
  const targetHref = itemId ? `/items/${itemId}` : wishId ? `/wishes/${wishId}` : null;

  return (
    <div className="flex min-h-[540px] flex-col overflow-hidden rounded-3xl bg-white/40 shadow-[0_30px_70px_-40px_rgba(14,143,116,0.45)] backdrop-blur-2xl">
      <div className="px-5 pb-3 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {state?.peer.name ?? "会话"} · {state?.targetTitle ?? "关联信息加载中"}
            </p>
            <p className="text-xs text-muted-foreground">
              来源：{state?.targetKind === "item" ? "商品详情" : "求购心愿"}
              {state?.threadCount ? ` · 共 ${state.threadCount} 条消息` : " · 尚无历史消息"}
            </p>
          </div>
          {targetHref ? (
            <Link
              href={targetHref}
              className="shrink-0 rounded-full bg-white/60 px-3 py-1 text-xs text-primary transition hover:bg-white"
            >
              查看来源
            </Link>
          ) : null}
        </div>
        <div className="fade-divider mt-3" />
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-white/10 via-transparent to-primary-soft/25 px-4 py-4 scrollbar-thin">
        {listQuery.isLoading ? (
          <div className="h-24 animate-pulse rounded-2xl bg-white/40" />
        ) : (listQuery.data?.length ?? 0) === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center">
            <MessageSquare className="h-6 w-6 text-primary/40" />
            <p className="text-sm text-muted-foreground">还没有消息，打个招呼吧。</p>
          </div>
        ) : (
          listQuery.data?.map((message) => (
            <div key={message.id} className={cn("flex", message.mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-6 shadow-[0_14px_30px_-24px_rgba(14,143,116,0.7)]",
                  message.mine
                    ? "bg-gradient-to-br from-[#43CBAC] to-[#0E8F74] text-white rounded-br-md"
                    : "bg-white/70 text-foreground backdrop-blur-md rounded-bl-md",
                )}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
                <p className={cn("mt-1 text-[11px]", message.mine ? "text-white/70" : "text-muted-foreground")}>
                  {formatDateTime(message.createdAt)}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {state && !state.canSend ? (
        <p className="mx-4 mb-2 rounded-2xl bg-accent/70 px-4 py-2 text-xs text-peach-foreground">
          {state.reason}
        </p>
      ) : null}

      <form onSubmit={handleSend} className="flex items-center gap-2 px-4 pb-4 pt-2">
        <Input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={500}
          disabled={!state?.canSend}
          placeholder={state?.canSend ? "输入消息内容（仅文本，MVP 不做已读状态）" : "当前会话暂不可发送"}
          aria-label="消息内容"
        />
        <Button
          type="submit"
          disabled={!state?.canSend || send.isPending}
          className="h-10 w-10 shrink-0 px-0"
          aria-label="发送消息"
        >
          {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
      {error ? <p className="px-5 pb-3 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function MessagesContent() {
  const searchParams = useSearchParams();
  const peer = searchParams.get("peer") ?? undefined;
  const itemId = searchParams.get("item") ?? undefined;
  const wishId = searchParams.get("wish") ?? undefined;

  const conversationsQuery = api.message.conversations.useQuery(undefined, {
    refetchInterval: 15_000,
  });
  const utils = api.useUtils();

  const conversations = conversationsQuery.data ?? [];
  const activeHref =
    peer && (itemId || wishId)
      ? `/messages?peer=${peer}${itemId ? `&item=${itemId}` : ""}${wishId ? `&wish=${wishId}` : ""}`
      : null;

  return (
    <div className="warm-mesh space-y-5 rounded-[32px] p-4 sm:p-6">
      <BackLink href="/" label="返回广场" />
      <PageHeader
        title="我的消息会话"
        description="会话按「对方 + 关联商品/心愿」聚合；静默出价需卖家接受后才能对话。"
      />

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-2">
          <p className="px-1 text-xs text-muted-foreground">全部会话 · {conversations.length} 个</p>
          {conversationsQuery.isLoading ? (
            <div className="h-40 animate-pulse rounded-3xl bg-white/40" />
          ) : conversations.length === 0 ? (
            <EmptyState
              icon={<MessageSquare className="h-5 w-5" />}
              title="还没有会话"
              description="在商品或心愿详情页点击「发起聊天」即可开始。"
              action={
                <Link href="/" className="text-sm text-primary hover:underline">
                  去闲置广场看看
                </Link>
              }
            />
          ) : (
            <div className="space-y-1 rounded-3xl bg-white/45 p-1.5 backdrop-blur-xl">
              {conversations.map((conversation) => {
                const href = `/messages?peer=${conversation.peerId}${
                  conversation.itemId ? `&item=${conversation.itemId}` : ""
                }${conversation.wishId ? `&wish=${conversation.wishId}` : ""}`;
                return (
                  <Link
                    key={`${conversation.peerId}-${conversation.itemId}-${conversation.wishId}`}
                    href={href}
                    onClick={() => void utils.message.chatState.invalidate()}
                    className={cn(
                      "relative block space-y-1 rounded-2xl px-3 py-3 transition-colors",
                      href === activeHref
                        ? "bg-gradient-to-r from-primary-soft/90 to-accent/30"
                        : "hover:bg-gradient-to-r hover:from-primary-soft/60 hover:to-accent/30",
                    )}
                  >
                    {href === activeHref ? (
                      <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-primary" />
                    ) : null}
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-foreground">{conversation.peerName}</p>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {formatDateTime(conversation.lastAt)}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      来源：{conversation.itemTitle ?? conversation.wishTitle ?? "未知"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground/80">{conversation.lastMessage}</p>
                  </Link>
                );
              })}
            </div>
          )}
        </aside>

        {peer && (itemId || wishId) ? (
          <ChatPanel peerId={peer} itemId={itemId} wishId={wishId} onSent={() => void conversationsQuery.refetch()} />
        ) : (
          <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-3xl bg-white/35 px-6 text-center backdrop-blur-xl">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-primary-soft to-accent/70 text-primary">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">选择左侧会话查看聊天</p>
              <p className="text-sm text-muted-foreground">
                也可以从商品或求购心愿详情页点击「发起聊天」进入。
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/" className="text-sm text-primary hover:underline">
                闲置广场
              </Link>
              <span className="text-muted-foreground">·</span>
              <Link href="/wishes" className="text-sm text-primary hover:underline">
                心愿广场
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl border border-border bg-white" />}>
      <MessagesContent />
    </Suspense>
  );
}
