"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Loader2,
  PackageOpen,
  Pencil,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { ItemFormDialog, type EditableItem } from "@/components/item-form-dialog";
import { PageHeader, Pagination } from "@/components/pagination";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { usePublishDialog } from "@/components/publish-dialog-provider";
import { GENERAL_PAGE_SIZE } from "@/lib/constants";
import { useDebouncedValue } from "@/lib/hooks";
import { formatDateTime, formatPrice } from "@/lib/utils";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";

type ConfirmAction = "offShelf" | "remove";

function MyItemsContent() {
  const { openPublish } = usePublishDialog();
  const searchParams = useSearchParams();
  const utils = api.useUtils();

  const [keywordInput, setKeywordInput] = useState("");
  const keyword = useDebouncedValue(keywordInput, 300).trim();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<"ALL" | "EXPIRED">("ALL");

  const [editing, setEditing] = useState<EditableItem | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<EditableItem | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>("offShelf");
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("publish") === "1") openPublish();
    if (searchParams.get("expired") === "1") setFilter("EXPIRED");
  }, [searchParams, openPublish]);

  useEffect(() => {
    setPage(1);
  }, [keyword, filter]);

  const listQuery = api.item.myItems.useQuery({
    keyword: keyword || undefined,
    status: filter,
    page,
    pageSize: GENERAL_PAGE_SIZE,
  });
  const expiredQuery = api.item.expiredCount.useQuery(undefined, { staleTime: 30_000 });

  const offShelf = api.item.offShelf.useMutation();
  const relist = api.item.relist.useMutation();
  const removeItem = api.item.remove.useMutation();
  const pending = offShelf.isPending || relist.isPending || removeItem.isPending;

  const invalidateAll = async () => {
    await Promise.all([
      utils.item.myItems.invalidate(),
      utils.item.list.invalidate(),
      utils.item.byId.invalidate(),
      utils.item.expiredCount.invalidate(),
      utils.stats.overview.invalidate(),
      utils.favorite.list.invalidate(),
    ]);
  };

  const openConfirm = (item: EditableItem, action: ConfirmAction) => {
    setActionError(null);
    setConfirmTarget(item);
    setConfirmAction(action);
  };

  const handleConfirm = async () => {
    if (!confirmTarget) return;
    setActionError(null);
    try {
      if (confirmAction === "remove") {
        await removeItem.mutateAsync({ id: confirmTarget.id });
      } else {
        await offShelf.mutateAsync({ id: confirmTarget.id });
      }
      await invalidateAll();
      setConfirmTarget(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "操作失败，请稍后重试");
    }
  };

  const handleRelist = async (item: EditableItem) => {
    setActionError(null);
    try {
      await relist.mutateAsync({ id: item.id });
      await invalidateAll();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "重新上架失败，请稍后重试");
    }
  };

  const items = listQuery.data?.items ?? [];
  const expiredCount = expiredQuery.data?.count ?? 0;
  const columnCount = 8;

  return (
    <div className="space-y-5">
      <PageHeader
        title="我的发布"
        description="闲置上架 14 天内有效，到期会自动下架并在这里提醒你重新上架或删除。"
        actions={
          <Button onClick={openPublish} className="gap-1.5 active:scale-[0.97]">
            <PackageOpen className="h-4 w-4" />
            发布闲置
          </Button>
        }
      />

      {expiredCount > 0 ? (
        <div className="flex flex-col gap-3 rounded-3xl bg-gradient-to-r from-accent/80 via-white/50 to-primary-soft/70 px-5 py-4 sm:flex-row sm:items-center">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/70 text-peach-foreground">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">有 {expiredCount} 件闲置已到期自动下架</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              重新上架可继续展示 14 天，不再需要也可以直接删除。
            </p>
          </div>
          <Button
            variant="peach"
            size="sm"
            onClick={() => setFilter("EXPIRED")}
            className="shrink-0 gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            查看并处理
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
          <Input
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            placeholder="搜索我发布的闲置"
            className="pl-9"
            aria-label="搜索我的发布"
          />
        </div>
        <div className="flex items-center gap-1 rounded-full bg-white/45 p-1">
          {[
            { key: "ALL" as const, label: "全部" },
            { key: "EXPIRED" as const, label: `已到期${expiredCount ? ` ${expiredCount}` : ""}` },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={cn(
                "rounded-full px-3.5 py-1 text-xs transition-all",
                filter === tab.key
                  ? "mint-gradient font-medium text-white"
                  : "text-muted-foreground hover:text-primary",
              )}
            >
              {tab.label}
            </button>
          ))}
          <span className="px-2 text-xs text-muted-foreground">共 {listQuery.data?.total ?? 0} 件</span>
        </div>
      </div>

      {actionError ? (
        <p className="rounded-2xl bg-[#FFE9E4] px-4 py-2.5 text-sm text-[#C4473A]">{actionError}</p>
      ) : null}

      <div className="overflow-hidden rounded-3xl bg-white/45 backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead>
              <tr className="bg-white/40 text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">标题</th>
                <th className="px-4 py-3 font-medium">价格</th>
                <th className="px-4 py-3 font-medium">分类</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">发布时间</th>
                <th className="px-4 py-3 font-medium">到期时间</th>
                <th className="px-4 py-3 font-medium">意向收藏</th>
                <th className="px-4 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {listQuery.isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index}>
                    <td colSpan={columnCount} className="px-4 py-4">
                      <div className="h-5 w-full animate-pulse rounded-full bg-muted" />
                    </td>
                  </tr>
                ))
              ) : listQuery.isError ? (
                <tr>
                  <td colSpan={columnCount} className="px-4 py-10 text-center text-sm text-destructive">
                    {listQuery.error.message}
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={columnCount} className="px-4 py-10">
                    <EmptyState
                      className="border-0 bg-transparent py-6"
                      icon={<PackageOpen className="h-5 w-5" />}
                      title={
                        filter === "EXPIRED"
                          ? "没有已到期的闲置"
                          : keyword
                            ? "没有匹配的发布记录"
                            : "你还没有发布闲置"
                      }
                      description={
                        filter === "EXPIRED"
                          ? "上架满 14 天后会自动出现在这里。"
                          : keyword
                            ? "换个关键词试试，或清空搜索条件。"
                            : "发布第一件闲置，让它找到新的主人。"
                      }
                      action={
                        keyword ? (
                          <Button variant="outline" onClick={() => setKeywordInput("")}>
                            清空搜索
                          </Button>
                        ) : (
                          <Button onClick={openPublish} className="gap-1.5">
                            <PackageOpen className="h-4 w-4" />
                            发布闲置
                          </Button>
                        )
                      }
                    />
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const expired = item.status === "EXPIRED";
                  const editable = item.status === "ON_SALE";
                  return (
                    <tr
                      key={item.id}
                      className="border-t border-border/60 transition-colors hover:bg-white/35"
                    >
                      <td className="max-w-[240px] px-4 py-3">
                        <p className="truncate font-medium text-foreground" title={item.title}>
                          {item.title}
                        </p>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {item.isGift ? (
                            <span className="text-[11px] text-primary">善意赠予</span>
                          ) : null}
                          {(item.dealTags ?? []).map((tag) => (
                            <span key={tag} className="text-[11px] text-primary/70">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-primary">
                        {item.isGift ? "免费" : formatPrice(item.price)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{item.category}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                        {formatDateTime(item.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs">
                        {expired ? (
                          <span className="text-peach-foreground">已到期</span>
                        ) : (
                          <span className="text-muted-foreground">
                            {formatDateTime(item.expiresAt ?? item.createdAt)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">
                          {item.intentCount} 人
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {expired ? (
                            <>
                              <Button
                                size="sm"
                                variant="subtle"
                                className="gap-1"
                                disabled={pending}
                                onClick={() => void handleRelist(item)}
                              >
                                {relist.isPending ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <RotateCcw className="h-3.5 w-3.5" />
                                )}
                                重新上架
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="gap-1 text-destructive hover:bg-destructive/5 hover:text-destructive"
                                disabled={pending}
                                onClick={() => openConfirm(item, "remove")}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                删除
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1"
                                disabled={!editable}
                                title={!editable ? "已下架商品不可编辑" : undefined}
                                onClick={() => {
                                  setEditing(item);
                                  setEditOpen(true);
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                编辑
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="gap-1 text-destructive hover:bg-destructive/5 hover:text-destructive"
                                disabled={!editable || pending}
                                onClick={() => openConfirm(item, "offShelf")}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                {editable ? "下架" : "已下架"}
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {items.length > 0 ? (
        <Pagination
          page={listQuery.data?.page ?? 1}
          totalPages={listQuery.data?.totalPages ?? 1}
          total={listQuery.data?.total}
          onChange={setPage}
        />
      ) : null}

      <ItemFormDialog
        open={editOpen}
        onOpenChange={(next) => {
          setEditOpen(next);
          if (!next) setEditing(null);
        }}
        mode="edit"
        item={editing}
      />

      <Dialog
        open={Boolean(confirmTarget)}
        onOpenChange={(next) => {
          if (!next) {
            setConfirmTarget(null);
            setActionError(null);
          }
        }}
      >
        <DialogHeader
          title={confirmAction === "remove" ? "确认删除该商品？" : "确认下架该商品？"}
          description={
            confirmAction === "remove"
              ? "删除后不可恢复，相关收藏、意向标记、出价与聊天来源记录会被一并清理。"
              : "下架后不可恢复为在售；如果是到期商品，请使用「重新上架」续期。"
          }
          onClose={() => setConfirmTarget(null)}
        />
        <div className="space-y-2 px-6 py-5">
          <p className="text-sm text-foreground">{confirmTarget?.title}</p>
          {actionError ? (
            <p className="rounded-2xl bg-[#FFE9E4] px-3 py-2 text-sm text-[#C4473A]">{actionError}</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setConfirmTarget(null)}>
            取消
          </Button>
          <Button
            variant={confirmAction === "remove" ? "destructive" : "peach"}
            onClick={handleConfirm}
            disabled={pending}
            className="gap-1.5"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {confirmAction === "remove" ? "确认删除" : "确认下架"}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

export default function MyItemsPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-3xl bg-white/50" />}>
      <MyItemsContent />
    </Suspense>
  );
}
