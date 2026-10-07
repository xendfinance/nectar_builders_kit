import clsx from "clsx";
import { useState } from "react";

import type { BuilderUsersSortBy } from "@/api/types";
import { Card } from "@/components/Card";
import { Pagination } from "@/components/Pagination";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { useBuilderUsers } from "@/hooks/queries";
import { formatDate, formatNumber, formatUsd, shortAddress } from "@/lib/format";

const PAGE_SIZE = 10;

const COLUMNS: { sortBy: BuilderUsersSortBy; label: string }[] = [
  { sortBy: "volumeUsd", label: "Volume" },
  { sortBy: "tradeCount", label: "Trades" },
  { sortBy: "feeGenerated", label: "Builder fees" },
  { sortBy: "firstSeen", label: "First seen" },
];

export function UsersTable() {
  const [sortBy, setSortBy] = useState<BuilderUsersSortBy>("volumeUsd");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const users = useBuilderUsers({ sortBy, order, page, pageSize: PAGE_SIZE }, true);

  const sort = (column: BuilderUsersSortBy) => {
    if (column === sortBy) {
      setOrder((current) => (current === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(column);
      setOrder("desc");
    }
    setPage(1);
  };

  return (
    <Card title="Your users" endpoints={["builder.users"]} source="builderUsers" bodyClassName="overflow-x-auto">
      {users.error && (
        <div className="p-4">
          <ErrorState error={users.error} />
        </div>
      )}
      {!users.error && !users.data && <LoadingState />}
      {users.data && users.data.items.length === 0 && <EmptyState>No attributed users yet.</EmptyState>}
      {users.data && users.data.items.length > 0 && (
        <>
          <table className="data-table">
            <thead>
              <tr>
                <th>Account</th>
                {COLUMNS.map((column) => (
                  <th
                    key={column.sortBy}
                    className="num"
                    aria-sort={column.sortBy === sortBy ? (order === "asc" ? "ascending" : "descending") : "none"}
                  >
                    <button
                      type="button"
                      onClick={() => sort(column.sortBy)}
                      className={clsx("hover:text-ink", column.sortBy === sortBy && "text-ink")}
                    >
                      {column.label}
                      {column.sortBy === sortBy ? (order === "desc" ? " ↓" : " ↑") : ""}
                    </button>
                  </th>
                ))}
                <th className="num">Base fees</th>
              </tr>
            </thead>
            <tbody>
              {users.data.items.map((user) => (
                <tr key={user.account}>
                  <td className="font-mono" title={user.account}>
                    {shortAddress(user.account)}
                  </td>
                  <td className="num">{formatUsd(user.volumeUsd)}</td>
                  <td className="num">{formatNumber(user.tradeCount)}</td>
                  <td className="num text-info">{formatUsd(user.builderFeeGeneratedUsd)}</td>
                  <td className="num text-ink-muted">{formatDate(user.firstSeen)}</td>
                  <td className="num text-ink-muted">{formatUsd(user.baseFeeGeneratedUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-2">
            <Pagination
              page={users.data.page}
              pageSize={users.data.pageSize}
              totalItems={users.data.totalItems}
              onChange={setPage}
            />
          </div>
        </>
      )}
    </Card>
  );
}
