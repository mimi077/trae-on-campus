"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "outline" | "secondary" | "ghost" | "destructive" | "subtle" | "peach";
type Size = "sm" | "default" | "lg" | "icon";

const variantClasses: Record<Variant, string> = {
  default:
    "mint-gradient text-primary-foreground shadow-[0_12px_26px_-14px_rgba(14,143,116,0.75)] hover:brightness-[1.04]",
  outline:
    "bg-white/55 text-foreground shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.18),0_10px_26px_-24px_rgba(14,143,116,0.5)] backdrop-blur-md hover:bg-white/80 hover:text-primary",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/70",
  ghost: "text-foreground hover:bg-gradient-to-r hover:from-primary-soft/80 hover:to-accent/60",
  destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
  subtle:
    "bg-gradient-to-r from-primary-soft to-accent/60 text-primary hover:from-primary-soft hover:to-primary-soft",
  peach:
    "bg-gradient-to-r from-[#FFC9A6] via-[#FFB48A] to-[#FFA477] text-peach-foreground shadow-[0_12px_26px_-16px_rgba(255,164,119,0.9)] hover:brightness-[1.03]",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3.5 text-xs",
  default: "h-9 px-4 text-sm",
  lg: "h-11 px-6 text-sm",
  icon: "h-9 w-9",
};

const baseClasses =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:pointer-events-none disabled:opacity-50";

export function buttonClass({
  variant = "default",
  size = "default",
  className,
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
} = {}) {
  return cn(baseClasses, variantClasses[variant], sizeClasses[size], className);
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", type = "button", ...props }, ref) => (
    <button ref={ref} type={type} className={buttonClass({ variant, size, className })} {...props} />
  ),
);
Button.displayName = "Button";
