import clsx from "clsx";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "long" | "short";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-primary text-surface-base hover:bg-primary-dark",
  secondary: "border border-surface-line bg-surface-raised text-ink hover:border-ink-faint",
  ghost: "text-ink-muted hover:bg-surface-raised hover:text-ink",
  long: "bg-long text-surface-base hover:bg-primary-dark",
  short: "bg-short text-ink hover:opacity-90",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
}

export function Button({ variant = "secondary", size = "md", className, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        "disabled:cursor-not-allowed disabled:opacity-40",
        size === "sm" ? "h-7 px-2.5 text-xs" : "h-9 px-4 text-sm",
        VARIANT_CLASSES[variant],
        className
      )}
      {...props}
    />
  );
}
