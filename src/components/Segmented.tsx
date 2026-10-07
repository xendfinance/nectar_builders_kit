import clsx from "clsx";

interface SegmentedProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  size?: "sm" | "md";
}

export function Segmented<T extends string>({ options, value, onChange, ariaLabel, size = "sm" }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex rounded-md bg-surface-base p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className={clsx(
            "rounded px-2.5 font-medium transition-colors",
            size === "sm" ? "h-6 text-xs" : "h-8 text-sm",
            option.value === value ? "bg-surface-raised text-ink" : "text-ink-muted hover:text-ink"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
