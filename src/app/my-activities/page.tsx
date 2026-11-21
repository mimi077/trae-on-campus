"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarDays, CalendarX2, Loader2, MapPin } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader, Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { Dialog, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import {
  ACTIVITY_SOURCE_LABEL,
  ACTIVITY_STATUS_LABEL,
  REGISTRATION_CANCEL_HOURS,
  REGISTRATION_STATUS_LABEL,
  type ActivitySource,
  type ActivityStatus,
  type RegistrationStatus,
} from "@/lib/constants";
import { cn, formatDateTime } from "@/lib/utils";
import { api } from "@/trpc/react";

type Tab = "ALL" | "PENDING" | "APPROVED" | "CANCELLED" | "ENDED";

const TABS: { value: Tab; label: string }[] = [
  { value: "ALL", label: "全部" },
  { value: "PENDING", label: "待审核" },
  { value: "APPROVED", label: "已报名" },
  { value: "CANCELLED", label: "已取消" },
  { value: "ENDED", label: "已结束" },
];

const REG_STYLE: Record<RegistrationStatus, string> = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-700",
  APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REJECTED: "border-rose-200 bg-rose-50 text-rose-600",
  CANCELLED: "border-slate-200 bg-slate-100 text-slate-500",
};

const ACT_STYLE: Record<ActivityStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  PUBLISHED: "bg-emerald-50 text-emerald-700",
  ONGOING: "bg-sky-50 text-sky-700",
  ENDED: "bg-slate-100 text-slate-500",
  CANCELLED: "bg-rose-50 text-rose-600",
  REJECTED: "bg-rose-50 text-rose-600",
};

export default function MyActivitiesPage() {
  const utils = api.useUtils();
  const [tab, setTab] = useState<Tab>("ALL");
  const [page, setPage] = useState(1);
  const [cancelTarget, setCancelTarget] = useState<{ activityId: string; title: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const listQuery = api.registration.mine.useQuery({ tab, page });
  const cancelSignup = api.registration.cancel.useMutation();

  const items = listQuery.data?.items ?? [];
  const counts = listQuery.data?.counts;

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setError(null);
    try {
      await cancelSignup.mutateAsync({ activityId: cancelTarget.activityId });
      await Promise.all([
        utils.registration.mine.invalidate(),
        utils.activity.byId.invalidate({ id: cancelTarget.activityId }),
        utils.activity.list.invalidate(),
      ]);
      setCancelTarget(null);
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "取消失败，请稍后重试");
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="我的活动"
        description="查看报名状态与活动安排；无法到场时请提前取消，把名额留给其他同学。"
      />

      <div className="flex flex-wrap items-center gap-1 rounded-full bg-white/45 p-1">
        {TABS.map((item) => {
          const count = counts?.[item.value];
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => {
                setTab(item.value);
                setPage(1);
              }}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs transition-all",
                tab === item.value
                  ? "mint-gradient font-medium text-white"
                  : "text-muted-foreground hover:text-primary",
              )}
            >
              {item.label}
              {count ? ` ${count}` : ""}
            </button>
          );
        })}
        <span className="ml-auto px-2 text-xs text-muted-foreground">共 {listQuery.data?.total ?? 0} 条</span>
      </div>

      {error ? (
        <p className="rounded-2xl bg-[#FFE9E4] px-4 py-2.5 text-sm text-[#C4473A]">{error}</p>
      ) : null}

      {listQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-3xl bg-white/50" />
          ))}
        </div>
      ) : listQuery.isError ? (
        <EmptyState
          icon={<CalendarX2 className="h-5 w-5" />}
          title="加载失败"
          description={listQuery.error.message}
          action={
            <Button variant="outline" onClick={() => void listQuery.refetch()}>
              重新加载
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-5 w-5" />}
          title={tab === "ALL" ? "你还没有报名活动" : "当前状态下没有记录"}
          description={tab === "ALL" ? "去活动广场看看近期有哪些讲座、竞赛与志愿活动。" : "切换其他状态看看。"}
          action={
            <Link href="/activities" className={buttonClass({ size: "sm" })}>
              去活动广场
            </Link>
          }
        />
      ) : (
        <>
          <div className="space-y-3">
            {items.map((record) => {
              const activity = record.activity;
              const activityStatus = activity.status as ActivityStatus;
              const registrationStatus = record.status as RegistrationStatus;
              const hoursLeft = (new Date(activity.startAt).getTime() - Date.now()) / 3_600_000;
              const canCancel =
                (registrationStatus === "APPROVED" || registrationStatus === "PENDING") &&
                activityStatus === "PUBLISHED" &&
                hoursLeft >= REGISTRATION_CANCEL_HOURS;

              return (
                <div key={record.id} className="rounded-3xl bg-white/60 p-5 backdrop-blur-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-primary-soft/80 px-2.5 py-1 text-[11px] text-primary">
                      {ACTIVITY_SOURCE_LABEL[activity.source as ActivitySource] ?? activity.source}
                    </span>
                    <span className={cn("rounded-full px-2.5 py-1 text-[11px]", ACT_STYLE[activityStatus])}>
                      {ACTIVITY_STATUS_LABEL[activityStatus] ?? activity.status}
                    </span>
                    <Badge className={REG_STYLE[registrationStatus]}>
                      {REGISTRATION_STATUS_LABEL[registrationStatus] ?? record.status}
                    </Badge>
                    <span className="ml-auto text-xs text-muted-foreground">
                      报名于 {formatDateTime(record.createdAt)}
                    </span>
                  </div>

                  <Link
                    href={`/activities/${activity.id}`}
                    className="mt-3 block text-base font-medium text-foreground transition-colors hover:text-primary"
                  >
                    {activity.title}
                  </Link>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatDateTime(activity.startAt)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {activity.location}
                    </span>
                    <span>主办：{activity.organizer}</span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Link
                      href={`/activities/${activity.id}`}
                      className={buttonClass({ variant: "outline", size: "sm" })}
                    >
                      查看活动
                    </Link>
                    {canCancel ? (
                      <Button
                        size="sm"
                        variant="subtle"
                        onClick={() => setCancelTarget({ activityId: activity.id, title: activity.title })}
                      >
                        取消报名
                      </Button>
                    ) : null}
                    {registrationStatus === "PENDING" ? (
                      <span className="text-xs text-muted-foreground">等待主办方审核</span>
                    ) : null}
                    {activityStatus === "CANCELLED" ? (
                      <span className="text-xs text-rose-600">活动已取消，报名自动失效</span>
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

      <Dialog open={Boolean(cancelTarget)} onOpenChange={(next) => (!next ? setCancelTarget(null) : null)}>
        <DialogHeader
          title="确认取消报名？"
          description={`活动开始前 ${REGISTRATION_CANCEL_HOURS} 小时内不可取消，取消后名额会释放。`}
          onClose={() => setCancelTarget(null)}
        />
        <div className="px-6 py-4">
          <p className="text-sm text-foreground">{cancelTarget?.title}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setCancelTarget(null)}>
            再想想
          </Button>
          <Button onClick={handleCancel} disabled={cancelSignup.isPending} className="gap-1.5">
            {cancelSignup.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            确认取消
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
