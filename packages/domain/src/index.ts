import type { StockSymbol } from "@stock-prep/shared";

export type StockCandidate = {
  symbol: StockSymbol;
  reason: string;
};
