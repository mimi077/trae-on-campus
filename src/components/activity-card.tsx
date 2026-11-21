"use client";

import Link from "next/link";
import { CalendarDays, Clock3, MapPin, ShieldCheck, Users } from "lucide-react";
import { ItemImage } from "@/components/item-image";
import { Badge } from "@/components/ui/badge";
import {
  ACTIVITY_SOURCE_LABEL,
  ACTIVITY_STATUS_LABEL,
  ACTIVITY_TAG_LABEL,
  type ActivitySource,
  type ActivityStatus,
  type ActivityTag,
} from "@/lib/constants";
import { cn, formatDateTime } from "@/lib/utils";

export type ActivityCardData = {
  id: string;
  title: string;
  type: string;
  source: string;
  organizer: string;
  startAt: Date | string;
  endAt: Date | string;
  registrationDeadline: Date | string;
  location: string;
  capacity: number;
  isUnlimited?: boolean;
  occupied: number;
  remaining: number | null;
  capacityView?: {
    remaining: number | null;
    isFull: boolean;
    percent: number;
    ratioText: string;
    capacityText: string;
  };
  summary?: string | null;
  coverUrl?: string | null;
  tags: string[];
  creditPoints?: number | null;
  status: string;
  registrationMode?: string;
};

const SOURCE_STYLE: Record<ActivitySource, string> = {
  OFFICIAL: "mint-gradient text-white",
  SCHOOL: "bg-[#E3F0FF] text-[#2563EB]",
  COLLEGE: "bg-[#F0E7FF] text-[#7C3AED]",
  CLUB: "bg-gradient-to-r from-[#FFC9A6] to-[#FFA477] text-peach-foreground",
};

const STATUS_STYLE: Record<ActivityStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  PUBLISHED: "bg-emerald-50 text-emerald-700",
  ONGOING: "bg-sky-50 text-sky-700",
  ENDED: "bg-slate-100 text-slate-500",
  CANCELLED: "bg-rose-50 text-rose-600",
  REJECTED: "bg-rose-50 text-rose-600",
};

export function ActivityCard({ activity }: { activity: ActivityCardData }) {
  const source = activity.source as ActivitySource;
  const status = activity.status as ActivityStatus;
  const unlimited = Boolean(activity.isUnlimited);
  const percent = activity.capacityView?.percent ?? (activity.capacity > 0 ? Math.min(100, Math.round((activity.occupied / activity.capacity) * 100)) : 0);
  const isFull = unlimited ? false : (activity.capacityView?.isFull ?? (activity.remaining ?? 0) <= 0);
  const ratioText = activity.capacityView?.ratioText ?? `${activity.occupied} / ${unlimited ? "不限" : activity.capacity}`;
  const deadlinePassed = new Date(activity.registrationDeadline).getTime() < Date.now();
  const isExternal = activity.registrationMode === "EXTERNAL";

  return (
    <Link
      href={`/activities/${activity.id}`}
      className="group flex flex-col overflow-hidden rounded-3xl bg-white/60 shadow-[0_18px_40px_-34px_rgba(14,143,116,0.45)] backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-white/85 hover:shadow-[0_24px_50px_-30px_rgba(14,143,116,0.5)] sm:flex-row"
    >
      <div className="relative h-40 w-full shrink-0 overflow-hidden sm:h-auto sm:w-64">
        <ItemImage src={activity.coverUrl} alt={activity.title} category="其他" iconClassName="h-10 w-10" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium shadow-sm",
              SOURCE_STYLE[source] ?? "bg-white/85 text-foreground",
            )}
          >
            {source === "OFFICIAL" ? <ShieldCheck className="h-3 w-3" /> : null}
            {ACTIVITY_SOURCE_LABEL[source] ?? activity.source}
          </span>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          {activity.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-primary-soft/80 px-2 py-0.5 text-[11px] text-primary"
            >
              {ACTIVITY_TAG_LABEL[tag as ActivityTag] ?? tag}
            </span>
          ))}
          {activity.creditPoints ? (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
              {activity.creditPoints} 学分
            </span>
          ) : null}
          {status !== "PUBLISHED" ? (
            <span className={cn("rounded-full px-2 py-0.5 text-[11px]", STATUS_STYLE[status])}>
              {ACTIVITY_STATUS_LABEL[status] ?? activity.status}
            </span>
          ) : null}
          {isFull ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">已满</span>
          ) : null}
          {isExternal ? (
            <span className="rounded-full bg-[#F0E7FF] px-2 py-0.5 text-[11px] text-[#7C3AED]">外链报名</span>
          ) : null}
        </div>

        <h3 className="line-clamp-2 text-base font-medium leading-6 text-foreground transition-colors group-hover:text-primary sm:text-lg">
          {activity.title}
        </h3>

        {activity.summary ? (
          <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{activity.summary}</p>
        ) : null}

        <div className="mt-auto space-y-2 pt-1">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5 text-primary/70" />
              {formatDateTime(activity.startAt)}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-primary/70" />
              <span className="max-w-[220px] truncate">{activity.location}</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-primary-soft/70">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  isFull ? "bg-slate-400" : "bg-gradient-to-r from-[#2FBFA0] to-[#7FDFC8]",
                )}
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              {ratioText}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-dashed border-primary/15 pt-2 text-[11px] text-muted-foreground">
            <span>主办：{activity.organizer}</span>
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3 w-3" />
              {deadlinePassed ? "报名已截止" : `报名截止 ${formatDateTime(activity.registrationDeadline)}`}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
