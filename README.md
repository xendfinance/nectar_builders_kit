# Nectar Builder Kit

A ready-to-fork trading interface for **builders** on Nectar. A builder is a team that runs its own front end on top of
Nectar's perpetuals and earns a **builder fee** on every order its users place.

The kit has three parts:

- **Trade**: what your traders use. Markets, price chart, order book, recent trades, an order form that shows fees
  before signing, and order history.
- **Builder dashboard**: your profile, fees earned, users, trades and fee-rate settings.
- **API Explorer and Inspector**: every endpoint the kit uses, plus the exact request and response of every call.

The Builder Fee API is not live yet, so the kit runs against a **mock backend in the browser** by default. It uses the
same request format as the real API and checks real wallet signatures. Switching to the real API takes one setting.

---

## Quick start

You need Node 18+ and Yarn 4 (run `corepack enable` to get the right version).

```bash
yarn install
yarn start          # opens on http://localhost:3020
```

Other commands:

```bash
yarn test:ci        # run tests
yarn tscheck        # type check
yarn build          # production build to dist/
yarn preview        # serve the build
```

---

## Try it in five minutes

1. Open **Trade** and press **Sign in**. Open the **API Inspector** at the bottom to see each request.
2. Enter a size and press **Review long**. The form shows the base fee and the builder fee.
3. Press **Sign & submit**. Your order shows as *Open*, then *Executed* about 4 seconds later.
4. In the header, switch to **Demo builder (PerpDesk)**, open **Builder dashboard** and sign in. Your trade is at the
   top of **Attributed trades**.
5. Change the fee rate in **Settings**, go back to Trade, and place another order. The new rate applies.

Tip: click any endpoint badge (like `GET /builders/me/stats 200`) to jump to that call in the inspector.

---

## How builder fees work

1. **Sign in.** Your interface asks for a sign-in nonce with your builder ID. The trader signs it, and the session
   now belongs to your builder.
2. **Prepare.** The interface sends the order *without* fees. The API returns the order with the base fee and your
   builder fee added.
3. **Check.** The interface confirms the returned order matches what the trader asked for and the fees shown.
4. **Sign and submit.** The trader signs the order exactly as returned. The API relays it, and when it executes, the
   builder fee goes to your wallet.

**Fee formula:** `builder fee = order size × fee rate (bps) / 10,000`. A $10,000 order at 5 bps earns you $5.

Key rules:

- The client never sends fee amounts. The backend adds them.
- Changing the builder means signing in again.
- If a builder is unknown or frozen, sign-in still works, just without a builder.
- Editing a prepared order in any way (fees included) makes the signature fail.
- Fee rate must stay between 0 and your cap, and the cap is at most 10 bps.

---

## API endpoints used

| Endpoint | Used for |
| --- | --- |
| `GET /auth/nonce`, `POST /auth/verify` | Sign-in |
| `GET /auth` | Current session and builder fee rate |
| `GET /oracle-keeper/prices/tickers`, `/24h`, `/candles` | Prices and chart |
| `GET /orderbooks/:symbol` | Order book |
| `GET /trades/:symbol` | Recent trades |
| `GET /accounts/:account/orders` | Your orders |
| `POST /orders/prepare`, `POST /orders/submit` | Placing an order |
| `GET /builders/me`, `/stats`, `/users`, `/trades` | Builder dashboard |
| `PATCH /builders/:builderId` | Fee-rate settings |

All endpoints are defined in `src/api/catalog.ts`, and the React hooks are in `src/hooks/queries.ts`.

---

## The mock backend

The mock lives in `src/mock/` and runs entirely in your browser. Sign-in and order signatures are verified for real.
Prices, trades and builders are sample data. Reloading the page resets everything.

**Demo wallets** (public test keys, never send funds to them):

| Wallet | Address |
| --- | --- |
| Demo trader | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` |
| Demo builder (PerpDesk) | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` |

**Sample builders:** PerpDesk (default), YieldLens, Orbit Wallet, Kite Mobile (rate limited), Lumen Bot (frozen) and
Swiftfill (blacklisted).

---

## Going live

Copy `.env.example` to `.env.local` and set:

```bash
VITE_API_MODE=live
VITE_NECTAR_API_URL=https://api.nectar.finance
VITE_BUILDER_ID=<your builder ID from Nectar>
```

Before you launch:

- [ ] The API allows requests from your domain (CORS).
- [ ] Use a browser wallet (demo wallets are hidden in live mode).
- [ ] Switch your wallet to **AssetChain testnet (42421)** before signing orders.
- [ ] Review the open questions below with the backend team.

---

## Making it your own

1. Set `VITE_BUILDER_ID` so every sign-in is credited to you.
2. Share your link from the dashboard: `https://your.app/#/trade?builderId=<id>`.
3. **Keep** `src/api/`, `src/lib/` and `src/context/WalletContext.tsx`. This is the integration.
4. **Replace** `src/pages/` with your own design.
5. Using wagmi or RainbowKit? Implement the `WalletSigner` interface in `src/lib/wallet.ts`.
6. Once live, delete `src/mock/` and optionally the API Inspector.

---

## Open questions

Things the API spec doesn't settle yet. The mock makes a choice for each, so confirm them before going live.

1. No collateral amount on `/orders/prepare`, so leverage can't be set.
2. No trigger price, so only market orders are supported.
3. `acceptablePrice` scaling is unclear.
4. `eip712Payload` has no `primaryType` field.
5. No fee history endpoint, so the fees chart pages through trades.
6. Pagination differs between `/builders/me/users` and `/builders/me/trades`.
7. No positions endpoint, so Trade shows orders only.
8. Recent trades don't include a buy/sell side.
9. Some auth error codes and builder statuses aren't defined.

---

## Reference

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_MODE` | `mock` | `mock` or `live` |
| `VITE_NECTAR_API_URL` | `http://localhost:3333` | API URL in live mode |
| `VITE_BUILDER_ID` | PerpDesk in mock mode | Builder that sign-ins are credited to |

Other settings are in `src/config.ts`.

**Built with:** React 18, TypeScript, Vite, TanStack Query, Tailwind, viem, lightweight-charts and Recharts.
