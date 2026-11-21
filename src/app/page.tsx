"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  BellRing,
  CalendarDays,
  Clock3,
  ExternalLink,
  Flame,
  Gift,
  MapPin,
  Megaphone,
  PackageOpen,
  Search,
  SlidersHorizontal,
  Sparkles,
  Store,
  Users,
  X,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { ItemCard } from "@/components/item-card";
import { PageHeader, Pagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { usePublishDialog } from "@/components/publish-dialog-provider";
import {
  ACTIVITY_TAG_LABEL,
  CATEGORIES,
  PAGE_SIZE,
  SCENE_TAGS,
  type ActivityTag,
  type Category,
} from "@/lib/constants";
import { parsePriceInput, useDebouncedValue } from "@/lib/hooks";
import { api } from "@/trpc/react";
import { cn, formatDateTime } from "@/lib/utils";

type CategoryFilter = Category | "ALL";

function SectionHead({
  title,
  hint,
  href,
  linkLabel,
  icon,
}: {
  title: string;
  hint: string;
  href?: string;
  linkLabel?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="space-y-0.5">
        <h2 className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
          {icon}
          {title}
        </h2>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      {href ? (
        <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-xs text-primary hover:underline">
          {linkLabel ?? "查看全部"}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      ) : null}
    </div>
  );
}

function WelcomeStrip({ onPublish }: { onPublish: () => void }) {
  const statsQuery = api.stats.overview.useQuery(undefined, { staleTime: 30_000 });
  const stats = statsQuery.data;

  return (
    <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-primary-soft via-white/60 to-accent/60 soft-shadow">
      <div className="relative px-6 py-7 sm:px-8 sm:py-8">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/65 px-3.5 py-1.5 text-xs font-medium text-primary backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          校园集 V9 · 活动通知 · 课表 · 闲置与失物一站流转
        </span>
        <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          发现活动，
          <span className="text-gradient-mint">报名跟进</span>
          ，把校园时间用起来
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
          讲座、竞赛、志愿与社团活动在这里发布、筛选、报名；行政通知按学院与班级定向送达。闲置与失物招领作为校园生活的补充，继续保留。
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <Link
            href="/activities"
            className="inline-flex h-10 items-center gap-1.5 rounded-full mint-gradient px-5 text-sm font-medium text-primary-foreground shadow-[0_16px_30px_-18px_rgba(14,143,116,0.9)] transition hover:brightness-[1.04]"
          >
            去活动广场
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/notices"
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white/70 px-4 text-sm text-foreground backdrop-blur transition hover:bg-white"
          >
            <BellRing className="h-4 w-4 text-primary" />
            行政通知
          </Link>
          <Button variant="outline" onClick={onPublish} className="gap-1.5">
            <PackageOpen className="h-4 w-4" />
            发布闲置
          </Button>
        </div>

        <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
          {[
            { value: stats?.onSale ?? "—", label: "在售闲置" },
            { value: stats?.members ?? "—", label: "注册同学" },
            { value: stats?.wishes ?? "—", label: "求购心愿" },
            { value: stats?.gifts ?? "—", label: "善意赠予" },
          ].map((item) => (
            <div key={item.label}>
              <dd className="text-xl font-semibold tracking-tight text-foreground">{item.value}</dd>
              <dt className="mt-0.5 text-[11px] text-muted-foreground">{item.label}</dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function HotActivities() {
  const hotQuery = api.hotActivity.list.useQuery(undefined, { staleTime: 60_000 });
  const items = hotQuery.data ?? [];
  if (hotQuery.isLoading) {
    return (
      <section className="space-y-3">
        <SectionHead title="近期热门活动" hint="管理员精选，支持站内报名与外部链接" icon={<Flame className="h-4 w-4 text-primary" />} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-40 animate-pulse rounded-3xl bg-white/50" />
          ))}
        </div>
      </section>
    );
  }
  if (items.length === 0) return null;

  return (
    <section className="space-y-3">
      <SectionHead
        title="近期热门活动"
        hint="管理员精选：站内活动可直接报名，外部活动跳转官方页面"
        href="/activities"
        linkLabel="全部活动"
        icon={<Flame className="h-4 w-4 text-primary" />}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((hot) => {
          const inner = (
            <>
              <div className="relative h-24 w-full overflow-hidden rounded-2xl bg-primary-soft/60">
                {hot.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={hot.coverUrl}
                    alt={hot.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-primary/50">
                    <CalendarDays className="h-7 w-7" />
                  </div>
                )}
                <span className="absolute left-2 top-2 rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-medium text-primary backdrop-blur">
                  {hot.isExternal ? "外部活动" : "站内活动"}
                </span>
              </div>
              <h3 className="line-clamp-2 text-sm font-medium leading-6 text-foreground transition-colors group-hover:text-primary">
                {hot.title}
              </h3>
              {hot.activity ? (
                <div className="mt-auto space-y-1 text-[11px] text-muted-foreground">
                  <p className="inline-flex items-center gap-1">
                    <Clock3 className="h-3 w-3" />
                    {formatDateTime(hot.activity.startAt)}
                  </p>
                  <p className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{hot.activity.location}</span>
                  </p>
                  <p className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {hot.activity.occupied} / {hot.activity.isUnlimited ? "不限" : hot.activity.capacity} 人
                    {hot.activity.creditPoints ? ` · ${hot.activity.creditPoints} 学分` : ""}
                  </p>
                </div>
              ) : (
                <p className="mt-auto inline-flex items-center gap-1 text-[11px] text-[#7C3AED]">
                  <ExternalLink className="h-3 w-3" />
                  在新标签页打开报名页
                </p>
              )}
            </>
          );

          return hot.isExternal ? (
            <a
              key={hot.id}
              href={hot.externalUrl ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col gap-2 rounded-3xl bg-white/60 p-3.5 shadow-[0_18px_40px_-36px_rgba(14,143,116,0.45)] backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-white/85"
            >
              {inner}
            </a>
          ) : (
            <Link
              key={hot.id}
              href={`/activities/${hot.activityId}`}
              className="group flex flex-col gap-2 rounded-3xl bg-white/60 p-3.5 shadow-[0_18px_40px_-36px_rgba(14,143,116,0.45)] backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-white/85"
            >
              {inner}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function RecommendedActivities() {
  const recommendedQuery = api.activity.recommended.useQuery({ take: 6 }, { staleTime: 60_000 });
  const data = recommendedQuery.data;

  if (recommendedQuery.isLoading) {
    return (
      <section className="space-y-3">
        <SectionHead title="为你推荐" hint="按学院 / 年级 / 专业 / 班级标签匹配" icon={<Sparkles className="h-4 w-4 text-primary" />} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-3xl bg-white/50" />
          ))}
        </div>
      </section>
    );
  }

  if (data?.needsAuth) {
    return (
      <section className="space-y-3">
        <SectionHead title="为你推荐" hint="按学院 / 年级 / 专业 / 班级标签匹配" icon={<Sparkles className="h-4 w-4 text-primary" />} />
        <div className="flex flex-wrap items-center gap-4 rounded-3xl bg-gradient-to-r from-primary-soft/70 via-white/60 to-accent/50 p-5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/75 text-primary">
            <BadgeCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">完成学生身份认证后开启推荐</p>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              填写学院、年级、专业与班级，推荐会优先展示与你身份匹配的活动，学院 / 班级定向通知也才会送达。
            </p>
          </div>
          <Link href="/profile/auth">
            <Button className="shrink-0 gap-1.5">去认证</Button>
          </Link>
        </div>
      </section>
    );
  }

  const items = data?.items ?? [];
  if (items.length === 0) {
    return (
      <section className="space-y-3">
        <SectionHead title="为你推荐" hint="按身份标签匹配，暂无定向活动时展示公开活动" icon={<Sparkles className="h-4 w-4 text-primary" />} />
        <div className="rounded-3xl bg-white/50 p-6 text-center text-sm text-muted-foreground">
          暂无可推荐的活动，去
          <Link href="/activities" className="mx-1 text-primary hover:underline">
            活动广场
          </Link>
          看看全部活动。
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <SectionHead
        title="为你推荐"
        hint="按你的学院 / 年级 / 专业 / 班级匹配，定向条件越具体排序越靠前"
        href="/activities"
        linkLabel="更多活动"
        icon={<Sparkles className="h-4 w-4 text-primary" />}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((activity) => (
          <Link
            key={activity.id}
            href={`/activities/${activity.id}`}
            className="group flex flex-col gap-2 rounded-3xl bg-white/60 p-4 shadow-[0_18px_40px_-36px_rgba(14,143,116,0.45)] backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-white/85"
          >
            <div className="flex flex-wrap items-center gap-1.5">
              {activity.tags.slice(0, 2).map((tag) => (
                <span key={tag} className="rounded-full bg-primary-soft/80 px-2 py-0.5 text-[11px] text-primary">
                  {ACTIVITY_TAG_LABEL[tag as ActivityTag] ?? tag}
                </span>
              ))}
              {activity.creditPoints ? (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
                  {activity.creditPoints} 学分
                </span>
              ) : null}
            </div>
            <h3 className="line-clamp-2 text-sm font-medium leading-6 text-foreground transition-colors group-hover:text-primary">
              {activity.title}
            </h3>
            <p className="mt-auto text-[11px] text-muted-foreground">{activity.organizer}</p>
            <div className="space-y-1 text-[11px] text-muted-foreground">
              <p className="inline-flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                {formatDateTime(activity.startAt)}
              </p>
              <p className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{activity.location}</span>
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function NoticeBrief() {
  const latestQuery = api.notice.latest.useQuery({ take: 4 }, { staleTime: 60_000 });
  const items = latestQuery.data?.items ?? [];
  if (latestQuery.isLoading || items.length === 0) return null;

  return (
    <section className="space-y-3">
      <SectionHead
        title="最新行政通知"
        hint="全员通知之外，学院与班级定向通知只会出现在符合身份的同学这里"
        href="/notices"
        linkLabel="通知中心"
        icon={<Megaphone className="h-4 w-4 text-primary" />}
      />
      <div className="divide-y divide-primary/10 overflow-hidden rounded-3xl bg-white/60 backdrop-blur-sm">
        {items.map((notice) => (
          <Link
            key={notice.id}
            href={`/notices/${notice.id}`}
            className="group flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-white/80"
          >
            <span
              className={cn(
                "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl",
                notice.isTargeted ? "bg-[#F0E7FF] text-[#7C3AED]" : "bg-primary-soft text-primary",
              )}
            >
              {notice.isTargeted ? <Users className="h-4 w-4" /> : <Megaphone className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                  {notice.title}
                </p>
                {!notice.read ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-peach" /> : null}
              </div>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {notice.dept} · {formatDateTime(notice.publishAt)}
              </p>
            </div>
            <ArrowRight className="mt-2 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>
        ))}
      </div>
    </section>
  );
}

function LostFoundBrief() {
  const listQuery = api.lostFound.list.useQuery({ page: 1, pageSize: 5 }, { staleTime: 60_000 });
  const items = listQuery.data?.items ?? [];
  if (listQuery.isLoading || items.length === 0) return null;

  return (
    <section className="space-y-3">
      <SectionHead
        title="失物招领快报"
        hint="刚捡到与刚丢失的物品，帮忙转发给失主"
        href="/lost-found"
        linkLabel="失物招领专区"
        icon={<MapPin className="h-4 w-4 text-primary" />}
      />
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
        {items.map((record) => (
          <Link
            key={record.id}
            href={`/lost-found/${record.id}`}
            className="group rounded-2xl bg-white/60 p-3 transition-all hover:-translate-y-0.5 hover:bg-white/85"
          >
            <span
              className={cn(
                "inline-flex rounded-full px-2 py-0.5 text-[10px]",
                record.kind === "LOST" ? "bg-[#FFE1D6] text-[#C4473A]" : "bg-primary-soft text-primary",
              )}
            >
              {record.kind === "LOST" ? "寻物" : "招领"}
            </span>
            <p className="mt-1.5 line-clamp-2 text-xs font-medium leading-5 text-foreground transition-colors group-hover:text-primary">
              {record.title}
            </p>
            <p className="mt-1 truncate text-[10px] text-muted-foreground">{record.location}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function FeaturedItems() {
  const featuredQuery = api.item.list.useQuery(
    { status: "ON_SALE", page: 1, pageSize: 4 },
    { staleTime: 30_000 },
  );
  const items = featuredQuery.data?.items ?? [];

  return (
    <section className="space-y-4">
      <SectionHead
        title="闲置好物"
        hint="同校同学刚刚发布，适合开学与期末周"
        href="/?status=ON_SALE"
        icon={<Store className="h-4 w-4 text-primary" />}
      />

      {featuredQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-[300px] animate-pulse rounded-2xl bg-white/50" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl bg-white/50 p-8 text-center text-sm text-muted-foreground">
          还没有在售闲置，发布第一件吧。
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

function PlazaContent() {
  const { openPublish } = usePublishDialog();
  const searchParams = useSearchParams();
  const giftParam = searchParams.get("gift") === "1";
  const statusParam = searchParams.get("status") === "ON_SALE" ? "ON_SALE" : "ALL";

  const [keywordInput, setKeywordInput] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("ALL");
  const [minPriceInput, setMinPriceInput] = useState("");
  const [maxPriceInput, setMaxPriceInput] = useState("");
  const [onlyGift, setOnlyGift] = useState(giftParam);
  const [sceneTag, setSceneTag] = useState<string>("ALL");
  const [status, setStatus] = useState<"ALL" | "ON_SALE">(statusParam);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setOnlyGift(giftParam);
    setStatus(statusParam);
  }, [giftParam, statusParam]);

  const keyword = useDebouncedValue(keywordInput, 300).trim();
  const minPrice = parsePriceInput(minPriceInput);
  const maxPrice = parsePriceInput(maxPriceInput);

  useEffect(() => {
    setPage(1);
  }, [keyword, category, minPriceInput, maxPriceInput, onlyGift, sceneTag, status]);

  const listQuery = api.item.list.useQuery({
    keyword: keyword || undefined,
    category,
    minPrice,
    maxPrice,
    isGift: onlyGift ? true : undefined,
    sceneTag: sceneTag === "ALL" ? undefined : (sceneTag as (typeof SCENE_TAGS)[number]),
    status,
    page,
    pageSize: PAGE_SIZE,
  });

  const hasFilters =
    keywordInput.trim() !== "" ||
    category !== "ALL" ||
    minPriceInput !== "" ||
    maxPriceInput !== "" ||
    onlyGift ||
    sceneTag !== "ALL" ||
    status !== "ALL";

  const resetFilters = () => {
    setKeywordInput("");
    setCategory("ALL");
    setMinPriceInput("");
    setMaxPriceInput("");
    setOnlyGift(false);
    setSceneTag("ALL");
    setStatus("ALL");
    setPage(1);
  };

  const items = useMemo(() => listQuery.data?.items ?? [], [listQuery.data]);

  return (
    <div className="space-y-8">
      <WelcomeStrip onPublish={openPublish} />

      <HotActivities />

      <RecommendedActivities />

      <NoticeBrief />

      <LostFoundBrief />

      <FeaturedItems />

      <div id="plaza" className="scroll-mt-24 space-y-5 pt-2">
        <PageHeader
          title={onlyGift ? "善意赠予专区" : status === "ON_SALE" ? "在售商品专区" : "闲置广场"}
          description="校园里正在流转的闲置好物，挑一件带走，也把闲置留给需要的人。"
          actions={
            <Button onClick={openPublish} className="gap-1.5 active:scale-[0.97]">
              <PackageOpen className="h-4 w-4" />
              发布闲置
            </Button>
          }
        />

        <section className="rounded-3xl bg-white/45 p-4 backdrop-blur-sm">
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_150px_150px_130px_130px_auto] lg:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
              <Input
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                placeholder="搜索物品标题或描述"
                className="pl-10"
                aria-label="关键词搜索"
              />
            </div>

            <Select
              value={category}
              onChange={(value) => setCategory(value as CategoryFilter)}
              options={[
                { value: "ALL", label: "全部分类" },
                ...CATEGORIES.map((item) => ({ value: item, label: item })),
              ]}
              ariaLabel="物品分类"
            />

            <Select
              value={sceneTag}
              onChange={setSceneTag}
              options={[
                { value: "ALL", label: "全部场景" },
                ...SCENE_TAGS.map((tag) => ({ value: tag, label: tag })),
              ]}
              ariaLabel="校园场景标签"
            />

            <Input
              type="number"
              min={0}
              inputMode="numeric"
              value={minPriceInput}
              onChange={(e) => setMinPriceInput(e.target.value)}
              placeholder="最低价"
              aria-label="最低价格"
            />
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              value={maxPriceInput}
              onChange={(e) => setMaxPriceInput(e.target.value)}
              placeholder="最高价"
              aria-label="最高价格"
            />

            <Button variant="ghost" onClick={resetFilters} disabled={!hasFilters} className="gap-1.5">
              <X className="h-3.5 w-3.5" />
              重置
            </Button>
          </div>

          <label className="mt-3 inline-flex cursor-pointer items-center gap-2 pl-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[#2FBFA0]"
              checked={onlyGift}
              onChange={(e) => setOnlyGift(e.target.checked)}
            />
            仅看善意赠予
          </label>
        </section>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {hasFilters ? "筛选结果" : "全部闲置"} · {listQuery.data?.total ?? 0} 件
          </span>
          {hasFilters ? (
            <button type="button" onClick={resetFilters} className="text-primary hover:underline">
              清除筛选条件
            </button>
          ) : null}
        </div>

        {listQuery.isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-[320px] animate-pulse rounded-2xl bg-white/50" />
            ))}
          </div>
        ) : listQuery.isError ? (
          <EmptyState
            icon={<Store className="h-5 w-5" />}
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
            icon={<Store className="h-5 w-5" />}
            title="没有找到符合条件的闲置"
            description={
              hasFilters ? "换个关键词或放宽价格区间试试。" : "广场还很安静，发布第一件闲置吧。"
            }
            action={
              hasFilters ? (
                <Button variant="outline" onClick={resetFilters}>
                  清除筛选条件
                </Button>
              ) : (
                <Button onClick={openPublish} className="gap-1.5">
                  <PackageOpen className="h-4 w-4" />
                  发布闲置
                </Button>
              )
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((item) => (
                <ItemCard key={item.id} item={item} />
              ))}
            </div>
            <Pagination
              page={listQuery.data?.page ?? 1}
              totalPages={listQuery.data?.totalPages ?? 1}
              total={listQuery.data?.total}
              onChange={setPage}
              className="pt-2"
            />
          </>
        )}
      </div>
    </div>
  );
}

export default function PlazaPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-white/50" />}>
      <PlazaContent />
    </Suspense>
  );
}
