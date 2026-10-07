/**
 * Markets this interface trades. Addresses are the AssetChain testnet defaults from the main repo's SDK
 * (`sdk/src/configs/markets.ts` and `sdk/src/configs/tokens.ts`); keep them in sync if those change.
 */

export interface TokenConfig {
  symbol: string;
  address: string;
  decimals: number;
}

export interface MarketConfig {
  /** Display name and the `marketSymbol` builder trades report, e.g. "ETH/USD". */
  name: string;
  /** Market token address. Sent as `marketKey` to /orders/prepare. */
  marketKey: string;
  /** Oracle symbol used by tickers, candles, order book and trades endpoints. */
  indexToken: TokenConfig;
  /** Token posted as collateral (the market's short token). */
  collateralToken: TokenConfig;
  /** Decimals shown for prices. */
  priceDecimals: number;
  /** Decimals shown for sizes in index tokens. */
  sizeDecimals: number;
}

export const USDC: TokenConfig = { symbol: "USDC", address: "0x7E3137e20150f9dE23830597E1F15D432853d67F", decimals: 6 };
export const USDT: TokenConfig = { symbol: "USDT", address: "0x34282d1eba5dBd72ad6326708ee45A954b9043A1", decimals: 6 };

export const MARKETS: MarketConfig[] = [
  {
    name: "ETH/USD",
    marketKey: "0x87416dbb72D770622465f0F9Fac690e9c41529cC",
    indexToken: { symbol: "WETH", address: "0x62Cf327661e232f2C7A4706B73cf1c1e2c9BB57D", decimals: 18 },
    collateralToken: USDC,
    priceDecimals: 2,
    sizeDecimals: 4,
  },
  {
    name: "BTC/USD",
    marketKey: "0xE8e1E33a397A5A0614a591Db432F8321D23fd37E",
    indexToken: { symbol: "WBTC", address: "0x23cb3a0889b53C840D143a20A7aEa6E240759775", decimals: 8 },
    collateralToken: USDC,
    priceDecimals: 2,
    sizeDecimals: 5,
  },
  {
    name: "CNGN/USD",
    marketKey: "0xf4A7547dFb9484dfB1b357c3E1C3C4bBf97F849D",
    indexToken: { symbol: "CNGN", address: "0xfe3Fe88013E9b53702C85aD203F874054df65D77", decimals: 18 },
    collateralToken: USDT,
    priceDecimals: 7,
    sizeDecimals: 0,
  },
];

// Every market has at least one entry, so the first is always defined.
export const DEFAULT_MARKET = MARKETS[0] as MarketConfig;

export function findMarketByName(name: string): MarketConfig | undefined {
  return MARKETS.find((market) => market.name === name);
}

export function findMarketByKey(marketKey: string): MarketConfig | undefined {
  return MARKETS.find((market) => market.marketKey.toLowerCase() === marketKey.toLowerCase());
}

export function findMarketBySymbol(symbol: string): MarketConfig | undefined {
  return MARKETS.find((market) => market.indexToken.symbol === symbol);
}

export const INDEX_SYMBOLS = MARKETS.map((market) => market.indexToken.symbol);
