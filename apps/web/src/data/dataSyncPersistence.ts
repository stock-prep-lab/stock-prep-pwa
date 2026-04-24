import type { HoldingsPayload, MarketDataPayload, SyncStateId } from "@stock-prep/shared";

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
