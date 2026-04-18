export const APP_NAME = "Stock Prep Lab";

export type RegionCode = "JP" | "US" | "UK" | "HK";

export type CurrencyCode = "JPY" | "USD" | "GBP" | "HKD";

export type DataSourceCode = "stooq";

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
