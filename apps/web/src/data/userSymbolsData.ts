import type {
  RecentSymbolRecord,
  StoredStockSymbol,
  UserSymbolsPayload,
  WatchlistSymbolRecord,
} from "@stock-prep/shared";

import { createStockPrepDbRepository, openStockPrepDb } from "../storage/stockPrepDb";
import { persistUserSymbolsPayload } from "./dataSyncPersistence";
import {
  addWatchlistSymbol,
  recordRecentSymbol,
  removeWatchlistSymbol,
} from "./syncApi";
import { notifyUserSymbolsChanged } from "./userSymbolsEvents";

export type UserSymbolListItem = {
  isHeld: boolean;
  isWatched: boolean;
  symbol: StoredStockSymbol;
  timestamp: string;
};

export type UserSymbolsIndexedDbSnapshot = {
  holdingSymbolIds: string[];
  recentSymbols: UserSymbolListItem[];
  watchSymbolIds: string[];
  watchlist: UserSymbolListItem[];
};

export async function loadUserSymbolsSnapshotFromIndexedDb(): Promise<UserSymbolsIndexedDbSnapshot> {
  const db = await openStockPrepDb();

  try {
    const repository = createStockPrepDbRepository(db);
    const [holdings, recentSymbols, symbols, watchlist] = await Promise.all([
      repository.listHoldings(),
      repository.listRecentSymbols(),
      repository.listSymbols(),
      repository.listWatchlistSymbols(),
    ]);

    const holdingSymbolIds = new Set(holdings.map((holding) => holding.symbolId));
    const watchSymbolIds = new Set(watchlist.map((record) => record.symbolId));
    const symbolById = new Map(symbols.map((symbol) => [symbol.id, symbol] as const));

    return {
      holdingSymbolIds: [...holdingSymbolIds],
      recentSymbols: toUserSymbolListItems({
        holdingSymbolIds,
        records: recentSymbols,
        symbolById,
        watchSymbolIds,
      }),
      watchSymbolIds: [...watchSymbolIds],
      watchlist: toUserSymbolListItems({
        holdingSymbolIds,
        records: watchlist,
        symbolById,
        watchSymbolIds,
      }),
    };
  } finally {
    db.close();
  }
}

export async function loadUserSymbolFlags(symbolId: string): Promise<{
  isHeld: boolean;
  isWatched: boolean;
  wasRecentlyViewed: boolean;
}> {
  const db = await openStockPrepDb();

  try {
    const repository = createStockPrepDbRepository(db);
    const [holdings, recentSymbol, watchlistSymbol] = await Promise.all([
      repository.listHoldings(),
      repository.getRecentSymbol(symbolId),
      repository.getWatchlistSymbol(symbolId),
    ]);

    return {
      isHeld: holdings.some((holding) => holding.symbolId === symbolId),
      isWatched: watchlistSymbol !== null,
      wasRecentlyViewed: recentSymbol !== null,
    };
  } finally {
    db.close();
  }
}

export async function recordRecentViewedSymbol(symbolId: string): Promise<void> {
  const payload = await recordRecentSymbol({ symbolId });
  await persistAndBroadcastUserSymbolsPayload(payload);
}

export async function addWatchSymbol(symbolId: string): Promise<void> {
  const payload = await addWatchlistSymbol({ symbolId });
  await persistAndBroadcastUserSymbolsPayload(payload);
}

export async function removeWatchSymbol(symbolId: string): Promise<void> {
  const payload = await removeWatchlistSymbol(symbolId);
  await persistAndBroadcastUserSymbolsPayload(payload);
}

async function persistAndBroadcastUserSymbolsPayload(payload: UserSymbolsPayload): Promise<void> {
  await persistUserSymbolsPayload(payload);
  notifyUserSymbolsChanged();
}

function toUserSymbolListItems({
  holdingSymbolIds,
  records,
  symbolById,
  watchSymbolIds,
}: {
  holdingSymbolIds: Set<string>;
  records: Array<RecentSymbolRecord | WatchlistSymbolRecord>;
  symbolById: Map<string, StoredStockSymbol>;
  watchSymbolIds: Set<string>;
}): UserSymbolListItem[] {
  return records
    .map((record) => {
      const symbol = symbolById.get(record.symbolId);

      if (!symbol) {
        return null;
      }

      return {
        isHeld: holdingSymbolIds.has(record.symbolId),
        isWatched: watchSymbolIds.has(record.symbolId),
        symbol,
        timestamp: "viewedAt" in record ? record.viewedAt : record.addedAt,
      };
    })
    .filter((item): item is UserSymbolListItem => item !== null)
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp));
}
