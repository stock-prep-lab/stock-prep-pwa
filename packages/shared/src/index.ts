export const APP_NAME = "Stock Prep Lab";

export type RegionCode = "JP" | "US" | "UK" | "HK";

export type CurrencyCode = "JPY" | "USD" | "GBP" | "HKD";

export type DataSourceCode = "stooq";

export type SecurityType = "currency" | "etf" | "stock";

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

export type SyncStateId = "holdings" | "market-data";

export type StoredSyncState = {
  datasetVersion: string;
  id: SyncStateId;
  syncedAt: string;
};

export type MarketDataPayload = Pick<
  StockPrepSnapshot,
  "dailyPrices" | "exchangeRates" | "symbols"
> & {
  datasetVersion: string;
  generatedAt: string;
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

export type DatasetVersionPayload = {
  datasetVersion: string;
  generatedAt: string;
  shouldSync: boolean;
};

export type HoldingsPayload = Pick<StockPrepSnapshot, "cashBalances" | "holdings"> & {
  updatedAt: string;
};

export type UpsertHoldingRequest = {
  averagePrice: number;
  quantity: number;
  symbolId: string;
};

export type ImportScopeId = "FX" | "HK" | "JP" | "UK" | "US";

export type ImportJobStatus = "failed" | "running" | "succeeded";

export type ImportJobRecord = {
  id: string;
  scopeId: ImportScopeId;
  fileName: string;
  status: ImportJobStatus;
  startedAt: string;
  finishedAt?: string;
  datasetVersion?: string;
  manifestKey?: string;
  symbolCount: number;
  dailyPriceCount: number;
  exchangeRateCount: number;
  errorMessage?: string;
};

export type ImportJobsPayload = {
  datasetVersion: string | null;
  generatedAt: string | null;
  jobs: ImportJobRecord[];
};
