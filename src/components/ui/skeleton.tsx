import * as React from "react";
import clsx from "clsx";

export function Skeleton({
  className,
  as: Tag = "div",
}: { className?: string; as?: React.ElementType }) {
  return (
    <Tag
      className={clsx(
        "relative overflow-hidden rounded-md bg-gray-200/80 dark:bg-gray-800/60",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.2s_infinite]",
        "before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent",
        "dark:before:via-white/10",
        className
      )}
      aria-hidden="true"
    />
  );
}


