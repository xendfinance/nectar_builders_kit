import { useState } from "react";

import type { BuilderProfileResponse, UpdateBuilderPayload, UpdateBuilderResponse } from "@/api/types";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ErrorState, Spinner } from "@/components/states";
import { PROTOCOL_MAX_CAP_BPS } from "@/config";
import { useUpdateBuilder } from "@/hooks/queries";
import { formatBps } from "@/lib/format";

/**
 * PATCH /builders/:builderId as a builder. Only fields that changed are sent; the backend re-validates everything.
 */
export function SettingsCard({ profile }: { profile: BuilderProfileResponse }) {
  const update = useUpdateBuilder();
  const [feeRateBps, setFeeRateBps] = useState(profile.feeRateBps);
  const [description, setDescription] = useState(profile.description ?? "");
  const [contactEmail, setContactEmail] = useState(profile.contactEmail ?? "");
  const [result, setResult] = useState<UpdateBuilderResponse>();

  // Client-side guard only: the cap is per builder and never above the protocol maximum.
  const maxRate = Math.min(profile.feeCapBps, PROTOCOL_MAX_CAP_BPS);

  const payload: UpdateBuilderPayload = {};
  if (feeRateBps !== profile.feeRateBps) payload.feeRateBps = feeRateBps;
  if (description !== (profile.description ?? "")) payload.description = description;
  if (contactEmail !== (profile.contactEmail ?? "")) payload.contactEmail = contactEmail;
  const hasChanges = Object.keys(payload).length > 0;

  const save = async () => {
    setResult(undefined);
    try {
      setResult(await update.mutateAsync({ builderId: profile.builderId, payload }));
    } catch {
      // Shown from update.error below.
    }
  };

  return (
    <Card title="Settings" endpoints={["builder.update"]} source="builderSettings">
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-2 text-xs text-ink-muted">
          <span className="flex justify-between">
            <span>Builder fee rate</span>
            <span className="text-ink">{formatBps(feeRateBps)}</span>
          </span>
          <input
            type="range"
            min={0}
            max={maxRate}
            step={1}
            value={feeRateBps}
            onChange={(event) => setFeeRateBps(Number(event.target.value))}
          />
          <span className="text-ink-faint">
            0 to your cap of {profile.feeCapBps} bps. Applies to orders prepared after the change.
          </span>
        </label>

        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Description
          <textarea
            rows={2}
            maxLength={280}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Contact email
          <input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} />
        </label>

        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={save} disabled={!hasChanges || update.isPending}>
            {update.isPending && <Spinner className="h-3 w-3" />}
            Save changes
          </Button>
          <span className="text-xs text-ink-faint">
            {hasChanges ? `Will send: ${Object.keys(payload).join(", ")}` : "No changes"}
          </span>
        </div>

        {update.error && <ErrorState error={update.error} />}
        {result && (
          <p className="text-xs text-long">
            Saved. Changed fields: {result.changedFields.length > 0 ? result.changedFields.join(", ") : "none"}.
          </p>
        )}
        <p className="text-xs text-ink-faint">
          Fee cap, fee receiver wallet and status are admin-only. Contact Nectar to change them.
        </p>
      </div>
    </Card>
  );
}
