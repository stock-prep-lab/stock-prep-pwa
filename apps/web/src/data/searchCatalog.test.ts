import { describe, expect, it } from "vitest";

import type { LatestSummaryPayload, StoredStockSymbol } from "@stock-prep/shared";

import { buildSearchCatalog, filterSearchCatalog } from "./searchCatalog";

describe("searchCatalog", () => {
  it("builds searchable rows from cached symbols and latest summary", () => {
    const items = buildSearchCatalog({
      latestSummary: createLatestSummary(),
      symbols: [
        createSymbol({
          code: "7203",
          currency: "JPY",
          id: "jp-7203",
          name: "トヨタ自動車",
          region: "JP",
          securityType: "stock",
        }),
        createSymbol({
          code: "0823",
          currency: "HKD",
          id: "hk-0823",
          name: "LINK REIT",
          region: "HK",
          securityType: "etf",
          unsupportedReason: "MVP では香港 ETF をまだ扱いません。",
        }),
        createSymbol({
          code: "USDJPY",
          currency: "USD",
          id: "fx-usdjpy",
          name: "USD/JPY",
          region: "US",
          securityType: "currency",
        }),
      ],
    });

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "0823",
          marketLabel: "香港",
          securityTypeLabel: "ETF",
          status: "unsupported",
          statusReason: "MVP では香港 ETF をまだ扱いません。",
        }),
        expect.objectContaining({
          code: "7203",
          lastClose: 3218,
          marketLabel: "日本",
          securityTypeLabel: "株式",
          status: "ready",
        }),
      ]),
    );
  });

  it("marks symbols without latest close as unavailable", () => {
    const items = buildSearchCatalog({
      latestSummary: createLatestSummary(),
      symbols: [
        createSymbol({
          code: "9988",
          currency: "HKD",
          id: "hk-9988",
          name: "Alibaba Group",
          region: "HK",
          securityType: "stock",
        }),
      ],
    });

    expect(items[0]).toMatchObject({
      code: "9988",
      status: "unavailable",
      statusLabel: "取得失敗",
      statusReason: "終値未取得",
    });
  });

  it("builds results from latest summary even when IndexedDB symbols are empty", () => {
    const items = buildSearchCatalog({
      latestSummary: createLatestSummary(),
      symbols: [],
    });

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "7203",
          name: "トヨタ自動車",
          status: "ready",
        }),
        expect.objectContaining({
          code: "TSLA",
          name: "Tesla",
          status: "ready",
        }),
      ]),
    );
  });

  it("filters by query and market while preferring exact code matches", () => {
    const items = buildSearchCatalog({
      latestSummary: createLatestSummary(),
      symbols: [
        createSymbol({
          code: "7203",
          currency: "JPY",
          id: "jp-7203",
          name: "トヨタ自動車",
          region: "JP",
          securityType: "stock",
        }),
        createSymbol({
          code: "7201",
          currency: "JPY",
          id: "jp-7201",
          name: "日産自動車",
          region: "JP",
          securityType: "stock",
        }),
        createSymbol({
          code: "TSLA",
          currency: "USD",
          id: "us-tsla",
          name: "Tesla",
          region: "US",
          securityType: "stock",
        }),
      ],
    });

    expect(
      filterSearchCatalog(items, {
        query: "7203",
        region: "ALL",
      }).map((item) => item.code),
    ).toEqual(["7203"]);

    expect(
      filterSearchCatalog(items, {
        query: "自動車",
        region: "JP",
      }).map((item) => item.code),
    ).toEqual(["7201", "7203"]);
  });
});

function createLatestSummary(): LatestSummaryPayload {
  return {
    datasetVersion: "market-data-2026-05-06",
    exchangeRates: [],
    generatedAt: "2026-05-06T06:00:00.000Z",
    symbols: [
      {
        code: "7203",
        currency: "JPY",
        id: "jp-7203",
        lastClose: 3218,
        lastCloseDate: "2026-05-06",
        name: "トヨタ自動車",
        region: "JP",
        securityType: "stock",
        sourceSymbol: "7203.jp",
      },
      {
        code: "7201",
        currency: "JPY",
        id: "jp-7201",
        lastClose: 412,
        lastCloseDate: "2026-05-06",
        name: "日産自動車",
        region: "JP",
        securityType: "stock",
        sourceSymbol: "7201.jp",
      },
      {
        code: "TSLA",
        currency: "USD",
        id: "us-tsla",
        lastClose: 182.34,
        lastCloseDate: "2026-05-06",
        name: "Tesla",
        region: "US",
        securityType: "stock",
        sourceSymbol: "tsla.us",
      },
    ],
  };
}

function createSymbol(
  symbol: Omit<StoredStockSymbol, "source" | "sourceSymbol"> &
    Partial<Pick<StoredStockSymbol, "source" | "sourceSymbol">>,
): StoredStockSymbol {
  return {
    ...symbol,
    source: symbol.source ?? "stooq",
    sourceSymbol: symbol.sourceSymbol ?? `${symbol.code.toLowerCase()}.${symbol.region.toLowerCase()}`,
  };
}
