import clsx from "clsx";
import { useState } from "react";

import { getErrorMessage } from "@/api/errors";
import type { PrepareOrderPayload, PrepareOrderResponse } from "@/api/types";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { JsonView } from "@/components/JsonView";
import { ErrorState, Notice, Spinner } from "@/components/states";
import { showToast } from "@/components/Toaster";
import { DEFAULT_SLIPPAGE_BPS } from "@/config";
import { useWallet } from "@/context/WalletContext";
import { useAuthSession, usePrepareOrder, useSubmitOrder, useTickers } from "@/hooks/queries";
import { useNow } from "@/hooks/useNow";
import { formatNumber, formatPrice, formatUsd, shortAddress, shortHash } from "@/lib/format";
import type { MarketConfig } from "@/lib/markets";
import { checkPreparedOrder } from "@/lib/orderChecks";
import type { OrderIntent } from "@/lib/orderChecks";
import { findTicker, tickerMid } from "@/lib/prices";
import { numberToScaled, parseUsd } from "@/lib/units";

/** MarketIncrease: the only order type the order form builds. */
const MARKET_INCREASE = 2;
const SIZE_PATTERN = /^\d+(\.\d{1,2})?$/;

type Step =
  | { kind: "edit" }
  | { kind: "review"; prepared: PrepareOrderResponse; intent: OrderIntent; problems: string[] };

function FeeRow({ label, rate, amount, strong }: { label: string; rate: string; amount: string; strong?: boolean }) {
  return (
    <div
      className={clsx(
        "flex items-center justify-between text-xs",
        strong ? "font-semibold text-ink" : "text-ink-muted"
      )}
    >
      <span>{label}</span>
      <span className="tabular-nums">
        <span className="text-ink-faint">{rate}</span> · ${amount}
      </span>
    </div>
  );
}

function Review({
  step,
  isSubmitting,
  onBack,
  onConfirm,
}: {
  step: Extract<Step, { kind: "review" }>;
  isSubmitting: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const { prepared, problems } = step;
  const fees = prepared.feeBreakdown;
  const now = useNow(1000);
  const secondsLeft = Math.max(0, Math.ceil((Date.parse(prepared.expiresAt) - now) / 1000));
  const isExpired = secondsLeft === 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5 rounded-md bg-surface-base p-3">
        <span className="text-xs font-medium text-ink">Fees injected by the backend</span>
        <FeeRow label="Base fee (protocol)" rate={`${fees.baseFeeRateBps} bps`} amount={fees.baseFeeAmountUsd} />
        <FeeRow
          label={`Builder fee${fees.builderName ? ` (${fees.builderName})` : ""}`}
          rate={`${fees.builderFeeRateBps} bps`}
          amount={fees.builderFeeAmountUsd}
        />
        <FeeRow label="Total" rate={`${fees.totalFeeRateBps} bps`} amount={fees.totalFeeAmountUsd} strong />
        <span className="text-[11px] text-ink-faint">Fee receiver {shortAddress(fees.uiFeeReceiver)}</span>
      </div>

      {problems.length > 0 ? (
        <Notice tone="warn">
          <p className="mb-1 font-medium">Not safe to sign: the prepared order differs from your request.</p>
          <ul className="list-disc pl-4 text-xs">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </Notice>
      ) : (
        <p className="text-xs text-long">✓ Checked: the order to sign matches your request and the fees shown.</p>
      )}

      <details className="text-xs">
        <summary className="cursor-pointer text-ink-muted hover:text-ink">EIP-712 payload you will sign</summary>
        <JsonView value={prepared.eip712Payload} className="mt-2 max-h-64" />
      </details>

      <p className={clsx("text-xs", isExpired ? "text-short" : "text-ink-muted")}>
        {isExpired ? "Quote expired. Go back and review again." : `Quote expires in ${secondsLeft}s`}
      </p>

      <div className="flex gap-2">
        <Button className="flex-1" onClick={onBack} disabled={isSubmitting}>
          Back
        </Button>
        <Button
          className="flex-1"
          variant="primary"
          onClick={onConfirm}
          disabled={isSubmitting || isExpired || problems.length > 0}
        >
          {isSubmitting && <Spinner className="h-3 w-3" />}
          Sign & submit
        </Button>
      </div>
    </div>
  );
}

export function OrderForm({ market }: { market: MarketConfig }) {
  const { signer, session, signIn, isSigningIn } = useWallet();
  const tickers = useTickers();
  const authSession = useAuthSession();
  const prepareOrder = usePrepareOrder();
  const submitOrder = useSubmitOrder();

  const [isLong, setIsLong] = useState(true);
  const [sizeInput, setSizeInput] = useState("1000");
  const [step, setStep] = useState<Step>({ kind: "edit" });
  const [error, setError] = useState<unknown>();
  const [isSigning, setIsSigning] = useState(false);

  const ticker = findTicker(tickers.data, market.indexToken.symbol);
  const markPrice = ticker ? tickerMid(ticker) : undefined;
  const sizeUsd = SIZE_PATTERN.test(sizeInput) ? Number(sizeInput) : NaN;
  const isSizeValid = Number.isFinite(sizeUsd) && sizeUsd > 0;
  const builderBps = authSession.data?.builderFeeRateBps ?? 0;
  const slippage = DEFAULT_SLIPPAGE_BPS / 10_000;
  const acceptablePrice = markPrice === undefined ? undefined : markPrice * (isLong ? 1 + slippage : 1 - slippage);

  const resetToEdit = () => {
    setStep({ kind: "edit" });
    setError(undefined);
  };

  const review = async () => {
    if (!isSizeValid || acceptablePrice === undefined) {
      return;
    }
    setError(undefined);
    const payload: PrepareOrderPayload = {
      marketKey: market.marketKey,
      collateralToken: market.collateralToken.address,
      sizeDeltaUsd: parseUsd(sizeInput).toString(),
      isLong,
      orderType: MARKET_INCREASE,
      acceptablePrice: numberToScaled(acceptablePrice).toString(),
    };
    try {
      const prepared = await prepareOrder.mutateAsync(payload);
      const intent: OrderIntent = {
        ...payload,
        sizeDeltaUsd: BigInt(payload.sizeDeltaUsd),
        orderType: MARKET_INCREASE,
      };
      setStep({ kind: "review", prepared, intent, problems: checkPreparedOrder(intent, prepared) });
    } catch (prepareError) {
      setError(prepareError);
    }
  };

  const confirm = async () => {
    if (step.kind !== "review" || !signer) {
      return;
    }
    setError(undefined);
    setIsSigning(true);
    try {
      // Sign the payload exactly as issued. Any change, fees included, fails with SIGNATURE_MISMATCH.
      const signature = await signer.signTypedData(step.prepared.eip712Payload);
      const result = await submitOrder.mutateAsync({ orderId: step.prepared.orderId, signature });
      showToast({
        tone: "success",
        title: `${isLong ? "Long" : "Short"} ${market.name} ${formatUsd(sizeUsd)} submitted`,
        detail: `tx ${shortHash(result.txHash)} · status ${result.status}`,
      });
      resetToEdit();
    } catch (submitError) {
      setError(submitError);
      showToast({ tone: "error", title: "Order not submitted", detail: getErrorMessage(submitError) });
    } finally {
      setIsSigning(false);
    }
  };

  return (
    <Card title="Place order" endpoints={["orders.prepare", "orders.submit"]} source="tradeOrderForm">
      {step.kind === "review" ? (
        <Review step={step} isSubmitting={isSigning} onBack={resetToEdit} onConfirm={confirm} />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-1 rounded-md bg-surface-base p-0.5">
            <Button variant={isLong ? "long" : "ghost"} size="sm" onClick={() => setIsLong(true)} aria-pressed={isLong}>
              Long
            </Button>
            <Button
              variant={isLong ? "ghost" : "short"}
              size="sm"
              onClick={() => setIsLong(false)}
              aria-pressed={!isLong}
            >
              Short
            </Button>
          </div>

          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            Size (USD)
            <input
              inputMode="decimal"
              value={sizeInput}
              onChange={(event) => setSizeInput(event.target.value.replace(/,/g, ""))}
              aria-invalid={!isSizeValid}
            />
          </label>

          <dl className="flex flex-col gap-1 text-xs">
            <div className="flex justify-between">
              <dt className="text-ink-muted">Order type</dt>
              <dd>Market (orderType {MARKET_INCREASE})</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">Mark price</dt>
              <dd className="tabular-nums">
                {markPrice === undefined ? "—" : formatPrice(markPrice, market.priceDecimals)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">Acceptable price ({DEFAULT_SLIPPAGE_BPS / 100}% slippage)</dt>
              <dd className="tabular-nums">
                {acceptablePrice === undefined ? "—" : formatPrice(acceptablePrice, market.priceDecimals)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">Size in {market.indexToken.symbol}</dt>
              <dd className="tabular-nums">
                {markPrice === undefined || !isSizeValid ? "—" : formatNumber(sizeUsd / markPrice, market.sizeDecimals)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">Builder fee (from GET /auth)</dt>
              <dd className="tabular-nums">
                {session
                  ? `${builderBps} bps ≈ ${isSizeValid ? formatUsd((sizeUsd * builderBps) / 10_000) : "—"}`
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">Base fee</dt>
              <dd className="text-ink-faint">set by the backend on review</dd>
            </div>
          </dl>

          {!signer ? (
            <p className="text-xs text-ink-muted">Connect a wallet from the header to trade.</p>
          ) : !session ? (
            <Button variant="primary" onClick={signIn} disabled={isSigningIn}>
              {isSigningIn && <Spinner className="h-3 w-3" />}
              Sign in to trade
            </Button>
          ) : (
            <Button
              variant={isLong ? "long" : "short"}
              onClick={review}
              disabled={!isSizeValid || acceptablePrice === undefined || prepareOrder.isPending}
            >
              {prepareOrder.isPending && <Spinner className="h-3 w-3" />}
              Review {isLong ? "long" : "short"}
            </Button>
          )}
        </div>
      )}
      {error !== undefined && (
        <div className="mt-3">
          <ErrorState error={error} />
        </div>
      )}
    </Card>
  );
}
