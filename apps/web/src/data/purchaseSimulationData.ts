import {
  buildPortfolioValuation,
  buildRebalancePlan,
  type PortfolioValuation,
} from "@stock-prep/domain";
import type { DailyPriceBar, ExchangeRateBar, StoredStockSymbol } from "@stock-prep/shared";

import {
  createStockPrepDbRepository,
  loadStockPrepSnapshot,
  openStockPrepDb,
} from "../storage/stockPrepDb";

export type PurchaseSimulationTarget = {
  exchangeRates: ExchangeRateBar[];
  latestPrice: DailyPriceBar | null;
  portfolio: PortfolioValuation;
  suggestedPrice: number | null;
  suggestedQuantity: number | null;
  symbol: StoredStockSymbol;
};

export type PurchaseSimulationLoadResult = {
  dailyPriceCount: number;
  symbolCount: number;
  target: PurchaseSimulationTarget | null;
};

export async function loadPurchaseSimulationTargetFromIndexedDb(
  symbolCode: string | null,
): Promise<PurchaseSimulationLoadResult> {
  const db = await openStockPrepDb();

  try {
    const repository = createStockPrepDbRepository(db);
    const snapshot = await loadStockPrepSnapshot(repository);
    const portfolio = buildPortfolioValuation({
      cashBalances: snapshot.cashBalances,
      dailyPrices: snapshot.dailyPrices,
      exchangeRates: snapshot.exchangeRates,
      holdings: snapshot.holdings,
      symbols: snapshot.symbols,
    });
    const rebalancePlan = buildRebalancePlan({
      cashBalances: snapshot.cashBalances,
      dailyPrices: snapshot.dailyPrices,
      exchangeRates: snapshot.exchangeRates,
      holdings: snapshot.holdings,
      symbols: snapshot.symbols,
    });
    const symbol =
      findSymbol(snapshot.symbols, symbolCode) ??
      rebalancePlan.proposals[0]?.symbol ??
      snapshot.symbols[0] ??
      null;

    if (!symbol) {
      return {
        dailyPriceCount: snapshot.dailyPrices.length,
        symbolCount: snapshot.symbols.length,
        target: null,
      };
    }

    const latestPrice = findLatestPrice(snapshot.dailyPrices, symbol.id);
    const proposal = rebalancePlan.proposals.find((candidate) => candidate.symbol.id === symbol.id);

    return {
      dailyPriceCount: snapshot.dailyPrices.length,
      symbolCount: snapshot.symbols.length,
      target: {
        exchangeRates: snapshot.exchangeRates,
        latestPrice,
        portfolio,
        suggestedPrice: latestPrice?.close ?? null,
        suggestedQuantity: proposal?.estimatedQuantity ?? null,
        symbol,
      },
    };
  } finally {
    db.close();
  }
}

function findSymbol(
  symbols: StoredStockSymbol[],
  symbolCode: string | null,
): StoredStockSymbol | null {
  if (!symbolCode) {
    return null;
  }

  return (
    symbols.find((candidate) => candidate.code === symbolCode) ??
    symbols.find((candidate) => candidate.sourceSymbol.startsWith(symbolCode.toLowerCase())) ??
    null
  );
}

function findLatestPrice(dailyPrices: DailyPriceBar[], symbolId: string): DailyPriceBar | null {
  return (
    dailyPrices
      .filter((price) => price.symbolId === symbolId)
      .sort((left, right) => right.date.localeCompare(left.date))
      .at(0) ?? null
  );
}
