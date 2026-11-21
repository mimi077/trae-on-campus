"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { CalendarDays, ShieldAlert, Users } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { EmptyState } from "@/components/empty-state";
import { Button, buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ACTIVITY_STATUS_LABEL,
  REGISTRATION_STATUS_LABEL,
  type ActivityStatus,
  type RegistrationStatus,
} from "@/lib/constants";
import { cn, formatDateTime } from "@/lib/utils";
import { api } from "@/trpc/react";

const REG_STYLE: Record<RegistrationStatus, string> = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-700",
  APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REJECTED: "border-rose-200 bg-rose-50 text-rose-600",
  CANCELLED: "border-slate-200 bg-slate-100 text-slate-500",
};

export default function ActivityRosterPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : "";

  const meQuery = api.auth.me.useQuery();
  const rosterQuery = api.registration.roster.useQuery({ activityId: id }, { enabled: Boolean(id) });

  if (meQuery.isLoading) {
    return <div className="h-64 animate-pulse rounded-3xl bg-white/50" />;
  }

  if (!meQuery.data?.isStaff) {
    return (
      <EmptyState
        icon={<ShieldAlert className="h-5 w-5" />}
        title="无权查看报名名单"
        description="报名名单仅对教师或管理员开放。"
        action={
          <Link href="/" className="text-sm text-primary hover:underline">
            返回闲置广场
          </Link>
        }
      />
    );
  }

  if (rosterQuery.isLoading) {
    return (
      <div className="space-y-4">
        <BackLink href="/admin/reviews" label="返回审核中心" />
        <div className="h-72 animate-pulse rounded-3xl bg-white/50" />
      </div>
    );
  }

  if (rosterQuery.isError || !rosterQuery.data) {
    return (
      <div className="space-y-4">
        <BackLink href="/admin/reviews" label="返回审核中心" />
        <EmptyState
          icon={<CalendarDays className="h-5 w-5" />}
          title="无法加载报名名单"
          description={rosterQuery.error?.message ?? "活动可能已被删除。"}
          action={
            <Button variant="outline" onClick={() => void rosterQuery.refetch()}>
              重新加载
            </Button>
          }
        />
      </div>
    );
  }

  const data = rosterQuery.data;
  const status = data.activity.status as ActivityStatus;
  const maxCollege = Math.max(1, ...data.colleges.map((item) => item.count));

  return (
    <div className="space-y-5">
      <BackLink href="/admin/reviews" label="返回审核中心" />

      <div className="rounded-3xl bg-white/60 p-5 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-foreground">报名名单</h1>
          <Badge variant="outline">{ACTIVITY_STATUS_LABEL[status] ?? data.activity.status}</Badge>
        </div>
        <p className="mt-2 text-sm font-medium text-foreground">{data.activity.title}</p>
        <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
          <p>活动时间：{formatDateTime(data.activity.startAt)}</p>
          <p>
            名额：{data.total} / {data.activity.isUnlimited ? "不限" : data.activity.capacity}
            {data.activity.isUnlimited ? "" : `（剩余 ${data.remaining ?? 0}）`}
          </p>
          <p className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            有效报名 {data.total} 人
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="overflow-hidden rounded-3xl bg-white/60 backdrop-blur-sm">
          <div className="grid grid-cols-[1.4fr_1.4fr_0.8fr_1fr] gap-2 border-b border-primary/10 px-4 py-3 text-xs font-medium text-muted-foreground">
            <span>姓名（脱敏）</span>
            <span>学院</span>
            <span>状态</span>
            <span>报名时间</span>
          </div>
          {data.items.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">还没有同学报名。</p>
          ) : (
            <div className="divide-y divide-primary/5">
              {data.items.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[1.4fr_1.4fr_0.8fr_1fr] items-center gap-2 px-4 py-3 text-sm"
                >
                  <span className="font-medium text-foreground">{item.name}</span>
                  <span className="truncate text-muted-foreground">{item.college}</span>
                  <span>
                    <Badge className={REG_STYLE[item.status as RegistrationStatus]}>
                      {REGISTRATION_STATUS_LABEL[item.status as RegistrationStatus] ?? item.status}
                    </Badge>
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-3xl bg-white/60 p-5 backdrop-blur-sm">
            <h2 className="text-sm font-semibold text-foreground">学院分布</h2>
            {data.colleges.length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">暂无报名数据。</p>
            ) : (
              <div className="mt-3 space-y-2.5">
                {data.colleges.map((college) => (
                  <div key={college.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate text-muted-foreground">{college.name}</span>
                      <span className="font-medium text-foreground">{college.count}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-primary-soft/70">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#2FBFA0] to-[#7FDFC8]"
                        style={{ width: `${Math.round((college.count / maxCollege) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Link href={`/activities/${data.activity.id}`} className={buttonClass({ variant: "outline", className: "w-full" })}>
            查看活动详情
          </Link>
        </aside>
      </div>
    </div>
  );
}
