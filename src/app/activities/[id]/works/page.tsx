"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Award, Images, Search, Sparkles } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader, Pagination } from "@/components/pagination";
import { Button, buttonClass } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WORK_PAGE_SIZE } from "@/lib/constants";
import { useDebouncedValue } from "@/lib/hooks";
import { formatDateTime } from "@/lib/utils";
import { api } from "@/trpc/react";

export default function WorksShowcasePage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : "";

  const overviewQuery = api.showcase.overview.useQuery({ activityId: id }, { enabled: Boolean(id) });
  const activityQuery = api.activity.byId.useQuery({ id }, { enabled: Boolean(id) });
  const [categoryId, setCategoryId] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const keyword = useDebouncedValue(keywordInput, 300).trim();
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [categoryId, keyword]);

  const listQuery = api.showcase.list.useQuery(
    {
      activityId: id,
      categoryId: categoryId || undefined,
      keyword: keyword || undefined,
      page,
      pageSize: WORK_PAGE_SIZE,
    },
    { enabled: Boolean(id) },
  );

  const overview = overviewQuery.data;
  const activity = activityQuery.data;
  const items = listQuery.data?.items ?? [];
  const categories = overview?.categories ?? [];

  const canSubmit =
    Boolean(activity) &&
    activity?.showcaseEnabled &&
    activity?.myRegistration === "APPROVED" &&
    activity?.myWork?.status !== "APPROVED" &&
    new Date(activity?.submissionDeadline ?? activity?.endAt ?? 0).getTime() > Date.now();

  return (
    <div className="space-y-5">
      <BackLink href={`/activities/${id}`} label="返回活动详情" />

      <PageHeader
        title="作品展示专区"
        description="分类浏览参赛作品，置顶与精选作品优先展示；图片资源按需懒加载，移动端与桌面端自适应。"
        actions={
          canSubmit ? (
            <Link href={`/activities/${id}/submit`} className={buttonClass({ variant: "default", size: "sm", className: "gap-1" })}>
              提交我的作品
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : null
        }
      />

      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-primary-soft/80 via-white/70 to-accent/50 p-5 backdrop-blur-sm sm:p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 text-primary">
            <Award className="h-3.5 w-3.5" />
            {overview?.approvedCount ?? 0} 件已通过作品
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {overview?.featuredCount ?? 0} 件精选
          </span>
          {overview?.activity ? (
            <span className="rounded-full bg-white/70 px-2.5 py-1">
              提交截止：{formatDateTime(overview.activity.submissionDeadline ?? overview.activity.endAt)}
            </span>
          ) : null}
        </div>
        <h2 className="mt-3 text-lg font-semibold text-foreground">
          {overview?.activity.title ?? activity?.title ?? "作品展示"}
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {overview?.activity.organizer ?? activity?.organizer ?? ""}
        </p>
      </section>

      <section className="space-y-3 rounded-3xl bg-white/50 p-4 backdrop-blur-sm">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
            <Input
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              placeholder="搜索作品标题、作者或描述"
              className="pl-10"
              aria-label="搜索作品"
            />
          </div>
          <span className="flex items-center justify-end text-xs text-muted-foreground">
            共 {listQuery.data?.total ?? 0} 件作品
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategoryId("")}
            className={
              categoryId === ""
                ? "rounded-full mint-gradient px-3.5 py-1.5 text-xs font-medium text-white"
                : "rounded-full bg-white/60 px-3.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-primary-soft hover:text-primary"
            }
          >
            全部作品
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setCategoryId(category.id)}
              className={
                categoryId === category.id
                  ? "rounded-full mint-gradient px-3.5 py-1.5 text-xs font-medium text-white"
                  : "rounded-full bg-white/60 px-3.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-primary-soft hover:text-primary"
              }
            >
              {category.name}
              <span className="ml-1 opacity-70">{category.count}</span>
            </button>
          ))}
        </div>
      </section>

      {listQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-64 animate-pulse rounded-3xl bg-white/50" />
          ))}
        </div>
      ) : listQuery.isError ? (
        <EmptyState
          icon={<Images className="h-5 w-5" />}
          title="作品加载失败"
          description={listQuery.error.message}
          action={
            <Button variant="outline" onClick={() => void listQuery.refetch()}>
              重新加载
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Images className="h-5 w-5" />}
          title="暂无符合条件的作品"
          description="换个分类或关键词试试；报名通过的同学可以提交第一件作品。"
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((work) => (
              <Link
                key={work.id}
                href={`/activities/${id}/works/${work.id}`}
                className="group flex flex-col overflow-hidden rounded-3xl bg-white/65 shadow-[0_18px_40px_-34px_rgba(14,143,116,0.45)] backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-white/85"
              >
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-primary-soft/40">
                  {work.coverUrl ? (
                    <img
                      src={work.coverUrl}
                      alt={work.title}
                      loading="lazy"
                      decoding="async"
                      width={480}
                      height={300}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-xs text-muted-foreground">暂无封面</div>
                  )}
                  <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                    {work.pinned ? (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                        置顶
                      </span>
                    ) : null}
                    {work.featured ? (
                      <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-peach-foreground">
                        精选
                      </span>
                    ) : null}
                    <span className="rounded-full bg-white/85 px-2 py-0.5 text-[10px] text-foreground">
                      {work.categoryName}
                    </span>
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-1.5 p-4">
                  <h3 className="line-clamp-2 text-sm font-medium leading-6 text-foreground group-hover:text-primary">
                    {work.title}
                  </h3>
                  <p className="line-clamp-1 text-[11px] text-muted-foreground">{work.authorName}</p>
                  <p className="line-clamp-3 text-xs leading-6 text-muted-foreground">{work.excerpt}</p>
                  <div className="mt-auto flex items-center gap-2 pt-2 text-[11px] text-muted-foreground">
                    <Images className="h-3.5 w-3.5" />
                    {work.media.length} 个资源
                    <span className="ml-auto">{formatDateTime(work.updatedAt)}</span>
                  </div>
                </div>
              </Link>
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
