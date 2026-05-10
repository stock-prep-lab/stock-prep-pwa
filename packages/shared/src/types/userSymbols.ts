export const RECENT_SYMBOLS_MAX_COUNT = 30;
export const WATCHLIST_MAX_COUNT = 50;

export type RecentSymbolRecord = {
  symbolId: string;
  viewedAt: string;
};

export type WatchlistSymbolRecord = {
  addedAt: string;
  symbolId: string;
};

export type UserSymbolsPayload = {
  recentSymbols: RecentSymbolRecord[];
  updatedAt: string;
  watchlist: WatchlistSymbolRecord[];
};

export type RecordRecentSymbolRequest = {
  symbolId: string;
};

export type UpsertWatchlistSymbolRequest = {
  symbolId: string;
};
