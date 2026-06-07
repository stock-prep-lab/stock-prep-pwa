import {
  buildPortfolioValuation,
  buildRebalancePlan,
  type PortfolioValuation,
  type RebalancePlan,
} from "@stock-prep/domain";
import type { DailyPriceBar, PortfolioHolding, StoredStockSymbol } from "@stock-prep/shared";
import type { RegionCode } from "@stock-prep/shared";

import { notifyStockPrepDataChanged } from "./dataSyncEvents";
import { persistHoldingsPayload } from "./dataSyncPersistence";
import { loadLatestSummaryMarketSnapshot } from "./latestSummarySnapshot";
import { deleteHolding, upsertHolding } from "./syncApi";

export type PortfolioLoadResult = {
  dailyPriceCount: number;
  portfolio: PortfolioValuation;
  symbolCount: number;
};

export type RebalanceLoadResult = {
  dailyPriceCount: number;
  plan: RebalancePlan;
  symbolCount: number;
};

export type HoldingFormTarget = {
  existingHolding: PortfolioHolding | null;
  latestPrice: DailyPriceBar | null;
  symbol: StoredStockSymbol;
};

export type SaveHoldingInput = {
  averagePrice: number;
  quantity: number;
  symbolId: string;
};

export async function loadPortfolioFromIndexedDb(): Promise<PortfolioLoadResult> {
  const snapshot = await loadLatestSummaryMarketSnapshot();

  return {
    dailyPriceCount: snapshot.dailyPrices.length,
    portfolio: buildPortfolioValuation({
      cashBalances: snapshot.cashBalances,
      dailyPrices: snapshot.dailyPrices,
      exchangeRates: snapshot.exchangeRates,
      holdings: snapshot.holdings,
      symbols: snapshot.symbols,
    }),
    symbolCount: snapshot.symbols.length,
  };
}

export async function loadRebalancePlanFromIndexedDb(): Promise<RebalanceLoadResult> {
  const snapshot = await loadLatestSummaryMarketSnapshot();

  return {
    dailyPriceCount: snapshot.dailyPrices.length,
    plan: buildRebalancePlan({
      cashBalances: snapshot.cashBalances,
      dailyPrices: snapshot.dailyPrices,
      exchangeRates: snapshot.exchangeRates,
      holdings: snapshot.holdings,
      symbols: snapshot.symbols,
    }),
    symbolCount: snapshot.symbols.length,
  };
}

export async function loadHoldingFormTargetFromIndexedDb(
  symbolCode: string,
  region?: RegionCode | null,
): Promise<HoldingFormTarget | null> {
  const snapshot = await loadLatestSummaryMarketSnapshot();
  const symbol =
    (region
      ? snapshot.symbols.find(
          (candidate) => candidate.code === symbolCode && candidate.region === region,
        )
      : null) ??
    snapshot.symbols.find((candidate) => candidate.code === symbolCode) ??
    snapshot.symbols.find((candidate) =>
      candidate.sourceSymbol.startsWith(symbolCode.toLowerCase()),
    );

  if (!symbol) {
    return null;
  }

  return {
    existingHolding: snapshot.holdings.find((holding) => holding.symbolId === symbol.id) ?? null,
    latestPrice: findLatestPrice(snapshot.dailyPrices, symbol.id),
    symbol,
  };
}

export async function saveHoldingToIndexedDb({
  averagePrice,
  quantity,
  symbolId,
}: SaveHoldingInput): Promise<void> {
  const snapshot = await loadLatestSummaryMarketSnapshot();

  if (!snapshot.symbols.some((symbol) => symbol.id === symbolId)) {
    throw new Error("保存対象の銘柄が見つかりませんでした。");
  }

  const payload = await upsertHolding({
    averagePrice,
    quantity,
    symbolId,
  });

  await persistHoldingsPayload(payload);
  notifyStockPrepDataChanged();
}

export async function deleteHoldingFromIndexedDb(symbolId: string): Promise<void> {
  const payload = await deleteHolding({ symbolId });
  await persistHoldingsPayload(payload);
  notifyStockPrepDataChanged();
}

function findLatestPrice(dailyPrices: DailyPriceBar[], symbolId: string): DailyPriceBar | null {
  return (
    dailyPrices
      .filter((price) => price.symbolId === symbolId)
      .sort((left, right) => right.date.localeCompare(left.date))
      .at(0) ?? null
  );
}
