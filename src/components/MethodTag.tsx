import clsx from "clsx";

import type { HttpMethod } from "@/api/transport";

const METHOD_CLASSES: Record<HttpMethod, string> = {
  GET: "text-info",
  POST: "text-long",
  PATCH: "text-warn",
};

export function MethodTag({ method, className }: { method: HttpMethod; className?: string }) {
  return <span className={clsx("font-mono font-semibold", METHOD_CLASSES[method], className)}>{method}</span>;
}
