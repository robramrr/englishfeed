import type { ReactNode } from "react";

type Variant = "default" | "primary" | "secondary" | "accent";

const variantClasses: Record<Variant, string> = {
  default: "bg-white text-brand-navy",
  primary: "comic-bg-primary text-white",
  secondary: "comic-bg-secondary text-white",
  accent: "comic-bg-accent text-white",
};

export function ComicCard({
  children,
  className = "",
  variant = "default",
}: {
  children: ReactNode;
  className?: string;
  variant?: Variant;
}) {
  return (
    <div className={`comic-card p-6 ${variantClasses[variant]} ${className}`}>
      {children}
    </div>
  );
}
