import clsx from "clsx";
import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

import { API_BASE_URL, API_MODE } from "@/config";
import { InspectorPanel } from "@/inspector/InspectorPanel";

import { Toaster } from "./Toaster";
import { WalletMenu } from "./WalletMenu";

const NAV_ITEMS = [
  { to: "/", label: "Overview", exact: true },
  { to: "/trade", label: "Trade", exact: false },
  { to: "/builder", label: "Builder dashboard", exact: false },
  { to: "/explorer", label: "API Explorer", exact: false },
];

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-base pb-12 text-ink">
      <header className="sticky top-0 z-30 border-b border-surface-line bg-surface-base/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4">
          <NavLink to="/" exact className="flex shrink-0 items-center gap-2 whitespace-nowrap font-semibold">
            <span className="h-5 w-5 rounded bg-primary" aria-hidden />
            <span className="hidden sm:inline">Nectar Builder Kit</span>
          </NavLink>
          <span
            title={API_MODE === "mock" ? "Requests are answered by the in-browser mock backend" : API_BASE_URL}
            className={clsx(
              "whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
              API_MODE === "mock" ? "bg-warn/15 text-warn" : "bg-long/15 text-long"
            )}
          >
            {API_MODE === "mock" ? "Mock API" : "Live API"}
          </span>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                exact={item.exact}
                className="rounded-md px-3 py-1.5 text-sm text-ink-muted hover:text-ink"
                activeClassName="bg-surface-raised !text-ink"
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto">
            <WalletMenu />
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-4 pb-2 md:hidden">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              exact={item.exact}
              className="whitespace-nowrap rounded-md px-3 py-1 text-sm text-ink-muted"
              activeClassName="bg-surface-raised !text-ink"
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-[1600px] p-4">{children}</main>
      <InspectorPanel />
      <Toaster />
    </div>
  );
}
