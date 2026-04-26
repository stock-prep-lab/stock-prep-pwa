import type { CurrencyCode } from "./core";
import type { DailyPriceBar, ExchangeRateBar, StoredStockSymbol } from "./marketData";
const TYPE_MARKER = undefined as never;

export type PortfolioHolding = {
  id: string;
  symbolId: string;
  quantity: number;
  averagePrice: number;
  currency: CurrencyCode;
  updatedAt: string;
};
export const PortfolioHolding = TYPE_MARKER as PortfolioHolding;

export type CashBalance = {
  currency: CurrencyCode;
  amount: number;
  updatedAt: string;
};
export const CashBalance = TYPE_MARKER as CashBalance;

export type StockPrepSnapshot = {
  cashBalances: CashBalance[];
  dailyPrices: DailyPriceBar[];
  exchangeRates: ExchangeRateBar[];
  holdings: PortfolioHolding[];
  symbols: StoredStockSymbol[];
};
export const StockPrepSnapshot = TYPE_MARKER as StockPrepSnapshot;

export type MarketDataPayload = Pick<
  StockPrepSnapshot,
  "dailyPrices" | "exchangeRates" | "symbols"
> & {
  datasetVersion: string;
  generatedAt: string;
};
export const MarketDataPayload = TYPE_MARKER as MarketDataPayload;

export type HoldingsPayload = Pick<StockPrepSnapshot, "cashBalances" | "holdings"> & {
  updatedAt: string;
};
export const HoldingsPayload = TYPE_MARKER as HoldingsPayload;

export type UpsertHoldingRequest = {
  averagePrice: number;
  quantity: number;
  symbolId: string;
};
export const UpsertHoldingRequest = TYPE_MARKER as UpsertHoldingRequest;
