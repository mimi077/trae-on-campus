"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Gift, Gavel } from "lucide-react";
import { ItemImage } from "@/components/item-image";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";

export type ItemCardData = {
  id: string;
  title: string;
  category: string;
  price: number;
  imageUrl: string | null;
  status: string;
  userId: string;
  createdAt: Date | string;
  description?: string | null;
  isGift?: boolean;
  bargainMode?: string;
  sceneTags?: string[];
  dealTags?: string[];
  userName?: string;
  intentCount?: number;
};

const DEAL_TAG_STYLE: Record<string, string> = {
  急出: "bg-[#FFE2D3] text-[#C0562B]",
  可小刀: "bg-primary-soft text-primary",
  只自提: "bg-[#E7EFFF] text-[#4C6FA3]",
  可换物: "bg-accent/70 text-peach-foreground",
};

export function ItemCard({ item, footer }: { item: ItemCardData; footer?: ReactNode }) {
  const soldOut = item.status === "SOLD_OUT";
  const expired = item.status === "EXPIRED";
  const inactive = soldOut || expired;
  const isGift = Boolean(item.isGift);
  const silentBid = item.bargainMode === "SILENT_BID";
  const breathing = !inactive && !isGift;

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col rounded-2xl border bg-white/60 backdrop-blur-sm transition-all hover:shadow-[0_22px_48px_-32px_rgba(14,143,116,0.55)]",
        breathing ? "border-primary/20 animate-breathe" : "border-primary/20",
        isGift && "border-primary/25 bg-primary/[0.06]",
        inactive && "opacity-70 saturate-50",
      )}
    >
      <div className="relative overflow-hidden rounded-t-2xl">
        <Link
          href={`/items/${item.id}`}
          className="relative block aspect-[4/3] overflow-hidden bg-muted"
          aria-label={item.title}
        >
          <ItemImage src={item.imageUrl} alt={item.title} category={item.category} />
          {inactive ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/55 backdrop-blur-[1px]">
              <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-medium text-slate-500">
                {expired ? "已到期自动下架" : "已下架"}
              </span>
            </div>
          ) : null}
        </Link>
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          {isGift ? (
            <Badge className="gap-1 bg-primary-soft text-primary">
              <Gift className="h-3 w-3" />
              善意赠予
            </Badge>
          ) : null}
          {silentBid ? (
            <Badge className="gap-1 border-primary/20 bg-white/90 text-primary">
              <Gavel className="h-3 w-3" />
              静默出价
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="group/title relative flex items-start justify-between gap-2">
          <Link href={`/items/${item.id}`} className="min-w-0">
            <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-foreground transition-colors group-hover:text-primary">
              {item.title}
            </h3>
          </Link>
          <StatusBadge status={item.status} className="shrink-0" />

          {/* hover 标题弹出悬浮快速预览卡片（淡入淡出，不阻断点击） */}
          <div className="pointer-events-none absolute left-0 right-0 top-full z-30 mt-2 hidden rounded-2xl bg-gradient-to-b from-white/85 via-card/95 to-primary-soft/40 p-3 opacity-0 shadow-[0_22px_50px_-28px_rgba(14,143,116,0.45)] backdrop-blur-xl transition-opacity duration-200 group-hover/title:opacity-100 md:block">
            <div className="flex gap-3">
              <div className="h-16 w-20 shrink-0 overflow-hidden rounded-lg border border-primary/15">
                <ItemImage src={item.imageUrl} alt={item.title} category={item.category} />
              </div>
              <div className="min-w-0 space-y-1">
                <p className="line-clamp-2 text-sm font-medium text-foreground">{item.title}</p>
                <p className="text-sm font-semibold text-primary">{formatPrice(item.price)}</p>
                <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {item.description || "暂无描述"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {item.dealTags?.length ? (
          <div className="flex flex-wrap gap-1">
            {item.dealTags.map((tag) => (
              <span
                key={tag}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-medium",
                  DEAL_TAG_STYLE[tag] ?? "bg-muted text-muted-foreground",
                )}
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        {item.sceneTags?.length ? (
          <div className="flex flex-wrap gap-1">
            {item.sceneTags.map((tag) => (
              <Badge key={tag} variant="outline" className="border-primary/20 text-primary/80">
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="mt-auto space-y-2.5">
          <div className="flex items-center justify-between">
            <span
              className={cn(
                "text-lg font-semibold",
                isGift ? "text-primary-dark" : inactive ? "text-primary/50" : "text-primary",
              )}
            >
              {isGift ? "免费赠予" : formatPrice(item.price)}
            </span>
            <Badge variant="outline">{item.category}</Badge>
          </div>
          <div className="flex items-center justify-between border-t border-dashed border-primary/15 pt-2 text-xs text-muted-foreground">
            <span className="truncate">{item.userName ?? "校园同学"}</span>
            <span className="shrink-0 pl-2">{formatDate(item.createdAt)}</span>
          </div>
          {typeof item.intentCount === "number" && item.intentCount > 0 ? (
            <p className="text-xs text-muted-foreground">💡 {item.intentCount} 人意向关注</p>
          ) : null}
          {footer ? <div className="pt-1">{footer}</div> : null}
        </div>
      </div>
    </article>
  );
}
