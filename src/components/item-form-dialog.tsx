"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import {
  BARGAIN_MODES,
  CATEGORIES,
  DEAL_TAGS,
  DEAL_TAG_HINT,
  ITEM_EXPIRE_DAYS,
  SCENE_TAGS,
  type BargainMode,
  type Category,
  type DealTag,
  type SceneTag,
} from "@/lib/constants";
import { AI_DISCLAIMER, AI_IMAGE_MAX_BYTES, formatPriceRange } from "@/lib/rules/ai";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";

export type EditableItem = {
  id: string;
  title: string;
  category: string;
  price: number;
  description: string | null;
  imageUrl: string | null;
  status?: string;
  sceneTags?: string[];
  dealTags?: string[];
  isGift?: boolean;
  bargainMode?: string;
  isbn?: string | null;
};

type FormState = {
  title: string;
  category: Category;
  price: string;
  description: string;
  imageUrl: string;
  sceneTags: SceneTag[];
  dealTags: DealTag[];
  isGift: boolean;
  bargainMode: BargainMode;
  isbn: string;
};

const emptyForm: FormState = {
  title: "",
  category: "数码",
  price: "",
  description: "",
  imageUrl: "",
  sceneTags: [],
  dealTags: [],
  isGift: false,
  bargainMode: "FREE_BARGAIN",
  isbn: "",
};

function toForm(item?: EditableItem | null): FormState {
  if (!item) return emptyForm;
  return {
    title: item.title,
    category: (CATEGORIES as readonly string[]).includes(item.category)
      ? (item.category as Category)
      : "其他",
    price: String(item.price),
    description: item.description ?? "",
    imageUrl: item.imageUrl ?? "",
    sceneTags: (item.sceneTags ?? []).filter((tag): tag is SceneTag =>
      (SCENE_TAGS as readonly string[]).includes(tag),
    ),
    dealTags: (item.dealTags ?? []).filter((tag): tag is DealTag =>
      (DEAL_TAGS as readonly string[]).includes(tag),
    ),
    isGift: Boolean(item.isGift),
    bargainMode: item.bargainMode === "SILENT_BID" ? "SILENT_BID" : "FREE_BARGAIN",
    isbn: item.isbn ?? "",
  };
}

export function ItemFormDialog({
  open,
  onOpenChange,
  mode,
  item,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  item?: EditableItem | null;
}) {
  const utils = api.useUtils();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<{ title?: string; price?: string; imageUrl?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /** ===== 附加创新：图片 AI 润色简介 + 参考定价（不落库，不影响手动发布） ===== */
  const aiFileInputRef = useRef<HTMLInputElement | null>(null);
  const [aiImageDataUrl, setAiImageDataUrl] = useState<string | null>(null);
  const [aiFileName, setAiFileName] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState<{ priceMin: number; priceMax: number } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const aiStatusQuery = api.ai.status.useQuery(undefined, { staleTime: 5 * 60_000 });
  const aiMutation = api.ai.analyzeItemImage.useMutation();
  const aiEnabled = aiStatusQuery.data?.enabled ?? false;

  useEffect(() => {
    if (!open) return;
    setForm(toForm(item));
    setErrors({});
    setSubmitError(null);
    setSubmitting(false);
    setAiImageDataUrl(null);
    setAiFileName("");
    setAiSuggestion(null);
    setAiError(null);
    if (aiFileInputRef.current) aiFileInputRef.current.value = "";
  }, [open, item]);

  const createMutation = api.item.create.useMutation();
  const updateMutation = api.item.update.useMutation();

  const invalidateAll = async () => {
    await Promise.all([
      utils.item.list.invalidate(),
      utils.item.myItems.invalidate(),
      utils.item.byId.invalidate(),
      utils.favorite.list.invalidate(),
      utils.intentFavorite.list.invalidate(),
      utils.gift.myGiven.invalidate(),
    ]);
  };

  const handleAiFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setAiError(null);
    setAiSuggestion(null);

    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      setAiImageDataUrl(null);
      setAiFileName("");
      setAiError("请上传 PNG / JPG / WebP 格式的图片");
      return;
    }
    if (file.size > AI_IMAGE_MAX_BYTES) {
      setAiImageDataUrl(null);
      setAiFileName("");
      setAiError(`图片不能超过 ${Math.round(AI_IMAGE_MAX_BYTES / 1024 / 1024)}MB，请压缩后重试`);
      return;
    }

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
        reader.onerror = () => reject(reader.error ?? new Error("read failed"));
        reader.readAsDataURL(file);
      });
      if (!dataUrl) throw new Error("empty");
      setAiImageDataUrl(dataUrl);
      setAiFileName(file.name);
    } catch {
      setAiImageDataUrl(null);
      setAiFileName("");
      setAiError("图片读取失败，请重新选择");
    }
  };

  const clearAiImage = () => {
    setAiImageDataUrl(null);
    setAiFileName("");
    setAiSuggestion(null);
    setAiError(null);
    if (aiFileInputRef.current) aiFileInputRef.current.value = "";
  };

  const handleAiAnalyze = async () => {
    if (!aiImageDataUrl || aiMutation.isPending) return;
    setAiError(null);
    try {
      const result = await aiMutation.mutateAsync({
        imageBase64: aiImageDataUrl,
        title: form.title.trim() || undefined,
        category: form.category,
      });
      setForm((prev) => ({ ...prev, description: result.suggestDesc }));
      setAiSuggestion({ priceMin: result.priceMin, priceMax: result.priceMax });
    } catch (error) {
      setAiSuggestion(null);
      setAiError(error instanceof Error ? error.message : "AI 解析暂时不可用，请手动填写商品信息");
    }
  };

  const toggleTag = (tag: SceneTag) => {    setForm((prev) => ({
      ...prev,
      sceneTags: prev.sceneTags.includes(tag)
        ? prev.sceneTags.filter((value) => value !== tag)
        : [...prev.sceneTags, tag],
    }));
  };

  const toggleDealTag = (tag: DealTag) => {
    setForm((prev) => ({
      ...prev,
      dealTags: prev.dealTags.includes(tag)
        ? prev.dealTags.filter((value) => value !== tag)
        : [...prev.dealTags, tag],
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    const nextErrors: typeof errors = {};
    const title = form.title.trim();
    const priceValue = form.isGift ? 0 : Number(form.price);

    if (!title) nextErrors.title = "标题不能为空";
    else if (title.length > 60) nextErrors.title = "标题最多 60 个字符";

    if (!form.isGift) {
      if (form.price.trim() === "" || Number.isNaN(priceValue)) {
        nextErrors.price = "请输入有效的售价（允许 0 元）";
      } else if (priceValue < 0) {
        nextErrors.price = "价格不能为负数";
      }
    }

    const imageUrl = form.imageUrl.trim();
    if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
      nextErrors.imageUrl = "图片链接需以 http(s):// 开头";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = {
        title,
        category: form.category,
        price: priceValue,
        description: form.description.trim() || undefined,
        imageUrl: imageUrl || undefined,
        sceneTags: form.sceneTags,
        dealTags: form.dealTags,
        isGift: form.isGift,
        bargainMode: form.bargainMode,
        isbn: form.isbn.trim() || undefined,
      };

      if (mode === "create") {
        await createMutation.mutateAsync(payload);
      } else if (item) {
        await updateMutation.mutateAsync({ id: item.id, ...payload });
      }

      await invalidateAll();
      onOpenChange(false);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "提交失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (!submitting ? onOpenChange(next) : null)}>
      <form onSubmit={handleSubmit} noValidate>
        <DialogHeader
          title={mode === "create" ? "发布闲置" : "编辑闲置"}
          description={
            mode === "create"
              ? `填写物品信息后发布到闲置广场。上架 ${ITEM_EXPIRE_DAYS} 天内有效，到期会自动下架并提醒你重新上架。`
              : "商品状态不会被编辑修改，已下架或已到期商品请先在「我的发布」中处理。"
          }
          onClose={() => !submitting && onOpenChange(false)}
        />

        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5">
          <div>
            <Label htmlFor="item-title" required>
              标题
            </Label>
            <Input
              id="item-title"
              value={form.title}
              placeholder="例如：iPad Air 5 64G 深空灰"
              maxLength={60}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              aria-invalid={Boolean(errors.title)}
              className={errors.title ? "border-destructive focus:border-destructive" : ""}
            />
            {errors.title ? <p className="mt-1 text-xs text-destructive">{errors.title}</p> : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="item-category" required>
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
              <Label htmlFor="item-price" required>
                售价（元）
              </Label>
              <Input
                id="item-price"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                placeholder="0"
                value={form.isGift ? "0" : form.price}
                disabled={form.isGift}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                aria-invalid={Boolean(errors.price)}
                className={errors.price ? "border-destructive focus:border-destructive" : ""}
              />
              {form.isGift ? (
                <p className="mt-1 text-xs text-primary">善意赠予已开启，售价锁定为 0 元</p>
              ) : errors.price ? (
                <p className="mt-1 text-xs text-destructive">{errors.price}</p>
              ) : null}
              {aiSuggestion ? (
                <span className="mt-1.5 inline-flex items-center rounded-full bg-[#F0E7FF] px-2.5 py-1 text-[11px] font-medium text-[#7C3AED]">
                  💡AI参考价格：{formatPriceRange(aiSuggestion.priceMin, aiSuggestion.priceMax)}
                </span>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="item-bargain">议价模式</Label>
              <Select
                value={form.bargainMode}
                onChange={(value) => setForm({ ...form, bargainMode: value as BargainMode })}
                options={BARGAIN_MODES.map((modeValue) => ({
                  value: modeValue,
                  label: modeValue === "FREE_BARGAIN" ? "自由议价（默认）" : "静默出价模式",
                }))}
                ariaLabel="议价模式"
              />
            </div>
            <div>
              <Label htmlFor="item-isbn">ISBN（选填）</Label>
              <Input
                id="item-isbn"
                value={form.isbn}
                placeholder="书籍类可填写 ISBN"
                maxLength={32}
                onChange={(e) => setForm({ ...form, isbn: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label>一键流转标签（可多选）</Label>
            <div className="flex flex-wrap gap-2">
              {DEAL_TAGS.map((tag) => {
                const active = form.dealTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    title={DEAL_TAG_HINT[tag]}
                    onClick={() => toggleDealTag(tag)}
                    className={cn(
                      "rounded-full px-3.5 py-1.5 text-xs transition-all active:scale-[0.97]",
                      active
                        ? "mint-gradient font-medium text-white shadow-[0_10px_20px_-14px_rgba(14,143,116,0.9)]"
                        : "bg-white/60 text-muted-foreground hover:bg-gradient-to-r hover:from-primary-soft/80 hover:to-accent/60 hover:text-primary",
                    )}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              例：急出 + 可小刀；教材可以选择「可换物」方便以书换书。
            </p>
          </div>

          <div>
            <Label>校园场景标签（可多选）</Label>
            <div className="flex flex-wrap gap-2">
              {SCENE_TAGS.map((tag) => {
                const active = form.sceneTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={cn(
                      "rounded-full px-3.5 py-1.5 text-xs transition-all active:scale-[0.97]",
                      active
                        ? "bg-primary-soft font-medium text-primary"
                        : "bg-white/60 text-muted-foreground hover:bg-primary-soft/70 hover:text-primary",
                    )}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-primary-soft/60 px-3 py-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[#2FBFA0]"
              checked={form.isGift}
              onChange={(e) => setForm({ ...form, isGift: e.target.checked })}
            />
            <span className="space-y-0.5">
              <span className="block text-sm font-medium text-foreground">开启善意赠予</span>
              <span className="block text-xs text-muted-foreground">
                开启后售价强制为 0 元，他人可提交善意认可；后端会再次校验价格。
              </span>
            </span>
          </label>

          <div>
            <Label htmlFor="item-description">物品描述</Label>
            <Textarea
              id="item-description"
              value={form.description}
              maxLength={500}
              placeholder="新旧程度、使用时长、交易方式等（选填）"
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="item-image">图片链接</Label>
            <Input
              id="item-image"
              value={form.imageUrl}
              placeholder="https://example.com/photo.jpg（选填）"
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              aria-invalid={Boolean(errors.imageUrl)}
              className={errors.imageUrl ? "border-destructive focus:border-destructive" : ""}
            />
            {errors.imageUrl ? (
              <p className="mt-1 text-xs text-destructive">{errors.imageUrl}</p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">MVP 阶段仅支持粘贴图片链接，不提供文件上传</p>
            )}
          </div>

          <div className="space-y-3 rounded-2xl border border-dashed border-primary/25 bg-primary-soft/35 p-3.5">
            <div className="flex items-start gap-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/70 text-primary">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <div>
                <p className="text-xs font-medium text-foreground">AI 润色简介与参考定价（附加功能）</p>
                <p className="text-[11px] leading-5 text-muted-foreground">
                  选择物品图片后手动触发解析；图片仅用于本次分析，不保存、不影响手动发布。
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="cursor-pointer rounded-full border border-primary/20 bg-white/70 px-3 py-1.5 text-xs text-primary transition-colors hover:bg-white">
                选择图片
                <input
                  ref={aiFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(event) => void handleAiFileChange(event)}
                />
              </label>
              {aiImageDataUrl ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-white/70 p-1 pr-2 text-[11px] text-muted-foreground">
                  {/* 本地预览图不参与发布，仅用于确认分析对象 */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={aiImageDataUrl} alt="待分析物品图片" className="h-7 w-7 rounded-full object-cover" />
                  <span className="max-w-[140px] truncate">{aiFileName}</span>
                  <button
                    type="button"
                    onClick={clearAiImage}
                    aria-label="移除待分析图片"
                    className="text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ) : null}
            </div>

            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full gap-1.5"
              disabled={!aiImageDataUrl || aiMutation.isPending}
              onClick={() => void handleAiAnalyze()}
            >
              {aiMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {aiMutation.isPending ? "AI正在分析物品图片，请稍候…" : "使用 AI 解析图片生成简介与价格参考"}
            </Button>

            {!aiStatusQuery.isLoading && !aiEnabled ? (
              <p className="rounded-xl bg-white/60 px-3 py-2 text-[11px] text-muted-foreground">
                当前环境未配置 AI 服务，可继续手动填写商品信息完成发布。
              </p>
            ) : null}

            {aiError ? (
              <p className="rounded-xl bg-[#FFE9E4] px-3 py-2 text-[11px] text-[#C4473A]">{aiError}</p>
            ) : null}

            {aiSuggestion ? (
              <p className="text-[11px] leading-5 text-primary">
                已生成简介并回填到「物品描述」，参考价格 {formatPriceRange(aiSuggestion.priceMin, aiSuggestion.priceMax)}
                仅作提示，请手动填写售价。
              </p>
            ) : null}

            <p className="text-[11px] leading-5 text-muted-foreground">⚠️{AI_DISCLAIMER}</p>
          </div>

          {submitError ? (
            <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {submitError}
            </p>
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
            {mode === "create" ? "发布" : "保存修改"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
