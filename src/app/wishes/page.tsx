"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Search, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader, Pagination } from "@/components/pagination";
import { WishCard } from "@/components/wish-card";
import { WishFormDialog } from "@/components/wish-form-dialog";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { CATEGORIES, PAGE_SIZE, type Category } from "@/lib/constants";
import { useDebouncedValue } from "@/lib/hooks";
import { api } from "@/trpc/react";

type CategoryFilter = Category | "ALL";

function WishesContent() {
  const searchParams = useSearchParams();
  const [openCreate, setOpenCreate] = useState(false);
  const [keywordInput, setKeywordInput] = useState("");
  const keyword = useDebouncedValue(keywordInput, 300).trim();
  const [category, setCategory] = useState<CategoryFilter>("ALL");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (searchParams.get("new") === "1") setOpenCreate(true);
  }, [searchParams]);

  useEffect(() => {
    setPage(1);
  }, [keyword, category]);

  const listQuery = api.wish.list.useQuery({
    keyword: keyword || undefined,
    category,
    page,
    pageSize: PAGE_SIZE,
  });

  const items = listQuery.data?.items ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="心愿·意向闲置"
        description="发起一条求购心愿，让正在整理闲置的同学主动找到你。"
        actions={
          <Button onClick={() => setOpenCreate(true)} className="gap-1.5 active:scale-[0.97]">
            <Plus className="h-4 w-4" />
            发布求购心愿
          </Button>
        }
      />

      <section className="rounded-3xl bg-white/45 p-4 backdrop-blur-sm">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_170px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
            <Input
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              placeholder="搜索求购标题或需求描述"
              className="pl-10"
              aria-label="搜索求购心愿"
            />
          </div>
          <Select
            value={category}
            onChange={(value) => setCategory(value as CategoryFilter)}
            options={[
              { value: "ALL", label: "全部分类" },
              ...CATEGORIES.map((item) => ({ value: item, label: item })),
            ]}
            ariaLabel="心愿分类"
          />
        </div>
      </section>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          共 {listQuery.data?.total ?? 0} 条心愿
        </span>
        <span>过期心愿自动归档，不再允许发起新对话</span>
      </div>

      {listQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-[220px] animate-pulse rounded-xl border border-border bg-white" />
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
          title="还没有人发布求购心愿"
          description="成为第一个说出需求的人，让闲置主动来找你。"
          action={
            <Button onClick={() => setOpenCreate(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              发布求购心愿
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((wish) => (
              <WishCard key={wish.id} wish={wish} />
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

export default function WishesPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl border border-border bg-white" />}>
      <WishesContent />
    </Suspense>
  );
}
