"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ExternalLink, Flame, Loader2, Plus, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

export default function AdminHotActivityPage() {
  const utils = api.useUtils();
  const meQuery = api.auth.me.useQuery();
  const isAdmin = Boolean(meQuery.data?.isAdmin);
  const listQuery = api.hotActivity.adminList.useQuery(undefined, { enabled: isAdmin });
  const candidatesQuery = api.hotActivity.candidates.useQuery(undefined, { enabled: isAdmin });
  const addInternal = api.hotActivity.addInternal.useMutation();
  const addExternal = api.hotActivity.addExternal.useMutation();
  const reorder = api.hotActivity.reorder.useMutation();
  const remove = api.hotActivity.remove.useMutation();

  const [activityId, setActivityId] = useState("");
  const [openExternal, setOpenExternal] = useState(false);
  const [extTitle, setExtTitle] = useState("");
  const [extUrl, setExtUrl] = useState("");
  const [extCover, setExtCover] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    await Promise.all([utils.hotActivity.adminList.invalidate(), utils.hotActivity.list.invalidate(), utils.hotActivity.candidates.invalidate()]);
  };

  if (!meQuery.isLoading && !isAdmin) {
    return (
      <div className="space-y-4">
        <PageHeader title="首页热门活动" description="仅管理员可配置首页热门活动池。" />
        <EmptyState
          icon={<Flame className="h-5 w-5" />}
          title="无权访问"
          description="热门活动池由平台管理员统一维护，教师与学生可正常浏览首页热门活动。"
        />
      </div>
    );
  }

  const items = listQuery.data?.items ?? [];
  const candidates = candidatesQuery.data ?? [];
  const max = listQuery.data?.max ?? 8;

  const move = async (index: number, direction: -1 | 1) => {
    const next = [...items];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    try {
      await reorder.mutateAsync({ ids: next.map((item) => item.id) });
      await refresh();
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : "调整顺序失败");
    }
  };

  const handleAddInternal = async () => {
    if (!activityId) {
      setError("请选择要加入热门池的活动");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await addInternal.mutateAsync({ activityId });
      setActivityId("");
      await refresh();
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "加入失败");
    } finally {
      setBusy(false);
    }
  };

  const handleAddExternal = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await addExternal.mutateAsync({
        title: extTitle.trim(),
        externalUrl: extUrl.trim(),
        coverUrl: extCover.trim() || undefined,
      });
      setOpenExternal(false);
      setExtTitle("");
      setExtUrl("");
      setExtCover("");
      await refresh();
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "添加失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="首页热门活动"
        description={`从活动广场挑选活动置顶到首页，也可录入外部活动链接；最多 ${max} 条，顺序即展示顺序。`}
      />

      <section className="space-y-3 rounded-3xl bg-white/55 p-4">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
          <Select
            value={activityId || "NONE"}
            onChange={(value) => setActivityId(value === "NONE" ? "" : value)}
            options={[
              { value: "NONE", label: candidates.length ? "选择报名中的公开活动" : "暂无可加入的公开活动" },
              ...candidates.map((activity) => ({ value: activity.id, label: activity.title })),
            ]}
            ariaLabel="选择内部活动"
          />
          <Button onClick={handleAddInternal} disabled={busy || !activityId} className="gap-1.5">
            <Plus className="h-4 w-4" />
            加入热门池
          </Button>
          <Button variant="outline" onClick={() => setOpenExternal(true)} className="gap-1.5">
            <ExternalLink className="h-4 w-4" />
            录入外部活动
          </Button>
        </div>
        {error ? <p className="rounded-2xl bg-[#FFE9E4] px-4 py-2.5 text-xs text-[#C4473A]">{error}</p> : null}
      </section>

      {listQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-3xl bg-white/50" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Flame className="h-5 w-5" />}
          title="热门池还是空的"
          description="从上方选择活动或录入外部链接，首页「近期热门活动」会立即展示。"
        />
      ) : (
        <div className="space-y-2.5">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center gap-3 rounded-3xl bg-white/60 px-4 py-3 backdrop-blur-sm"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  {item.isExternal ? (
                    <span className="inline-flex items-center gap-1 text-[#7C3AED]">
                      <ExternalLink className="h-3 w-3" />
                      外部链接
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <Flame className="h-3 w-3 text-primary" />
                      站内活动 · {item.activity?.status ?? "已删除"}
                    </span>
                  )}
                  {item.activity ? <span>{item.activity.location}</span> : null}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void move(index, -1)}
                  disabled={index === 0}
                  className={cn(
                    "grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-primary-soft hover:text-primary",
                    index === 0 && "pointer-events-none opacity-30",
                  )}
                  aria-label="上移"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void move(index, 1)}
                  disabled={index === items.length - 1}
                  className={cn(
                    "grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-primary-soft hover:text-primary",
                    index === items.length - 1 && "pointer-events-none opacity-30",
                  )}
                  aria-label="下移"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-[#C4473A] hover:bg-[#FFE9E4]"
                  onClick={async () => {
                    if (!window.confirm("从首页热门池移除这条活动？")) return;
                    try {
                      await remove.mutateAsync({ id: item.id });
                      await refresh();
                    } catch (removeError) {
                      setError(removeError instanceof Error ? removeError.message : "移除失败");
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  移除
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={openExternal} onOpenChange={(next) => (!busy ? setOpenExternal(next) : null)}>
        <form onSubmit={handleAddExternal}>
          <DialogHeader
            title="录入外部活动"
            description="外部活动会在新标签页打开，平台不代管报名与名额。"
            onClose={() => !busy && setOpenExternal(false)}
          />
          <div className="space-y-4 px-6 py-5">
            <div>
              <Label htmlFor="hot-title" required>
                展示标题
              </Label>
              <Input
                id="hot-title"
                value={extTitle}
                maxLength={60}
                placeholder="例如：Trae 校园黑客松"
                onChange={(e) => setExtTitle(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="hot-url" required>
                外部链接
              </Label>
              <Input
                id="hot-url"
                value={extUrl}
                maxLength={500}
                placeholder="https:// 开头"
                onChange={(e) => setExtUrl(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="hot-cover">封面图片链接</Label>
              <Input
                id="hot-cover"
                value={extCover}
                maxLength={500}
                placeholder="https:// 开头的图片地址（选填）"
                onChange={(e) => setExtCover(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpenExternal(false)} disabled={busy}>
              取消
            </Button>
            <Button type="submit" disabled={busy} className="gap-1.5">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              添加到首页
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}
