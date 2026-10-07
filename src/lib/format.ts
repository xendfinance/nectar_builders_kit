const usdFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const usdCompactFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatUsd(value: number, options: { compact?: boolean } = {}): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  return options.compact && Math.abs(value) >= 10_000 ? usdCompactFormatter.format(value) : usdFormatter.format(value);
}

export function formatNumber(value: number, fractionDigits = 0): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  return value.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export function formatPrice(value: number, decimals: number): string {
  return formatNumber(value, decimals);
}

export function formatPercent(value: number, fractionDigits = 2): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(fractionDigits)}%`;
}

/** 5 → "5 bps (0.05%)" */
export function formatBps(bps: number): string {
  return `${bps} bps (${(bps / 100).toFixed(2)}%)`;
}

export function shortAddress(address: string, chars = 4): string {
  return address.length <= 2 + chars * 2 ? address : `${address.slice(0, 2 + chars)}…${address.slice(-chars)}`;
}

export function shortHash(hash: string): string {
  return shortAddress(hash, 6);
}

export function formatDateTime(value: string | number): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(value: string | number): string {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatTime(value: string | number): string {
  return new Date(value).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
