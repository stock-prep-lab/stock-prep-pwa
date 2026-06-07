import type {
  CashBalance,
  CurrencyCode,
  ImportJobRecord,
  ImportJobsPayload,
  LatestSummaryPayload,
  LatestSymbolSummary,
  PortfolioHolding,
  StoredStockSymbol,
  StoredSyncState,
} from "@stock-prep/shared";

import { createStockPrepDbRepository, openStockPrepDb } from "../storage/stockPrepDb";
import { fetchImportJobs } from "./adminImportApi";
import { formatPriceCurrency } from "./priceFormat";
import { fetchLatestSummary } from "./syncApi";
import {
  loadUserSymbolsSnapshotFromIndexedDb,
  type UserSymbolListItem,
  type UserSymbolsIndexedDbSnapshot,
} from "./userSymbolsData";

export type HomeLatestSymbolItem = UserSymbolListItem & {
  lastCloseDateLabel: string | null;
  lastCloseLabel: string | null;
  latestStatusLabel: string;
};

export type HomeCandidate = {
  code: string;
  id: string;
  isHeld: boolean;
  isWatched: boolean;
  lastCloseDateLabel: string | null;
  lastCloseLabel: string | null;
  name: string;
  reason: string;
  region: StoredStockSymbol["region"];
  timestampLabel: string | null;
  wasRecentlyViewed: boolean;
};

export type HomePortfolioSummary = {
  cashRatioLabel: string;
  holdingCountLabel: string;
  stockRatioLabel: string;
  topHoldingLabel: string;
  totalValueLabel: string;
};

export type HomeRebalanceAlert = {
  description: string;
  severity: "注意" | "確認";
  title: string;
};

export type HomeDataStatus = "ready" | "unavailable";

export type HomePageData = {
  candidates: HomeCandidate[];
  datasetVersionLabel: string;
  importedAtLabel: string;
  importJobDetailLabel: string;
  importStatusLabel: string;
  latestSummaryStatus: HomeDataStatus;
  marketDateLabel: string;
  portfolioSummary: HomePortfolioSummary | null;
  priceCountLabel: string;
  rebalanceAlert: HomeRebalanceAlert | null;
  recentSymbols: HomeLatestSymbolItem[];
  symbolCountLabel: string;
  syncDetailLabel: string;
  syncStateLabel: string;
  watchlist: HomeLatestSymbolItem[];
};

type HomeLocalSnapshot = {
  cashBalances: CashBalance[];
  holdings: PortfolioHolding[];
  syncStates: Partial<Record<StoredSyncState["id"], StoredSyncState | null>>;
  symbols: StoredStockSymbol[];
};

export async function loadHomePageData(): Promise<HomePageData> {
  const [localSnapshot, userSymbols, importJobsPayload, latestSummary] = await Promise.all([
    loadHomeLocalSnapshotFromIndexedDb(),
    loadUserSymbolsSnapshotFromIndexedDb(),
    fetchImportJobs({ activity: "background" }).catch(() => null),
    fetchLatestSummary({ activity: "background" }).catch(() => null),
  ]);

  return buildHomePageData({
    holdings: localSnapshot.holdings,
    importJobsPayload,
    latestSummary,
    symbols: localSnapshot.symbols,
    syncStates: localSnapshot.syncStates,
    userSymbols,
    cashBalances: localSnapshot.cashBalances,
  });
}

export function buildHomePageData({
  cashBalances,
  holdings,
  importJobsPayload,
  latestSummary,
  symbols,
  syncStates,
  userSymbols,
}: {
  cashBalances: CashBalance[];
  holdings: PortfolioHolding[];
  importJobsPayload: ImportJobsPayload | null;
  latestSummary: LatestSummaryPayload | null;
  symbols: StoredStockSymbol[];
  syncStates: Partial<Record<StoredSyncState["id"], StoredSyncState | null>>;
  userSymbols: UserSymbolsIndexedDbSnapshot;
}): HomePageData {
  const latestBySymbolId = new Map(
    (latestSummary?.symbols ?? []).map((symbol) => [symbol.id, symbol] as const),
  );
  const importJobs = importJobsPayload?.jobs ?? [];
  const latestJob = getLatestImportJob(importJobs);
  const marketDate = resolveMarketDate(latestSummary);
  const symbolCount = latestSummary?.symbols.length ?? symbols.length;
  const priceCount = (latestSummary?.symbols ?? []).filter((symbol) => symbol.lastCloseDate).length;

  return {
    candidates: buildTodayCandidates({
      holdingSymbolIds: new Set(userSymbols.holdingSymbolIds),
      latestBySymbolId,
      recentSymbols: userSymbols.recentSymbols,
      watchSymbolIds: new Set(userSymbols.watchSymbolIds),
      watchlist: userSymbols.watchlist,
    }),
    datasetVersionLabel: latestSummary?.datasetVersion ?? importJobsPayload?.datasetVersion ?? "未同期",
    importedAtLabel: formatDateTimeLabel(latestJob?.finishedAt ?? latestSummary?.generatedAt),
    importJobDetailLabel: buildImportJobDetailLabel({
      importJobs,
      latestJob,
    }),
    importStatusLabel: buildImportStatusLabel({
      latestJob,
      latestSummary,
    }),
    latestSummaryStatus: latestSummary ? "ready" : "unavailable",
    marketDateLabel: formatDateLabel(marketDate),
    portfolioSummary: buildPortfolioSummary({
      cashBalances,
      holdings,
      latestSummary,
      symbols,
    }),
    priceCountLabel: formatCount(priceCount),
    rebalanceAlert: buildRebalanceAlert({
      cashBalances,
      holdings,
      latestSummary,
      symbols,
    }),
    recentSymbols: enrichUserSymbolItems(userSymbols.recentSymbols, latestBySymbolId),
    symbolCountLabel: formatCount(symbolCount),
    syncDetailLabel: buildSyncDetailLabel(syncStates),
    syncStateLabel: buildSyncStateLabel(syncStates),
    watchlist: enrichUserSymbolItems(userSymbols.watchlist, latestBySymbolId),
  };
}

async function loadHomeLocalSnapshotFromIndexedDb(): Promise<HomeLocalSnapshot> {
  const db = await openStockPrepDb();

  try {
    const repository = createStockPrepDbRepository(db);
    const [cashBalances, holdings, symbols, latestSummarySync, holdingsSync, userSymbolsSync] =
      await Promise.all([
        repository.listCashBalances(),
        repository.listHoldings(),
        repository.listSymbols(),
        repository.getSyncState("latest-summary"),
        repository.getSyncState("holdings"),
        repository.getSyncState("user-symbols"),
      ]);

    return {
      cashBalances,
      holdings,
      syncStates: {
        holdings: holdingsSync,
        "latest-summary": latestSummarySync,
        "user-symbols": userSymbolsSync,
      },
      symbols,
    };
  } finally {
    db.close();
  }
}

function buildImportStatusLabel({
  latestJob,
  latestSummary,
}: {
  latestJob: ImportJobRecord | null;
  latestSummary: LatestSummaryPayload | null;
}): string {
  if (!latestJob) {
    return latestSummary ? "保存済みデータを表示中" : "取り込み待ち";
  }

  if (latestJob.status === "completed") {
    return "最新データ同期済み";
  }

  if (latestJob.status === "processing") {
    return `${formatScopeLabel(latestJob.scopeId)} を取り込み中`;
  }

  if (latestJob.status === "queued") {
    return `${formatScopeLabel(latestJob.scopeId)} の取り込み待機中`;
  }

  return `${formatScopeLabel(latestJob.scopeId)} の取り込みで失敗`;
}

function buildImportJobDetailLabel({
  importJobs,
  latestJob,
}: {
  importJobs: ImportJobRecord[];
  latestJob: ImportJobRecord | null;
}): string {
  const queuedCount = importJobs.filter((job) => job.status === "queued").length;
  const failedCount = importJobs.filter((job) => job.status === "failed").length;

  if (!latestJob) {
    return "まだ import job がありません。";
  }

  const details = [
    `${formatScopeLabel(latestJob.scopeId)} / ${formatJobStatusLabel(latestJob.status)}`,
    queuedCount > 0 ? `待機 ${queuedCount}件` : null,
    failedCount > 0 ? `失敗 ${failedCount}件` : null,
  ].filter((value): value is string => Boolean(value));

  return details.join(" | ");
}

function buildSyncStateLabel(
  syncStates: Partial<Record<StoredSyncState["id"], StoredSyncState | null>>,
): string {
  if (!syncStates["latest-summary"] && !syncStates.holdings && !syncStates["user-symbols"]) {
    return "この端末ではまだ同期されていません。";
  }

  return [
    syncStates["latest-summary"] ? "市場データ同期済み" : "市場データ未同期",
    syncStates.holdings ? "保有同期済み" : "保有未同期",
    syncStates["user-symbols"] ? "ウォッチ / 最近見た同期済み" : "ウォッチ / 最近見た未同期",
  ].join(" / ");
}

function buildSyncDetailLabel(
  syncStates: Partial<Record<StoredSyncState["id"], StoredSyncState | null>>,
): string {
  const parts = [
    syncStates["latest-summary"]
      ? `市場 ${formatDateTimeLabel(syncStates["latest-summary"]?.syncedAt)}`
      : null,
    syncStates.holdings ? `保有 ${formatDateTimeLabel(syncStates.holdings?.syncedAt)}` : null,
    syncStates["user-symbols"]
      ? `ウォッチ ${formatDateTimeLabel(syncStates["user-symbols"]?.syncedAt)}`
      : null,
  ].filter((value): value is string => Boolean(value));

  return parts.length > 0 ? parts.join(" / ") : "端末内キャッシュはまだありません。";
}

function buildTodayCandidates({
  holdingSymbolIds,
  latestBySymbolId,
  recentSymbols,
  watchSymbolIds,
  watchlist,
}: {
  holdingSymbolIds: Set<string>;
  latestBySymbolId: Map<string, LatestSymbolSummary>;
  recentSymbols: UserSymbolListItem[];
  watchSymbolIds: Set<string>;
  watchlist: UserSymbolListItem[];
}): HomeCandidate[] {
  const rankedCandidates = new Map<
    string,
    {
      item: UserSymbolListItem;
      score: number;
      wasRecentlyViewed: boolean;
    }
  >();

  for (const item of watchlist) {
    rankedCandidates.set(item.symbol.id, {
      item,
      score: 3 + (item.isHeld ? 1 : 0),
      wasRecentlyViewed: false,
    });
  }

  for (const item of recentSymbols) {
    const existing = rankedCandidates.get(item.symbol.id);

    if (existing) {
      rankedCandidates.set(item.symbol.id, {
        item: existing.item,
        score: existing.score + 2,
        wasRecentlyViewed: true,
      });
      continue;
    }

    rankedCandidates.set(item.symbol.id, {
      item,
      score: 2 + (item.isHeld ? 1 : 0),
      wasRecentlyViewed: true,
    });
  }

  return [...rankedCandidates.values()]
    .sort((left, right) => {
      return (
        right.score - left.score ||
        right.item.timestamp.localeCompare(left.item.timestamp) ||
        left.item.symbol.code.localeCompare(right.item.symbol.code, "ja")
      );
    })
    .slice(0, 3)
    .map(({ item, wasRecentlyViewed }) => {
      const latest = latestBySymbolId.get(item.symbol.id);

      return {
        code: item.symbol.code,
        id: item.symbol.id,
        isHeld: holdingSymbolIds.has(item.symbol.id),
        isWatched: watchSymbolIds.has(item.symbol.id),
        lastCloseDateLabel: formatDateLabel(latest?.lastCloseDate ?? null),
        lastCloseLabel:
          latest?.lastClose != null ? formatPriceCurrency(latest.lastClose, item.symbol.currency) : null,
        name: item.symbol.name,
        reason: buildCandidateReason({
          isHeld: holdingSymbolIds.has(item.symbol.id),
          isWatched: watchSymbolIds.has(item.symbol.id),
          wasRecentlyViewed,
        }),
        region: item.symbol.region,
        timestampLabel: formatDateTimeLabel(item.timestamp),
        wasRecentlyViewed,
      };
    });
}

function buildCandidateReason({
  isHeld,
  isWatched,
  wasRecentlyViewed,
}: {
  isHeld: boolean;
  isWatched: boolean;
  wasRecentlyViewed: boolean;
}): string {
  if (isWatched && wasRecentlyViewed && isHeld) {
    return "保有中かつウォッチ中で、直近にも確認した銘柄です。";
  }

  if (isWatched && wasRecentlyViewed) {
    return "ウォッチ中で、直近にも開いたため優先して見直したい銘柄です。";
  }

  if (isWatched && isHeld) {
    return "保有中かつウォッチ中なので、値動きを先に確認します。";
  }

  if (isWatched) {
    return "ウォッチ銘柄として追っているので、今日の確認候補に入れています。";
  }

  if (wasRecentlyViewed && isHeld) {
    return "保有中で最近も見返したため、今日の確認候補に入れています。";
  }

  if (wasRecentlyViewed) {
    return "最近見返した銘柄なので、今日の確認候補に入れています。";
  }

  return "保有中のため、今日の値動きを先に確認します。";
}

function buildPortfolioSummary({
  cashBalances,
  holdings,
  latestSummary,
  symbols,
}: {
  cashBalances: CashBalance[];
  holdings: PortfolioHolding[];
  latestSummary: LatestSummaryPayload | null;
  symbols: StoredStockSymbol[];
}): HomePortfolioSummary | null {
  if (holdings.length === 0 && cashBalances.length === 0) {
    return null;
  }

  const symbolById = new Map(symbols.map((symbol) => [symbol.id, symbol] as const));
  const latestBySymbolId = new Map(
    (latestSummary?.symbols ?? []).map((symbol) => [symbol.id, symbol] as const),
  );
  const fxRates = new Map((latestSummary?.exchangeRates ?? []).map((rate) => [rate.pair, rate.close] as const));

  const holdingValues = holdings
    .map((holding) => {
      const symbol = symbolById.get(holding.symbolId);
      const latest = latestBySymbolId.get(holding.symbolId);

      if (!symbol || latest?.lastClose == null) {
        return null;
      }

      const nativeValue = holding.quantity * latest.lastClose;
      const jpyValue = convertToJpy(nativeValue, symbol.currency, fxRates);

      if (jpyValue == null) {
        return null;
      }

      return {
        jpyValue,
        symbol,
      };
    })
    .filter((item): item is { jpyValue: number; symbol: StoredStockSymbol } => item !== null);

  const totalStockValue = holdingValues.reduce((sum, item) => sum + item.jpyValue, 0);
  const totalCashValue = cashBalances.reduce((sum, balance) => {
    const jpyValue = convertToJpy(balance.amount, balance.currency, fxRates);
    return sum + (jpyValue ?? 0);
  }, 0);
  const totalValue = totalStockValue + totalCashValue;
  const topHolding = holdingValues.sort((left, right) => right.jpyValue - left.jpyValue)[0] ?? null;

  return {
    cashRatioLabel: totalValue > 0 ? formatPercent(totalCashValue / totalValue) : "-",
    holdingCountLabel: `${holdings.length}銘柄`,
    stockRatioLabel: totalValue > 0 ? formatPercent(totalStockValue / totalValue) : "-",
    topHoldingLabel: topHolding
      ? `${topHolding.symbol.code} ${topHolding.symbol.name}`
      : "評価額算出待ち",
    totalValueLabel: formatPriceCurrency(totalValue, "JPY"),
  };
}

function buildRebalanceAlert({
  cashBalances,
  holdings,
  latestSummary,
  symbols,
}: {
  cashBalances: CashBalance[];
  holdings: PortfolioHolding[];
  latestSummary: LatestSummaryPayload | null;
  symbols: StoredStockSymbol[];
}): HomeRebalanceAlert | null {
  const summary = buildPortfolioSummary({
    cashBalances,
    holdings,
    latestSummary,
    symbols,
  });

  if (!summary || holdings.length === 0) {
    return null;
  }

  const symbolById = new Map(symbols.map((symbol) => [symbol.id, symbol] as const));
  const latestBySymbolId = new Map(
    (latestSummary?.symbols ?? []).map((symbol) => [symbol.id, symbol] as const),
  );
  const fxRates = new Map((latestSummary?.exchangeRates ?? []).map((rate) => [rate.pair, rate.close] as const));
  const valuedHoldings = holdings
    .map((holding) => {
      const symbol = symbolById.get(holding.symbolId);
      const latest = latestBySymbolId.get(holding.symbolId);

      if (!symbol || latest?.lastClose == null) {
        return null;
      }

      const jpyValue = convertToJpy(holding.quantity * latest.lastClose, symbol.currency, fxRates);

      if (jpyValue == null) {
        return null;
      }

      return { jpyValue, symbol };
    })
    .filter((item): item is { jpyValue: number; symbol: StoredStockSymbol } => item !== null)
    .sort((left, right) => right.jpyValue - left.jpyValue);

  const totalHoldingValue = valuedHoldings.reduce((sum, item) => sum + item.jpyValue, 0);

  if (totalHoldingValue === 0 || valuedHoldings.length === 0) {
    return {
      description: "最新価格または為替が不足しているため、偏りをまだ計算できません。",
      severity: "確認",
      title: "リバランス計算待ち",
    };
  }

  const topHoldingRatio = valuedHoldings[0].jpyValue / totalHoldingValue;
  const topTwoRatio =
    valuedHoldings.slice(0, 2).reduce((sum, item) => sum + item.jpyValue, 0) / totalHoldingValue;

  if (topHoldingRatio >= 0.45) {
    return {
      description: `最大保有の ${valuedHoldings[0].symbol.name} が評価額の ${formatPercent(topHoldingRatio)} を占めています。`,
      severity: "注意",
      title: "最大保有への集中が高め",
    };
  }

  if (topTwoRatio >= 0.65 && valuedHoldings.length >= 2) {
    return {
      description: `上位 2 銘柄で ${formatPercent(topTwoRatio)} を占めています。業種分散も確認したい状態です。`,
      severity: "注意",
      title: "上位 2 銘柄の偏りが大きめ",
    };
  }

  return {
    description: `${summary.stockRatioLabel} が株式、${summary.cashRatioLabel} が現金です。次の候補を追加する余地を確認します。`,
    severity: "確認",
    title: "大きな偏りは見当たりません",
  };
}

function enrichUserSymbolItems(
  items: UserSymbolListItem[],
  latestBySymbolId: Map<string, LatestSymbolSummary>,
): HomeLatestSymbolItem[] {
  return items.map((item) => {
    const latest = latestBySymbolId.get(item.symbol.id);

    return {
      ...item,
      lastCloseDateLabel: formatDateLabel(latest?.lastCloseDate ?? null),
      lastCloseLabel:
        latest?.lastClose != null ? formatPriceCurrency(latest.lastClose, item.symbol.currency) : null,
      latestStatusLabel: latest?.lastCloseDate ? "終値取得済み" : "終値未取得",
    };
  });
}

function convertToJpy(
  amount: number,
  currency: CurrencyCode,
  fxRates: Map<string, number>,
): number | null {
  if (currency === "JPY") {
    return amount;
  }

  const pair = `${currency}JPY`;
  const rate = fxRates.get(pair);

  return rate != null ? amount * rate : null;
}

function resolveMarketDate(latestSummary: LatestSummaryPayload | null): string | null {
  const dates = (latestSummary?.symbols ?? [])
    .map((symbol) => symbol.lastCloseDate)
    .filter((date): date is string => Boolean(date))
    .sort((left, right) => right.localeCompare(left));

  return dates[0] ?? null;
}

function getLatestImportJob(jobs: ImportJobRecord[]): ImportJobRecord | null {
  return (
    [...jobs].sort((left, right) =>
      (right.finishedAt ?? right.startedAt).localeCompare(left.finishedAt ?? left.startedAt),
    )[0] ?? null
  );
}

function formatScopeLabel(scopeId: ImportJobRecord["scopeId"]): string {
  if (scopeId === "JP") {
    return "日本株";
  }

  if (scopeId === "US") {
    return "米国株";
  }

  if (scopeId === "HK") {
    return "香港株";
  }

  return "為替";
}

function formatJobStatusLabel(status: ImportJobRecord["status"]): string {
  if (status === "completed") {
    return "完了";
  }

  if (status === "processing") {
    return "取り込み中";
  }

  if (status === "queued") {
    return "待機中";
  }

  return "失敗";
}

function formatCount(value: number): string {
  return `${new Intl.NumberFormat("ja-JP").format(value)}件`;
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat("ja-JP", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
    style: "percent",
  }).format(value);
}

function formatDateLabel(value: string | null | undefined): string {
  if (!value) {
    return "未取得";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ja-JP", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatDateTimeLabel(value: string | null | undefined): string {
  if (!value) {
    return "未取得";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ja-JP", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  }).format(date);
}
