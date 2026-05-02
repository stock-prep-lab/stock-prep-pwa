import type { CurrencyCode } from "./core.js";
import type {
  DailyPriceBar,
  ExchangeRateBar,
  StoredStockSymbol,
} from "./marketData.js";

export type PortfolioHolding = {
  id: string;
  symbolId: string;
  quantity: number;
  averagePrice: number;
  currency: CurrencyCode;
  updatedAt: string;
};

export type CashBalance = {
  currency: CurrencyCode;
  amount: number;
  updatedAt: string;
};

export type StockPrepSnapshot = {
  cashBalances: CashBalance[];
  dailyPrices: DailyPriceBar[];
  exchangeRates: ExchangeRateBar[];
  holdings: PortfolioHolding[];
  symbols: StoredStockSymbol[];
};

export type MarketDataPayload = Pick<
  StockPrepSnapshot,
  "dailyPrices" | "exchangeRates" | "symbols"
> & {
  datasetVersion: string;
  generatedAt: string;
};

export type HoldingsPayload = Pick<StockPrepSnapshot, "cashBalances" | "holdings"> & {
  updatedAt: string;
};

export type UpsertHoldingRequest = {
  averagePrice: number;
  quantity: number;
  symbolId: string;
};
