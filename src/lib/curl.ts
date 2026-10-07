import type { HttpMethod } from "@/api/transport";

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * cURL equivalent of a request. The bearer token is never inlined: it reads $NECTAR_TOKEN from the shell, so a
 * copied command can be shared without leaking a session.
 */
export function toCurl({
  method,
  url,
  hasAuth,
  body,
}: {
  method: HttpMethod;
  url: string;
  hasAuth: boolean;
  body?: unknown;
}): string {
  const lines = [`curl -X ${method} ${shellQuote(url)}`, `  -H 'Accept: application/json'`];
  if (hasAuth) {
    lines.push(`  -H "Authorization: Bearer $NECTAR_TOKEN"`);
  }
  if (body !== undefined) {
    lines.push(`  -H 'Content-Type: application/json'`, `  --data ${shellQuote(JSON.stringify(body))}`);
  }
  return lines.join(" \\\n");
}
