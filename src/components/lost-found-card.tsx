"use client";

import Link from "next/link";
import { MapPin, MessageSquare } from "lucide-react";
import { ItemImage } from "@/components/item-image";
import { Badge } from "@/components/ui/badge";
import {
  LOST_FOUND_ICON_CATEGORY,
  LOST_FOUND_KIND_LABEL,
  type LostFoundKind,
} from "@/lib/constants";
import { cn, formatDateTime } from "@/lib/utils";

export type LostFoundCardData = {
  id: string;
  kind: string;
  title: string;
  category: string;
  location: string;
  happenedAt: Date | string;
  description?: string | null;
  imageUrl?: string | null;
  userName: string;
  messageCount: number;
};

export function LostFoundCard({ record }: { record: LostFoundCardData }) {
  const kind = record.kind as LostFoundKind;
  const isFound = kind === "FOUND";

  return (
    <Link
      href={`/lost-found/${record.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-3xl bg-white/60 shadow-[0_18px_40px_-34px_rgba(14,143,116,0.5)] backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-white/85 hover:shadow-[0_24px_50px_-30px_rgba(14,143,116,0.55)]"
    >
      <div className="relative aspect-[16/9] overflow-hidden">
        <ItemImage
          src={record.imageUrl}
          alt={record.title}
          category={LOST_FOUND_ICON_CATEGORY[record.category] ?? "其他"}
          iconClassName="h-10 w-10"
        />
        <span
          className={cn(
            "absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-medium shadow-sm",
            isFound ? "mint-gradient text-white" : "bg-gradient-to-r from-[#FFC9A6] to-[#FFA477] text-peach-foreground",
          )}
        >
          {LOST_FOUND_KIND_LABEL[kind] ?? record.kind}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-base font-medium leading-6 text-foreground transition-colors group-hover:text-primary">
            {record.title}
          </h3>
          <Badge variant="outline" className="shrink-0">
            {record.category}
          </Badge>
        </div>

        <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
          {record.description || "发布者暂未填写物品描述。"}
        </p>

        <div className="mt-auto space-y-2 pt-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-primary/70" />
            <span className="truncate">{record.location}</span>
          </div>
          <div className="flex items-center justify-between border-t border-dashed border-primary/15 pt-2 text-xs text-muted-foreground">
            <span>{formatDateTime(record.happenedAt)}</span>
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" />
              {record.messageCount} 条留言
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground/80">发布人：{record.userName}</p>
        </div>
      </div>
    </Link>
  );
}
