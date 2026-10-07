import clsx from "clsx";

import type { AccountOrderStatus, BuilderStatus } from "@/api/types";

type Status = BuilderStatus | AccountOrderStatus;

const STATUS_CLASSES: Record<Status, string> = {
  active: "bg-long/15 text-long",
  EXECUTED: "bg-long/15 text-long",
  OPEN: "bg-info/15 text-info",
  rate_limited: "bg-warn/15 text-warn",
  frozen: "bg-info/15 text-info",
  blacklisted: "bg-short/15 text-short",
  CANCELLED: "bg-short/15 text-short",
  EXPIRED: "bg-surface-raised text-ink-muted",
};

const STATUS_LABELS: Record<Status, string> = {
  active: "Active",
  rate_limited: "Rate limited",
  frozen: "Frozen",
  blacklisted: "Blacklisted",
  OPEN: "Open",
  EXECUTED: "Executed",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={clsx("inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium", STATUS_CLASSES[status])}>
      {STATUS_LABELS[status]}
    </span>
  );
}
