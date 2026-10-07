import { isAddress } from "viem";

import type {
  BuilderStatsResponse,
  BuilderUsersSortBy,
  StatsPeriod,
  UpdateBuilderPayload,
  UpdateBuilderResponse,
} from "@/api/types";
import { ERROR_CODES } from "@/api/types";

import {
  aggregateUsers,
  findBuilderById,
  findBuilderByWallet,
  paginate,
  sortUsers,
  sumBaseFees,
  summarizeTrades,
  tradesInPeriod,
  withStats,
} from "../db";
import type { MockBuilder } from "../db";
import { HttpError, MOCK_ERROR_CODES, ok, readBody, readEnum, readOptionalInt, requireSession } from "../http";
import type { RouteContext } from "../http";
import type { Route } from "../router";

const PERIODS: StatsPeriod[] = ["all", "30d", "7d", "24h"];
const USER_SORTS: BuilderUsersSortBy[] = ["volumeUsd", "tradeCount", "feeGenerated", "firstSeen"];
const BUILDER_EDITABLE_FIELDS = ["feeRateBps", "contactEmail", "description"] as const;
const ADMIN_ONLY_FIELDS = ["feeCapBps", "walletAddress", "status", "name"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_DESCRIPTION_LENGTH = 280;

/** /builders/me/* resolve the builder from the session wallet, never from a parameter. */
function requireBuilder(context: RouteContext): MockBuilder {
  const session = requireSession(context);
  const builder = findBuilderByWallet(context.db, session.address);
  if (!builder) {
    throw new HttpError(403, ERROR_CODES.NOT_A_BUILDER, "This wallet is not a registered builder");
  }
  return builder;
}

function readPagination(query: Record<string, string>) {
  return {
    page: readOptionalInt(query, "page", { min: 1 }),
    pageSize: readOptionalInt(query, "pageSize", { min: 1, max: 100 }),
  };
}

function me(context: RouteContext) {
  return ok(withStats(requireBuilder(context), context.now));
}

function stats(context: RouteContext) {
  const builder = requireBuilder(context);
  const { query } = context.request;
  const period = readEnum(query, "period", PERIODS) ?? "all";
  const chainId = readOptionalInt(query, "chainId", { min: 1 });

  const trades = tradesInPeriod(builder.trades, period, context.now).filter(
    (trade) => chainId === undefined || trade.chainId === chainId
  );
  const summary = summarizeTrades(trades);
  const { profile } = builder;

  const response: BuilderStatsResponse = {
    builderId: profile.builderId,
    name: profile.name,
    feeRateBps: profile.feeRateBps,
    feeCapBps: profile.feeCapBps,
    walletAddress: profile.walletAddress,
    stats: {
      tradeCount: summary.tradeCount,
      volumeUsd: summary.volumeUsd,
      builderFeeEarnedUsd: summary.builderFeeEarnedUsd,
      baseFeePassThroughUsd: sumBaseFees(trades),
      uniqueUsers: summary.uniqueUsers,
      directTrades: Math.round(summary.tradeCount * builder.directTradeRatio),
      builderAttributedTrades: summary.tradeCount,
    },
  };
  return ok(response);
}

function users(context: RouteContext) {
  const builder = requireBuilder(context);
  const { query } = context.request;
  const sortBy = readEnum(query, "sortBy", USER_SORTS);
  const order = readEnum(query, "order", ["asc", "desc"] as const);
  return ok(paginate(sortUsers(aggregateUsers(builder.trades), { sortBy, order }), readPagination(query), true));
}

function trades(context: RouteContext) {
  const builder = requireBuilder(context);
  const { query } = context.request;
  const account = query.account;
  if (account !== undefined && !isAddress(account, { strict: false })) {
    throw new HttpError(400, ERROR_CODES.INVALID_ADDRESS, "account must be a valid EVM address");
  }
  const fromTimestamp = readOptionalInt(query, "fromTimestamp", { min: 0 });
  const toTimestamp = readOptionalInt(query, "toTimestamp", { min: 0 });
  const chainId = readOptionalInt(query, "chainId", { min: 1 });

  const filtered = builder.trades.filter((trade) => {
    const settledAt = Date.parse(trade.settledAt) / 1000;
    return (
      (account === undefined || trade.account.toLowerCase() === account.toLowerCase()) &&
      (fromTimestamp === undefined || settledAt >= fromTimestamp) &&
      (toTimestamp === undefined || settledAt <= toTimestamp) &&
      (chainId === undefined || trade.chainId === chainId)
    );
  });
  return ok(paginate(filtered, readPagination(query), false));
}

function update(context: RouteContext) {
  const session = requireSession(context);
  const builderId = context.params.builderId ?? "";
  const builder = findBuilderById(context.db, builderId);
  if (!builder) {
    throw new HttpError(404, ERROR_CODES.BUILDER_NOT_FOUND, "Builder ID does not exist");
  }
  if (builder.profile.walletAddress.toLowerCase() !== session.address.toLowerCase()) {
    throw new HttpError(403, ERROR_CODES.FORBIDDEN, "Only this builder's wallet can update it");
  }

  const body = readBody(context);
  const adminFields = Object.keys(body).filter((key) => ADMIN_ONLY_FIELDS.includes(key));
  if (adminFields.length > 0) {
    throw new HttpError(403, ERROR_CODES.FORBIDDEN, `Admin-only fields: ${adminFields.join(", ")}`);
  }
  const unknownFields = Object.keys(body).filter(
    (key) => !(BUILDER_EDITABLE_FIELDS as readonly string[]).includes(key)
  );
  if (unknownFields.length > 0) {
    throw new HttpError(400, MOCK_ERROR_CODES.INVALID_PARAMS, `Unknown fields: ${unknownFields.join(", ")}`);
  }

  const payload = body as UpdateBuilderPayload;
  const { profile } = builder;
  if (
    payload.feeRateBps !== undefined &&
    (!Number.isInteger(payload.feeRateBps) || payload.feeRateBps < 0 || payload.feeRateBps > profile.feeCapBps)
  ) {
    throw new HttpError(
      400,
      ERROR_CODES.INVALID_FEE_RATE,
      `feeRateBps must be a whole number from 0 to your fee cap (${profile.feeCapBps})`
    );
  }
  if (
    payload.contactEmail !== undefined &&
    (typeof payload.contactEmail !== "string" || !EMAIL_PATTERN.test(payload.contactEmail))
  ) {
    throw new HttpError(400, MOCK_ERROR_CODES.INVALID_PARAMS, "contactEmail must be a valid email address");
  }
  if (
    payload.description !== undefined &&
    (typeof payload.description !== "string" || payload.description.length > MAX_DESCRIPTION_LENGTH)
  ) {
    throw new HttpError(
      400,
      MOCK_ERROR_CODES.INVALID_PARAMS,
      `description must be a string of at most ${MAX_DESCRIPTION_LENGTH} characters`
    );
  }

  const changedFields = BUILDER_EDITABLE_FIELDS.filter(
    (field) => payload[field] !== undefined && payload[field] !== profile[field]
  );
  builder.profile = {
    ...profile,
    feeRateBps: payload.feeRateBps ?? profile.feeRateBps,
    contactEmail: payload.contactEmail ?? profile.contactEmail,
    description: payload.description ?? profile.description,
  };

  const response: UpdateBuilderResponse = {
    builderId,
    feeRateBps: builder.profile.feeRateBps,
    feeCapBps: builder.profile.feeCapBps,
    status: builder.profile.status,
    updatedAt: new Date(context.now).toISOString(),
    changedFields,
  };
  return ok(response);
}

export const builderRoutes: Route[] = [
  { method: "GET", path: "/builders/me", handler: me },
  { method: "GET", path: "/builders/me/stats", handler: stats },
  { method: "GET", path: "/builders/me/users", handler: users },
  { method: "GET", path: "/builders/me/trades", handler: trades },
  { method: "PATCH", path: "/builders/:builderId", handler: update },
];
