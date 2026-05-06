import type {
  DailyPriceBar,
  ExchangeRateBar,
  ImportScopeId,
  MarketDataPayload,
  StoredStockSymbol,
} from "@stock-prep/shared";

import { buildLatestSummaryPayload } from "./stockPrepImport.js";
import { mapWithConcurrency } from "./asyncConcurrency.js";

const defaultDailyPriceChunkSize = 20_000;
const defaultLoadChunkConcurrency = 4;
const scopeOrder = ["JP", "US", "HK", "FX"] as const satisfies readonly ImportScopeId[];

type ScopeArtifactReference = {
  latestSummaryKey: string;
  marketDataKey: string;
  scopeId: ImportScopeId;
};

type ScopedMarketDataRootArtifact = {
  datasetVersion: string;
  format: "scoped-v1";
  generatedAt: string;
  scopeArtifacts: Partial<Record<ImportScopeId, ScopeArtifactReference>>;
};

type ScopeChunkedMarketDataArtifact = {
  dailyPriceChunkKeys: string[];
  datasetVersion: string;
  exchangeRatesKey: string;
  format: "scope-chunked-v1";
  generatedAt: string;
  historyIndexKey: string;
  latestSummaryKey: string;
  scopeId: ImportScopeId;
  symbolsKey: string;
};

type ScopeHistoryIndexArtifact = {
  chunks: string[];
  format: "scope-history-index-v1";
  scopeId: ImportScopeId;
  symbols: Record<string, number[]>;
};

type LegacyChunkedMarketDataArtifact = {
  dailyPriceChunkKeys: string[];
  datasetVersion: string;
  exchangeRatesKey: string;
  format: "chunked-v1";
  generatedAt: string;
  symbolsKey: string;
};

type PersistedJsonObject = {
  body: unknown;
  key: string;
};

type ScopeStoragePlan = {
  artifact: ScopeChunkedMarketDataArtifact;
  artifactKey: string;
  artifactKeys: string[];
  objects: PersistedJsonObject[];
};

export function planPersistedMarketData({
  baseKey,
  chunkSize = defaultDailyPriceChunkSize,
  marketData,
}: {
  baseKey: string;
  chunkSize?: number;
  marketData: MarketDataPayload;
}): {
  artifact: ScopedMarketDataRootArtifact;
  artifactKeys: string[];
  artifactKeysByScope: Partial<Record<ImportScopeId, string[]>>;
  objects: PersistedJsonObject[];
} {
  const rootDir = resolveRootDirectory(baseKey);
  const scopePlans = scopeOrder
    .map((scopeId) => createScopeStoragePlan({ chunkSize, marketData, rootDir, scopeId }))
    .filter((plan): plan is ScopeStoragePlan => plan !== null);

  const artifact: ScopedMarketDataRootArtifact = {
    datasetVersion: marketData.datasetVersion,
    format: "scoped-v1",
    generatedAt: marketData.generatedAt,
    scopeArtifacts: Object.fromEntries(
      scopePlans.map((plan) => [
        plan.artifact.scopeId,
        {
          latestSummaryKey: plan.artifact.latestSummaryKey,
          marketDataKey: plan.artifactKey,
          scopeId: plan.artifact.scopeId,
        },
      ]),
    ) as Partial<Record<ImportScopeId, ScopeArtifactReference>>,
  };

  return {
    artifact,
    artifactKeys: [
      baseKey,
      ...scopePlans.flatMap((plan) => plan.artifactKeys),
    ],
    artifactKeysByScope: Object.fromEntries(
      scopePlans.map((plan) => [plan.artifact.scopeId, plan.artifactKeys]),
    ) as Partial<Record<ImportScopeId, string[]>>,
    objects: [
      ...scopePlans.flatMap((plan) => plan.objects),
      {
        body: artifact,
        key: baseKey,
      },
    ],
  };
}

export async function loadPersistedHistoryBarsForSymbol({
  chunkConcurrency = defaultLoadChunkConcurrency,
  key,
  readJson,
  scopeId,
  symbolId,
}: {
  chunkConcurrency?: number;
  key: string;
  readJson: <T>(key: string) => Promise<T>;
  scopeId?: ImportScopeId;
  symbolId: string;
}): Promise<DailyPriceBar[]> {
  const root = await readJson<unknown>(key);

  if (isScopedMarketDataRootArtifact(root)) {
    const resolvedScopeId = scopeId ?? inferScopeIdFromSymbolId(symbolId);

    if (!resolvedScopeId) {
      return [];
    }

    const scopeArtifactRef = root.scopeArtifacts[resolvedScopeId];

    if (!scopeArtifactRef) {
      return [];
    }

    const scopeArtifact = await readJson<ScopeChunkedMarketDataArtifact>(scopeArtifactRef.marketDataKey);
    const historyIndex = await readJson<ScopeHistoryIndexArtifact>(scopeArtifact.historyIndexKey);
    const chunkIndexes = historyIndex.symbols[symbolId] ?? [];
    const chunkKeys = chunkIndexes.map((index) => historyIndex.chunks[index]).filter(isNonNullable);

    const chunks = await mapWithConcurrency({
      concurrency: chunkConcurrency,
      items: chunkKeys,
      mapper: (chunkKey) => readJson<DailyPriceBar[]>(chunkKey),
    });

    return chunks.flat().filter((bar) => bar.symbolId === symbolId).sort(compareDailyPriceBars);
  }

  const persisted = await loadPersistedMarketData({
    chunkConcurrency,
    key,
    readJson,
  });

  return persisted.marketData.dailyPrices
    .filter((bar) => bar.symbolId === symbolId)
    .sort(compareDailyPriceBars);
}

export async function loadPersistedMarketData({
  chunkConcurrency = defaultLoadChunkConcurrency,
  key,
  readJson,
}: {
  chunkConcurrency?: number;
  key: string;
  readJson: <T>(key: string) => Promise<T>;
}): Promise<{
  artifactKeys: string[];
  artifactKeysByScope: Partial<Record<ImportScopeId, string[]>>;
  marketData: MarketDataPayload;
}> {
  const root = await readJson<unknown>(key);

  if (isScopedMarketDataRootArtifact(root)) {
    const loadedScopes = await mapWithConcurrency({
      concurrency: chunkConcurrency,
      items: scopeOrder.filter((scopeId) => root.scopeArtifacts[scopeId]),
      mapper: async (scopeId) => {
        const scopeArtifactRef = root.scopeArtifacts[scopeId]!;
        return loadScopePersistedMarketData({
          chunkConcurrency,
          key: scopeArtifactRef.marketDataKey,
          readJson,
        });
      },
    });

    return {
      artifactKeys: [
        key,
        ...loadedScopes.flatMap((scope) => scope.artifactKeys),
      ],
      artifactKeysByScope: Object.fromEntries(
        loadedScopes.map((scope) => [scope.scopeId, scope.artifactKeys]),
      ) as Partial<Record<ImportScopeId, string[]>>,
      marketData: mergeScopePayloads(
        loadedScopes.map((scope) => scope.marketData),
        root.datasetVersion,
        root.generatedAt,
      ),
    };
  }

  if (isLegacyChunkedMarketDataArtifact(root)) {
    const [symbols, exchangeRates, dailyPriceChunks] = await Promise.all([
      readJson<StoredStockSymbol[]>(root.symbolsKey),
      readJson<ExchangeRateBar[]>(root.exchangeRatesKey),
      mapWithConcurrency({
        concurrency: chunkConcurrency,
        items: root.dailyPriceChunkKeys,
        mapper: (chunkKey) => readJson<DailyPriceBar[]>(chunkKey),
      }),
    ]);

    return {
      artifactKeys: [
        key,
        root.symbolsKey,
        root.exchangeRatesKey,
        ...root.dailyPriceChunkKeys,
      ],
      artifactKeysByScope: {},
      marketData: {
        dailyPrices: dailyPriceChunks.flat(),
        datasetVersion: root.datasetVersion,
        exchangeRates,
        generatedAt: root.generatedAt,
        symbols,
      },
    };
  }

  return {
    artifactKeys: [key],
    artifactKeysByScope: {},
    marketData: root as MarketDataPayload,
  };
}

function buildHistoryIndex({
  chunkKeys,
  dailyPriceChunks,
  scopeId,
}: {
  chunkKeys: readonly string[];
  dailyPriceChunks: readonly DailyPriceBar[][];
  scopeId: ImportScopeId;
}): ScopeHistoryIndexArtifact {
  const chunkIndexesBySymbolId = new Map<string, number[]>();

  dailyPriceChunks.forEach((chunk, chunkIndex) => {
    const seenSymbolIds = new Set<string>();

    for (const bar of chunk) {
      if (seenSymbolIds.has(bar.symbolId)) {
        continue;
      }

      seenSymbolIds.add(bar.symbolId);
      const existing = chunkIndexesBySymbolId.get(bar.symbolId) ?? [];
      existing.push(chunkIndex);
      chunkIndexesBySymbolId.set(bar.symbolId, existing);
    }
  });

  return {
    chunks: [...chunkKeys],
    format: "scope-history-index-v1",
    scopeId,
    symbols: Object.fromEntries(chunkIndexesBySymbolId.entries()),
  };
}

function chunkArray<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size <= 0) {
    throw new Error("chunk size must be a positive integer");
  }

  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function compareDailyPriceBars(left: DailyPriceBar, right: DailyPriceBar): number {
  return left.symbolId.localeCompare(right.symbolId) || left.date.localeCompare(right.date);
}

function compareExchangeRateBars(left: ExchangeRateBar, right: ExchangeRateBar): number {
  return left.pair.localeCompare(right.pair) || left.date.localeCompare(right.date);
}

function compareSymbols(left: StoredStockSymbol, right: StoredStockSymbol): number {
  return left.id.localeCompare(right.id);
}

function createScopePayload({
  generatedAt,
  marketData,
  scopeId,
}: {
  generatedAt: string;
  marketData: MarketDataPayload;
  scopeId: ImportScopeId;
}): MarketDataPayload {
  if (scopeId === "FX") {
    return {
      dailyPrices: [],
      datasetVersion: marketData.datasetVersion,
      exchangeRates: marketData.exchangeRates,
      generatedAt,
      symbols: [],
    };
  }

  return {
    dailyPrices: marketData.dailyPrices.filter((bar) => bar.region === scopeId),
    datasetVersion: marketData.datasetVersion,
    exchangeRates: [],
    generatedAt,
    symbols: marketData.symbols.filter((symbol) => symbol.region === scopeId),
  };
}

function createScopeStoragePlan({
  chunkSize,
  marketData,
  rootDir,
  scopeId,
}: {
  chunkSize: number;
  marketData: MarketDataPayload;
  rootDir: string;
  scopeId: ImportScopeId;
}): ScopeStoragePlan | null {
  const scopePayload = createScopePayload({
    generatedAt: marketData.generatedAt,
    marketData,
    scopeId,
  });

  if (
    scopePayload.dailyPrices.length === 0 &&
    scopePayload.exchangeRates.length === 0 &&
    scopePayload.symbols.length === 0
  ) {
    return null;
  }

  const scopeDir = `${rootDir}/${scopeId.toLowerCase()}`;
  const artifactKey = `${scopeDir}/market-data.json`;
  const prefix = `${scopeDir}/market-data`;
  const symbolsKey = `${prefix}.symbols.json`;
  const exchangeRatesKey = `${prefix}.exchange-rates.json`;
  const latestSummaryKey = `${scopeDir}/latest-summary.json`;
  const historyIndexKey = `${scopeDir}/history-index.json`;
  const dailyPriceChunks = chunkArray(scopePayload.dailyPrices, chunkSize);
  const dailyPriceChunkKeys = dailyPriceChunks.map(
    (_chunk, index) => `${prefix}.daily-prices.${String(index).padStart(4, "0")}.json`,
  );
  const historyIndex = buildHistoryIndex({
    chunkKeys: dailyPriceChunkKeys,
    dailyPriceChunks,
    scopeId,
  });

  const artifact: ScopeChunkedMarketDataArtifact = {
    dailyPriceChunkKeys,
    datasetVersion: scopePayload.datasetVersion,
    exchangeRatesKey,
    format: "scope-chunked-v1",
    generatedAt: scopePayload.generatedAt,
    historyIndexKey,
    latestSummaryKey,
    scopeId,
    symbolsKey,
  };

  return {
    artifact,
    artifactKey,
    artifactKeys: [
      artifactKey,
      symbolsKey,
      exchangeRatesKey,
      historyIndexKey,
      latestSummaryKey,
      ...dailyPriceChunkKeys,
    ],
    objects: [
      {
        body: scopePayload.symbols,
        key: symbolsKey,
      },
      {
        body: scopePayload.exchangeRates,
        key: exchangeRatesKey,
      },
      ...dailyPriceChunks.map((chunk, index) => ({
        body: chunk,
        key: dailyPriceChunkKeys[index]!,
      })),
      {
        body: historyIndex,
        key: historyIndexKey,
      },
      {
        body: buildLatestSummaryPayload(scopePayload),
        key: latestSummaryKey,
      },
      {
        body: artifact,
        key: artifactKey,
      },
    ],
  };
}

function inferScopeIdFromSymbolId(symbolId: string): ImportScopeId | null {
  const prefix = symbolId.split("-")[0]?.toUpperCase();

  if (prefix === "JP" || prefix === "US" || prefix === "HK") {
    return prefix;
  }

  return null;
}

function isChunkedScopeMarketDataArtifact(value: unknown): value is ScopeChunkedMarketDataArtifact {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<ScopeChunkedMarketDataArtifact>;

  return (
    candidate.format === "scope-chunked-v1" &&
    typeof candidate.datasetVersion === "string" &&
    typeof candidate.generatedAt === "string" &&
    typeof candidate.historyIndexKey === "string" &&
    typeof candidate.latestSummaryKey === "string" &&
    typeof candidate.scopeId === "string" &&
    typeof candidate.symbolsKey === "string" &&
    typeof candidate.exchangeRatesKey === "string" &&
    Array.isArray(candidate.dailyPriceChunkKeys)
  );
}

function isLegacyChunkedMarketDataArtifact(value: unknown): value is LegacyChunkedMarketDataArtifact {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<LegacyChunkedMarketDataArtifact>;

  return (
    candidate.format === "chunked-v1" &&
    typeof candidate.datasetVersion === "string" &&
    typeof candidate.generatedAt === "string" &&
    typeof candidate.symbolsKey === "string" &&
    typeof candidate.exchangeRatesKey === "string" &&
    Array.isArray(candidate.dailyPriceChunkKeys)
  );
}

function isNonNullable<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function isScopedMarketDataRootArtifact(value: unknown): value is ScopedMarketDataRootArtifact {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<ScopedMarketDataRootArtifact>;

  return (
    candidate.format === "scoped-v1" &&
    typeof candidate.datasetVersion === "string" &&
    typeof candidate.generatedAt === "string" &&
    typeof candidate.scopeArtifacts === "object" &&
    candidate.scopeArtifacts !== null
  );
}

async function loadScopePersistedMarketData({
  chunkConcurrency,
  key,
  readJson,
}: {
  chunkConcurrency: number;
  key: string;
  readJson: <T>(key: string) => Promise<T>;
}): Promise<{
  artifactKeys: string[];
  marketData: MarketDataPayload;
  scopeId: ImportScopeId;
}> {
  const scopeArtifact = await readJson<unknown>(key);

  if (!isChunkedScopeMarketDataArtifact(scopeArtifact)) {
    throw new Error(`Unexpected scope market data artifact: ${key}`);
  }

  const [symbols, exchangeRates, dailyPriceChunks] = await Promise.all([
    readJson<StoredStockSymbol[]>(scopeArtifact.symbolsKey),
    readJson<ExchangeRateBar[]>(scopeArtifact.exchangeRatesKey),
    mapWithConcurrency({
      concurrency: chunkConcurrency,
      items: scopeArtifact.dailyPriceChunkKeys,
      mapper: (chunkKey) => readJson<DailyPriceBar[]>(chunkKey),
    }),
  ]);

  return {
    artifactKeys: [
      key,
      scopeArtifact.symbolsKey,
      scopeArtifact.exchangeRatesKey,
      scopeArtifact.historyIndexKey,
      scopeArtifact.latestSummaryKey,
      ...scopeArtifact.dailyPriceChunkKeys,
    ],
    marketData: {
      dailyPrices: dailyPriceChunks.flat(),
      datasetVersion: scopeArtifact.datasetVersion,
      exchangeRates,
      generatedAt: scopeArtifact.generatedAt,
      symbols,
    },
    scopeId: scopeArtifact.scopeId,
  };
}

function mergeScopePayloads(
  scopePayloads: readonly MarketDataPayload[],
  datasetVersion: string,
  generatedAt: string,
): MarketDataPayload {
  return {
    dailyPrices: scopePayloads.flatMap((scopePayload) => scopePayload.dailyPrices).sort(compareDailyPriceBars),
    datasetVersion,
    exchangeRates: scopePayloads
      .flatMap((scopePayload) => scopePayload.exchangeRates)
      .sort(compareExchangeRateBars),
    generatedAt,
    symbols: scopePayloads.flatMap((scopePayload) => scopePayload.symbols).sort(compareSymbols),
  };
}

function resolveRootDirectory(key: string): string {
  const lastSlashIndex = key.lastIndexOf("/");

  return lastSlashIndex === -1 ? "." : key.slice(0, lastSlashIndex);
}
