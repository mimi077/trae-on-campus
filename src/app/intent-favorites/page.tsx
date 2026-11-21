"use client";

import Link from "next/link";
import { useState } from "react";
import { Lightbulb, LightbulbOff, Loader2, Store } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { ItemCard } from "@/components/item-card";
import { PageHeader, Pagination } from "@/components/pagination";
import { Button, buttonClass } from "@/components/ui/button";
import { PAGE_SIZE } from "@/lib/constants";
import { api } from "@/trpc/react";

export default function IntentFavoritesPage() {
  const utils = api.useUtils();
  const [page, setPage] = useState(1);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const listQuery = api.intentFavorite.list.useQuery({ page, pageSize: PAGE_SIZE });
  const removeIntent = api.intentFavorite.remove.useMutation();

  const handleRemove = async (itemId: string) => {
    if (pendingId) return;
    setPendingId(itemId);
    setActionError(null);
    try {
      await removeIntent.mutateAsync({ itemId });
      await Promise.all([
        utils.intentFavorite.list.invalidate(),
        utils.item.list.invalidate(),
        utils.item.byId.invalidate({ id: itemId }),
      ]);
      if ((listQuery.data?.items.length ?? 0) === 1 && page > 1) {
        setPage((prev) => Math.max(1, prev - 1));
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "取消意向标记失败，请稍后重试");
    } finally {
      setPendingId(null);
    }
  };

  const items = listQuery.data?.items ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="我的意向标记"
        description="意向收藏是完全独立的匿名关注，卖家只能看到统计人数，看不到你的身份。"
        actions={
          <Link href="/" className={buttonClass({ variant: "outline", className: "gap-1.5" })}>
            <Store className="h-4 w-4" />
            去广场逛逛
          </Link>
        }
      />

      {actionError ? (
        <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

      {listQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-[320px] animate-pulse rounded-xl border border-border bg-white" />
          ))}
        </div>
      ) : listQuery.isError ? (
        <EmptyState
          icon={<Lightbulb className="h-5 w-5" />}
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
          icon={<Lightbulb className="h-5 w-5" />}
          title="还没有意向标记"
          description="遇到感兴趣但还在观望的闲置，点一下「意向收藏」，卖家会看到匿名关注人数。"
          action={
            <Link href="/" className={buttonClass({ className: "gap-1.5" })}>
              <Store className="h-4 w-4" />
              去闲置广场
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                footer={
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5"
                    disabled={pendingId === item.id}
                    onClick={() => handleRemove(item.id)}
                  >
                    {pendingId === item.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <LightbulbOff className="h-3.5 w-3.5" />
                    )}
                    取消意向标记
                  </Button>
                }
              />
            ))}
          </div>
          <Pagination
            page={listQuery.data?.page ?? 1}
            totalPages={listQuery.data?.totalPages ?? 1}
            total={listQuery.data?.total}
            onChange={setPage}
          />
        </>
      )}
    </div>
  );
}
