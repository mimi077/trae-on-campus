"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AlarmClock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { SUBMISSION_POPUP_DAILY_LIMIT, SUBMISSION_POPUP_STORAGE_KEY } from "@/lib/constants";
import {
  canShowPopup,
  countForDay,
  incrementCounter,
  parsePopupCounter,
  popupDayKey,
  type PopupCounter,
} from "@/lib/rules/popup";
import { countdownParts } from "@/lib/rules/submission";
import { api } from "@/trpc/react";

/**
 * 提交前 24 小时全局弹窗：任意页面访问时检测一次，可手动关闭；
 * 同一用户单天最多触发 3 次，计数存 localStorage，不上报服务端。
 */
export function DeadlinePopup() {
  const pathname = usePathname();
  const popupQuery = api.showcase.popupState.useQuery(undefined, { staleTime: 60_000 });
  const [open, setOpen] = useState(false);
  const [counter, setCounter] = useState<PopupCounter>({});
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const stored = parsePopupCounter(window.localStorage.getItem(SUBMISSION_POPUP_STORAGE_KEY));
    setCounter(stored);
  }, []);

  useEffect(() => {
    if (!popupQuery.data || popupQuery.data.items.length === 0) return;
    if (pathname === "/login") return;
    const day = popupDayKey();
    const stored = parsePopupCounter(window.localStorage.getItem(SUBMISSION_POPUP_STORAGE_KEY));
    setCounter(stored);
    if (!canShowPopup(countForDay(stored, day), SUBMISSION_POPUP_DAILY_LIMIT)) return;
    setOpen(true);
    // 仅在页面切换 / 数据首次到达时评估，关闭后不重复弹
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popupQuery.data, pathname]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [open]);

  const close = () => {
    setOpen(false);
    const day = popupDayKey();
    setCounter((prev) => {
      const next = incrementCounter(prev, day);
      window.localStorage.setItem(SUBMISSION_POPUP_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const items = popupQuery.data?.items ?? [];
  if (items.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <DialogHeader
        title="作品提交即将截止"
        description="以下竞赛你已报名但尚未提交作品，请及时完成提交。"
        onClose={close}
      />
      <div className="max-h-[50vh] space-y-3 overflow-y-auto px-6 pb-2 scrollbar-thin">
        {items.map((item) => {
          const remaining = countdownParts(item.deadline, now);
          return (
            <div key={item.id} className="rounded-2xl bg-white/70 p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/70 text-peach-foreground">
                  <AlarmClock className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    剩余提交时间：
                    <span className="font-semibold text-primary">
                      {remaining.expired ? "已截止" : remaining.text}
                    </span>
                  </p>
                </div>
                <Link
                  href={item.submitPath}
                  onClick={close}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                >
                  去提交
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
      <DialogFooter>
        <p className="mr-auto text-[11px] text-muted-foreground">
          每日最多提醒 {SUBMISSION_POPUP_DAILY_LIMIT} 次，可随时关闭
        </p>
        <Button variant="outline" onClick={close}>
          稍后提醒
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
