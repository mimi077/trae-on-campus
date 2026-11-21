"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
  closeOnOverlayClick?: boolean;
};

export function Dialog({
  open,
  onOpenChange,
  children,
  className,
  closeOnOverlayClick = true,
}: DialogProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onOpenChange]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <div
        className="fixed inset-0 animate-fade-in bg-[#0E3A32]/35 backdrop-blur-sm"
        onClick={closeOnOverlayClick ? () => onOpenChange(false) : undefined}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 my-auto w-full max-w-lg animate-slide-up rounded-[28px]",
          "bg-gradient-to-b from-white/90 via-card/95 to-primary-soft/45 shadow-[0_40px_90px_-40px_rgba(14,143,116,0.55)] backdrop-blur-2xl",
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function DialogHeader({
  title,
  description,
  onClose,
}: {
  title: string;
  description?: string;
  onClose?: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-6">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭"
          className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-primary-soft hover:text-primary"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("px-6 pb-6 pt-5", className)}>
      <div className="fade-divider mb-5" aria-hidden="true" />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end" {...props} />
    </div>
  );
}
