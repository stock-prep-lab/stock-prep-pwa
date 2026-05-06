import type {
  HoldingsPayload,
  LatestSummaryPayload,
  MarketDataPayload,
  StoredStockSymbol,
  SyncStateId,
} from "@stock-prep/shared";

import { createStockPrepDbRepository, openStockPrepDb } from "../storage/stockPrepDb";

export async function readLocalSyncVersion(id: SyncStateId): Promise<string | null> {
  const db = await openStockPrepDb();

  try {
    const repository = createStockPrepDbRepository(db);
    const syncState = await repository.getSyncState(id);
    return syncState?.datasetVersion ?? null;
  } finally {
    db.close();
  }
}

export async function persistMarketDataPayload(payload: MarketDataPayload): Promise<void> {
  const db = await openStockPrepDb();

  try {
    const repository = createStockPrepDbRepository(db);
    await repository.replaceMarketDataSnapshot({
      dailyPrices: payload.dailyPrices,
      exchangeRates: payload.exchangeRates,
      symbols: payload.symbols,
    });
    await repository.putSyncState({
      datasetVersion: payload.datasetVersion,
      id: "market-data",
      syncedAt: new Date().toISOString(),
    });
  } finally {
    db.close();
  }
}

export async function persistLatestSummaryPayload(payload: LatestSummaryPayload): Promise<void> {
  const db = await openStockPrepDb();

  try {
    const repository = createStockPrepDbRepository(db);
    const existingSymbols = await repository.listSymbols();
    const existingById = new Map(existingSymbols.map((symbol) => [symbol.id, symbol] as const));
    const nextSymbols: StoredStockSymbol[] = payload.symbols.map((symbol) => {
      const existing = existingById.get(symbol.id);

      return {
        code: symbol.code,
        currency: symbol.currency,
        id: symbol.id,
        name: symbol.name,
        region: symbol.region,
        securityType: symbol.securityType,
        source: existing?.source ?? "stooq",
        sourceSymbol: symbol.sourceSymbol,
        unsupportedReason: existing?.unsupportedReason,
      };
    });

    await repository.replaceSymbolsSnapshot(nextSymbols);
    await repository.putSyncState({
      datasetVersion: payload.datasetVersion,
      id: "latest-summary",
      syncedAt: new Date().toISOString(),
    });
  } finally {
    db.close();
  }
}

export async function persistHoldingsPayload(payload: HoldingsPayload): Promise<void> {
  const db = await openStockPrepDb();

  try {
    const repository = createStockPrepDbRepository(db);
    await repository.replaceHoldingsSnapshot({
      cashBalances: payload.cashBalances,
      holdings: payload.holdings,
    });
    await repository.putSyncState({
      datasetVersion: payload.updatedAt,
      id: "holdings",
      syncedAt: new Date().toISOString(),
    });
  } finally {
    db.close();
  }
}
