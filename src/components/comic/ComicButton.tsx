import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "accent" | "warning" | "ghost";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary: "comic-bg-primary text-white hover:brightness-110",
  secondary: "comic-bg-secondary text-white hover:brightness-110",
  accent: "comic-bg-accent text-white hover:brightness-110",
  warning: "comic-bg-warning text-brand-navy hover:brightness-110",
  ghost: "bg-white text-brand-navy hover:bg-brand-gray/40",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-4 py-2 text-base",
  md: "px-6 py-3 text-lg",
  lg: "px-8 py-4 text-xl",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
};

export function ComicButton({
  children,
  variant = "primary",
  size = "md",
  className = "",
  disabled,
  ...props
}: Props) {
  const disabledClasses = disabled
    ? "cursor-not-allowed opacity-50 hover:scale-100 hover:translate-y-0"
    : "";

  return (
    <button
      type="button"
      className={`comic-button inline-flex items-center justify-center text-center ${variantClasses[variant]} ${sizeClasses[size]} ${disabledClasses} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
