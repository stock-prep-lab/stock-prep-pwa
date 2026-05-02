import JSZip from "jszip";
import type {
  CurrencyCode,
  DailyPriceBar,
  ExchangeRateBar,
  ImportScopeId,
  LatestSummaryPayload,
  MarketDataPayload,
  SecurityType,
  StoredStockSymbol,
} from "@stock-prep/shared";

import {
  appendStooqBulkFileToAccumulator,
  createStooqBulkNormalizationAccumulator,
  finalizeStooqBulkNormalizationAccumulator,
  resolveBulkCategoryRule,
  resolveSourceSymbolFromPath,
  type StooqBulkFile,
  type StooqBulkImportTarget,
  type StooqNormalizedPriceHistoryFile,
  type StooqNormalizedSymbol,
} from "../data/stooqBulk.js";

type SupportedRegion = Exclude<ImportScopeId, "FX">;

export type ScopeImportSummary = {
  dailyPriceCount: number;
  exchangeRateCount: number;
  failureCount: number;
  fileCount: number;
  generatedAt: string;
  scopeId: ImportScopeId;
  symbolCount: number;
};

export type ScreeningSnapshot = {
  candidateCount: number;
  generatedAt: string;
  topCandidates: unknown[];
};

export type StockPrepMarketDataManifest = {
  datasetVersion: string;
  generatedAt: string;
  latestSummaryKey: string;
  marketDataKey: string;
  runId: string;
  scopeSummaries: Partial<Record<ImportScopeId, ScopeImportSummary>>;
};

export type ScopeImportResult = {
  marketData: MarketDataPayload;
  screening: ScreeningSnapshot;
  summary: ScopeImportSummary;
  symbols: ImportedSymbolSnapshot[];
};

export type ImportedSymbolSnapshot = StoredStockSymbol & {
  importStatus: "failed" | "imported" | "noData" | "unsupported";
  lastClose: number | null;
  lastCloseDate: string | null;
  stooqCategory: string | null;
};

const scopeRegionMap: Record<SupportedRegion, StoredStockSymbol["region"]> = {
  HK: "HK",
  JP: "JP",
  UK: "UK",
  US: "US",
};

const regionCurrencyMap: Record<StoredStockSymbol["region"], CurrencyCode> = {
  HK: "HKD",
  JP: "JPY",
  UK: "GBP",
  US: "USD",
};

const fxSourceMap = {
  jpygbp: {
    baseCurrency: "GBP",
    pair: "GBPJPY",
  },
  jpyhkd: {
    baseCurrency: "HKD",
    pair: "HKDJPY",
  },
  jpyusd: {
    baseCurrency: "USD",
    pair: "USDJPY",
  },
} as const satisfies Record<
  string,
  Pick<ExchangeRateBar, "baseCurrency" | "pair">
>;

export function createEmptyMarketDataPayload(): MarketDataPayload {
  return {
    dailyPrices: [],
    datasetVersion: "market-data-empty",
    exchangeRates: [],
    generatedAt: new Date(0).toISOString(),
    symbols: [],
  };
}

export function buildLatestSummaryPayload(marketData: MarketDataPayload): LatestSummaryPayload {
  const latestPriceBySymbolId = new Map<string, DailyPriceBar>();

  for (const bar of marketData.dailyPrices) {
    const current = latestPriceBySymbolId.get(bar.symbolId);

    if (!current || bar.date > current.date) {
      latestPriceBySymbolId.set(bar.symbolId, bar);
    }
  }

  const latestExchangeRateByPair = new Map<ExchangeRateBar["pair"], ExchangeRateBar>();

  for (const rate of marketData.exchangeRates) {
    const current = latestExchangeRateByPair.get(rate.pair);

    if (!current || rate.date > current.date) {
      latestExchangeRateByPair.set(rate.pair, rate);
    }
  }

  return {
    datasetVersion: marketData.datasetVersion,
    exchangeRates: [...latestExchangeRateByPair.values()]
      .map((rate) => ({
        baseCurrency: rate.baseCurrency,
        close: rate.close,
        date: rate.date,
        pair: rate.pair,
        quoteCurrency: rate.quoteCurrency,
      }))
      .sort((left, right) => left.pair.localeCompare(right.pair)),
    generatedAt: marketData.generatedAt,
    symbols: marketData.symbols
      .map((symbol) => {
        const latestBar = latestPriceBySymbolId.get(symbol.id);

        return {
          code: symbol.code,
          currency: symbol.currency,
          id: symbol.id,
          lastClose: latestBar?.close ?? null,
          lastCloseDate: latestBar?.date ?? null,
          name: symbol.name,
          region: symbol.region,
          securityType: symbol.securityType,
          sourceSymbol: symbol.sourceSymbol,
        };
      })
      .sort(compareLatestSymbolSummary),
  };
}

export async function extractStooqBulkFilesFromZip(
  zipBytes: Uint8Array,
): Promise<StooqBulkFile[]> {
  const zip = await JSZip.loadAsync(zipBytes);
  const files = await Promise.all(
    Object.values(zip.files)
      .filter((entry) => !entry.dir && entry.name.toLowerCase().endsWith(".txt"))
      .map(async (entry) => ({
        content: await entry.async("string"),
        path: entry.name,
      })),
  );

  return files.sort((left, right) => left.path.localeCompare(right.path));
}

export async function importBulkScopeFromZip({
  currentMarketData,
  generatedAt = new Date().toISOString(),
  referenceSymbols = currentMarketData.symbols,
  scopeId,
  zipBytes,
}: {
  currentMarketData: MarketDataPayload;
  generatedAt?: string;
  referenceSymbols?: StoredStockSymbol[];
  scopeId: ImportScopeId;
  zipBytes: Uint8Array;
}): Promise<ScopeImportResult> {
  const zip = await JSZip.loadAsync(zipBytes);
  const txtEntries = Object.values(zip.files)
    .filter((entry) => !entry.dir && entry.name.toLowerCase().endsWith(".txt"))
    .sort((left, right) => left.name.localeCompare(right.name));

  if (scopeId === "FX") {
    const exchangeRates = await parseWorldCurrencyEntries(txtEntries);

    if (exchangeRates.length === 0) {
      throw new Error("world ZIP から対象為替ペアを見つけられませんでした。");
    }

    const marketData = mergeMarketDataScope({
      currentMarketData,
      generatedAt,
      importedDailyPrices: [],
      importedExchangeRates: exchangeRates,
      importedSymbols: [],
      scopeId,
    });

    return {
      marketData,
      screening: await createScreeningSnapshot({ generatedAt, marketData }),
      summary: {
        dailyPriceCount: 0,
        exchangeRateCount: exchangeRates.length,
        failureCount: 0,
        fileCount: txtEntries.length,
        generatedAt,
        scopeId,
        symbolCount: 0,
      },
      symbols: [],
    };
  }

  const inferredTargets = inferTargetsFromBulkPaths(
    txtEntries.map((entry) => entry.name),
    scopeId,
  );
  const accumulator = createStooqBulkNormalizationAccumulator({
    targets: inferredTargets.targets,
  });

  for (const entry of txtEntries) {
    appendStooqBulkFileToAccumulator({
      accumulator,
      file: {
        content: await entry.async("string"),
        path: entry.name,
      },
    });
  }

  const normalized = finalizeStooqBulkNormalizationAccumulator(accumulator);

  if (inferredTargets.targets.length === 0) {
    throw new Error(`${scopeId} ZIP から対象カテゴリの .txt を見つけられませんでした。`);
  }

  const existingNameBySourceSymbol = new Map(
    referenceSymbols.map((symbol) => [symbol.sourceSymbol, symbol.name]),
  );
  const importedSymbols = buildImportedSymbols({
    categoryBySourceSymbol: inferredTargets.categoryBySourceSymbol,
    existingNameBySourceSymbol,
    histories: normalized.histories,
    symbols: normalized.symbols,
  });
  const marketData = mergeMarketDataScope({
    currentMarketData,
    generatedAt,
    importedDailyPrices: normalized.histories.flatMap((history) => history.bars),
    importedExchangeRates: [],
    importedSymbols: importedSymbols.map(stripImportedSymbolSnapshot),
    scopeId,
  });

  return {
    marketData,
    screening: await createScreeningSnapshot({ generatedAt, marketData }),
    summary: {
      dailyPriceCount: normalized.histories.reduce((total, history) => total + history.bars.length, 0),
      exchangeRateCount: 0,
      failureCount: normalized.failures.length,
      fileCount: txtEntries.length,
      generatedAt,
      scopeId,
      symbolCount: importedSymbols.length,
    },
    symbols: importedSymbols,
  };
}

function inferTargetsFromBulkPaths(
  paths: readonly string[],
  scopeId: SupportedRegion,
): {
  categoryBySourceSymbol: Map<string, string>;
  targets: StooqBulkImportTarget[];
} {
  const categoryBySourceSymbol = new Map<string, string>();
  const targetsBySourceSymbol = new Map<string, StooqBulkImportTarget>();

  for (const path of paths) {
    const rule = resolveBulkCategoryRule(path);

    if (!rule || rule.kind === "unsupported" || rule.region !== scopeRegionMap[scopeId]) {
      continue;
    }

    const sourceSymbol = resolveSourceSymbolFromPath(path).toLowerCase();
    const [rawCode = sourceSymbol] = sourceSymbol.split(".");
    const securityType = normalizeSecurityType(rule.instrumentType);

    if (categoryBySourceSymbol.has(sourceSymbol)) {
      continue;
    }

    categoryBySourceSymbol.set(sourceSymbol, rule.pathFragment);
    targetsBySourceSymbol.set(sourceSymbol, {
      code: rawCode.toUpperCase(),
      currency: regionCurrencyMap[rule.region],
      instrumentType: securityType === "stock" ? "stock" : "etf",
      name: rawCode.toUpperCase(),
      region: rule.region,
      sourceSymbol,
    });
  }

  return {
    categoryBySourceSymbol,
    targets: [...targetsBySourceSymbol.values()].sort((left, right) =>
      left.sourceSymbol.localeCompare(right.sourceSymbol),
    ),
  };
}

function buildImportedSymbols({
  categoryBySourceSymbol,
  existingNameBySourceSymbol,
  histories,
  symbols,
}: {
  categoryBySourceSymbol: Map<string, string>;
  existingNameBySourceSymbol: Map<string, string>;
  histories: readonly StooqNormalizedPriceHistoryFile[];
  symbols: readonly StooqNormalizedSymbol[];
}): ImportedSymbolSnapshot[] {
  const latestPriceBySymbolId = new Map(
    histories.map((history) => {
      const latestBar = history.bars.reduce((latest, candidate) =>
        candidate.date > latest.date ? candidate : latest,
      );
      return [history.symbolId, latestBar] as const;
    }),
  );

  return symbols.map((symbol) => {
    const latestBar = latestPriceBySymbolId.get(symbol.id);

    return {
      code: symbol.code,
      currency: symbol.currency,
      id: symbol.id,
      importStatus: symbol.importStatus,
      lastClose: latestBar?.close ?? null,
      lastCloseDate: latestBar?.date ?? null,
      name: existingNameBySourceSymbol.get(symbol.sourceSymbol) ?? symbol.name,
      region: symbol.region,
      securityType: normalizeSecurityType(symbol.instrumentType),
      source: symbol.source,
      sourceSymbol: symbol.sourceSymbol,
      stooqCategory: categoryBySourceSymbol.get(symbol.sourceSymbol) ?? null,
      unsupportedReason: symbol.lastImportError,
    };
  });
}

function stripImportedSymbolSnapshot(symbol: ImportedSymbolSnapshot): StoredStockSymbol {
  return {
    code: symbol.code,
    currency: symbol.currency,
    id: symbol.id,
    name: symbol.name,
    region: symbol.region,
    securityType: symbol.securityType,
    source: symbol.source,
    sourceSymbol: symbol.sourceSymbol,
    unsupportedReason: symbol.unsupportedReason,
  };
}

function mergeMarketDataScope({
  currentMarketData,
  generatedAt,
  importedDailyPrices,
  importedExchangeRates,
  importedSymbols,
  scopeId,
}: {
  currentMarketData: MarketDataPayload;
  generatedAt: string;
  importedDailyPrices: DailyPriceBar[];
  importedExchangeRates: ExchangeRateBar[];
  importedSymbols: StoredStockSymbol[];
  scopeId: ImportScopeId;
}): MarketDataPayload {
  const nextDatasetVersion = `market-data-${generatedAt}`;

  if (scopeId === "FX") {
    return {
      ...currentMarketData,
      datasetVersion: nextDatasetVersion,
      exchangeRates: [...importedExchangeRates].sort(compareExchangeRateBars),
      generatedAt,
    };
  }

  const region = scopeRegionMap[scopeId];

  return {
    dailyPrices: [
      ...currentMarketData.dailyPrices.filter((bar) => bar.region !== region),
      ...importedDailyPrices,
    ].sort(compareDailyPriceBars),
    datasetVersion: nextDatasetVersion,
    exchangeRates: currentMarketData.exchangeRates,
    generatedAt,
    symbols: [
      ...currentMarketData.symbols.filter((symbol) => symbol.region !== region),
      ...importedSymbols,
    ].sort(compareSymbols),
  };
}

async function parseWorldCurrencyEntries(
  entries: readonly { name: string; async(type: "string"): Promise<string> }[],
): Promise<ExchangeRateBar[]> {
  const barsById = new Map<string, ExchangeRateBar>();

  for (const entry of entries) {
    const sourceSymbol = resolveSourceSymbolFromPath(entry.name).toLowerCase();
    const mapping = fxSourceMap[sourceSymbol as keyof typeof fxSourceMap];

    if (!entry.name.toLowerCase().includes("/currencies/") || !mapping) {
      continue;
    }

    const content = await entry.async("string");

    for (const line of content.split(/\r?\n/).map((row) => row.trim()).filter(Boolean)) {
      if (line.startsWith("<TICKER>")) {
        continue;
      }

      const columns = line.split(",").map((value) => value.trim());

      if (columns.length < 8) {
        throw new Error(`Unexpected FX ASCII row for ${sourceSymbol}.`);
      }

      const [, , rawDate, , , , , rawClose] = columns;
      const close = Number(rawClose);

      if (!rawDate || !Number.isFinite(close) || close <= 0) {
        throw new Error(`Unexpected FX ASCII values for ${sourceSymbol}.`);
      }

      const date = toIsoDate(rawDate);
      const invertedClose = Number((1 / close).toFixed(6));
      const id = `${mapping.pair}-${date}`;

      barsById.set(id, {
        baseCurrency: mapping.baseCurrency,
        close: invertedClose,
        date,
        id,
        pair: mapping.pair,
        quoteCurrency: "JPY",
      });
    }
  }

  return [...barsById.values()].sort(compareExchangeRateBars);
}

async function createScreeningSnapshot({
  generatedAt,
  marketData,
}: {
  generatedAt: string;
  marketData: MarketDataPayload;
}): Promise<ScreeningSnapshot> {
  const { buildScreeningCandidates } = await import("@stock-prep/domain");
  const topCandidates = buildScreeningCandidates({
    dailyPrices: marketData.dailyPrices,
    exchangeRates: marketData.exchangeRates,
    limit: 50,
    symbols: marketData.symbols,
  });

  return {
    candidateCount: topCandidates.length,
    generatedAt,
    topCandidates,
  };
}

function normalizeSecurityType(instrumentType: "etf" | "reit" | "stock"): SecurityType {
  if (instrumentType === "stock") {
    return "stock";
  }

  return "etf";
}

function toIsoDate(rawDate: string): string {
  if (!/^\d{8}$/.test(rawDate)) {
    throw new Error(`Unexpected date value: ${rawDate}`);
  }

  return `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
}

function compareDailyPriceBars(left: DailyPriceBar, right: DailyPriceBar): number {
  return (
    left.symbolId.localeCompare(right.symbolId) ||
    left.date.localeCompare(right.date)
  );
}

function compareExchangeRateBars(left: ExchangeRateBar, right: ExchangeRateBar): number {
  return left.pair.localeCompare(right.pair) || left.date.localeCompare(right.date);
}

function compareSymbols(left: StoredStockSymbol, right: StoredStockSymbol): number {
  return left.id.localeCompare(right.id);
}

function compareLatestSymbolSummary(
  left: LatestSummaryPayload["symbols"][number],
  right: LatestSummaryPayload["symbols"][number],
): number {
  return compareByRegionCode(left.region, right.region) || left.code.localeCompare(right.code);
}

function compareByRegionCode(
  left: LatestSummaryPayload["symbols"][number]["region"],
  right: LatestSummaryPayload["symbols"][number]["region"],
): number {
  return left.localeCompare(right);
}
