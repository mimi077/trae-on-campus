"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, MapPin, PackageSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import {
  LOST_FOUND_CATEGORIES,
  LOST_FOUND_KIND_HINT,
  LOST_FOUND_KIND_LABEL,
  type LostFoundCategory,
  type LostFoundKind,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

function currentLocalTime() {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

type FormState = {
  kind: LostFoundKind;
  title: string;
  category: LostFoundCategory;
  location: string;
  happenedAt: string;
  description: string;
  imageUrl: string;
  contact: string;
};

function emptyForm(kind: LostFoundKind): FormState {
  return {
    kind,
    title: "",
    category: "证件卡片",
    location: "",
    happenedAt: currentLocalTime(),
    description: "",
    imageUrl: "",
    contact: "",
  };
}

export function LostFoundFormDialog({
  open,
  onOpenChange,
  defaultKind = "FOUND",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultKind?: LostFoundKind;
}) {
  const utils = api.useUtils();
  const [form, setForm] = useState<FormState>(() => emptyForm(defaultKind));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const createRecord = api.lostFound.create.useMutation();

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm(defaultKind));
    setError(null);
    setSubmitting(false);
    setSubmitted(false);
  }, [open, defaultKind]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    const title = form.title.trim();
    const location = form.location.trim();
    if (title.length < 2) {
      setError("请填写至少 2 个字的物品标题");
      return;
    }
    if (location.length < 2) {
      setError("请填写具体的丢失 / 捡到地点");
      return;
    }
    const happenedAt = new Date(form.happenedAt);
    if (Number.isNaN(happenedAt.getTime())) {
      setError("请选择有效的时间");
      return;
    }
    if (happenedAt.getTime() > Date.now() + 60_000) {
      setError("丢失 / 捡到的时间不能晚于当前时间");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await createRecord.mutateAsync({
        kind: form.kind,
        title,
        category: form.category,
        location,
        happenedAt: happenedAt.toISOString(),
        description: form.description.trim() || undefined,
        imageUrl: form.imageUrl.trim() || undefined,
        contact: form.contact.trim() || undefined,
      });
      await Promise.all([utils.lostFound.myList.invalidate(), utils.lostFound.list.invalidate()]);
      setSubmitted(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "提交失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (!submitting ? onOpenChange(next) : null)}>
      {submitted ? (
        <>
          <DialogHeader title="已提交，等待管理员审核" onClose={() => onOpenChange(false)} />
          <div className="space-y-4 px-6 py-6">
            <div className="flex items-start gap-3 rounded-2xl bg-primary-soft/70 px-4 py-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="space-y-1 text-sm">
                <p className="font-medium text-foreground">审核通过后会出现在失物招领列表</p>
                <p className="text-xs leading-5 text-muted-foreground">
                  管理员通常会在当天处理。你可以随时在「我的失物发布」查看审核状态，被驳回时会附上原因。
                </p>
              </div>
            </div>
            <p className="rounded-2xl bg-accent/50 px-4 py-3 text-xs leading-5 text-peach-foreground">
              温馨提示：公开信息中请勿填写身份证号、完整银行卡号等敏感内容；联系方式建议使用微信 / QQ。
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>知道了</Button>
          </DialogFooter>
        </>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <DialogHeader
            title="发布失物信息"
            description="选择寻物或拾物，填写物品与地点，提交后由管理员审核。"
            onClose={() => !submitting && onOpenChange(false)}
          />
          <div className="max-h-[68vh] space-y-4 overflow-y-auto px-6 py-5 scrollbar-thin">
            <div>
              <Label required>信息类型</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["FOUND", "LOST"] as const).map((kind) => {
                  const active = form.kind === kind;
                  const Icon = kind === "FOUND" ? PackageSearch : MapPin;
                  return (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => setForm({ ...form, kind })}
                      className={cn(
                        "flex flex-col gap-1 rounded-2xl px-4 py-3 text-left transition-all",
                        active
                          ? kind === "FOUND"
                            ? "mint-gradient text-white shadow-[0_14px_30px_-18px_rgba(14,143,116,0.9)]"
                            : "bg-gradient-to-br from-[#FFC9A6] to-[#FFA477] text-peach-foreground shadow-[0_14px_30px_-18px_rgba(255,164,119,0.9)]"
                          : "bg-white/60 text-muted-foreground hover:bg-white/85",
                      )}
                    >
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                        <Icon className="h-4 w-4" />
                        {LOST_FOUND_KIND_LABEL[kind]}
                      </span>
                      <span
                        className={cn(
                          "text-[11px] leading-4",
                          active ? "text-white/85" : "text-muted-foreground/80",
                          kind === "LOST" && active && "text-peach-foreground/80",
                        )}
                      >
                        {LOST_FOUND_KIND_HINT[kind]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <Label htmlFor="lf-title" required>
                物品标题
              </Label>
              <Input
                id="lf-title"
                value={form.title}
                maxLength={60}
                placeholder="例如：捡到一张校园卡 / 丢失蓝色保温杯"
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="lf-category" required>
                  物品分类
                </Label>
                <Select
                  value={form.category}
                  onChange={(value) => setForm({ ...form, category: value as LostFoundCategory })}
                  options={LOST_FOUND_CATEGORIES.map((category) => ({ value: category, label: category }))}
                  ariaLabel="物品分类"
                />
              </div>
              <div>
                <Label htmlFor="lf-time" required>
                  {form.kind === "FOUND" ? "捡到时间" : "丢失时间"}
                </Label>
                <Input
                  id="lf-time"
                  type="datetime-local"
                  value={form.happenedAt}
                  max={currentLocalTime()}
                  onChange={(e) => setForm({ ...form, happenedAt: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="lf-location" required>
                地点
              </Label>
              <Input
                id="lf-location"
                value={form.location}
                maxLength={60}
                placeholder="例如：第一食堂二楼 3 号窗口 / 图书馆三楼自习区"
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="lf-description">物品描述</Label>
              <Textarea
                id="lf-description"
                value={form.description}
                maxLength={500}
                placeholder="颜色、品牌、明显特征、目前保管在哪里等（选填，描述越具体越容易匹配）"
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="lf-image">图片链接</Label>
              <Input
                id="lf-image"
                value={form.imageUrl}
                maxLength={500}
                placeholder="https:// 开头的图片地址（选填）"
                onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="lf-contact">联系方式</Label>
              <Input
                id="lf-contact"
                value={form.contact}
                maxLength={60}
                placeholder="微信 / QQ 昵称等（选填，也可只通过留言联系）"
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
              />
            </div>

            {error ? (
              <p className="rounded-2xl bg-[#FFE9E4] px-4 py-2.5 text-sm text-[#C4473A]">{error}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              取消
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              提交审核
            </Button>
          </DialogFooter>
        </form>
      )}
    </Dialog>
  );
}
