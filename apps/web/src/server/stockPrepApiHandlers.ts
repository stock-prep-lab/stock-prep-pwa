import type {
  DatasetVersionPayload,
  HoldingsPayload,
  MarketDataPayload,
  PortfolioHolding,
  StockPrepSnapshot,
  UpsertHoldingRequest,
} from "@stock-prep/shared";

import { dummyStockPrepSnapshot } from "../data/seedSnapshot";

type StockPrepServerState = {
  holdingsPayload: HoldingsPayload;
  marketDataPayload: MarketDataPayload;
};

type GlobalWithStockPrepServerState = typeof globalThis & {
  __stockPrepServerState__?: StockPrepServerState;
};

const defaultGeneratedAt = "2026-04-17T15:35:00+09:00";
const defaultMarketDatasetVersion = "server-market-v1";

export async function handleDatasetVersionRequest({
  localDatasetVersion,
}: {
  localDatasetVersion?: string | null;
} = {}): Promise<DatasetVersionPayload> {
  const { marketDataPayload } = getServerState();

  return {
    datasetVersion: marketDataPayload.datasetVersion,
    generatedAt: marketDataPayload.generatedAt,
    shouldSync: localDatasetVersion !== marketDataPayload.datasetVersion,
  };
}

export async function handleMarketDataRequest(): Promise<MarketDataPayload> {
  return structuredClone(getServerState().marketDataPayload);
}

export async function handleGetHoldingsRequest(): Promise<HoldingsPayload> {
  return structuredClone(getServerState().holdingsPayload);
}

export async function handleUpsertHoldingRequest(
  request: UpsertHoldingRequest,
): Promise<HoldingsPayload> {
  validateHoldingRequest(request);

  const state = getServerState();
  const symbol = state.marketDataPayload.symbols.find((candidate) => candidate.id === request.symbolId);

  if (!symbol) {
    throw new Error("保存対象の銘柄がサーバー側に存在しません。");
  }

  const updatedAt = new Date().toISOString();
  const nextHolding: PortfolioHolding = {
    averagePrice: request.averagePrice,
    currency: symbol.currency,
    id: `holding-${symbol.id}`,
    quantity: request.quantity,
    symbolId: symbol.id,
    updatedAt,
  };

  const filteredHoldings = state.holdingsPayload.holdings.filter(
    (holding) => holding.symbolId !== request.symbolId,
  );

  state.holdingsPayload = {
    ...state.holdingsPayload,
    holdings: [...filteredHoldings, nextHolding].sort((left, right) =>
      left.symbolId.localeCompare(right.symbolId),
    ),
    updatedAt,
  };

  return structuredClone(state.holdingsPayload);
}

export function resetStockPrepApiServerState(): void {
  const globalState = globalThis as GlobalWithStockPrepServerState;
  globalState.__stockPrepServerState__ = createDefaultServerState();
}

function getServerState(): StockPrepServerState {
  const globalState = globalThis as GlobalWithStockPrepServerState;

  if (!globalState.__stockPrepServerState__) {
    globalState.__stockPrepServerState__ = createDefaultServerState();
  }

  return globalState.__stockPrepServerState__;
}

function createDefaultServerState(): StockPrepServerState {
  return {
    holdingsPayload: {
      cashBalances: structuredClone(dummyStockPrepSnapshot.cashBalances),
      holdings: structuredClone(dummyStockPrepSnapshot.holdings),
      updatedAt: getLatestHoldingUpdatedAt(dummyStockPrepSnapshot),
    },
    marketDataPayload: {
      dailyPrices: structuredClone(dummyStockPrepSnapshot.dailyPrices),
      datasetVersion: defaultMarketDatasetVersion,
      exchangeRates: structuredClone(dummyStockPrepSnapshot.exchangeRates),
      generatedAt: defaultGeneratedAt,
      symbols: structuredClone(dummyStockPrepSnapshot.symbols),
    },
  };
}

function getLatestHoldingUpdatedAt(snapshot: StockPrepSnapshot): string {
  return (
    snapshot.holdings
      .map((holding) => holding.updatedAt)
      .sort((left, right) => right.localeCompare(left))
      .at(0) ?? defaultGeneratedAt
  );
}

function validateHoldingRequest(request: UpsertHoldingRequest): void {
  if (!request.symbolId) {
    throw new Error("symbolId が必要です。");
  }

  if (!Number.isFinite(request.quantity) || request.quantity <= 0) {
    throw new Error("quantity は 0 より大きい数値で指定してください。");
  }

  if (!Number.isFinite(request.averagePrice) || request.averagePrice <= 0) {
    throw new Error("averagePrice は 0 より大きい数値で指定してください。");
  }
}
