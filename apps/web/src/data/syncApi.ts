import type {
  DatasetVersionPayload,
  HoldingsPayload,
  LatestSummaryPayload,
  MarketDataPayload,
  UpsertHoldingRequest,
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

export async function fetchHoldings({
  activity = "foreground",
}: {
  activity?: ApiActivityMode;
} = {}): Promise<HoldingsPayload> {
  const response = await fetchWithApiActivity("/api/holdings", undefined, { activity });
  return readJsonResponse<HoldingsPayload>(response);
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
