"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Label, Textarea } from "@/components/ui/input";
import { api } from "@/trpc/react";

export function ReportDialog({
  open,
  onOpenChange,
  targetItemId,
  targetWishId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetItemId?: string;
  targetWishId?: string;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const createReport = api.report.create.useMutation();

  useEffect(() => {
    if (!open) return;
    setReason("");
    setError(null);
    setDone(false);
  }, [open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (createReport.isPending) return;
    if (reason.trim().length < 2) {
      setError("请填写至少 2 个字的举报理由");
      return;
    }
    setError(null);
    try {
      await createReport.mutateAsync({ targetItemId, targetWishId, reason: reason.trim() });
      setDone(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "提交失败，请稍后重试");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <form onSubmit={handleSubmit}>
        <DialogHeader
          title={done ? "举报已提交" : "提交举报"}
          description={done ? "管理员会在举报处理队列中核实并处理。" : "请如实描述问题，恶意举报会被驳回。"}
          onClose={() => onOpenChange(false)}
        />
        <div className="space-y-3 px-6 py-5">
          {done ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              举报已进入管理员待处理队列，处理结果会记录在审计日志中。
            </p>
          ) : (
            <>
              <Label htmlFor="report-reason" required>
                举报理由
              </Label>
              <Textarea
                id="report-reason"
                value={reason}
                maxLength={200}
                placeholder="例如：描述与实物不符、疑似广告引流、违规内容等"
                onChange={(e) => setReason(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{reason.length}/200</p>
              {error ? (
                <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}
            </>
          )}
        </div>
        <DialogFooter>
          {done ? (
            <Button onClick={() => onOpenChange(false)}>知道了</Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button type="submit" disabled={createReport.isPending} className="gap-1.5">
                {createReport.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                提交举报
              </Button>
            </>
          )}
        </DialogFooter>
      </form>
    </Dialog>
  );
}
