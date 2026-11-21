"use client";

import Link from "next/link";
import { useState } from "react";
import { Gift, HeartHandshake, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { formatDateTime, formatPrice, cn } from "@/lib/utils";
import { api } from "@/trpc/react";

type Tab = "GIVEN" | "APPROVALS";

export default function GiftRecordsPage() {
  const [tab, setTab] = useState<Tab>("GIVEN");
  const givenQuery = api.gift.myGiven.useQuery();
  const approvalsQuery = api.gift.myApprovals.useQuery();

  return (
    <div className="space-y-5">
      <PageHeader
        title="我的善意记录"
        description="善意赠予是免费的分享；每件赠予物，每位同学只能送出一次认可。"
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("GIVEN")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors",
            tab === "GIVEN"
              ? "border-primary/30 bg-primary-soft font-medium text-primary"
              : "border-border bg-white text-muted-foreground hover:bg-muted",
          )}
        >
          <Gift className="h-4 w-4" />
          我赠予的物品
        </button>
        <button
          type="button"
          onClick={() => setTab("APPROVALS")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors",
            tab === "APPROVALS"
              ? "border-primary/30 bg-primary-soft font-medium text-primary"
              : "border-border bg-white text-muted-foreground hover:bg-muted",
          )}
        >
          <HeartHandshake className="h-4 w-4" />
          我的善意认可记录
        </button>
      </div>

      {tab === "GIVEN" ? (
        givenQuery.isLoading ? (
          <div className="grid gap-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-xl border border-border bg-white" />
            ))}
          </div>
        ) : givenQuery.isError ? (
          <p className="text-sm text-destructive">{givenQuery.error.message}</p>
        ) : (givenQuery.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={<Gift className="h-5 w-5" />}
            title="你还没有赠予过闲置"
            description="发布闲置时开启「善意赠予」，售价会自动锁定为 0 元。"
            action={
              <Link href="/my-items?publish=1" className={buttonClass({ className: "gap-1.5" })}>
                <Sparkles className="h-4 w-4" />
                去发布善意赠予
              </Link>
            }
          />
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-primary/15 bg-white">
            {givenQuery.data?.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/items/${item.id}`} className="font-medium text-foreground hover:text-primary">
                      {item.title}
                    </Link>
                    <Badge className="border-emerald-200 bg-emerald-50 text-emerald-600">
                      {item.status === "SOLD_OUT" ? "已下架" : "赠予中"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {item.category} · 发布于 {formatDateTime(item.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    <HeartHandshake className="h-3.5 w-3.5" />
                    收到 {item.approvalCount} 次善意认可
                  </span>
                  <Link href={`/items/${item.id}`} className={buttonClass({ variant: "outline", size: "sm" })}>
                    查看
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )
      ) : approvalsQuery.isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-xl border border-border bg-white" />
          ))}
        </div>
      ) : approvalsQuery.isError ? (
        <p className="text-sm text-destructive">{approvalsQuery.error.message}</p>
      ) : (approvalsQuery.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<HeartHandshake className="h-5 w-5" />}
          title="还没有送出过善意认可"
          description="在善意赠予专区遇到有心人，可以点一下「送出善意认可」。"
          action={
            <Link href="/?gift=1" className={buttonClass({ className: "gap-1.5" })}>
              <Gift className="h-4 w-4" />
              去善意赠予专区
            </Link>
          }
        />
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-primary/15 bg-white">
          {approvalsQuery.data?.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="space-y-1">
                <Link href={`/items/${row.item.id}`} className="font-medium text-foreground hover:text-primary">
                  {row.item.title}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {row.item.category} · 心理价 {formatPrice(row.item.price)} · {formatDateTime(row.approvedAt)}
                </p>
              </div>
              <Badge className="border-emerald-200 bg-emerald-50 text-emerald-600">已送出善意认可</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
