"use client";

import { useState } from "react";
import { Clock, Loader2, Megaphone, Pencil, Plus, Trash2, Users } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader, Pagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { COLLEGES, GRADES } from "@/lib/constants";
import { cn, formatDateTime } from "@/lib/utils";
import { api } from "@/trpc/react";

type FormState = {
  title: string;
  dept: string;
  content: string;
  publishAt: string;
  targetCollege: string;
  targetGrade: string;
  targetMajor: string;
  targetClass: string;
};

type AdminNoticeItem = {
  id: string;
  title: string;
  dept: string;
  content: string;
  publishAt: Date | string;
  createdAt: Date | string;
  isActive: boolean;
  isTargeted: boolean;
  isScheduled: boolean;
  targetCollege: string | null;
  targetGrade: string | null;
  targetMajor: string | null;
  targetClass: string | null;
  creatorName: string;
};

function emptyForm(): FormState {
  return {
    title: "",
    dept: "",
    content: "",
    publishAt: "",
    targetCollege: "",
    targetGrade: "",
    targetMajor: "",
    targetClass: "",
  };
}

/** Date → datetime-local 输入框需要的本地时间字符串 */
function toLocalInput(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const pad = (input: number) => String(input).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
}

export default function AdminNoticesPage() {
  const utils = api.useUtils();
  const meQuery = api.auth.me.useQuery();
  const isAdmin = Boolean(meQuery.data?.isAdmin);
  const [page, setPage] = useState(1);
  const listQuery = api.notice.adminList.useQuery({ page, pageSize: 10 });
  const createNotice = api.notice.create.useMutation();
  const updateNotice = api.notice.update.useMutation();
  const removeNotice = api.notice.remove.useMutation();

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setError(null);
    setOpen(true);
  };

  const openEdit = (notice: AdminNoticeItem) => {
    setEditingId(notice.id);
    setForm({
      title: notice.title,
      dept: notice.dept,
      content: notice.content,
      publishAt: toLocalInput(notice.publishAt),
      targetCollege: notice.targetCollege ?? "",
      targetGrade: notice.targetGrade ?? "",
      targetMajor: notice.targetMajor ?? "",
      targetClass: notice.targetClass ?? "",
    });
    setError(null);
    setOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        title: form.title.trim(),
        dept: form.dept.trim(),
        content: form.content.trim(),
        publishAt: form.publishAt ? new Date(form.publishAt) : undefined,
        targetCollege: form.targetCollege || undefined,
        targetGrade: form.targetGrade || undefined,
        targetMajor: form.targetMajor.trim() || undefined,
        targetClass: form.targetClass.trim() || undefined,
      };
      if (editingId) {
        await updateNotice.mutateAsync({ id: editingId, ...payload });
      } else {
        await createNotice.mutateAsync(payload);
      }
      await Promise.all([
        utils.notice.adminList.invalidate(),
        utils.notice.list.invalidate(),
        utils.notice.latest.invalidate(),
        utils.notice.unreadCount.invalidate(),
      ]);
      setOpen(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "保存失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (id: string) => {
    if (!window.confirm("确认下架这条通知？下架后学生将不再看到。")) return;
    try {
      await removeNotice.mutateAsync({ id });
      await Promise.all([
        utils.notice.adminList.invalidate(),
        utils.notice.list.invalidate(),
        utils.notice.latest.invalidate(),
        utils.notice.unreadCount.invalidate(),
      ]);
    } catch (removeError) {
      window.alert(removeError instanceof Error ? removeError.message : "下架失败，请稍后重试");
    }
  };

  const items = (listQuery.data?.items ?? []) as AdminNoticeItem[];

  return (
    <div className="space-y-5">
      <PageHeader
        title="通知管理"
        description={
          isAdmin
            ? "发布全员通知，或按学院 / 年级 / 专业 / 班级定向送达；可编辑发布时间，下架后学生立即不可见。"
            : "教师可发布并编辑自己发布的行政通知，支持设置发布时间；定向通知需由管理员发布。"
        }
        actions={
          <Button onClick={openCreate} className="gap-1.5">
            <Plus className="h-4 w-4" />
            发布通知
          </Button>
        }
      />

      {listQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-3xl bg-white/50" />
          ))}
        </div>
      ) : listQuery.isError ? (
        <EmptyState
          icon={<Megaphone className="h-5 w-5" />}
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
          icon={<Megaphone className="h-5 w-5" />}
          title="还没有通知"
          description="发布第一条通知，让同学在首页与通知中心看到。"
          action={<Button onClick={openCreate}>发布通知</Button>}
        />
      ) : (
        <>
          <div className="space-y-3">
            {items.map((notice) => (
              <div key={notice.id} className="rounded-3xl bg-white/60 p-4 backdrop-blur-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-medium text-foreground">{notice.title}</h3>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px]",
                          notice.isTargeted ? "bg-[#F0E7FF] text-[#7C3AED]" : "bg-primary-soft/80 text-primary",
                        )}
                      >
                        {notice.isTargeted ? "定向通知" : "全员通知"}
                      </span>
                      {notice.isScheduled ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">
                          <Clock className="h-3 w-3" />
                          定时发布
                        </span>
                      ) : null}
                      {!notice.isActive ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">已下架</span>
                      ) : null}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{notice.content}</p>
                    <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span>{notice.dept}</span>
                      <span>发布人：{notice.creatorName}</span>
                      <span>发布时间：{formatDateTime(notice.publishAt)}</span>
                      <span>创建于 {formatDateTime(notice.createdAt)}</span>
                      {notice.isTargeted ? (
                        <span className="inline-flex items-center gap-1 text-[#7C3AED]">
                          <Users className="h-3 w-3" />
                          {[notice.targetCollege, notice.targetGrade, notice.targetMajor, notice.targetClass]
                            .filter(Boolean)
                            .join(" / ")}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {notice.isActive ? (
                      <Button variant="ghost" size="sm" onClick={() => openEdit(notice)} className="gap-1 text-primary">
                        <Pencil className="h-3.5 w-3.5" />
                        编辑
                      </Button>
                    ) : null}
                    {isAdmin && notice.isActive ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleRemove(notice.id)}
                        className="gap-1 text-[#C4473A] hover:bg-[#FFE9E4]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        下架
                      </Button>
                    ) : null}
                  </div>
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

      <Dialog open={open} onOpenChange={(next) => (!submitting ? setOpen(next) : null)}>
        <form onSubmit={handleSubmit}>
          <DialogHeader
            title={editingId ? "编辑行政通知" : "发布行政通知"}
            description={
              isAdmin
                ? "不填写筛选条件即为全员通知；填写后仅身份全部匹配的学生可见。"
                : "教师发布的通知默认面向全校学生，不可设置定向条件；可随时修改标题、正文与发布时间。"
            }
            onClose={() => !submitting && setOpen(false)}
          />
          <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5 scrollbar-thin">
            <div>
              <Label htmlFor="notice-title" required>
                通知标题
              </Label>
              <Input
                id="notice-title"
                value={form.title}
                maxLength={80}
                placeholder="例如：师范1234班本周教学技能训练安排"
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="notice-dept" required>
                发布部门
              </Label>
              <Input
                id="notice-dept"
                value={form.dept}
                maxLength={30}
                placeholder="例如：学生事务中心 / 数学与统计学院"
                onChange={(e) => setForm({ ...form, dept: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="notice-publishAt">发布时间</Label>
              <Input
                id="notice-publishAt"
                type="datetime-local"
                value={form.publishAt}
                onChange={(e) => setForm({ ...form, publishAt: e.target.value })}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                留空表示立即发布；设置为未来时间则到点后才出现在学生消息栏与通知中心。
              </p>
            </div>

            <div>
              <Label htmlFor="notice-content" required>
                通知正文
              </Label>
              <Textarea
                id="notice-content"
                value={form.content}
                maxLength={3000}
                placeholder="时间、地点、需要携带的材料与联系人等"
                onChange={(e) => setForm({ ...form, content: e.target.value })}
              />
            </div>

            {isAdmin ? (
              <div className="space-y-3 rounded-2xl bg-white/50 p-3.5">
                <p className="text-xs font-medium text-foreground">定向筛选（选填，全部留空 = 全员通知）</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>学院</Label>
                    <Select
                      value={form.targetCollege || "ALL"}
                      onChange={(value) => setForm({ ...form, targetCollege: value === "ALL" ? "" : value })}
                      options={[{ value: "ALL", label: "不限学院" }, ...COLLEGES.map((item) => ({ value: item, label: item }))]}
                      ariaLabel="定向学院"
                    />
                  </div>
                  <div>
                    <Label>年级</Label>
                    <Select
                      value={form.targetGrade || "ALL"}
                      onChange={(value) => setForm({ ...form, targetGrade: value === "ALL" ? "" : value })}
                      options={[{ value: "ALL", label: "不限年级" }, ...GRADES.map((item) => ({ value: item, label: item }))]}
                      ariaLabel="定向年级"
                    />
                  </div>
                  <div>
                    <Label htmlFor="notice-major">专业</Label>
                    <Input
                      id="notice-major"
                      value={form.targetMajor}
                      placeholder="留空不限"
                      onChange={(e) => setForm({ ...form, targetMajor: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="notice-class">班级</Label>
                    <Input
                      id="notice-class"
                      value={form.targetClass}
                      placeholder="例如：师范1234班"
                      onChange={(e) => setForm({ ...form, targetClass: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {error ? (
              <p className="rounded-2xl bg-[#FFE9E4] px-4 py-2.5 text-sm text-[#C4473A]">{error}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              取消
            </Button>
            <Button type="submit" disabled={submitting} className="gap-1.5">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
              {editingId ? "保存修改" : "发布通知"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}
