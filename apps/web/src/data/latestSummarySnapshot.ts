import type {
  CashBalance,
  DailyPriceBar,
  ExchangeRateBar,
  LatestSummaryPayload,
  PortfolioHolding,
  StoredStockSymbol,
} from "@stock-prep/shared";

import { createStockPrepDbRepository, openStockPrepDb } from "../storage/stockPrepDb";
import { fetchLatestSummary } from "./syncApi";

export type LatestSummaryLocalSnapshot = {
  cashBalances: CashBalance[];
  holdings: PortfolioHolding[];
  symbols: StoredStockSymbol[];
};

export type LatestSummaryMarketSnapshot = LatestSummaryLocalSnapshot & {
  dailyPrices: DailyPriceBar[];
  exchangeRates: ExchangeRateBar[];
  latestSummary: LatestSummaryPayload | null;
};

export async function loadLatestSummaryMarketSnapshot(): Promise<LatestSummaryMarketSnapshot> {
  const [localSnapshot, latestSummary] = await Promise.all([
    loadLatestSummaryLocalSnapshotFromIndexedDb(),
    fetchLatestSummary({ activity: "silent" }).catch(() => null),
  ]);

  return buildLatestSummaryMarketSnapshot({
    latestSummary,
    localSnapshot,
  });
}

export function buildLatestSummaryMarketSnapshot({
  latestSummary,
  localSnapshot,
}: {
  latestSummary: LatestSummaryPayload | null;
  localSnapshot: LatestSummaryLocalSnapshot;
}): LatestSummaryMarketSnapshot {
  const localSymbolsById = new Map(localSnapshot.symbols.map((symbol) => [symbol.id, symbol] as const));

  const summarySymbols: StoredStockSymbol[] =
    latestSummary?.symbols.map((symbol) => {
      const localSymbol = localSymbolsById.get(symbol.id);

      return {
        code: symbol.code,
        currency: symbol.currency,
        id: symbol.id,
        name: symbol.name,
        region: symbol.region,
        securityType: symbol.securityType,
        source: localSymbol?.source ?? "stooq",
        sourceSymbol: symbol.sourceSymbol,
        unsupportedReason: localSymbol?.unsupportedReason,
      } satisfies StoredStockSymbol;
    }) ?? [];

  const mergedSymbols = new Map<string, StoredStockSymbol>(
    summarySymbols.map((symbol) => [symbol.id, symbol] as const),
  );

  for (const localSymbol of localSnapshot.symbols) {
    if (!mergedSymbols.has(localSymbol.id)) {
      mergedSymbols.set(localSymbol.id, localSymbol);
    }
  }

  const dailyPrices =
    latestSummary?.symbols.flatMap((symbol) => {
      if (symbol.lastClose === null || !symbol.lastCloseDate) {
        return [];
      }

      return [
        {
          close: symbol.lastClose,
          currency: symbol.currency,
          date: symbol.lastCloseDate,
          high: symbol.lastClose,
          id: `${symbol.id}-${symbol.lastCloseDate}`,
          low: symbol.lastClose,
          open: symbol.lastClose,
          region: symbol.region,
          sourceSymbol: symbol.sourceSymbol,
          symbolId: symbol.id,
          volume: 0,
        } satisfies DailyPriceBar,
      ];
    }) ?? [];

  const exchangeRates =
    latestSummary?.exchangeRates.map((rate) => ({
      baseCurrency: rate.baseCurrency,
      close: rate.close,
      date: rate.date,
      id: `${rate.pair}-${rate.date}`,
      pair: rate.pair,
      quoteCurrency: rate.quoteCurrency,
    })) ?? [];

  return {
    cashBalances: localSnapshot.cashBalances,
    dailyPrices,
    exchangeRates,
    holdings: localSnapshot.holdings,
    latestSummary,
    symbols: [...mergedSymbols.values()],
  };
}

async function loadLatestSummaryLocalSnapshotFromIndexedDb(): Promise<LatestSummaryLocalSnapshot> {
  const db = await openStockPrepDb();

  try {
    const repository = createStockPrepDbRepository(db);
    const [cashBalances, holdings, symbols] = await Promise.all([
      repository.listCashBalances(),
      repository.listHoldings(),
      repository.listSymbols(),
    ]);

    return {
      cashBalances,
      holdings,
      symbols,
    };
  } finally {
    db.close();
  }
}
