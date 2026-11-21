"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { CATEGORIES, WISH_VALID_DAYS, type Category } from "@/lib/constants";
import { api } from "@/trpc/react";

type FormState = {
  title: string;
  category: Category;
  expectPrice: string;
  description: string;
  validDays: 7 | 14;
};

const emptyForm: FormState = {
  title: "",
  category: "书籍",
  expectPrice: "",
  description: "",
  validDays: 7,
};

export function WishFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = api.useUtils();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const createWish = api.wish.create.useMutation();

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm);
    setError(null);
    setSubmitting(false);
  }, [open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    const title = form.title.trim();
    const price = Number(form.expectPrice);
    if (!title) {
      setError("求购标题不能为空");
      return;
    }
    if (!form.expectPrice.trim() || Number.isNaN(price) || price < 0) {
      setError("请输入有效的心理预期价格（≥0）");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await createWish.mutateAsync({
        title,
        category: form.category,
        expectPrice: price,
        description: form.description.trim() || undefined,
        validDays: form.validDays,
      });
      await Promise.all([
        utils.wish.list.invalidate(),
        utils.wish.myWishes.invalidate(),
      ]);
      onOpenChange(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "提交失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (!submitting ? onOpenChange(next) : null)}>
      <form onSubmit={handleSubmit} noValidate>
        <DialogHeader
          title="发布求购心愿"
          description="告诉全校同学你在找什么，有效期结束后自动归档，历史会话仍会保留。"
          onClose={() => !submitting && onOpenChange(false)}
        />
        <div className="space-y-4 px-6 py-5">
          <div>
            <Label htmlFor="wish-title" required>
              求购标题
            </Label>
            <Input
              id="wish-title"
              value={form.title}
              maxLength={60}
              placeholder="例如：求购考研政治全套资料"
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="wish-category" required>
                分类
              </Label>
              <Select
                value={form.category}
                onChange={(value) => setForm({ ...form, category: value as Category })}
                options={CATEGORIES.map((category) => ({ value: category, label: category }))}
                ariaLabel="分类"
              />
            </div>
            <div>
              <Label htmlFor="wish-price" required>
                心理预期价格（元）
              </Label>
              <Input
                id="wish-price"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                placeholder="0"
                value={form.expectPrice}
                onChange={(e) => setForm({ ...form, expectPrice: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="wish-valid">有效期</Label>
            <Select
              value={String(form.validDays)}
              onChange={(value) => setForm({ ...form, validDays: Number(value) === 14 ? 14 : 7 })}
              options={WISH_VALID_DAYS.map((days) => ({ value: String(days), label: `${days} 天` }))}
              ariaLabel="有效期"
            />
          </div>

          <div>
            <Label htmlFor="wish-description">需求描述</Label>
            <Textarea
              id="wish-description"
              value={form.description}
              maxLength={500}
              placeholder="成色、预算范围、交易方式等（选填）"
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          {error ? (
            <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            取消
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            提交心愿
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
