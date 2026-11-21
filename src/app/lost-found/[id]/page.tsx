"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Loader2,
  MapPin,
  MessageSquare,
  Phone,
  UserRound,
} from "lucide-react";
import { BackLink } from "@/components/back-link";
import { EmptyState } from "@/components/empty-state";
import { ItemImage } from "@/components/item-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import {
  LOST_FOUND_ICON_CATEGORY,
  LOST_FOUND_KIND_LABEL,
  LOST_FOUND_STATUS_LABEL,
  type LostFoundKind,
  type LostFoundStatus,
} from "@/lib/constants";
import { cn, formatDateTime } from "@/lib/utils";
import { api } from "@/trpc/react";

const STATUS_STYLE: Record<LostFoundStatus, string> = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-700",
  APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REJECTED: "border-rose-200 bg-rose-50 text-rose-600",
  CLOSED: "border-slate-200 bg-slate-100 text-slate-500",
};

export default function LostFoundDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : "";
  const utils = api.useUtils();

  const detailQuery = api.lostFound.byId.useQuery({ id }, { enabled: Boolean(id) });
  const messagesQuery = api.lostFound.messages.useQuery({ id }, { enabled: Boolean(id) });
  const addMessage = api.lostFound.addMessage.useMutation();
  const closeRecord = api.lostFound.close.useMutation();

  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);

  const data = detailQuery.data;
  const status = (data?.status ?? "PENDING") as LostFoundStatus;
  const kind = (data?.kind ?? "FOUND") as LostFoundKind;
  const canComment = status === "APPROVED" && !data?.isOwner;

  const refresh = async () => {
    await Promise.all([
      utils.lostFound.byId.invalidate({ id }),
      utils.lostFound.messages.invalidate({ id }),
      utils.lostFound.list.invalidate(),
      utils.lostFound.myList.invalidate(),
    ]);
  };

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = content.trim();
    if (!value || addMessage.isPending) return;
    setError(null);
    try {
      await addMessage.mutateAsync({ id, content: value });
      setContent("");
      await refresh();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "留言失败，请稍后重试");
    }
  };

  const handleClose = async () => {
    setError(null);
    try {
      await closeRecord.mutateAsync({ id });
      setConfirmClose(false);
      await refresh();
    } catch (closeError) {
      setError(closeError instanceof Error ? closeError.message : "操作失败，请稍后重试");
    }
  };

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-4">
        <BackLink href="/lost-found" label="返回失物招领" />
        <div className="h-72 animate-pulse rounded-3xl bg-white/50" />
      </div>
    );
  }

  if (detailQuery.isError || !data) {
    return (
      <div className="space-y-4">
        <BackLink href="/lost-found" label="返回失物招领" />
        <EmptyState
          icon={<MapPin className="h-5 w-5" />}
          title="信息不存在或尚未通过审核"
          description={detailQuery.error?.message ?? "该信息可能已被删除，去看看其他失物信息吧。"}
          action={
            <Button variant="outline" onClick={() => void detailQuery.refetch()}>
              重新加载
            </Button>
          }
        />
      </div>
    );
  }

  const messages = messagesQuery.data ?? [];

  return (
    <div className="space-y-6">
      <BackLink href="/lost-found" label="返回失物招领" />

      {status !== "APPROVED" ? (
        <div
          className={cn(
            "flex items-start gap-2.5 rounded-3xl px-4 py-3 text-sm",
            status === "PENDING" && "bg-amber-50 text-amber-800",
            status === "REJECTED" && "bg-rose-50 text-rose-700",
            status === "CLOSED" && "bg-slate-100 text-slate-600",
          )}
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-1">
            <p className="font-medium">
              {status === "PENDING" && "该信息正在等待管理员审核，审核通过后才会公开展示。"}
              {status === "REJECTED" && "该信息未通过审核，只有你和管理员可以看到。"}
              {status === "CLOSED" && "该信息已结束（物品已找到或已归还），不再接受新的留言。"}
            </p>
            {data.reviewNote ? (
              <p className="text-xs leading-5">审核备注：{data.reviewNote}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <div className="overflow-hidden rounded-3xl bg-white/60 backdrop-blur-sm">
            {data.imageUrl ? (
              <div className="aspect-[16/9] w-full">
                <ItemImage
                  src={data.imageUrl}
                  alt={data.title}
                  category={LOST_FOUND_ICON_CATEGORY[data.category] ?? "其他"}
                  iconClassName="h-12 w-12"
                />
              </div>
            ) : null}
            <div className="space-y-4 p-6">
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
                <Badge variant="outline">{data.category}</Badge>
                <Badge className={STATUS_STYLE[status]}>{LOST_FOUND_STATUS_LABEL[status]}</Badge>
                {data.isOwner ? <Badge>我发布的</Badge> : null}
              </div>

              <h1 className="text-2xl font-semibold leading-8 text-foreground">{data.title}</h1>

              <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                {data.description || "发布者暂未填写详细描述。"}
              </p>
            </div>
          </div>

          <section className="rounded-3xl bg-white/60 p-5 backdrop-blur-sm">
            <div className="mb-4 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold text-foreground">留言联系</h2>
              <span className="text-xs text-muted-foreground">共 {messages.length} 条</span>
            </div>

            {messagesQuery.isLoading ? (
              <div className="h-20 animate-pulse rounded-2xl bg-muted/60" />
            ) : messages.length === 0 ? (
              <p className="rounded-2xl bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
                还没有留言，如果你有线索或认领信息，可以在下方留言。
              </p>
            ) : (
              <div className="space-y-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "rounded-2xl px-4 py-3",
                      message.mine
                        ? "bg-gradient-to-r from-primary-soft/90 to-accent/50"
                        : "bg-white/70",
                    )}
                  >
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {message.userName}
                        {message.mine ? "（我）" : ""}
                      </span>
                      <span>{formatDateTime(message.createdAt)}</span>
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-foreground">
                      {message.content}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {error ? (
              <p className="mt-3 rounded-2xl bg-[#FFE9E4] px-4 py-2.5 text-sm text-[#C4473A]">{error}</p>
            ) : null}

            {canComment ? (
              <form onSubmit={handleSend} className="mt-4 space-y-2">
                <Textarea
                  value={content}
                  maxLength={300}
                  placeholder="描述你掌握的线索，或说明物品特征以便认领…"
                  onChange={(e) => setContent(e.target.value)}
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{content.length} / 300</span>
                  <Button type="submit" size="sm" disabled={!content.trim() || addMessage.isPending} className="gap-1.5">
                    {addMessage.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    发布留言
                  </Button>
                </div>
              </form>
            ) : (
              <p className="mt-4 rounded-2xl bg-muted/40 px-4 py-3 text-xs leading-5 text-muted-foreground">
                {data.isOwner
                  ? "这是你发布的信息，其他同学的留言会显示在上方。"
                  : status === "CLOSED"
                    ? "该信息已结束，无法继续留言。"
                    : "该信息尚未通过审核，审核通过后才能留言。"}
              </p>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <div className="space-y-3 rounded-3xl bg-white/60 p-5 backdrop-blur-sm">
            <h2 className="text-sm font-semibold text-foreground">信息详情</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
                <div>
                  <p className="text-xs text-muted-foreground">地点</p>
                  <p className="font-medium text-foreground">{data.location}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
                <div>
                  <p className="text-xs text-muted-foreground">
                    {kind === "FOUND" ? "捡到时间" : "丢失时间"}
                  </p>
                  <p className="font-medium text-foreground">{formatDateTime(data.happenedAt)}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
                <div>
                  <p className="text-xs text-muted-foreground">发布人</p>
                  <p className="font-medium text-foreground">{data.userName}</p>
                  <p className="text-[11px] text-muted-foreground">{data.userCampus}</p>
                </div>
              </div>
              {data.contact ? (
                <div className="flex items-start gap-2.5">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
                  <div>
                    <p className="text-xs text-muted-foreground">联系方式</p>
                    <p className="whitespace-pre-wrap font-medium text-foreground">{data.contact}</p>
                  </div>
                </div>
              ) : null}
              <div className="border-t border-dashed border-primary/15 pt-3 text-xs text-muted-foreground">
                发布时间：{formatDateTime(data.createdAt)}
              </div>
            </div>

            {data.isOwner && status === "APPROVED" ? (
              <Button variant="outline" className="w-full gap-1.5" onClick={() => setConfirmClose(true)}>
                <CheckCircle2 className="h-4 w-4" />
                标记为已找到 / 已归还
              </Button>
            ) : null}
          </div>

          <p className="rounded-3xl bg-accent/50 px-4 py-3 text-xs leading-5 text-peach-foreground">
            线下交接时建议在宿舍楼下、食堂或图书馆等公共场所进行，贵重物品请核实特征后再归还。
          </p>
        </aside>
      </div>

      <Dialog open={confirmClose} onOpenChange={setConfirmClose}>
        <DialogHeader
          title="确认结束这条失物信息？"
          description="结束后信息仍可查看，但不再接受新的留言。"
          onClose={() => setConfirmClose(false)}
        />
        <div className="px-6 py-4">
          <p className="text-sm text-foreground">{data.title}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setConfirmClose(false)}>
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
