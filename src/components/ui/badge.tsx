import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "sale" | "sold" | "outline" | "muted" | "peach";

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-primary-soft text-primary",
  sale: "bg-primary-soft text-primary-dark",
  sold: "bg-muted text-muted-foreground",
  outline: "bg-white/55 text-muted-foreground backdrop-blur",
  muted: "bg-muted text-muted-foreground",
  peach: "bg-accent/80 text-peach-foreground",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium leading-5",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
