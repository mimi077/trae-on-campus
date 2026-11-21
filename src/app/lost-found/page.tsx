"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Info, MapPin, Plus, Search } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { LostFoundCard } from "@/components/lost-found-card";
import { LostFoundFormDialog } from "@/components/lost-found-form-dialog";
import { PageHeader, Pagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import {
  LOST_FOUND_CATEGORIES,
  LOST_FOUND_KIND_LABEL,
  PAGE_SIZE,
  type LostFoundCategory,
  type LostFoundKind,
} from "@/lib/constants";
import { useDebouncedValue } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

type KindFilter = "ALL" | LostFoundKind;
type CategoryFilter = "ALL" | LostFoundCategory;

const KIND_TABS: { value: KindFilter; label: string }[] = [
  { value: "ALL", label: "全部" },
  { value: "LOST", label: "寻物启事" },
  { value: "FOUND", label: "失物招领" },
];

function LostFoundContent() {
  const searchParams = useSearchParams();
  const kindParam = searchParams.get("kind");
  const initialKind: LostFoundKind = kindParam === "LOST" ? "LOST" : "FOUND";

  const [openCreate, setOpenCreate] = useState(false);
  const [defaultKind, setDefaultKind] = useState<LostFoundKind>(initialKind);
  const [keywordInput, setKeywordInput] = useState("");
  const keyword = useDebouncedValue(keywordInput, 300).trim();
  const [kind, setKind] = useState<KindFilter>(kindParam === "LOST" || kindParam === "FOUND" ? kindParam : "ALL");
  const [category, setCategory] = useState<CategoryFilter>("ALL");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setDefaultKind(kindParam === "LOST" ? "LOST" : "FOUND");
      setOpenCreate(true);
    }
  }, [searchParams, kindParam]);

  useEffect(() => {
    setPage(1);
  }, [keyword, kind, category]);

  const listQuery = api.lostFound.list.useQuery({
    keyword: keyword || undefined,
    kind,
    category,
    page,
    pageSize: PAGE_SIZE,
  });

  const items = listQuery.data?.items ?? [];
  const hasFilters = keyword !== "" || kind !== "ALL" || category !== "ALL";

  const resetFilters = () => {
    setKeywordInput("");
    setKind("ALL");
    setCategory("ALL");
    setPage(1);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="失物招领"
        description="捡到东西发一条失物招领，丢了东西发一条寻物启事，让校园里的物品回到主人手里。"
        actions={
          <Button
            onClick={() => {
              setDefaultKind("FOUND");
              setOpenCreate(true);
            }}
            className="gap-1.5 active:scale-[0.97]"
          >
            <Plus className="h-4 w-4" />
            发布失物信息
          </Button>
        }
      />

      <div className="flex items-start gap-2.5 rounded-3xl bg-gradient-to-r from-primary-soft/80 via-white/40 to-accent/70 px-4 py-3 text-xs leading-5 text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>
          所有信息需管理员审核通过后才会公开展示。发布时请勿填写身份证号、完整银行卡号等敏感信息，联系方式建议使用微信或 QQ
          昵称。
        </p>
      </div>

      <section className="rounded-3xl bg-white/45 p-4 backdrop-blur-sm">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_170px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
            <Input
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              placeholder="搜索物品标题、描述或地点"
              className="pl-10"
              aria-label="搜索失物招领"
            />
          </div>
          <Select
            value={category}
            onChange={(value) => setCategory(value as CategoryFilter)}
            options={[
              { value: "ALL", label: "全部分类" },
              ...LOST_FOUND_CATEGORIES.map((item) => ({ value: item, label: item })),
            ]}
            ariaLabel="物品分类"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {KIND_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setKind(tab.value)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs transition-colors",
                kind === tab.value
                  ? tab.value === "LOST"
                    ? "bg-gradient-to-r from-[#FFC9A6] to-[#FFA477] font-medium text-peach-foreground"
                    : "mint-gradient font-medium text-white"
                  : "bg-white/55 text-muted-foreground hover:bg-primary-soft hover:text-primary",
              )}
            >
              {tab.label}
            </button>
          ))}
          <span className="ml-auto text-xs text-muted-foreground">
            共 {listQuery.data?.total ?? 0} 条已通过审核的信息
          </span>
        </div>
      </section>

      {listQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-[320px] animate-pulse rounded-3xl bg-white/50" />
          ))}
        </div>
      ) : listQuery.isError ? (
        <EmptyState
          icon={<MapPin className="h-5 w-5" />}
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
          icon={<MapPin className="h-5 w-5" />}
          title="没有找到匹配的失物信息"
          description={
            hasFilters
              ? "换个关键词或分类试试，也可以发布一条信息让同学帮你留意。"
              : "还没有通过审核的失物信息，成为第一个发布的人吧。"
          }
          action={
            hasFilters ? (
              <Button variant="outline" onClick={resetFilters}>
                清除筛选条件
              </Button>
            ) : (
              <Button
                onClick={() => {
                  setDefaultKind("FOUND");
                  setOpenCreate(true);
                }}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" />
                发布失物信息
              </Button>
            )
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((record) => (
              <LostFoundCard key={record.id} record={record} />
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

      <LostFoundFormDialog open={openCreate} onOpenChange={setOpenCreate} defaultKind={defaultKind} />
    </div>
  );
}

export default function LostFoundPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-3xl bg-white/50" />}>
      <LostFoundContent />
    </Suspense>
  );
}
