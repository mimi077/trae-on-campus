"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlarmClock,
  Check,
  Images,
  Loader2,
  Pin,
  Plus,
  ShieldAlert,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader, Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { REMINDER_STAGE_LABEL, WORK_STATUS_LABEL, type WorkStatus } from "@/lib/constants";
import { cn, formatDateTime } from "@/lib/utils";
import { api } from "@/trpc/react";

const STATUS_TABS = [
  { value: "PENDING", label: "待审核" },
  { value: "APPROVED", label: "已通过" },
  { value: "REJECTED", label: "已驳回" },
  { value: "ALL", label: "全部" },
] as const;

const STATUS_STYLE: Record<WorkStatus, string> = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-700",
  APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REJECTED: "border-rose-200 bg-rose-50 text-rose-600",
};

export default function AdminWorksPage() {
  const utils = api.useUtils();
  const meQuery = api.auth.me.useQuery();
  const isStaff = Boolean(meQuery.data?.isStaff);

  const activitiesQuery = api.showcase.adminActivities.useQuery(undefined, { enabled: isStaff });
  const activities = activitiesQuery.data ?? [];

  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]["value"]>("PENDING");
  const [page, setPage] = useState(1);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [newCategory, setNewCategory] = useState("");
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, { name: string; sortOrder: string }>>({});
  const [sortDrafts, setSortDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [reminderResult, setReminderResult] = useState<string | null>(null);

  useEffect(() => {
    if (selectedId || activities.length === 0) return;
    const fromQuery =
      typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("activityId") : null;
    if (fromQuery && activities.some((activity) => activity.id === fromQuery)) {
      setSelectedId(fromQuery);
      return;
    }
    setSelectedId(activities.find((activity) => activity.showcaseEnabled)?.id ?? activities[0].id);
  }, [activities, selectedId]);

  const overviewQuery = api.showcase.overview.useQuery(
    { activityId: selectedId },
    { enabled: Boolean(selectedId) },
  );
  const listQuery = api.showcase.adminList.useQuery(
    { activityId: selectedId || undefined, status, page, pageSize: 10 },
    { enabled: Boolean(selectedId) },
  );

  const createCategory = api.showcase.createCategory.useMutation();
  const updateCategory = api.showcase.updateCategory.useMutation();
  const deleteCategory = api.showcase.deleteCategory.useMutation();
  const setShowcaseEnabled = api.showcase.setShowcaseEnabled.useMutation();
  const reviewMutation = api.showcase.review.useMutation();
  const toggleFeatured = api.showcase.toggleFeatured.useMutation();
  const togglePinned = api.showcase.togglePinned.useMutation();
  const updateSort = api.showcase.updateSort.useMutation();
  const runReminder = api.reminder.run.useMutation();

  const selected = activities.find((activity) => activity.id === selectedId);
  const categories = overviewQuery.data?.categories ?? [];
  const works = listQuery.data?.items ?? [];
  const busy =
    createCategory.isPending ||
    updateCategory.isPending ||
    deleteCategory.isPending ||
    setShowcaseEnabled.isPending ||
    reviewMutation.isPending ||
    toggleFeatured.isPending ||
    togglePinned.isPending ||
    updateSort.isPending;

  const refresh = async () => {
    await Promise.all([
      utils.showcase.adminActivities.invalidate(),
      utils.showcase.adminList.invalidate(),
      utils.showcase.overview.invalidate({ activityId: selectedId }),
      utils.showcase.pendingCount.invalidate(),
      utils.showcase.list.invalidate(),
      utils.showcase.featured.invalidate(),
      utils.activity.byId.invalidate({ id: selectedId }),
    ]);
  };

  const guard = async (task: () => Promise<unknown>) => {
    setError(null);
    try {
      await task();
      await refresh();
    } catch (taskError) {
      setError(taskError instanceof Error ? taskError.message : "操作失败，请稍后重试");
    }
  };

  if (meQuery.isLoading) {
    return <div className="h-64 animate-pulse rounded-3xl bg-white/50" />;
  }

  if (!isStaff) {
    return (
      <EmptyState
        icon={<ShieldAlert className="h-5 w-5" />}
        title="无权管理作品专区"
        description="作品分类、精选、置顶与审核仅对教师或管理员开放。"
        action={
          <Link href="/activities" className="text-sm text-primary hover:underline">
            返回活动广场
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="作品专区管理"
        description="为竞赛维护作品分类、审核参赛作品，并设置精选、置顶与排序；只有审核通过的作品会公开展示。"
      />

      {activities.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-5 w-5" />}
          title="暂无可管理的活动"
          description="发布活动并开启作品展示专区后，即可在这里管理分类与作品。"
          action={
            <Link href="/activities" className={buttonClass({ variant: "outline", size: "sm" })}>
              去活动广场
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="space-y-2 rounded-3xl bg-white/50 p-3 backdrop-blur-sm">
            <p className="px-2 pb-1 text-[11px] font-medium text-muted-foreground">我的活动（{activities.length}）</p>
            <div className="max-h-[70vh] space-y-1.5 overflow-y-auto pr-1 scrollbar-thin">
              {activities.map((activity) => {
                const active = activity.id === selectedId;
                return (
                  <button
                    key={activity.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(activity.id);
                      setPage(1);
                      setReminderResult(null);
                      setError(null);
                    }}
                    className={cn(
                      "w-full rounded-2xl px-3 py-2.5 text-left transition-colors",
                      active
                        ? "bg-gradient-to-r from-primary-soft/90 to-accent/60 text-primary"
                        : "text-muted-foreground hover:bg-primary-soft/50 hover:text-foreground",
                    )}
                  >
                    <p className="line-clamp-2 text-xs font-medium">{activity.title}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span>{activity.showcaseEnabled ? "专区已开启" : "专区未开启"}</span>
                      <span>· {activity.workCount} 件作品</span>
                      {activity.pendingCount > 0 ? (
                        <span className="rounded-full bg-peach px-1.5 text-peach-foreground">
                          {activity.pendingCount} 待审
                        </span>
                      ) : null}
                    </p>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="space-y-4">
            {selected ? (
              <section className="space-y-3 rounded-3xl bg-white/60 p-5 backdrop-blur-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-foreground">{selected.title}</h2>
                  <Badge className={selected.showcaseEnabled ? STATUS_STYLE.APPROVED : STATUS_STYLE.PENDING}>
                    {selected.showcaseEnabled ? "专区已开启" : "专区未开启"}
                  </Badge>
                  <Badge variant="outline">{selected.workCount} 件作品</Badge>
                  <Badge variant="outline">{selected.categoryCount} 个分类</Badge>
                  {selected.pendingCount > 0 ? (
                    <Badge className={STATUS_STYLE.PENDING}>{selected.pendingCount} 件待审核</Badge>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  提交截止：{formatDateTime(selected.submissionDeadline ?? selected.endAt)} · 报名人数{" "}
                  {selected.registrationCount}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={selected.showcaseEnabled ? "outline" : "default"}
                    disabled={busy}
                    onClick={() =>
                      guard(() =>
                        setShowcaseEnabled.mutateAsync({
                          activityId: selected.id,
                          enabled: !selected.showcaseEnabled,
                        }),
                      )
                    }
                  >
                    {selected.showcaseEnabled ? "关闭作品专区" : "开启作品专区"}
                  </Button>
                  <Button
                    size="sm"
                    variant="subtle"
                    disabled={runReminder.isPending}
                    className="gap-1.5"
                    onClick={async () => {
                      setError(null);
                      try {
                        const result = await runReminder.mutateAsync({ activityId: selected.id });
                        setReminderResult(
                          `本次新增 ${result.created} 条提醒，幂等跳过 ${result.skipped} 条；邮件模拟发送 ${result.mail.simulated} 封。`,
                        );
                      } catch (reminderError) {
                        setError(reminderError instanceof Error ? reminderError.message : "提醒执行失败");
                      }
                    }}
                  >
                    {runReminder.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AlarmClock className="h-3.5 w-3.5" />}
                    立即执行提醒扫描
                  </Button>
                  <Link
                    href={`/activities/${selected.id}/works`}
                    className={buttonClass({ variant: "ghost", size: "sm" })}
                  >
                    查看公开专区
                  </Link>
                </div>
                {reminderResult ? (
                  <p className="rounded-2xl bg-primary-soft/60 px-3 py-2 text-xs leading-5 text-primary">{reminderResult}</p>
                ) : null}
                {error ? (
                  <p className="rounded-2xl bg-[#FFE9E4] px-3 py-2 text-xs leading-5 text-[#C4473A]">{error}</p>
                ) : null}
              </section>
            ) : null}

            <section className="space-y-3 rounded-3xl bg-white/60 p-5 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">作品分类管理</h3>
                <span className="text-xs text-muted-foreground">共 {categories.length} 个</span>
              </div>

              <div className="space-y-2">
                {categories.length === 0 ? (
                  <p className="rounded-2xl bg-muted/40 px-4 py-4 text-center text-xs text-muted-foreground">
                    还没有分类，添加后作品提交页与展示页会同步出现分类筛选。
                  </p>
                ) : (
                  categories.map((category) => {
                    const draft = categoryDrafts[category.id] ?? {
                      name: category.name,
                      sortOrder: String(category.sortOrder),
                    };
                    return (
                      <div key={category.id} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_100px_auto]">
                        <Input
                          value={draft.name}
                          maxLength={20}
                          onChange={(event) =>
                            setCategoryDrafts((prev) => ({
                              ...prev,
                              [category.id]: { ...draft, name: event.target.value },
                            }))
                          }
                        />
                        <Input
                          type="number"
                          min={0}
                          max={999}
                          value={draft.sortOrder}
                          onChange={(event) =>
                            setCategoryDrafts((prev) => ({
                              ...prev,
                              [category.id]: { ...draft, sortOrder: event.target.value },
                            }))
                          }
                        />
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              guard(async () => {
                                await updateCategory.mutateAsync({
                                  id: category.id,
                                  name: draft.name.trim(),
                                  sortOrder: Number(draft.sortOrder) || 0,
                                });
                                setCategoryDrafts((prev) => {
                                  const next = { ...prev };
                                  delete next[category.id];
                                  return next;
                                });
                              })
                            }
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-destructive/30 text-destructive hover:bg-destructive/5"
                            disabled={busy}
                            onClick={() => {
                              if (!window.confirm(`确认删除分类「${category.name}」？该分类下的作品会变为未分类。`)) return;
                              void guard(() => deleteCategory.mutateAsync({ id: category.id }));
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <Input
                  value={newCategory}
                  maxLength={20}
                  placeholder="新分类名称，例如「人工智能应用」"
                  onChange={(event) => setNewCategory(event.target.value)}
                />
                <Button
                  size="sm"
                  disabled={busy || !newCategory.trim()}
                  className="gap-1"
                  onClick={() =>
                    guard(async () => {
                      await createCategory.mutateAsync({
                        activityId: selectedId,
                        name: newCategory.trim(),
                        sortOrder: categories.length,
                      });
                      setNewCategory("");
                    })
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                  添加分类
                </Button>
              </div>
            </section>

            <section className="space-y-3 rounded-3xl bg-white/60 p-5 backdrop-blur-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Images className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">作品审核与排序</h3>
                <div className="ml-auto flex flex-wrap gap-1 rounded-full bg-white/60 p-1">
                  {STATUS_TABS.map((tab) => (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => {
                        setStatus(tab.value);
                        setPage(1);
                      }}
                      className={cn(
                        "rounded-full px-3 py-1 text-[11px] transition-colors",
                        status === tab.value
                          ? "mint-gradient font-medium text-white"
                          : "text-muted-foreground hover:text-primary",
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {listQuery.isLoading ? (
                <div className="h-40 animate-pulse rounded-2xl bg-white/50" />
              ) : works.length === 0 ? (
                <p className="rounded-2xl bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
                  当前筛选下没有作品。
                </p>
              ) : (
                <div className="space-y-3">
                  {works.map((work) => {
                    const workStatus = work.status as WorkStatus;
                    const sortDraft = sortDrafts[work.id] ?? String(work.sortOrder);
                    return (
                      <div key={work.id} className="space-y-3 rounded-2xl bg-white/70 p-4">
                        <div className="flex flex-wrap items-start gap-3">
                          <div className="h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-primary-soft/40">
                            {work.coverUrl ? (
                              <img
                                src={work.coverUrl}
                                alt={work.title}
                                loading="lazy"
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="text-sm font-medium text-foreground">{work.title}</p>
                              <Badge className={STATUS_STYLE[workStatus]}>{WORK_STATUS_LABEL[workStatus]}</Badge>
                              {work.pinned ? (
                                <Badge className="border-primary/20 bg-primary-soft text-primary">
                                  <Pin className="mr-0.5 h-3 w-3" />
                                  置顶
                                </Badge>
                              ) : null}
                              {work.featured ? (
                                <Badge className="border-amber-200 bg-amber-50 text-amber-700">
                                  <Star className="mr-0.5 h-3 w-3" />
                                  精选
                                </Badge>
                              ) : null}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {work.authorName} · {work.categoryName} · 提交于 {formatDateTime(work.createdAt)}
                            </p>
                            <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">{work.excerpt}</p>
                            {work.reviewNote ? (
                              <p className="text-[11px] text-rose-600">审核备注：{work.reviewNote}</p>
                            ) : null}
                          </div>
                          <Link
                            href={`/activities/${work.activityId}/works/${work.id}`}
                            className={buttonClass({ variant: "ghost", size: "sm" })}
                          >
                            预览
                          </Link>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Input
                            value={notes[work.id] ?? ""}
                            maxLength={200}
                            placeholder="驳回原因（至少 5 个字）；通过可留空"
                            className="h-9 min-w-[220px] flex-1"
                            onChange={(event) => setNotes((prev) => ({ ...prev, [work.id]: event.target.value }))}
                          />
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              guard(() =>
                                reviewMutation.mutateAsync({
                                  id: work.id,
                                  action: "APPROVED",
                                  note: notes[work.id]?.trim() || undefined,
                                }),
                              )
                            }
                          >
                            通过
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-destructive/30 text-destructive hover:bg-destructive/5"
                            disabled={busy}
                            onClick={() =>
                              guard(() =>
                                reviewMutation.mutateAsync({
                                  id: work.id,
                                  action: "REJECTED",
                                  note: notes[work.id]?.trim() || undefined,
                                }),
                              )
                            }
                          >
                            驳回
                          </Button>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 border-t border-dashed border-primary/15 pt-2 text-[11px] text-muted-foreground">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              guard(() => toggleFeatured.mutateAsync({ id: work.id, featured: !work.featured }))
                            }
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors",
                              work.featured ? "bg-amber-50 text-amber-700" : "bg-white/70 hover:text-primary",
                            )}
                          >
                            <Star className="h-3 w-3" />
                            {work.featured ? "取消精选" : "设为精选"}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => guard(() => togglePinned.mutateAsync({ id: work.id, pinned: !work.pinned }))}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors",
                              work.pinned ? "bg-primary-soft text-primary" : "bg-white/70 hover:text-primary",
                            )}
                          >
                            <Pin className="h-3 w-3" />
                            {work.pinned ? "取消置顶" : "置顶"}
                          </button>
                          <span className="inline-flex items-center gap-1">
                            排序
                            <Input
                              type="number"
                              min={0}
                              max={9999}
                              value={sortDraft}
                              className="h-7 w-20 text-xs"
                              onChange={(event) =>
                                setSortDrafts((prev) => ({ ...prev, [work.id]: event.target.value }))
                              }
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() =>
                                guard(async () => {
                                  await updateSort.mutateAsync({ id: work.id, sortOrder: Number(sortDraft) || 0 });
                                  setSortDrafts((prev) => {
                                    const next = { ...prev };
                                    delete next[work.id];
                                    return next;
                                  });
                                })
                              }
                            >
                              保存
                            </Button>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <Pagination
                page={listQuery.data?.page ?? 1}
                totalPages={listQuery.data?.totalPages ?? 1}
                total={listQuery.data?.total}
                onChange={setPage}
              />
            </section>

            {overviewQuery.data ? (
              <p className="text-[11px] leading-5 text-muted-foreground">
                提醒阶段：{" "}
                {Object.entries(REMINDER_STAGE_LABEL)
                  .map(([key, label]) => `${key} ${label}`)
                  .join(" · ")}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
