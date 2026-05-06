import type { LatestSummaryPayload, RegionCode, StoredStockSymbol } from "@stock-prep/shared";

import { createStockPrepDbRepository, openStockPrepDb } from "../storage/stockPrepDb";
import { fetchLatestSummary } from "./syncApi";

export type SearchResultStatus = "ready" | "unavailable" | "unsupported";

export type SearchCatalogItem = {
  code: string;
  currency: StoredStockSymbol["currency"];
  id: string;
  lastClose: number | null;
  lastCloseDate: string | null;
  marketLabel: string;
  name: string;
  region: RegionCode;
  securityType: "etf" | "stock";
  securityTypeLabel: string;
  status: SearchResultStatus;
  statusLabel: string;
  statusReason: string | null;
};

export type SearchCatalogLoadResult = {
  datasetVersion: string | null;
  items: SearchCatalogItem[];
  latestSummaryStatus: "ready" | "unavailable";
};

export type SearchRegionFilter = "ALL" | RegionCode;

export async function loadSearchCatalog(): Promise<SearchCatalogLoadResult> {
  const db = await openStockPrepDb();

  try {
    const repository = createStockPrepDbRepository(db);
    const symbols = await repository.listSymbols();

    try {
      const latestSummary = await fetchLatestSummary();

      return {
        datasetVersion: latestSummary.datasetVersion,
        items: buildSearchCatalog({ latestSummary, symbols }),
        latestSummaryStatus: "ready",
      };
    } catch {
      return {
        datasetVersion: null,
        items: buildSearchCatalog({ latestSummary: null, symbols }),
        latestSummaryStatus: "unavailable",
      };
    }
  } finally {
    db.close();
  }
}

export function buildSearchCatalog({
  latestSummary,
  symbols,
}: {
  latestSummary: LatestSummaryPayload | null;
  symbols: StoredStockSymbol[];
}): SearchCatalogItem[] {
  const resolvedSymbols = mergeSearchSymbols({
    latestSummary,
    symbols,
  });
  const latestBySymbolId = new Map(
    (latestSummary?.symbols ?? []).map((symbol) => [symbol.id, symbol] as const),
  );

  return resolvedSymbols
    .flatMap((symbol) => {
      const securityType = normalizeSecurityType(symbol);

      if (!securityType) {
        return [];
      }

      const latest = latestBySymbolId.get(symbol.id);
      const status = resolveStatus({ hasLatest: Boolean(latest?.lastCloseDate), symbol });

      return [
        {
          code: symbol.code,
          currency: symbol.currency,
          id: symbol.id,
          lastClose: latest?.lastClose ?? null,
          lastCloseDate: latest?.lastCloseDate ?? null,
          marketLabel: formatRegionLabel(symbol.region),
          name: symbol.name,
          region: symbol.region,
          securityType,
          securityTypeLabel: formatSecurityTypeLabel(securityType),
          status,
          statusLabel: formatStatusLabel(status),
          statusReason: symbol.unsupportedReason ?? (status === "unavailable" ? "終値未取得" : null),
        },
      ];
    })
    .sort(compareSearchCatalogItem);
}

export function filterSearchCatalog(
  items: SearchCatalogItem[],
  {
    query,
    region,
  }: {
    query: string;
    region: SearchRegionFilter;
  },
): SearchCatalogItem[] {
  const normalizedQuery = query.trim().toLowerCase();

  return items
    .filter((item) => (region === "ALL" ? true : item.region === region))
    .filter((item) => {
      if (!normalizedQuery) {
        return true;
      }

      return (
        item.code.toLowerCase().includes(normalizedQuery) ||
        item.name.toLowerCase().includes(normalizedQuery)
      );
    })
    .sort((left, right) => compareSearchCatalogMatch(left, right, normalizedQuery));
}

export function formatRegionLabel(region: RegionCode): string {
  if (region === "JP") {
    return "日本";
  }

  if (region === "US") {
    return "米国";
  }

  return "香港";
}

function mergeSearchSymbols({
  latestSummary,
  symbols,
}: {
  latestSummary: LatestSummaryPayload | null;
  symbols: StoredStockSymbol[];
}): StoredStockSymbol[] {
  const merged = new Map(symbols.map((symbol) => [symbol.id, symbol] as const));

  for (const summarySymbol of latestSummary?.symbols ?? []) {
    const existing = merged.get(summarySymbol.id);

    if (existing) {
      merged.set(summarySymbol.id, {
        ...existing,
        code: summarySymbol.code,
        currency: summarySymbol.currency,
        name: summarySymbol.name,
        region: summarySymbol.region,
        securityType: summarySymbol.securityType,
        sourceSymbol: summarySymbol.sourceSymbol,
      });
      continue;
    }

    merged.set(summarySymbol.id, {
      code: summarySymbol.code,
      currency: summarySymbol.currency,
      id: summarySymbol.id,
      name: summarySymbol.name,
      region: summarySymbol.region,
      securityType: summarySymbol.securityType,
      source: "stooq",
      sourceSymbol: summarySymbol.sourceSymbol,
    });
  }

  return [...merged.values()];
}

function normalizeSecurityType(
  symbol: StoredStockSymbol,
): SearchCatalogItem["securityType"] | null {
  if (symbol.securityType === "stock" || symbol.securityType === "etf") {
    return symbol.securityType;
  }

  if (symbol.securityType === "currency") {
    return null;
  }

  return "stock";
}

function resolveStatus({
  hasLatest,
  symbol,
}: {
  hasLatest: boolean;
  symbol: StoredStockSymbol;
}): SearchResultStatus {
  if (symbol.unsupportedReason) {
    return "unsupported";
  }

  return hasLatest ? "ready" : "unavailable";
}

function formatSecurityTypeLabel(type: SearchCatalogItem["securityType"]): string {
  return type === "etf" ? "ETF" : "株式";
}

function formatStatusLabel(status: SearchResultStatus): string {
  if (status === "ready") {
    return "取得済み";
  }

  if (status === "unsupported") {
    return "未対応";
  }

  return "取得失敗";
}

function compareSearchCatalogItem(left: SearchCatalogItem, right: SearchCatalogItem): number {
  return (
    left.marketLabel.localeCompare(right.marketLabel, "ja") ||
    left.code.localeCompare(right.code, "ja")
  );
}

function compareSearchCatalogMatch(
  left: SearchCatalogItem,
  right: SearchCatalogItem,
  normalizedQuery: string,
): number {
  if (!normalizedQuery) {
    return compareSearchCatalogItem(left, right);
  }

  return (
    calculateSearchScore(left, normalizedQuery) - calculateSearchScore(right, normalizedQuery) ||
    compareSearchCatalogItem(left, right)
  );
}

function calculateSearchScore(item: SearchCatalogItem, normalizedQuery: string): number {
  const code = item.code.toLowerCase();
  const name = item.name.toLowerCase();

  if (code === normalizedQuery) {
    return 0;
  }

  if (code.startsWith(normalizedQuery)) {
    return 1;
  }

  if (name === normalizedQuery) {
    return 2;
  }

  if (name.startsWith(normalizedQuery)) {
    return 3;
  }

  if (name.includes(normalizedQuery)) {
    return 4;
  }

  return 5;
}
