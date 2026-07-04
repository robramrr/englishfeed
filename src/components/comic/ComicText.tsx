import type { ReactNode } from "react";

export function ComicText({
  children,
  className = "",
  bold = false,
  as: Tag = "p",
}: {
  children: ReactNode;
  className?: string;
  bold?: boolean;
  as?: "p" | "span" | "label";
}) {
  return (
    <Tag className={`${bold ? "comic-text-bold" : "comic-text"} ${className}`}>
      {children}
    </Tag>
  );
}
