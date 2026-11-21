"use client";

import { useState } from "react";
import {
  BookOpen,
  Coffee,
  Dumbbell,
  ImageOff,
  Laptop,
  Package,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";

const iconMap: Record<string, typeof Package> = {
  数码: Laptop,
  书籍: BookOpen,
  文具: Pencil,
  生活用品: Coffee,
  运动器材: Dumbbell,
  其他: Package,
};

export function ItemImage({
  src,
  alt,
  category,
  className,
  iconClassName,
}: {
  src?: string | null;
  alt: string;
  category: string;
  className?: string;
  iconClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  const Icon = iconMap[category] ?? Package;
  const showFallback = !src || failed;

  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-primary-soft via-white to-muted",
        className,
      )}
    >
      {showFallback ? (
        <div className="flex flex-col items-center gap-1.5 text-primary/50">
          <Icon className={cn("h-8 w-8", iconClassName)} strokeWidth={1.5} />
          {failed ? <ImageOff className="h-4 w-4" strokeWidth={1.5} /> : null}
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      )}
    </div>
  );
}
