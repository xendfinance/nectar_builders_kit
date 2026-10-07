import clsx from "clsx";
import { useMemo, useState } from "react";
import { Link, Redirect, useParams } from "react-router-dom";

import { ENDPOINT_GROUPS, ENDPOINT_LIST, ENDPOINTS, resolvePath, UI_SOURCES } from "@/api/catalog";
import type { EndpointDef, EndpointGroup, EndpointId, ExampleContext } from "@/api/catalog";
import { callEndpoint, toQueryRecord } from "@/api/client";
import { getErrorMessage, isApiError } from "@/api/errors";
import { buildUrl } from "@/api/transport";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { CopyButton } from "@/components/CopyButton";
import { JsonView, toJson } from "@/components/JsonView";
import { MethodTag } from "@/components/MethodTag";
import { Segmented } from "@/components/Segmented";
import { Notice, Spinner } from "@/components/states";
import { DEPLOYMENT_BUILDER_ID } from "@/config";
import { useWallet } from "@/context/WalletContext";
import { inspector, selectLatestCall, useInspector } from "@/inspector/store";
import { toCurl } from "@/lib/curl";
import { DEMO_WALLETS } from "@/lib/demoWallets";
import { DEFAULT_MARKET } from "@/lib/markets";

const AUTH_LABELS = {
  none: "Public",
  session: "Requires session (Bearer token)",
  builder: "Requires a builder wallet session",
} as const;

function useExampleContext(): ExampleContext {
  const { signer, attribution } = useWallet();
  const records = useInspector((state) => state.records);
  const lastPrepared = records.find((record) => record.endpointId === "orders.prepare" && record.state === "success");
  const lastPreparedOrderId = (lastPrepared?.responseBody as { orderId?: string } | undefined)?.orderId;

  return {
    address: signer?.address ?? DEMO_WALLETS.trader.address,
    builderId: attribution.builderId ?? DEPLOYMENT_BUILDER_ID,
    marketKey: DEFAULT_MARKET.marketKey,
    collateralToken: DEFAULT_MARKET.collateralToken.address,
    tokenSymbol: DEFAULT_MARKET.indexToken.symbol,
    lastPreparedOrderId,
  };
}

function EndpointNav({ activeId }: { activeId: EndpointId }) {
  return (
    <nav className="flex flex-col gap-4">
      {(Object.keys(ENDPOINT_GROUPS) as EndpointGroup[]).map((group) => (
        <div key={group} className="flex flex-col gap-1">
          <span className="px-2 text-xs font-medium text-ink-faint">{ENDPOINT_GROUPS[group]}</span>
          {ENDPOINT_LIST.filter((endpoint) => endpoint.group === group).map((endpoint) => (
            <Link
              key={endpoint.id}
              to={`/explorer/${endpoint.id}`}
              className={clsx(
                "flex items-center gap-2 rounded-md px-2 py-1 font-mono text-[11px]",
                endpoint.id === activeId ? "bg-surface-raised text-ink" : "text-ink-muted hover:text-ink"
              )}
            >
              <MethodTag method={endpoint.method} className="w-10 shrink-0" />
              <span className="truncate">{endpoint.path}</span>
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}

function tsSnippet(endpoint: EndpointDef, path: Record<string, string>, query: Record<string, string>, body: unknown) {
  const options = [`source: "explorer"`];
  if (Object.keys(path).length > 0) options.push(`path: ${JSON.stringify(path)}`);
  if (Object.keys(query).length > 0) options.push(`query: ${JSON.stringify(query)}`);
  if (body !== undefined) options.push(`body: ${toJson(body).replace(/\n/g, "\n  ")}`);
  return [
    `import { callEndpoint } from "@/api/client";`,
    `import type { ${endpoint.responseType.replace("[]", "")} } from "@/api/types";`,
    ``,
    `const data = await callEndpoint<${endpoint.responseType}>("${endpoint.id}", {`,
    `  ${options.join(",\n  ")},`,
    `});`,
  ].join("\n");
}

function EndpointDetail({ endpoint }: { endpoint: EndpointDef }) {
  const { session } = useWallet();
  const context = useExampleContext();
  // Seeded once per endpoint (the page keys this component by endpoint id).
  const [example] = useState(() => endpoint.example(context));
  const [pathValues, setPathValues] = useState<Record<string, string>>(example.path ?? {});
  const [queryValues, setQueryValues] = useState<Record<string, string>>(example.query ?? {});
  const [bodyText, setBodyText] = useState(example.body === undefined ? "" : toJson(example.body));
  const [snippet, setSnippet] = useState<"curl" | "ts">("curl");
  const [isSending, setIsSending] = useState(false);
  const [clientError, setClientError] = useState<string>();
  const latest = useInspector(selectLatestCall(endpoint.id, "explorer"));

  const pathParams = endpoint.params.filter((param) => param.in === "path");
  const queryParams = endpoint.params.filter((param) => param.in === "query");

  const parsedBody = useMemo((): { value?: unknown; error?: string } => {
    if (endpoint.bodyType === undefined || bodyText.trim() === "") return {};
    try {
      return { value: JSON.parse(bodyText) as unknown };
    } catch (error) {
      return { error: getErrorMessage(error) };
    }
  }, [bodyText, endpoint.bodyType]);

  const query = toQueryRecord(queryValues);
  let resolvedPath: string | undefined;
  try {
    resolvedPath = resolvePath(endpoint.path, pathValues);
  } catch {
    resolvedPath = undefined;
  }

  const send = async () => {
    setClientError(undefined);
    if (parsedBody.error) {
      setClientError(`Body is not valid JSON: ${parsedBody.error}`);
      return;
    }
    setIsSending(true);
    try {
      await callEndpoint(endpoint.id, {
        source: "explorer",
        path: pathValues,
        query: queryValues,
        body: parsedBody.value,
      });
    } catch (error) {
      // API errors are recorded by the client and shown from the inspector record; this catches the rest.
      if (!isApiError(error)) {
        setClientError(getErrorMessage(error));
      }
    } finally {
      setIsSending(false);
    }
  };

  const snippetText =
    snippet === "curl"
      ? toCurl({
          method: endpoint.method,
          url: buildUrl(resolvedPath ?? endpoint.path, query),
          hasAuth: endpoint.auth !== "none",
          body: parsedBody.value,
        })
      : tsSnippet(endpoint, pathValues, query, parsedBody.value);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Card>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 font-mono text-sm">
            <MethodTag method={endpoint.method} />
            <span className="break-all">{endpoint.path}</span>
          </div>
          <h1 className="text-lg font-semibold">{endpoint.summary}</h1>
          <p className="text-sm text-ink-muted">{endpoint.description}</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
            <span>
              <span className="text-ink-faint">Auth </span>
              {AUTH_LABELS[endpoint.auth]}
            </span>
            {endpoint.bodyType && (
              <span>
                <span className="text-ink-faint">Body </span>
                <code>{endpoint.bodyType}</code>
              </span>
            )}
            <span>
              <span className="text-ink-faint">Response </span>
              <code>{endpoint.responseType}</code> <span className="text-ink-faint">(src/api/types.ts)</span>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-ink-faint">Used in</span>
            {endpoint.usedIn.map((source) => (
              <Link
                key={source}
                to={UI_SOURCES[source].route}
                className="rounded border border-surface-line px-1.5 py-0.5 text-ink-muted hover:border-primary hover:text-ink"
              >
                {UI_SOURCES[source].label}
              </Link>
            ))}
          </div>
          {endpoint.notes?.map((note) => (
            <p key={note} className="text-xs text-ink-muted">
              {note}
            </p>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 2xl:grid-cols-2">
        <Card title="Request">
          <div className="flex flex-col gap-3">
            {endpoint.auth !== "none" && !session && (
              <Notice tone="warn">
                No session: the request goes out without a token and the backend should answer 401. Sign in from the
                header first.
              </Notice>
            )}
            {pathParams.length + queryParams.length === 0 && endpoint.bodyType === undefined && (
              <p className="text-xs text-ink-faint">No parameters.</p>
            )}
            {[...pathParams, ...queryParams].map((param) => {
              const values = param.in === "path" ? pathValues : queryValues;
              const setValues = param.in === "path" ? setPathValues : setQueryValues;
              const value = values[param.name] ?? "";
              const onChange = (next: string) => setValues((current) => ({ ...current, [param.name]: next }));
              return (
                <label key={`${param.in}:${param.name}`} className="flex flex-col gap-1 text-xs text-ink-muted">
                  <span>
                    <code className="text-ink">{param.name}</code> <span className="text-ink-faint">({param.in}</span>
                    <span className="text-ink-faint">{param.required ? ", required)" : ")"}</span> {param.description}
                  </span>
                  {param.type === "enum" ? (
                    <select value={value} onChange={(event) => onChange(event.target.value)}>
                      {!param.required && <option value="">(not set)</option>}
                      {param.options?.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={value}
                      inputMode={param.type === "number" ? "numeric" : undefined}
                      onChange={(event) => onChange(event.target.value)}
                    />
                  )}
                </label>
              );
            })}
            {endpoint.bodyType && (
              <label className="flex flex-col gap-1 text-xs text-ink-muted">
                <span>
                  Body <code className="text-ink">{endpoint.bodyType}</code> (JSON)
                </span>
                <textarea
                  rows={8}
                  spellCheck={false}
                  className="font-mono text-xs"
                  value={bodyText}
                  onChange={(event) => setBodyText(event.target.value)}
                />
                {parsedBody.error && <span className="text-short">Invalid JSON: {parsedBody.error}</span>}
              </label>
            )}
            <div className="flex items-center gap-2">
              <Button variant="primary" onClick={send} disabled={isSending || resolvedPath === undefined}>
                {isSending && <Spinner className="h-3 w-3" />}
                Send request
              </Button>
              {resolvedPath === undefined && <span className="text-xs text-short">Fill in the path parameters.</span>}
            </div>
            {clientError && <p className="text-xs text-short">{clientError}</p>}

            <div className="flex flex-col gap-2 border-t border-surface-line pt-3">
              <div className="flex items-center justify-between">
                <Segmented
                  ariaLabel="Snippet language"
                  value={snippet}
                  onChange={setSnippet}
                  options={[
                    { value: "curl", label: "cURL" },
                    { value: "ts", label: "TypeScript" },
                  ]}
                />
                <CopyButton text={snippetText} />
              </div>
              <pre className="overflow-auto whitespace-pre rounded-md bg-surface-base p-3 font-mono text-[12px] leading-5 text-ink-muted">
                {snippetText}
              </pre>
            </div>
          </div>
        </Card>

        <Card
          title="Response"
          actions={
            latest && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => inspector.open({ endpointFilter: endpoint.id, selectedId: latest.id })}
              >
                Open in inspector
              </Button>
            )
          }
        >
          {!latest && <p className="text-sm text-ink-faint">Send the request to see the response.</p>}
          {latest && (
            <div className="flex flex-col gap-2">
              <p className="font-mono text-xs">
                <span className={latest.state === "error" ? "text-short" : "text-long"}>{latest.status || "ERR"}</span>
                <span className="text-ink-faint">
                  {" "}
                  · {latest.durationMs} ms · {latest.path}
                </span>
              </p>
              {latest.errorMessage && <p className="font-mono text-xs text-short">{latest.errorMessage}</p>}
              <JsonView value={latest.responseBody} className="max-h-[560px]" />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export function ExplorerPage() {
  const { endpointId } = useParams<{ endpointId?: string }>();

  if (endpointId === undefined) {
    return <Redirect to={`/explorer/${ENDPOINT_LIST[0]!.id}`} />;
  }
  const endpoint = (ENDPOINTS as Record<string, EndpointDef | undefined>)[endpointId];
  if (!endpoint) {
    return <Redirect to="/explorer" />;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <EndpointNav activeId={endpoint.id} />
      </aside>
      <EndpointDetail key={endpoint.id} endpoint={endpoint} />
    </div>
  );
}
