export const APP_NAME = "Stock Prep Lab";

export type MarketCode = "TSE";

export type StockSymbol = {
  code: string;
  market: MarketCode;
  name: string;
};
