import type {
  DeleteHoldingRequest,
  DatasetVersionPayload,
  HoldingsPayload,
  LatestSummaryPayload,
  MarketDataPayload,
  RecordRecentSymbolRequest,
  StockDetailPayload,
  StockDetailRequest,
  UpsertWatchlistSymbolRequest,
  UpsertHoldingRequest,
  UserSymbolsPayload,
} from "@stock-prep/shared";
import { fetchWithApiActivity } from "./apiActivity";

type ApiActivityMode = "background" | "foreground";

export async function fetchDatasetVersion(
  localDatasetVersion: string | null,
  {
    activity = "foreground",
  }: {
    activity?: ApiActivityMode;
  } = {},
): Promise<DatasetVersionPayload> {
  const query = new URLSearchParams();

  if (localDatasetVersion) {
    query.set("localVersion", localDatasetVersion);
  }

  const response = await fetchWithApiActivity(`/api/dataset-version?${query.toString()}`, undefined, {
    activity,
  });

  return readJsonResponse<DatasetVersionPayload>(response);
}

export async function fetchMarketData({
  activity = "foreground",
}: {
  activity?: ApiActivityMode;
} = {}): Promise<MarketDataPayload> {
  const response = await fetchWithApiActivity("/api/market-data", undefined, { activity });
  return readJsonResponse<MarketDataPayload>(response);
}

export async function fetchLatestSummary({
  activity = "foreground",
}: {
  activity?: ApiActivityMode;
} = {}): Promise<LatestSummaryPayload> {
  const response = await fetchWithApiActivity("/api/latest-summary", undefined, { activity });
  return readJsonResponse<LatestSummaryPayload>(response);
}

export async function fetchStockDetail(
  request: StockDetailRequest,
  {
    activity = "foreground",
  }: {
    activity?: ApiActivityMode;
  } = {},
): Promise<StockDetailPayload> {
  const query = new URLSearchParams();
  query.set("code", request.symbolCode);

  if (request.region) {
    query.set("region", request.region);
  }

  const response = await fetchWithApiActivity(`/api/stock-detail?${query.toString()}`, undefined, {
    activity,
  });

  return readJsonResponse<StockDetailPayload>(response);
}

export async function fetchHoldings({
  activity = "foreground",
}: {
  activity?: ApiActivityMode;
} = {}): Promise<HoldingsPayload> {
  const response = await fetchWithApiActivity("/api/holdings", undefined, { activity });
  return readJsonResponse<HoldingsPayload>(response);
}

export async function fetchUserSymbols({
  activity = "foreground",
}: {
  activity?: ApiActivityMode;
} = {}): Promise<UserSymbolsPayload> {
  const response = await fetchWithApiActivity("/api/user-symbols", undefined, { activity });
  return readJsonResponse<UserSymbolsPayload>(response);
}

export async function upsertHolding(request: UpsertHoldingRequest): Promise<HoldingsPayload> {
  const response = await fetchWithApiActivity("/api/holdings", {
    body: JSON.stringify(request),
    headers: {
      "Content-Type": "application/json",
    },
    method: "PUT",
  });

  return readJsonResponse<HoldingsPayload>(response);
}

export async function deleteHolding(request: DeleteHoldingRequest): Promise<HoldingsPayload> {
  const query = new URLSearchParams();
  query.set("symbolId", request.symbolId);

  const response = await fetchWithApiActivity(`/api/holdings?${query.toString()}`, {
    method: "DELETE",
  });

  return readJsonResponse<HoldingsPayload>(response);
}

export async function recordRecentSymbol(
  request: RecordRecentSymbolRequest,
  {
    activity = "background",
  }: {
    activity?: ApiActivityMode;
  } = {},
): Promise<UserSymbolsPayload> {
  const response = await fetchWithApiActivity(
    "/api/recent-symbols",
    {
      body: JSON.stringify(request),
      headers: {
        "Content-Type": "application/json",
      },
      method: "PUT",
    },
    { activity },
  );

  return readJsonResponse<UserSymbolsPayload>(response);
}

export async function addWatchlistSymbol(
  request: UpsertWatchlistSymbolRequest,
  {
    activity = "background",
  }: {
    activity?: ApiActivityMode;
  } = {},
): Promise<UserSymbolsPayload> {
  const response = await fetchWithApiActivity(
    "/api/watchlist",
    {
      body: JSON.stringify(request),
      headers: {
        "Content-Type": "application/json",
      },
      method: "PUT",
    },
    { activity },
  );

  return readJsonResponse<UserSymbolsPayload>(response);
}

export async function removeWatchlistSymbol(
  symbolId: string,
  {
    activity = "background",
  }: {
    activity?: ApiActivityMode;
  } = {},
): Promise<UserSymbolsPayload> {
  const query = new URLSearchParams();
  query.set("symbolId", symbolId);
  const response = await fetchWithApiActivity(`/api/watchlist?${query.toString()}`, {
    method: "DELETE",
  }, { activity });

  return readJsonResponse<UserSymbolsPayload>(response);
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `API request failed: ${response.status}`;

    try {
      const errorPayload = (await response.json()) as { error?: string };
      message = errorPayload.error ?? message;
    } catch {
      // Ignore JSON parse errors and use the default message.
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}
