import type {
  DailyPriceBar,
  ExchangeRateBar,
  MarketDataPayload,
  StoredStockSymbol,
} from "@stock-prep/shared";

import { mapWithConcurrency } from "./asyncConcurrency.js";

const defaultDailyPriceChunkSize = 20_000;
const defaultLoadChunkConcurrency = 4;

type ChunkedMarketDataArtifact = {
  datasetVersion: string;
  dailyPriceChunkKeys: string[];
  exchangeRatesKey: string;
  format: "chunked-v1";
  generatedAt: string;
  symbolsKey: string;
};

type PersistedJsonObject = {
  body: unknown;
  key: string;
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
  artifactKeys: string[];
  artifact: ChunkedMarketDataArtifact;
  objects: PersistedJsonObject[];
} {
  const prefix = baseKey.endsWith(".json") ? baseKey.slice(0, -".json".length) : baseKey;
  const symbolsKey = `${prefix}.symbols.json`;
  const exchangeRatesKey = `${prefix}.exchange-rates.json`;
  const dailyPriceChunkKeys = chunkArray(marketData.dailyPrices, chunkSize).map(
    (_chunk, index) => `${prefix}.daily-prices.${String(index).padStart(4, "0")}.json`,
  );

  const artifact: ChunkedMarketDataArtifact = {
    datasetVersion: marketData.datasetVersion,
    dailyPriceChunkKeys,
    exchangeRatesKey,
    format: "chunked-v1",
    generatedAt: marketData.generatedAt,
    symbolsKey,
  };

  return {
    artifactKeys: [baseKey, symbolsKey, exchangeRatesKey, ...dailyPriceChunkKeys],
    artifact,
    objects: [
      {
        body: marketData.symbols,
        key: symbolsKey,
      },
      {
        body: marketData.exchangeRates,
        key: exchangeRatesKey,
      },
      ...chunkArray(marketData.dailyPrices, chunkSize).map((chunk, index) => ({
        body: chunk,
        key: dailyPriceChunkKeys[index]!,
      })),
      {
        body: artifact,
        key: baseKey,
      },
    ],
  };
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
  marketData: MarketDataPayload;
}> {
  const root = await readJson<unknown>(key);

  if (!isChunkedMarketDataArtifact(root)) {
    return {
      artifactKeys: [key],
      marketData: root as MarketDataPayload,
    };
  }

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
    marketData: {
      dailyPrices: dailyPriceChunks.flat(),
      datasetVersion: root.datasetVersion,
      exchangeRates,
      generatedAt: root.generatedAt,
      symbols,
    },
  };
}

function isChunkedMarketDataArtifact(value: unknown): value is ChunkedMarketDataArtifact {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<ChunkedMarketDataArtifact>;

  return (
    candidate.format === "chunked-v1" &&
    typeof candidate.datasetVersion === "string" &&
    typeof candidate.generatedAt === "string" &&
    typeof candidate.symbolsKey === "string" &&
    typeof candidate.exchangeRatesKey === "string" &&
    Array.isArray(candidate.dailyPriceChunkKeys)
  );
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
