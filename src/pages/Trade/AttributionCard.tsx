import { Card } from "@/components/Card";
import { ErrorState, Notice } from "@/components/states";
import { API_MODE } from "@/config";
import type { AttributionSource } from "@/context/attribution";
import { useWallet } from "@/context/WalletContext";
import { useAuthSession } from "@/hooks/queries";
import { formatBps, shortAddress } from "@/lib/format";
import { getMockServer } from "@/mock/instance";

const SOURCE_LABELS: Record<AttributionSource, string> = {
  link: "from a ?builderId= link",
  deployment: "from VITE_BUILDER_ID",
  override: "demo override",
  none: "none",
};

/** In mock mode only: pick any seeded builder to see how each status behaves at sign-in and at /orders/prepare. */
function DemoAttributionPicker() {
  const { attribution, setAttribution } = useWallet();
  const builders = getMockServer().db.builders.map((builder) => builder.profile);

  return (
    <label className="flex flex-col gap-1 text-xs text-ink-muted">
      Demo: attribute the next sign-in to
      <select
        value={attribution.builderId ?? ""}
        onChange={(event) => {
          const builderId = event.target.value || undefined;
          setAttribution(builderId === undefined ? { source: "none" } : { builderId, source: "override" });
        }}
      >
        <option value="">No builder</option>
        {builders.map((builder) => (
          <option key={builder.builderId} value={builder.builderId}>
            {builder.name} · {builder.status} · {builder.feeRateBps} bps
          </option>
        ))}
      </select>
    </label>
  );
}

export function AttributionCard() {
  const { session, attribution, attributionNotice } = useWallet();
  const authSession = useAuthSession();
  const resolved = authSession.data;

  return (
    <Card title="Builder attribution" endpoints={["auth.session"]} source="tradeOrderForm">
      <div className="flex flex-col gap-3 text-sm">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-ink-muted">Requested at sign-in ({SOURCE_LABELS[attribution.source]})</span>
          <span className="break-all font-mono text-xs">{attribution.builderId ?? "—"}</span>
        </div>

        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-ink-muted">Resolved by the backend (GET /auth)</span>
          {!session && <span className="text-ink-faint">Sign in to see it.</span>}
          {session && authSession.isLoading && <span className="text-ink-faint">Loading…</span>}
          {session && authSession.error && <ErrorState error={authSession.error} />}
          {session && resolved && resolved.builderId === null && <span>No builder: orders carry no builder fee.</span>}
          {session && resolved && resolved.builderId !== null && (
            <span>
              {resolved.builderName} · builder fee{" "}
              {resolved.builderFeeRateBps === null ? "—" : formatBps(resolved.builderFeeRateBps)}
            </span>
          )}
          {session && resolved && (
            <span className="text-xs text-ink-faint">Session wallet {shortAddress(resolved.address)}</span>
          )}
        </div>

        {attributionNotice && <Notice tone="warn">{attributionNotice}</Notice>}
        {API_MODE === "mock" && <DemoAttributionPicker />}
        <p className="text-xs text-ink-faint">
          Attribution is fixed when the nonce is issued. Changing it signs you out; sign in again to apply it.
        </p>
      </div>
    </Card>
  );
}
