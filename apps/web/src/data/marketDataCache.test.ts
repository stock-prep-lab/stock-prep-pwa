import { beforeEach, describe, expect, it, vi } from "vitest";

import { ensureMarketDataSnapshot } from "./marketDataCache";

const {
  fetchMarketDataMock,
  persistMarketDataPayloadMock,
  readLocalSyncVersionMock,
} = vi.hoisted(() => ({
  fetchMarketDataMock: vi.fn(),
  persistMarketDataPayloadMock: vi.fn(),
  readLocalSyncVersionMock: vi.fn(),
}));

vi.mock("./dataSyncPersistence", () => ({
  persistMarketDataPayload: persistMarketDataPayloadMock,
  readLocalSyncVersion: readLocalSyncVersionMock,
}));

vi.mock("./syncApi", () => ({
  fetchMarketData: fetchMarketDataMock,
}));

describe("ensureMarketDataSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips fetching when market-data cache matches latest-summary", async () => {
    readLocalSyncVersionMock.mockImplementation(async (id: string) => {
      if (id === "market-data") {
        return "dataset-v1";
      }

      if (id === "latest-summary") {
        return "dataset-v1";
      }

      return null;
    });

    await ensureMarketDataSnapshot();

    expect(fetchMarketDataMock).not.toHaveBeenCalled();
    expect(persistMarketDataPayloadMock).not.toHaveBeenCalled();
  });

  it("fetches and persists when market-data cache is missing", async () => {
    readLocalSyncVersionMock.mockImplementation(async (id: string) => {
      if (id === "market-data") {
        return null;
      }

      if (id === "latest-summary") {
        return "dataset-v2";
      }

      return null;
    });
    fetchMarketDataMock.mockResolvedValue({
      dailyPrices: [],
      datasetVersion: "dataset-v2",
      exchangeRates: [],
      generatedAt: "2026-06-07T12:00:00.000Z",
      symbols: [],
    });

    await ensureMarketDataSnapshot();

    expect(fetchMarketDataMock).toHaveBeenCalledWith({
      activity: "background",
    });
    expect(persistMarketDataPayloadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        datasetVersion: "dataset-v2",
      }),
    );
  });

  it("fetches and persists when latest-summary is newer than market-data cache", async () => {
    readLocalSyncVersionMock.mockImplementation(async (id: string) => {
      if (id === "market-data") {
        return "dataset-v1";
      }

      if (id === "latest-summary") {
        return "dataset-v2";
      }

      return null;
    });
    fetchMarketDataMock.mockResolvedValue({
      dailyPrices: [],
      datasetVersion: "dataset-v2",
      exchangeRates: [],
      generatedAt: "2026-06-07T12:00:00.000Z",
      symbols: [],
    });

    await ensureMarketDataSnapshot();

    expect(fetchMarketDataMock).toHaveBeenCalledTimes(1);
    expect(persistMarketDataPayloadMock).toHaveBeenCalledTimes(1);
  });
});
