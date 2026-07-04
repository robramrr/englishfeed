import type { ReactNode } from "react";

const sizeClasses = {
  1: "text-3xl md:text-4xl",
  2: "text-2xl md:text-3xl",
  3: "text-xl md:text-2xl",
  4: "text-lg md:text-xl",
} as const;

export function ComicTitle({
  children,
  level = 2,
  className = "",
}: {
  children: ReactNode;
  level?: 1 | 2 | 3 | 4;
  className?: string;
}) {
  const Tag = `h${level}` as keyof React.JSX.IntrinsicElements;
  return (
    <Tag className={`comic-title ${sizeClasses[level]} ${className}`}>
      {children}
    </Tag>
  );
}
