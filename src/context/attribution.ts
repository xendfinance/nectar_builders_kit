import { DEPLOYMENT_BUILDER_ID, isValidBuilderId } from "@/config";

/**
 * Which builder the next sign-in is attributed to. Precedence, highest first:
 *   1. a `?builderId=` link the trader arrived with (persisted, like the main app's NECTAR_BUILDER_ID_KEY);
 *   2. the deployment's VITE_BUILDER_ID (your builder ID, in your fork).
 * In mock mode the Trade page can also override it to show how other builders' statuses behave.
 */

export type AttributionSource = "link" | "deployment" | "override" | "none";

export interface Attribution {
  builderId?: string;
  source: AttributionSource;
}

export const BUILDER_ID_QUERY_PARAM = "builderId";

const STORAGE_KEY = "nectar-builder-kit:builderId";

function readStoredBuilderId(): string | undefined {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isValidBuilderId(stored) ? stored : undefined;
  } catch {
    return undefined;
  }
}

export function storeLinkBuilderId(builderId: string | undefined) {
  try {
    if (builderId === undefined) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, builderId);
    }
  } catch {
    // Storage can be unavailable (private mode); attribution then lasts for this page load only.
  }
}

export function getInitialAttribution(): Attribution {
  const linked = readStoredBuilderId();
  if (linked !== undefined) {
    return { builderId: linked, source: "link" };
  }
  if (DEPLOYMENT_BUILDER_ID !== undefined) {
    return { builderId: DEPLOYMENT_BUILDER_ID, source: "deployment" };
  }
  return { source: "none" };
}

/** Link that sends traders to this interface with your builder ID. */
export function buildAttributionLink(builderId: string): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#/trade?${BUILDER_ID_QUERY_PARAM}=${encodeURIComponent(builderId)}`;
}
