"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-full bg-white/70 px-4 text-sm text-foreground shadow-[inset_0_0_0_1px_hsl(var(--input)/0.7)] backdrop-blur-sm transition-all",
        "placeholder:text-muted-foreground/70",
        "focus:bg-white/95 focus:shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.55),0_0_0_4px_hsl(var(--primary)/0.12)] focus:outline-none",
        "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[96px] w-full resize-y rounded-2xl bg-white/70 px-4 py-3 text-sm text-foreground shadow-[inset_0_0_0_1px_hsl(var(--input)/0.7)] backdrop-blur-sm transition-all",
      "placeholder:text-muted-foreground/70",
      "focus:bg-white/95 focus:shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.55),0_0_0_4px_hsl(var(--primary)/0.12)] focus:outline-none",
      "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export type SelectOption = { value: string; label: string };

/**
 * 无边框自定义下拉：
 * - 收起时只显示文字与箭头，hover/focus 才出现薄荷→蜜桃过渡渐变；
 * - 展开浮层与页面背景同色（暖白毛玻璃渐变），不使用实线边框；
 * - 原生 select 的下拉列表样式无法统一，所以这里完全自绘。
 */
export function Select({
  value,
  onChange,
  options,
  placeholder = "请选择",
  className,
  panelClassName,
  ariaLabel,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  panelClassName?: string;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [panelStyle, setPanelStyle] = React.useState<React.CSSProperties | null>(null);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);

  /** 浮层挂到 body 上并使用 fixed 定位：不会被弹窗、表格或滚动容器裁切，也不会被其他卡片遮挡 */
  const reposition = React.useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.max(rect.width, 168);
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const flipUp = spaceBelow < 220 && spaceAbove > spaceBelow;
    setPanelStyle(
      flipUp
        ? {
            left,
            width,
            bottom: window.innerHeight - rect.top + 8,
            maxHeight: Math.max(150, Math.min(288, spaceAbove - 20)),
          }
        : {
            left,
            width,
            top: rect.bottom + 8,
            maxHeight: Math.max(150, Math.min(288, spaceBelow - 20)),
          },
    );
  }, []);

  React.useLayoutEffect(() => {
    if (open) reposition();
  }, [open, reposition]);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onViewportChange = () => reposition();
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    };
  }, [open, reposition]);

  const current = options.find((option) => option.value === value);

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "group flex h-10 w-full items-center justify-between gap-2 rounded-full bg-transparent px-3 text-left text-sm text-foreground transition-all duration-200",
          "hover:bg-gradient-to-r hover:from-primary-soft/70 hover:via-white/30 hover:to-accent/60 hover:text-primary",
          "focus-visible:bg-gradient-to-r focus-visible:from-primary-soft/70 focus-visible:via-white/30 focus-visible:to-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
          open && "bg-gradient-to-r from-primary-soft/80 via-white/30 to-accent/60 text-primary",
          disabled && "pointer-events-none opacity-50",
          className,
        )}
      >
        <span className={cn("truncate", !current && "text-muted-foreground")}>
          {current?.label ?? placeholder}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground/80 transition-transform duration-200",
            open && "rotate-180 text-primary",
          )}
        />
      </button>

      {open && panelStyle && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              style={{ ...panelStyle, zIndex: 200 }}
              className={cn(
                "fixed animate-pop-in overflow-hidden rounded-2xl p-1.5",
                "bg-gradient-to-b from-white via-[hsl(var(--card))] to-[hsl(var(--primary-soft))] shadow-[0_26px_60px_-30px_rgba(14,143,116,0.45)]",
                panelClassName,
              )}
              role="listbox"
            >
              <div
                className="overflow-y-auto scrollbar-thin"
                style={{ maxHeight: panelStyle.maxHeight }}
              >
                {options.map((option) => {
                  const selected = option.value === value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        onChange(option.value);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                        selected
                          ? "font-medium text-primary"
                          : "text-muted-foreground hover:text-foreground",
                        "hover:bg-gradient-to-r hover:from-primary-soft/80 hover:to-accent/60",
                      )}
                    >
                      <span className="truncate">{option.label}</span>
                      {selected ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export function Label({
  className,
  children,
  required,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label className={cn("mb-1.5 block text-sm font-medium text-foreground", className)} {...props}>
      {children}
      {required ? <span className="ml-0.5 text-[#E86B5A]">*</span> : null}
    </label>
  );
}
