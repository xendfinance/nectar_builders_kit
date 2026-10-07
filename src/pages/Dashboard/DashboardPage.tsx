import { useState } from "react";

import { isApiError } from "@/api/errors";
import { ERROR_CODES } from "@/api/types";
import type { StatsPeriod } from "@/api/types";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Segmented } from "@/components/Segmented";
import { ErrorState, LoadingState, Spinner } from "@/components/states";
import { API_MODE } from "@/config";
import { useWallet } from "@/context/WalletContext";
import { useBuilderMe } from "@/hooks/queries";
import { DEMO_WALLETS } from "@/lib/demoWallets";

import { FeesChart } from "./FeesChart";
import { ProfileCard } from "./ProfileCard";
import { SettingsCard } from "./SettingsCard";
import { StatsGrid } from "./StatsGrid";
import { TradesTable } from "./TradesTable";
import { UsersTable } from "./UsersTable";

const PERIODS: { value: StatsPeriod; label: string }[] = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "all", label: "All time" },
];

/** Shown until the session belongs to a builder wallet. /builders/me/* resolve the builder from the session only. */
function SignInGate() {
  const { signer, session, signIn, isSigningIn, connectDemo, error } = useWallet();
  const me = useBuilderMe();
  const isDemoBuilder = signer?.address === DEMO_WALLETS.builder.address;
  const notABuilder = isApiError(me.error, ERROR_CODES.NOT_A_BUILDER);

  return (
    <Card title="Builder dashboard" endpoints={["builder.me"]} source="builderProfile" className="mx-auto max-w-xl">
      <div className="flex flex-col gap-3 text-sm">
        <p className="text-ink-muted">
          Sign in with the wallet registered as your builder&apos;s fee receiver. The dashboard endpoints identify the
          builder from that session, never from a parameter.
        </p>
        {session && notABuilder && <ErrorState error={me.error} />}
        {session && me.error && !notABuilder && <ErrorState error={me.error} />}
        {session && me.isLoading && <LoadingState />}
        {error && <p className="text-xs text-short">{error}</p>}

        <div className="flex flex-wrap gap-2">
          {API_MODE === "mock" && !isDemoBuilder && (
            <Button variant={session ? "primary" : "secondary"} onClick={() => connectDemo("builder")}>
              Use the {DEMO_WALLETS.builder.label} wallet
            </Button>
          )}
          {signer && !session && (
            <Button variant="primary" onClick={signIn} disabled={isSigningIn}>
              {isSigningIn && <Spinner className="h-3 w-3" />}
              Sign in as {signer.label}
            </Button>
          )}
          {!signer && <span className="text-ink-faint">Connect a wallet from the header.</span>}
        </div>
      </div>
    </Card>
  );
}

export function DashboardPage() {
  const { session } = useWallet();
  const me = useBuilderMe();
  const [period, setPeriod] = useState<StatsPeriod>("30d");

  if (!session || !me.data) {
    return <SignInGate />;
  }
  const profile = me.data;

  return (
    <div className="flex flex-col gap-4">
      <ProfileCard profile={profile} />
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Earnings</h1>
        <Segmented ariaLabel="Stats period" value={period} onChange={setPeriod} options={PERIODS} size="md" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <StatsGrid period={period} />
        <FeesChart period={period} registeredAt={profile.registeredAt} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <UsersTable />
        <SettingsCard profile={profile} />
      </div>
      <TradesTable />
    </div>
  );
}
