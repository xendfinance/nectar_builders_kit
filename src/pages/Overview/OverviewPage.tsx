import { Link } from "react-router-dom";

import { ENDPOINTS } from "@/api/catalog";
import type { EndpointId } from "@/api/catalog";
import { Card } from "@/components/Card";
import { MethodTag } from "@/components/MethodTag";
import { Notice } from "@/components/states";
import { API_BASE_URL, API_MODE, PROTOCOL_MAX_CAP_BPS } from "@/config";
import { inspector } from "@/inspector/store";
import { MOCK_BASE_FEE_BPS } from "@/mock/fixtures";

interface FlowStep {
  title: string;
  body: string;
  endpoints: EndpointId[];
}

const FLOW: FlowStep[] = [
  {
    title: "1. Attribute",
    body: "Your interface carries your builder ID (VITE_BUILDER_ID), or a trader arrives through your ?builderId= link. Sign-in passes it on the nonce request; an unknown or frozen builder is dropped so the trader can still sign in.",
    endpoints: ["auth.nonce"],
  },
  {
    title: "2. Sign in",
    body: "The wallet signs an EIP-4361 (SIWE) message. The backend verifies it and returns a session that remembers your builder.",
    endpoints: ["auth.verify", "auth.session"],
  },
  {
    title: "3. Prepare",
    body: "The client sends only what to trade. The backend injects the protocol base fee and your builder fee, and returns an EIP-712 payload with a fee breakdown.",
    endpoints: ["orders.prepare"],
  },
  {
    title: "4. Check, sign, submit",
    body: "The interface checks the payload matches the request and the fees shown, then the wallet signs it exactly as issued. Any edit fails with SIGNATURE_MISMATCH.",
    endpoints: ["orders.submit"],
  },
  {
    title: "5. Earn and track",
    body: "When a keeper executes the order, your builder fee goes to your fee-receiver wallet (uiFeeReceiver). The dashboard endpoints report it per period, user and trade.",
    endpoints: ["builder.me", "builder.stats", "builder.users", "builder.trades"],
  },
];

const PAGES = [
  {
    to: "/trade",
    title: "Trade",
    body: "The interface you ship to traders: markets, candlestick chart, order book, recent trades, an order form with the fee breakdown, and order history.",
  },
  {
    to: "/builder",
    title: "Builder dashboard",
    body: "Your profile, fees earned over time, users, attributed trades, and fee-rate settings. Sign in with your builder wallet.",
  },
  {
    to: "/explorer",
    title: "API Explorer",
    body: "Every endpoint the kit uses: what it does, where the UI uses it, editable parameters, live responses, cURL and TypeScript snippets.",
  },
];

function EndpointChip({ id }: { id: EndpointId }) {
  const endpoint = ENDPOINTS[id];
  return (
    <Link
      to={`/explorer/${id}`}
      className="inline-flex items-center gap-1.5 rounded border border-surface-line px-1.5 py-0.5 font-mono text-[11px] text-ink-muted hover:border-primary hover:text-ink"
    >
      <MethodTag method={endpoint.method} />
      {endpoint.path}
    </Link>
  );
}

export function OverviewPage() {
  const exampleSize = 10_000;
  const exampleBuilderBps = 5;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 py-4">
      <section className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold">Build on Nectar, earn on every trade</h1>
        <p className="max-w-3xl text-ink-muted">
          A reference trading interface for builders. Fork it, set your builder ID, and every order your users place
          through it pays you a builder fee. The API Inspector at the bottom of every page shows each request the
          interface makes and the data it gets back.
        </p>
        {API_MODE === "mock" ? (
          <Notice tone="warn">
            <strong>Mock API.</strong> The Builder Fee API is not live yet, so every response comes from an in-browser
            mock backend with seeded sample data. It speaks the same wire format as the spec, verifies real signatures,
            and resets when you reload. Set <code>VITE_API_MODE=live</code> to point the kit at{" "}
            <code>{API_BASE_URL}</code>.
          </Notice>
        ) : (
          <Notice>
            <strong>Live API.</strong> Requests go to <code>{API_BASE_URL}</code>.
          </Notice>
        )}
      </section>

      <Card title="How builder fees work">
        <ol className="flex flex-col gap-4">
          {FLOW.map((step) => (
            <li key={step.title} className="flex flex-col gap-1.5">
              <span className="font-medium">{step.title}</span>
              <span className="text-sm text-ink-muted">{step.body}</span>
              <span className="flex flex-wrap gap-1">
                {step.endpoints.map((id) => (
                  <EndpointChip key={id} id={id} />
                ))}
              </span>
            </li>
          ))}
        </ol>
      </Card>

      <Card title="The fee on one order">
        <div className="flex flex-col gap-2 text-sm text-ink-muted">
          <p>
            builder fee = size × your fee rate. Your rate is in basis points (1 bps = 0.01%), from 0 up to the cap
            Nectar sets for you, which is at most {PROTOCOL_MAX_CAP_BPS} bps.
          </p>
          <p className="rounded-md bg-surface-base p-3 font-mono text-xs text-ink">
            ${exampleSize.toLocaleString()} order × {exampleBuilderBps} bps = $
            {((exampleSize * exampleBuilderBps) / 10_000).toFixed(2)} builder fee
            {API_MODE === "mock" &&
              ` + $${((exampleSize * MOCK_BASE_FEE_BPS) / 10_000).toFixed(2)} base fee (${MOCK_BASE_FEE_BPS} bps in the mock)`}
          </p>
          <p>
            The trader sees both fees before signing. The base fee goes to the protocol; the builder fee goes to you.
          </p>
        </div>
      </Card>

      <section className="grid gap-4 md:grid-cols-3">
        {PAGES.map((page) => (
          <Link
            key={page.to}
            to={page.to}
            className="flex flex-col gap-2 rounded-lg border border-surface-line bg-surface-card p-4 hover:border-primary"
          >
            <span className="font-semibold">{page.title} →</span>
            <span className="text-sm text-ink-muted">{page.body}</span>
          </Link>
        ))}
      </section>

      <Card title="Try the full loop">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink-muted">
          <li>
            Open{" "}
            <Link className="text-ink underline" to="/trade">
              Trade
            </Link>{" "}
            and press <em>Sign in</em> (Demo trader). Watch the nonce and verify calls in the{" "}
            <button type="button" className="text-ink underline" onClick={() => inspector.open()}>
              API Inspector
            </button>
            .
          </li>
          <li>
            Enter a size, press <em>Review</em>, read the fee breakdown, then <em>Sign &amp; submit</em>.
          </li>
          <li>Your order appears as Open and turns Executed about 4 seconds later.</li>
          <li>
            Switch the header wallet to <em>Demo builder (PerpDesk)</em>, sign in, and open the{" "}
            <Link className="text-ink underline" to="/builder">
              Builder dashboard
            </Link>
            : the trade and its fee are there.
          </li>
          <li>
            On Trade, attribute sign-in to a frozen builder (Lumen Bot) to see the fallback, or change your fee rate in
            the dashboard and prepare another order.
          </li>
        </ol>
      </Card>
    </div>
  );
}
