import type { RegionCode } from "./core.js";
import type {
  DailyPriceBar,
  LatestExchangeRateSummary,
  LatestSymbolSummary,
} from "./marketData.js";
import type { PortfolioHolding } from "./portfolio.js";

export type StockDetailRequest = {
  region?: RegionCode | null;
  symbolCode: string;
};

export type StockDetailPayload = {
  datasetVersion: string;
  generatedAt: string;
  holding: PortfolioHolding | null;
  importStatus: "ready" | "unavailable";
  latestExchangeRate: LatestExchangeRateSummary | null;
  priceHistory: DailyPriceBar[];
  symbol: LatestSymbolSummary;
};
