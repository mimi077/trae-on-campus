"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Plus, Search } from "lucide-react";
import { ActivityCard } from "@/components/activity-card";
import { ActivityFormDialog } from "@/components/activity-form-dialog";
import { EmptyState } from "@/components/empty-state";
import { PageHeader, Pagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import {
  ACTIVITY_PAGE_SIZE,
  ACTIVITY_SOURCES,
  ACTIVITY_SOURCE_LABEL,
  ACTIVITY_TAGS,
  ACTIVITY_TAG_LABEL,
  ACTIVITY_TIME_FILTERS,
  ACTIVITY_TIME_LABEL,
  ACTIVITY_TYPES,
  ACTIVITY_TYPE_LABEL,
  type ActivitySource,
  type ActivityTag,
  type ActivityTimeFilter,
  type ActivityType,
} from "@/lib/constants";
import { useDebouncedValue } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

const TIME_TABS = ACTIVITY_TIME_FILTERS;

export default function ActivitiesPage() {
  const meQuery = api.auth.me.useQuery();
  const isStaff = Boolean(meQuery.data?.isStaff);

  const [openCreate, setOpenCreate] = useState(false);
  const [keywordInput, setKeywordInput] = useState("");
  const keyword = useDebouncedValue(keywordInput, 300).trim();
  const [time, setTime] = useState<ActivityTimeFilter>("ALL");
  const [type, setType] = useState<"ALL" | ActivityType>("ALL");
  const [source, setSource] = useState<"ALL" | ActivitySource>("ALL");
  const [tag, setTag] = useState<"ALL" | ActivityTag>("ALL");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [keyword, time, type, source, tag]);

  const listQuery = api.activity.list.useQuery({
    keyword: keyword || undefined,
    time,
    type,
    source,
    tag,
    page,
    pageSize: ACTIVITY_PAGE_SIZE,
  });

  const items = listQuery.data?.items ?? [];
  const hasFilters = keyword !== "" || time !== "ALL" || type !== "ALL" || source !== "ALL" || tag !== "ALL";

  const resetFilters = () => {
    setKeywordInput("");
    setTime("ALL");
    setType("ALL");
    setSource("ALL");
    setTag("ALL");
    setPage(1);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="活动广场"
        description="官方讲座、竞赛、志愿与社团活动都在这里，按时间与类型筛选，一站式完成报名。"
        actions={
          <Button onClick={() => setOpenCreate(true)} className="gap-1.5 active:scale-[0.97]">
            <Plus className="h-4 w-4" />
            {isStaff ? "发布活动" : "提交活动"}
          </Button>
        }
      />

      <section className="space-y-3 rounded-3xl bg-white/45 p-4 backdrop-blur-sm">
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_150px_150px_150px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
            <Input
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              placeholder="搜索活动标题、主办方或地点"
              className="pl-10"
              aria-label="搜索活动"
            />
          </div>
          <Select
            value={type}
            onChange={(value) => setType(value as "ALL" | ActivityType)}
            options={[
              { value: "ALL", label: "全部类型" },
              ...ACTIVITY_TYPES.map((item) => ({ value: item, label: ACTIVITY_TYPE_LABEL[item] })),
            ]}
            ariaLabel="活动类型"
          />
          <Select
            value={source}
            onChange={(value) => setSource(value as "ALL" | ActivitySource)}
            options={[
              { value: "ALL", label: "全部来源" },
              ...ACTIVITY_SOURCES.map((item) => ({ value: item, label: ACTIVITY_SOURCE_LABEL[item] })),
            ]}
            ariaLabel="活动来源"
          />
          <Select
            value={tag}
            onChange={(value) => setTag(value as "ALL" | ActivityTag)}
            options={[
              { value: "ALL", label: "全部标签" },
              ...ACTIVITY_TAGS.map((item) => ({ value: item, label: ACTIVITY_TAG_LABEL[item] })),
            ]}
            ariaLabel="活动标签"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {TIME_TABS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTime(item)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs transition-colors",
                time === item
                  ? "mint-gradient font-medium text-white"
                  : "bg-white/55 text-muted-foreground hover:bg-primary-soft hover:text-primary",
              )}
            >
              {ACTIVITY_TIME_LABEL[item]}
            </button>
          ))}
          <span className="ml-auto text-xs text-muted-foreground">
            共 {listQuery.data?.total ?? 0} 场活动
          </span>
        </div>
      </section>

      {listQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-44 animate-pulse rounded-3xl bg-white/50" />
          ))}
        </div>
      ) : listQuery.isError ? (
        <EmptyState
          icon={<CalendarDays className="h-5 w-5" />}
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
          title="没有找到匹配的活动"
          description={hasFilters ? "换个关键词、时间或类型试试。" : "近期还没有公开活动，稍后再来看看。"}
          action={
            hasFilters ? (
              <Button variant="outline" onClick={resetFilters}>
                清除筛选条件
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          <div className="space-y-3">
            {items.map((activity) => (
              <ActivityCard key={activity.id} activity={activity} />
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

      <ActivityFormDialog open={openCreate} onOpenChange={setOpenCreate} />
    </div>
  );
}
