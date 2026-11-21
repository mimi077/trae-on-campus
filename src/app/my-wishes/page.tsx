"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2, Plus, Sparkles, XCircle } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader, Pagination } from "@/components/pagination";
import { WishFormDialog } from "@/components/wish-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { GENERAL_PAGE_SIZE } from "@/lib/constants";
import { formatDateTime, formatPrice } from "@/lib/utils";
import { api } from "@/trpc/react";

export default function MyWishesPage() {
  const utils = api.useUtils();
  const [page, setPage] = useState(1);
  const [openCreate, setOpenCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listQuery = api.wish.myWishes.useQuery({ page, pageSize: GENERAL_PAGE_SIZE });
  const closeWish = api.wish.close.useMutation();

  const handleClose = async (id: string) => {
    setError(null);
    try {
      await closeWish.mutateAsync({ id });
      await Promise.all([
        utils.wish.myWishes.invalidate(),
        utils.wish.list.invalidate(),
        utils.wish.byId.invalidate({ id }),
      ]);
    } catch (closeError) {
      setError(closeError instanceof Error ? closeError.message : "关闭心愿失败，请稍后重试");
    }
  };

  const items = listQuery.data?.items ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="我的求购心愿"
        description="管理自己发布的心愿，关闭后不再接受新的对话，历史会话保留。"
        actions={
          <Button onClick={() => setOpenCreate(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            发布求购心愿
          </Button>
        }
      />

      {error ? (
        <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {listQuery.isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-xl border border-border bg-white" />
          ))}
        </div>
      ) : listQuery.isError ? (
        <EmptyState
          icon={<Sparkles className="h-5 w-5" />}
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
          icon={<Sparkles className="h-5 w-5" />}
          title="你还没有发布求购心愿"
          description="说出你的需求，让闲置主动找上门。"
          action={
            <Button onClick={() => setOpenCreate(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              发布求购心愿
            </Button>
          }
        />
      ) : (
        <>
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-primary/15 bg-white">
            {items.map((wish) => (
              <div key={wish.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/wishes/${wish.id}`} className="font-medium text-foreground hover:text-primary">
                      {wish.title}
                    </Link>
                    <Badge
                      className={
                        wish.expired
                          ? "border-slate-200 bg-slate-100 text-slate-500"
                          : "border-emerald-200 bg-emerald-50 text-emerald-600"
                      }
                    >
                      {wish.expired ? "已过期归档" : wish.isActive ? "有效" : "已关闭"}
                    </Badge>
                    <Badge variant="outline">{wish.category}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    心理价 {formatPrice(wish.expectPrice)} · 发布于 {formatDateTime(wish.createdAt)} · 到期{" "}
                    {formatDateTime(wish.expireAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/wishes/${wish.id}`} className={buttonClass({ variant: "outline", size: "sm" })}>
                    查看
                  </Link>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1 text-destructive hover:bg-destructive/5 hover:text-destructive"
                    disabled={wish.expired || closeWish.isPending}
                    onClick={() => handleClose(wish.id)}
                  >
                    {closeWish.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5" />
                    )}
                    {wish.isActive ? "关闭心愿" : "已关闭"}
                  </Button>
                </div>
              </div>
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

      <WishFormDialog open={openCreate} onOpenChange={setOpenCreate} />
    </div>
  );
}
