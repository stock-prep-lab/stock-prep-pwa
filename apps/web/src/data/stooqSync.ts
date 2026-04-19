import type { StoredStockSymbol } from "@stock-prep/shared";

import type { StockPrepDbRepository } from "../storage/stockPrepDb";
import {
  createStooqClient,
  StooqApiKeyMissingError,
  stooqEquityImportTargets,
  stooqExchangeRatePairs,
  StooqUnsupportedDataError,
  toStoredStockSymbol,
  type StooqClient,
  type StooqEquityImportTarget,
  type StooqExchangeRatePair,
} from "./stooqClient";

export type StooqImportFailure = {
  kind: "dailyPrice" | "exchangeRate";
  reason: string;
  sourceSymbol: string;
};

export type StooqSyncResult = {
  failures: StooqImportFailure[];
  importedDailyPriceCount: number;
  importedExchangeRateCount: number;
  importedSymbolCount: number;
};

export type SyncStooqDailyDataOptions = {
  client?: StooqClient;
  equityTargets?: StooqEquityImportTarget[];
  exchangeRatePairs?: readonly StooqExchangeRatePair[];
  repository: StockPrepDbRepository;
};

export type StartupStooqSyncResult =
  | {
      reason: "missing-api-key";
      status: "skipped";
    }
  | {
      result: StooqSyncResult;
      status: "completed";
    };

export async function syncStooqDailyData({
  client = createStooqClient(),
  equityTargets = stooqEquityImportTargets,
  exchangeRatePairs = stooqExchangeRatePairs,
  repository,
}: SyncStooqDailyDataOptions): Promise<StooqSyncResult> {
  const result: StooqSyncResult = {
    failures: [],
    importedDailyPriceCount: 0,
    importedExchangeRateCount: 0,
    importedSymbolCount: 0,
  };

  for (const target of equityTargets) {
    const symbol = toStoredStockSymbol(target);
    await repository.putSymbol(symbol);
    result.importedSymbolCount += 1;

    try {
      const prices = await client.fetchDailyPrices(target);
      await Promise.all(prices.map((price) => repository.putDailyPrice(price)));
      result.importedDailyPriceCount += prices.length;
    } catch (error) {
      const failure = toStooqImportFailure(error, "dailyPrice", target.sourceSymbol);
      result.failures.push(failure);
      await repository.putSymbol(markSymbolUnsupported(symbol, failure.reason));
    }
  }

  for (const pair of exchangeRatePairs) {
    try {
      const rates = await client.fetchExchangeRates(pair);
      await Promise.all(rates.map((rate) => repository.putExchangeRate(rate)));
      result.importedExchangeRateCount += rates.length;
    } catch (error) {
      result.failures.push(toStooqImportFailure(error, "exchangeRate", pair.toLowerCase()));
    }
  }

  return result;
}

export async function runStartupStooqSync({
  apiKey,
  fetcher,
  repository,
}: {
  apiKey?: string | null;
  fetcher?: typeof fetch;
  repository: StockPrepDbRepository;
}): Promise<StartupStooqSyncResult> {
  try {
    const client = createStooqClient({ apiKey, fetcher });
    const result = await syncStooqDailyData({ client, repository });
    return {
      result,
      status: "completed",
    };
  } catch (error) {
    if (error instanceof StooqApiKeyMissingError) {
      return {
        reason: "missing-api-key",
        status: "skipped",
      };
    }

    throw error;
  }
}

function markSymbolUnsupported(symbol: StoredStockSymbol, reason: string): StoredStockSymbol {
  return {
    ...symbol,
    unsupportedReason: reason,
  };
}

function toStooqImportFailure(
  error: unknown,
  kind: StooqImportFailure["kind"],
  sourceSymbol: string,
): StooqImportFailure {
  if (error instanceof StooqUnsupportedDataError || error instanceof StooqApiKeyMissingError) {
    return {
      kind,
      reason: error.message,
      sourceSymbol,
    };
  }

  if (error instanceof Error) {
    return {
      kind,
      reason: error.message,
      sourceSymbol,
    };
  }

  return {
    kind,
    reason: "Unknown Stooq import error.",
    sourceSymbol,
  };
}
