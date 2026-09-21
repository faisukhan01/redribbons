"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

/** The Red Ribbons monogram (transparent background, from the official logo). */
export function BrandMark({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/logo-mark.png"
      alt="Red Ribbons Bakery logo"
      width={1011}
      height={975}
      priority={priority}
      className={cn("h-10 w-auto", className)}
    />
  );
}

/** Monogram + brand name lockup used in headers and the login screen. */
export function BrandLockup({
  size = "md",
  className,
  priority = false,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
  priority?: boolean;
}) {
  const markSize = size === "lg" ? "h-24" : size === "sm" ? "h-9" : "h-12";
  const nameSize =
    size === "lg" ? "text-4xl sm:text-5xl" : size === "sm" ? "text-base" : "text-xl";
  const tagSize = size === "lg" ? "text-xs sm:text-sm" : "text-[10px]";
  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <BrandMark className={markSize} priority={priority} />
      <div className="text-center">
        <p
          className={cn(
            "font-display font-bold tracking-wide text-primary leading-tight",
            nameSize
          )}
        >
          RED RIBBONS
        </p>
        <p
          className={cn(
            "font-semibold uppercase text-muted-foreground",
            tagSize,
            size === "lg" ? "tracking-[0.45em]" : "tracking-[0.3em]"
          )}
        >
          Bakery · Point of Sale
        </p>
      </div>
    </div>
  );
}

/** Small header lockup with the mark left of the name (horizontal). */
export function BrandHeader({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <BrandMark className="h-10 w-auto" />
      <div className="leading-none">
        <p className="font-display font-bold text-lg text-primary tracking-wide">
          RED RIBBONS
        </p>
        <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-muted-foreground mt-0.5">
          Bakery POS
        </p>
      </div>
    </div>
  );
}
