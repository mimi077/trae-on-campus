"use client";

import Link from "next/link";
import { useState } from "react";
import { Heart, HeartOff, Lightbulb, LightbulbOff, Loader2, Store } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { ItemCard } from "@/components/item-card";
import { PageHeader, Pagination } from "@/components/pagination";
import { Button, buttonClass } from "@/components/ui/button";
import { PAGE_SIZE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

type Mode = "FAVORITE" | "INTENT";

export default function FavoritesPage() {
  const utils = api.useUtils();
  const [mode, setMode] = useState<Mode>("FAVORITE");
  const [page, setPage] = useState(1);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const favoriteQuery = api.favorite.list.useQuery(
    { page, pageSize: PAGE_SIZE },
    { enabled: mode === "FAVORITE" },
  );
  const intentQuery = api.intentFavorite.list.useQuery(
    { page, pageSize: PAGE_SIZE },
    { enabled: mode === "INTENT" },
  );
  const listQuery = mode === "FAVORITE" ? favoriteQuery : intentQuery;

  const removeFavorite = api.favorite.remove.useMutation();
  const removeIntent = api.intentFavorite.remove.useMutation();

  const switchMode = (next: Mode) => {
    setMode(next);
    setPage(1);
    setActionError(null);
  };

  const handleRemove = async (itemId: string) => {
    if (pendingId) return;
    setPendingId(itemId);
    setActionError(null);
    try {
      if (mode === "FAVORITE") {
        await removeFavorite.mutateAsync({ itemId });
      } else {
        await removeIntent.mutateAsync({ itemId });
      }
      await Promise.all([
        utils.favorite.list.invalidate(),
        utils.intentFavorite.list.invalidate(),
        utils.item.list.invalidate(),
        utils.item.byId.invalidate({ id: itemId }),
      ]);
      if ((listQuery.data?.items.length ?? 0) === 1 && page > 1) {
        setPage((prev) => Math.max(1, prev - 1));
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "操作失败，请稍后重试");
    } finally {
      setPendingId(null);
    }
  };

  const items = listQuery.data?.items ?? [];
  const isFavorite = mode === "FAVORITE";

  return (
    <div className="space-y-5">
      <PageHeader
        title="收藏与意向"
        description="普通收藏记录你想买的东西；意向标记是匿名关注，卖家只看到人数，看不到你的身份。"
        actions={
          <Link href="/" className={buttonClass({ variant: "outline", className: "gap-1.5" })}>
            <Store className="h-4 w-4" />
            去广场逛逛
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2 rounded-3xl bg-white/45 p-3 backdrop-blur-sm">
        {[
          { key: "FAVORITE" as const, label: "普通收藏", icon: Heart },
          { key: "INTENT" as const, label: "意向标记", icon: Lightbulb },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = mode === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => switchMode(tab.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs transition-colors",
                active
                  ? "mint-gradient font-medium text-white"
                  : "bg-white/60 text-muted-foreground hover:bg-primary-soft hover:text-primary",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
        <span className="ml-auto text-xs text-muted-foreground">
          共 {listQuery.data?.total ?? 0} 件 · 两种标记可同时存在
        </span>
      </div>

      {actionError ? (
        <p className="rounded-2xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

      {listQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-[292px] animate-pulse rounded-2xl bg-white/50" />
          ))}
        </div>
      ) : listQuery.isError ? (
        <EmptyState
          icon={isFavorite ? <Heart className="h-5 w-5" /> : <Lightbulb className="h-5 w-5" />}
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
          icon={isFavorite ? <Heart className="h-5 w-5" /> : <Lightbulb className="h-5 w-5" />}
          title={isFavorite ? "还没有收藏任何闲置" : "还没有意向标记"}
          description={
            isFavorite
              ? "在闲置广场遇到心动的物品，点一下收藏就能在这里找到。"
              : "遇到感兴趣但还在观望的闲置，点一下「意向标记」，卖家会看到匿名关注人数。"
          }
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
                    ) : isFavorite ? (
                      <HeartOff className="h-3.5 w-3.5" />
                    ) : (
                      <LightbulbOff className="h-3.5 w-3.5" />
                    )}
                    {isFavorite ? "取消收藏" : "取消意向标记"}
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
