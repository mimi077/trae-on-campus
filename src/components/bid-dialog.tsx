"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { BID_STATUS_LABEL, type BidStatus } from "@/lib/constants";
import { formatPrice } from "@/lib/utils";
import { api } from "@/trpc/react";

export function BidDialog({
  open,
  onOpenChange,
  itemId,
  itemTitle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  itemTitle: string;
}) {
  const utils = api.useUtils();
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{ price: number; status: string } | null>(null);

  const myBidQuery = api.bid.myBidForItem.useQuery({ itemId }, { enabled: open });
  const submitBid = api.bid.submit.useMutation();

  useEffect(() => {
    if (!open) return;
    setPrice("");
    setError(null);
    setSubmitted(null);
  }, [open]);

  const current = submitted ?? myBidQuery.data ?? null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitBid.isPending) return;
    const value = Number(price);
    if (price.trim() === "" || Number.isNaN(value) || value < 0) {
      setError("请输入有效的出价金额（≥0）");
      return;
    }
    setError(null);
    try {
      const result = await submitBid.mutateAsync({ itemId, price: value });
      setSubmitted(result.bid);
      await Promise.all([
        utils.item.byId.invalidate({ id: itemId }),
        utils.bid.myBidForItem.invalidate({ itemId }),
        utils.bid.listForOwner.invalidate({ itemId }),
      ]);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "出价失败，请稍后重试");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <form onSubmit={handleSubmit}>
        <DialogHeader
          title="静默出价"
          description="同一件商品每人只能出价一次，卖家接受后即可解锁对话。"
          onClose={() => onOpenChange(false)}
        />
        <div className="space-y-3 px-6 py-5">
          <p className="text-sm font-medium text-foreground">{itemTitle}</p>
          {current ? (
            <div className="space-y-1 rounded-lg border border-primary/20 bg-primary/[0.06] px-3 py-3 text-sm">
              <p className="text-foreground">
                我的出价：<span className="font-semibold text-primary">{formatPrice(current.price)}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                状态：{BID_STATUS_LABEL[current.status as BidStatus] ?? current.status}
              </p>
              {current.status === "PENDING" ? (
                <p className="text-xs text-muted-foreground">等待卖家处理，暂不能重复出价。</p>
              ) : null}
            </div>
          ) : (
            <>
              <Label htmlFor="bid-price" required>
                出价金额（元）
              </Label>
              <Input
                id="bid-price"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="请输入你的心理价位"
              />
            </>
          )}
          {error ? (
            <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
          {current ? null : (
            <Button type="submit" disabled={submitBid.isPending} className="gap-1.5">
              {submitBid.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              提交出价
            </Button>
          )}
        </DialogFooter>
      </form>
    </Dialog>
  );
}
