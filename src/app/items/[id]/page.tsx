"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import {
  ArrowLeft,
  Flag,
  Gavel,
  Gift,
  Heart,
  Lightbulb,
  Loader2,
  MessageSquare,
  PackageOpen,
} from "lucide-react";
import { BackLink } from "@/components/back-link";
import { BidDialog } from "@/components/bid-dialog";
import { EmptyState } from "@/components/empty-state";
import { ItemCard } from "@/components/item-card";
import { ItemImage } from "@/components/item-image";
import { ReportDialog } from "@/components/report-dialog";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { Dialog, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { BARGAIN_LABEL, BID_STATUS_LABEL, type BargainMode, type BidStatus } from "@/lib/constants";
import { cn, formatDateTime, formatPrice } from "@/lib/utils";
import { api } from "@/trpc/react";

export default function ItemDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : "";
  const utils = api.useUtils();

  const detailQuery = api.item.byId.useQuery({ id }, { enabled: Boolean(id) });
  const relatedQuery = api.item.related.useQuery({ id }, { enabled: Boolean(id) });
  const bidsQuery = api.bid.listForOwner.useQuery(
    { itemId: id },
    { enabled: Boolean(id) && Boolean(detailQuery.data?.isOwner) },
  );

  const addFavorite = api.favorite.add.useMutation();
  const removeFavorite = api.favorite.remove.useMutation();
  const addIntent = api.intentFavorite.add.useMutation();
  const removeIntent = api.intentFavorite.remove.useMutation();
  const approveGift = api.gift.approve.useMutation();
  const decideBid = api.bid.decide.useMutation();
  const offShelf = api.item.offShelf.useMutation();

  const [favoritePending, setFavoritePending] = useState(false);
  const [intentPending, setIntentPending] = useState(false);
  const [giftPending, setGiftPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [bidOpen, setBidOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const lastFavoriteClick = useRef(0);

  const data = detailQuery.data;
  const soldOut = Boolean(data) && data?.status !== "ON_SALE";
  const favoriteDisabled = Boolean(data) && soldOut && !data?.isFavorited;
  const intentDisabled = Boolean(data) && soldOut && !data?.isIntentFavorited;

  const refreshDetail = async () => {
    await Promise.all([
      utils.item.byId.invalidate({ id }),
      utils.item.list.invalidate(),
      utils.favorite.list.invalidate(),
      utils.intentFavorite.list.invalidate(),
      utils.bid.listForOwner.invalidate({ itemId: id }),
      utils.bid.myBidForItem.invalidate({ itemId: id }),
      utils.gift.myGiven.invalidate(),
      utils.gift.myApprovals.invalidate(),
    ]);
  };

  const handleToggleFavorite = async () => {
    if (!data || favoritePending) return;
    const now = Date.now();
    if (now - lastFavoriteClick.current < 400) return;
    lastFavoriteClick.current = now;

    setFavoritePending(true);
    setActionError(null);
    try {
      if (data.isFavorited) await removeFavorite.mutateAsync({ itemId: data.id });
      else await addFavorite.mutateAsync({ itemId: data.id });
      await refreshDetail();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "操作失败，请稍后重试");
    } finally {
      setFavoritePending(false);
    }
  };

  const handleToggleIntent = async () => {
    if (!data || intentPending) return;
    setIntentPending(true);
    setActionError(null);
    try {
      if (data.isIntentFavorited) await removeIntent.mutateAsync({ itemId: data.id });
      else await addIntent.mutateAsync({ itemId: data.id });
      await refreshDetail();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "操作失败，请稍后重试");
    } finally {
      setIntentPending(false);
    }
  };

  const handleGiftApprove = async () => {
    if (!data || giftPending) return;
    setGiftPending(true);
    setActionError(null);
    try {
      await approveGift.mutateAsync({ itemId: data.id });
      await refreshDetail();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "善意认可失败，请稍后重试");
    } finally {
      setGiftPending(false);
    }
  };

  const handleOffShelf = async () => {
    if (!data) return;
    setActionError(null);
    try {
      await offShelf.mutateAsync({ id: data.id });
      await refreshDetail();
      setConfirmOpen(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "下架失败，请稍后重试");
    }
  };

  const handleDecideBid = async (bidId: string, action: "ACCEPTED" | "REJECTED") => {
    setActionError(null);
    try {
      await decideBid.mutateAsync({ bidId, action });
      await refreshDetail();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "处理出价失败，请稍后重试");
    }
  };

  return (
    <div className="space-y-6">
      <BackLink href="/" label="返回广场" />

      {detailQuery.isLoading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="aspect-[4/3] animate-pulse rounded-xl border border-border bg-white" />
          <div className="h-[420px] animate-pulse rounded-xl border border-border bg-white" />
        </div>
      ) : detailQuery.isError || !data ? (
        <EmptyState
          icon={<PackageOpen className="h-5 w-5" />}
          title="商品不存在"
          description={detailQuery.error?.message ?? "该商品可能已被删除，去看看其他闲置吧。"}
          action={
            <Button variant="outline" onClick={() => void detailQuery.refetch()}>
              重新加载
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <div
              className={cn(
                "group aspect-[4/3] overflow-hidden rounded-[10px] border bg-white",
                data.isGift ? "border-primary/25 bg-primary/[0.06]" : "border-primary/20",
                soldOut && "opacity-80 saturate-50",
              )}
            >
              <ItemImage
                src={data.imageUrl}
                alt={data.title}
                category={data.category}
                iconClassName="h-12 w-12"
              />
            </div>

            <div className="flex flex-col gap-5 rounded-xl border border-primary/15 bg-white p-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{data.category}</Badge>
                <StatusBadge status={data.status} />
                {data.isGift ? (
                  <Badge className="gap-1 bg-primary-soft text-primary">
                    <Gift className="h-3 w-3" />
                    善意赠予
                  </Badge>
                ) : null}
                {data.bargainMode === "SILENT_BID" ? (
                  <Badge className="gap-1">
                    <Gavel className="h-3 w-3" />
                    {BARGAIN_LABEL[data.bargainMode as BargainMode]}
                  </Badge>
                ) : (
                  <Badge variant="muted">{BARGAIN_LABEL[data.bargainMode as BargainMode]}</Badge>
                )}
                {data.isOwner ? <Badge>我发布的</Badge> : null}
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl font-semibold leading-8 text-foreground">{data.title}</h1>
                <p
                  className={cn(
                    "text-3xl font-semibold",
                    data.isGift ? "text-emerald-600" : soldOut ? "text-primary/50" : "text-primary",
                  )}
                >
                  {data.isGift ? "免费赠予" : formatPrice(data.price)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/60 px-4 py-3 text-sm">
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">发布人</p>
                  <p className="font-medium text-foreground">{data.ownerName}</p>
                  <p className="text-[11px] text-muted-foreground">{data.ownerCampus}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">发布时间</p>
                  <p className="font-medium text-foreground">{formatDateTime(data.createdAt)}</p>
                </div>
                {data.isbn ? (
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">ISBN</p>
                    <p className="font-medium text-foreground">{data.isbn}</p>
                  </div>
                ) : null}
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">意向关注</p>
                  <p className="font-medium text-foreground">{data.intentCount} 人</p>
                </div>
              </div>

              {data.dealTags.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {data.dealTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-gradient-to-r from-primary-soft to-accent/60 px-2.5 py-1 text-xs font-medium text-primary"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}

              {data.sceneTags.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {data.sceneTags.map((tag) => (
                    <Badge key={tag} variant="outline" className="border-primary/20 text-primary/80">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : null}

              <div className="space-y-1.5">
                <h2 className="text-sm font-medium text-foreground">物品描述</h2>
                <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                  {data.description || "卖家暂未填写物品描述。"}
                </p>
              </div>

              {actionError ? (
                <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {actionError}
                </p>
              ) : null}

              <div className="mt-auto space-y-3 pt-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    onClick={handleToggleFavorite}
                    disabled={favoritePending || favoriteDisabled}
                    variant={data.isFavorited ? "secondary" : "default"}
                    className="gap-1.5 active:scale-[0.97]"
                  >
                    {favoritePending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Heart
                        className={cn(
                          "h-4 w-4 transition-transform duration-200",
                          data.isFavorited ? "scale-110 fill-rose-500 text-rose-500" : "active:scale-125",
                        )}
                      />
                    )}
                    {data.isFavorited ? "已收藏" : "收藏"}
                  </Button>

                  <Button
                    onClick={handleToggleIntent}
                    disabled={intentPending || intentDisabled}
                    variant={data.isIntentFavorited ? "subtle" : "outline"}
                    className="gap-1.5 active:scale-[0.97]"
                  >
                    {intentPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Lightbulb
                        className={cn("h-4 w-4 transition-transform", data.isIntentFavorited && "fill-primary/30 text-primary")}
                      />
                    )}
                    {data.isIntentFavorited ? "已意向标记" : "意向收藏"}
                  </Button>

                  {data.isGift && !data.isOwner ? (
                    <Button
                      onClick={handleGiftApprove}
                      disabled={giftPending || data.hasApprovedGift}
                      variant="outline"
                      className="gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    >
                      {giftPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Gift className="h-4 w-4" />
                      )}
                      {data.hasApprovedGift ? "已送出善意认可" : "送出善意认可"}
                      <span className="text-xs text-muted-foreground">({data.giftApprovalCount})</span>
                    </Button>
                  ) : null}

                  {!data.isOwner && data.bargainMode === "SILENT_BID" ? (
                    <Button onClick={() => setBidOpen(true)} variant="outline" className="gap-1.5" disabled={soldOut}>
                      <Gavel className="h-4 w-4" />
                      {data.myBid ? `我的出价 ${formatPrice(data.myBid.price)}` : "我要出价"}
                    </Button>
                  ) : null}

                  <Link
                    href={`/messages?peer=${data.userId}&item=${data.id}`}
                    className={buttonClass({ variant: "outline", className: "gap-1.5" })}
                  >
                    <MessageSquare className="h-4 w-4" />
                    发起聊天
                  </Link>

                  <Button variant="ghost" onClick={() => setReportOpen(true)} className="gap-1.5">
                    <Flag className="h-4 w-4" />
                    举报
                  </Button>

                  {data.isOwner ? (
                    <Button variant="destructive" onClick={() => setConfirmOpen(true)} disabled={soldOut}>
                      {soldOut ? "已下架" : "下架商品"}
                    </Button>
                  ) : null}

                  <Link href="/" className={buttonClass({ variant: "outline" })}>
                    返回广场
                  </Link>
                </div>

                {data.myBid ? (
                  <p className="text-xs text-muted-foreground">
                    我的出价状态：{BID_STATUS_LABEL[data.myBid.status as BidStatus]}
                    {data.myBid.status === "PENDING" ? "，等待卖家处理。" : ""}
                  </p>
                ) : null}
                {data.chatLockReason ? (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    {data.chatLockReason}
                  </p>
                ) : null}
                {soldOut ? (
                  <p className="text-xs leading-5 text-muted-foreground">
                    该商品已下架：不能新增收藏、意向标记或出价；历史标记保留，仍可取消；已有聊天会话可以继续查看。
                  </p>
                ) : null}
                {data.isOwner ? (
                  <p className="text-xs leading-5 text-muted-foreground">
                    下架按钮仅发布者可见，后端会再次校验商品归属，拦截越权请求。
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {data.isOwner && data.bargainMode === "SILENT_BID" ? (
            <section className="rounded-xl border border-primary/15 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold text-foreground">收到的静默出价</h2>
                <span className="text-xs text-muted-foreground">接受后即可与对方解锁聊天</span>
              </div>
              {bidsQuery.isLoading ? (
                <div className="h-16 animate-pulse rounded-lg bg-muted" />
              ) : (bidsQuery.data?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">还没有人出价。</p>
              ) : (
                <div className="divide-y divide-border">
                  {bidsQuery.data?.map((bid) => (
                    <div key={bid.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium text-foreground">
                          {bid.userName} · {formatPrice(bid.price)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(bid.createdAt)} · {BID_STATUS_LABEL[bid.status as BidStatus]}
                        </p>
                      </div>
                      {bid.status === "PENDING" ? (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleDecideBid(bid.id, "ACCEPTED")}
                            disabled={decideBid.isPending}
                          >
                            接受出价
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-destructive/30 text-destructive hover:bg-destructive/5"
                            onClick={() => handleDecideBid(bid.id, "REJECTED")}
                            disabled={decideBid.isPending}
                          >
                            拒绝
                          </Button>
                        </div>
                      ) : (
                        <Badge variant={bid.status === "ACCEPTED" ? "sale" : "sold"}>
                          {BID_STATUS_LABEL[bid.status as BidStatus]}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-foreground">你可能还感兴趣</h2>
              <Link href="/" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                <ArrowLeft className="h-4 w-4 rotate-180" />
                去广场逛逛
              </Link>
            </div>
            {relatedQuery.isLoading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-[280px] animate-pulse rounded-xl bg-white" />
                ))}
              </div>
            ) : (relatedQuery.data?.length ?? 0) === 0 ? (
              <p className="rounded-xl border border-dashed border-border bg-white/60 px-4 py-8 text-center text-sm text-muted-foreground">
                同分类暂时没有其他在售商品。
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {relatedQuery.data?.map((item) => (
                  <ItemCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogHeader
          title="确认下架该商品？"
          description="下架后不可恢复为在售，广场与详情页会展示「已下架」标记。"
          onClose={() => setConfirmOpen(false)}
        />
        <div className="space-y-2 px-6 py-5">
          <p className="text-sm text-foreground">{data?.title}</p>
          <p className="text-xs text-muted-foreground">历史收藏、意向标记与出价记录会保留，仍可查看历史聊天。</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setConfirmOpen(false)}>
            取消
          </Button>
          <Button variant="destructive" onClick={handleOffShelf} disabled={offShelf.isPending} className="gap-1.5">
            {offShelf.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            确认下架
          </Button>
        </DialogFooter>
      </Dialog>

      {data ? (
        <>
          <BidDialog open={bidOpen} onOpenChange={setBidOpen} itemId={data.id} itemTitle={data.title} />
          <ReportDialog open={reportOpen} onOpenChange={setReportOpen} targetItemId={data.id} />
        </>
      ) : null}
    </div>
  );
}
