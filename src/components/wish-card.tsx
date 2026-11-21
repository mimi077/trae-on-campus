"use client";

import Link from "next/link";
import { CalendarClock, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatPrice, cn } from "@/lib/utils";

export type WishCardData = {
  id: string;
  title: string;
  category: string;
  expectPrice: number;
  description?: string | null;
  expireAt: Date | string;
  expired?: boolean;
  status?: string;
  userName: string;
  createdAt: Date | string;
};

export function WishCard({ wish }: { wish: WishCardData }) {
  const expired = Boolean(wish.expired) || wish.status === "EXPIRED";

  return (
    <Link
      href={`/wishes/${wish.id}`}
      className={cn(
        "group flex h-full flex-col gap-3 rounded-xl border border-primary/15 bg-slate-50/80 p-4 transition-shadow hover:shadow-md",
        expired && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 text-base font-medium leading-6 text-foreground transition-colors group-hover:text-primary">
          {wish.title}
        </h3>
        <Badge
          className={cn(
            "shrink-0",
            expired
              ? "border-slate-200 bg-slate-100 text-slate-500"
              : "border-emerald-200 bg-emerald-50 text-emerald-600",
          )}
        >
          {expired ? "已过期归档" : "有效"}
        </Badge>
      </div>

      <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
        {wish.description || "发布者暂未填写需求描述。"}
      </p>

      <div className="mt-auto space-y-2 border-t border-dashed border-primary/15 pt-3">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            心理价 {formatPrice(wish.expectPrice)}
          </span>
          <Badge variant="outline">{wish.category}</Badge>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="h-3.5 w-3.5" />
            {formatDate(wish.expireAt)} 到期
          </span>
          <span>{wish.userName}</span>
        </div>
      </div>
    </Link>
  );
}
