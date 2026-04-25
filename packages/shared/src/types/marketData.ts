import type { CurrencyCode, DataSourceCode, RegionCode, SecurityType } from "./core";

export type StockSymbol = {
  code: string;
  name: string;
  region: RegionCode;
};

export type StoredStockSymbol = StockSymbol & {
  id: string;
  currency: CurrencyCode;
  source: DataSourceCode;
  sourceSymbol: string;
  securityType?: SecurityType;
  unsupportedReason?: string;
};

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

export type ExchangeRateBar = {
  id: string;
  pair: "USDJPY" | "GBPJPY" | "HKDJPY";
  baseCurrency: Exclude<CurrencyCode, "JPY">;
  quoteCurrency: "JPY";
  date: string;
  close: number;
};

export type LatestSymbolSummary = Pick<
  StoredStockSymbol,
  "code" | "currency" | "id" | "name" | "region" | "securityType" | "sourceSymbol"
> & {
  lastClose: number | null;
  lastCloseDate: string | null;
};

export type LatestExchangeRateSummary = Pick<
  ExchangeRateBar,
  "baseCurrency" | "close" | "date" | "pair" | "quoteCurrency"
>;

export type LatestSummaryPayload = {
  datasetVersion: string;
  exchangeRates: LatestExchangeRateSummary[];
  generatedAt: string;
  symbols: LatestSymbolSummary[];
};
