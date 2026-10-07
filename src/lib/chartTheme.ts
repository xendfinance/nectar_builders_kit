/**
 * Chart colours shared by lightweight-charts (price chart) and Recharts (fees chart). Builder fees are always blue
 * and base fees always orange, matching the main app's Builders Fee charts (src/components/BuildersFee/charts).
 */
export const CHART_COLORS = {
  up: "#00EC97",
  down: "#EF476F",
  builderFees: "#3987e5",
  baseFees: "#d95926",
  surface: "#161616",
  grid: "#262626",
  axis: "#333333",
  tick: "#9e9e9e",
  crosshair: "#6d6d6d",
} as const;
