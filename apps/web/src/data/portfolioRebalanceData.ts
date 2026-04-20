import {
  buildPortfolioValuation,
  buildRebalancePlan,
  type PortfolioValuation,
  type RebalancePlan,
} from "@stock-prep/domain";
import type { DailyPriceBar, PortfolioHolding, StoredStockSymbol } from "@stock-prep/shared";

import {
  createStockPrepDbRepository,
  loadStockPrepSnapshot,
  openStockPrepDb,
} from "../storage/stockPrepDb";

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
  const db = await openStockPrepDb();

  try {
    const repository = createStockPrepDbRepository(db);
    const snapshot = await loadStockPrepSnapshot(repository);

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
  } finally {
    db.close();
  }
}

export async function loadRebalancePlanFromIndexedDb(): Promise<RebalanceLoadResult> {
  const db = await openStockPrepDb();

  try {
    const repository = createStockPrepDbRepository(db);
    const snapshot = await loadStockPrepSnapshot(repository);

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
  } finally {
    db.close();
  }
}

export async function loadHoldingFormTargetFromIndexedDb(
  symbolCode: string,
): Promise<HoldingFormTarget | null> {
  const db = await openStockPrepDb();

  try {
    const repository = createStockPrepDbRepository(db);
    const snapshot = await loadStockPrepSnapshot(repository);
    const symbol =
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
  } finally {
    db.close();
  }
}

export async function saveHoldingToIndexedDb({
  averagePrice,
  quantity,
  symbolId,
}: SaveHoldingInput): Promise<void> {
  const db = await openStockPrepDb();

  try {
    const repository = createStockPrepDbRepository(db);
    const symbol = await repository.getSymbol(symbolId);

    if (!symbol) {
      throw new Error("保存対象の銘柄が見つかりませんでした。");
    }

    await repository.putHolding({
      averagePrice,
      currency: symbol.currency,
      id: `holding-${symbol.id}`,
      quantity,
      symbolId: symbol.id,
      updatedAt: new Date().toISOString(),
    });
  } finally {
    db.close();
  }
}

function findLatestPrice(dailyPrices: DailyPriceBar[], symbolId: string): DailyPriceBar | null {
  return (
    dailyPrices
      .filter((price) => price.symbolId === symbolId)
      .sort((left, right) => right.date.localeCompare(left.date))
      .at(0) ?? null
  );
}
