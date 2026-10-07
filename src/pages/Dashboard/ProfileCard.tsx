import type { BuilderProfileResponse } from "@/api/types";
import { Card } from "@/components/Card";
import { CopyButton } from "@/components/CopyButton";
import { StatusBadge } from "@/components/StatusBadge";
import { buildAttributionLink } from "@/context/attribution";
import { formatBps, formatDate } from "@/lib/format";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs text-ink-muted">{label}</span>
      <span className="min-w-0 text-sm">{children}</span>
    </div>
  );
}

export function ProfileCard({ profile }: { profile: BuilderProfileResponse }) {
  const link = buildAttributionLink(profile.builderId);

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          {profile.name} <StatusBadge status={profile.status} />
        </span>
      }
      endpoints={["builder.me"]}
      source="builderProfile"
    >
      <div className="flex flex-col gap-4">
        {profile.description && <p className="text-sm text-ink-muted">{profile.description}</p>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Builder fee rate">{formatBps(profile.feeRateBps)}</Field>
          <Field label="Fee cap (set by Nectar)">{formatBps(profile.feeCapBps)}</Field>
          <Field label="Registered">{formatDate(profile.registeredAt)}</Field>
          <Field label="Contact">{profile.contactEmail ?? "—"}</Field>
          <Field label="Fee receiver wallet">
            <span className="block truncate font-mono text-xs">{profile.walletAddress}</span>
          </Field>
          <Field label="Builder ID">
            <span className="flex items-center gap-1">
              <span className="truncate font-mono text-xs">{profile.builderId}</span>
              <CopyButton text={profile.builderId} />
            </span>
          </Field>
        </div>
        <div className="flex flex-col gap-1 rounded-md bg-surface-base p-3">
          <span className="text-xs text-ink-muted">
            Attribution link: traders who arrive through it sign in attributed to you
          </span>
          <span className="flex items-center gap-2">
            <span className="min-w-0 truncate font-mono text-xs">{link}</span>
            <CopyButton text={link} />
          </span>
        </div>
      </div>
    </Card>
  );
}
