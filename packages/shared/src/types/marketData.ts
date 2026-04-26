import type {
  CurrencyCode,
  DataSourceCode,
  RegionCode,
  SecurityType,
} from "./core.js";
const TYPE_MARKER = undefined as never;

export type StockSymbol = {
  code: string;
  name: string;
  region: RegionCode;
};
export const StockSymbol = TYPE_MARKER as StockSymbol;

export type StoredStockSymbol = StockSymbol & {
  id: string;
  currency: CurrencyCode;
  source: DataSourceCode;
  sourceSymbol: string;
  securityType?: SecurityType;
  unsupportedReason?: string;
};
export const StoredStockSymbol = TYPE_MARKER as StoredStockSymbol;

export type DailyPriceBar = {
  id: string;
  symbolId: string;
  sourceSymbol: string;
  currency: CurrencyCode;
  date: string;
  open: number;
  region: RegionCode;
  high: number;
  low: number;
  close: number;
  volume: number;
};
export const DailyPriceBar = TYPE_MARKER as DailyPriceBar;

export type ExchangeRateBar = {
  id: string;
  pair: "USDJPY" | "GBPJPY" | "HKDJPY";
  baseCurrency: Exclude<CurrencyCode, "JPY">;
  quoteCurrency: "JPY";
  date: string;
  close: number;
};
export const ExchangeRateBar = TYPE_MARKER as ExchangeRateBar;

export type LatestSymbolSummary = Pick<
  StoredStockSymbol,
  "code" | "currency" | "id" | "name" | "region" | "securityType" | "sourceSymbol"
> & {
  lastClose: number | null;
  lastCloseDate: string | null;
};
export const LatestSymbolSummary = TYPE_MARKER as LatestSymbolSummary;

export type LatestExchangeRateSummary = Pick<
  ExchangeRateBar,
  "baseCurrency" | "close" | "date" | "pair" | "quoteCurrency"
>;
export const LatestExchangeRateSummary = TYPE_MARKER as LatestExchangeRateSummary;

export type LatestSummaryPayload = {
  datasetVersion: string;
  exchangeRates: LatestExchangeRateSummary[];
  generatedAt: string;
  symbols: LatestSymbolSummary[];
};
export const LatestSummaryPayload = TYPE_MARKER as LatestSummaryPayload;
