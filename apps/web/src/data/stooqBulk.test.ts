import { describe, expect, it } from "vitest";

import {
  buildStooqBulkDownloadUrl,
  normalizeStooqBulkData,
  normalizeStooqCsvFallbackData,
  parseStooqAsciiDailyPriceText,
  resolveBulkCategoryRule,
  stooqBulkImportScopes,
  type StooqBulkImportTarget,
} from "./stooqBulk";

describe("stooqBulk", () => {
  it("builds bulk download urls for the configured import scopes", () => {
    expect(
      stooqBulkImportScopes.map((scope) => buildStooqBulkDownloadUrl(scope).toString()),
    ).toEqual([
      "https://stooq.com/db/d/?b=d_jp_txt",
      "https://stooq.com/db/d/?b=d_us_txt",
      "https://stooq.com/db/d/?b=d_uk_txt",
      "https://stooq.com/db/d/?b=d_hk_txt",
      "https://stooq.com/db/d/?b=d_world_txt",
    ]);
  });

  it("parses ASCII bulk rows without a header", () => {
    const bars = parseStooqAsciiDailyPriceText(
      ["2026-04-16,3100,3200,3050,3180,12345600", "2026-04-17,3138,3240,3112,3218,28430000"].join(
        "\n",
      ),
      createTarget(),
    );

    expect(bars).toEqual([
      {
        close: 3180,
        currency: "JPY",
        date: "2026-04-16",
        high: 3200,
        id: "jp-7203-2026-04-16",
        low: 3050,
        open: 3100,
        region: "JP",
        sourceSymbol: "7203.jp",
        symbolId: "jp-7203",
        volume: 12345600,
      },
      {
        close: 3218,
        currency: "JPY",
        date: "2026-04-17",
        high: 3240,
        id: "jp-7203-2026-04-17",
        low: 3112,
        open: 3138,
        region: "JP",
        sourceSymbol: "7203.jp",
        symbolId: "jp-7203",
        volume: 28430000,
      },
    ]);
  });

  it("accepts ASCII rows with open interest as the seventh column", () => {
    const bars = parseStooqAsciiDailyPriceText(
      "2026-04-17,3138,3240,3112,3218,28430000,0",
      createTarget(),
    );

    expect(bars).toHaveLength(1);
    expect(bars[0]?.volume).toBe(28430000);
  });

  it("returns an empty list for empty ASCII files", () => {
    expect(parseStooqAsciiDailyPriceText("", createTarget())).toEqual([]);
  });

  it("normalizes supported categories and keeps only stock / ETF / REIT targets", () => {
    const result = normalizeStooqBulkData({
      files: [
        {
          content: "2026-04-17,3138,3240,3112,3218,28430000",
          path: "data/daily/jp/tse stocks/7203.jp.txt",
        },
        {
          content: "2026-04-17,163,165,160,164,181000000",
          path: "data/daily/jp/tse etfs/1306.jp.txt",
        },
        {
          content: "2026-04-17,1200,1210,1190,1205,920000",
          path: "data/daily/hk/hkex reits/0823.hk.txt",
        },
        {
          content: "2026-04-17,110,112,109,111,440000",
          path: "data/daily/us/nyse bonds/test.us.txt",
        },
      ],
      targets: [
        createTarget(),
        createTarget({
          code: "1306",
          instrumentType: "etf",
          name: "TOPIX ETF",
          sourceSymbol: "1306.jp",
        }),
        createTarget({
          code: "0823",
          currency: "HKD",
          instrumentType: "reit",
          name: "Link REIT",
          region: "HK",
          sourceSymbol: "0823.hk",
        }),
      ],
    });

    expect(result.histories.map((history) => history.sourceSymbol)).toEqual([
      "0823.hk",
      "1306.jp",
      "7203.jp",
    ]);
    expect(result.histories.map((history) => history.instrumentType)).toEqual([
      "reit",
      "etf",
      "stock",
    ]);
    expect(result.failures).toEqual([]);
  });

  it("marks targets as imported, noData, failed, or unsupported", () => {
    const result = normalizeStooqBulkData({
      files: [
        {
          content: "2026-04-17,3138,3240,3112,3218,28430000",
          path: "data/daily/jp/tse stocks/7203.jp.txt",
        },
        {
          content: "",
          path: "data/daily/jp/tse stocks/9984.jp.txt",
        },
        {
          content: "bad,row",
          path: "data/daily/us/nasdaq stocks/aapl.us.txt",
        },
      ],
      targets: [
        createTarget(),
        createTarget({
          code: "9984",
          name: "ソフトバンクグループ",
          sourceSymbol: "9984.jp",
        }),
        createTarget({
          code: "AAPL",
          currency: "USD",
          name: "Apple",
          region: "US",
          sourceSymbol: "aapl.us",
        }),
        createTarget({
          code: "HSBA",
          currency: "GBP",
          name: "HSBC Holdings",
          region: "UK",
          sourceSymbol: "hsba.uk",
        }),
      ],
    });

    expect(result.symbols).toEqual([
      {
        code: "7203",
        currency: "JPY",
        id: "jp-7203",
        importStatus: "imported",
        instrumentType: "stock",
        name: "トヨタ自動車",
        region: "JP",
        source: "stooq",
        sourceSymbol: "7203.jp",
      },
      {
        code: "9984",
        currency: "JPY",
        id: "jp-9984",
        importStatus: "noData",
        instrumentType: "stock",
        name: "ソフトバンクグループ",
        region: "JP",
        source: "stooq",
        sourceSymbol: "9984.jp",
      },
      {
        code: "AAPL",
        currency: "USD",
        id: "us-aapl",
        importStatus: "failed",
        instrumentType: "stock",
        lastImportError: "Unexpected ASCII columns for aapl.us.",
        name: "Apple",
        region: "US",
        source: "stooq",
        sourceSymbol: "aapl.us",
      },
      {
        code: "HSBA",
        currency: "GBP",
        id: "uk-hsba",
        importStatus: "unsupported",
        instrumentType: "stock",
        name: "HSBC Holdings",
        region: "UK",
        source: "stooq",
        sourceSymbol: "hsba.uk",
      },
    ]);
    expect(result.failures).toEqual([
      {
        path: "data/daily/us/nasdaq stocks/aapl.us.txt",
        reason: "Unexpected ASCII columns for aapl.us.",
        sourceSymbol: "aapl.us",
      },
    ]);
  });

  it("normalizes CSV fallback into the same price-history shape", () => {
    const history = normalizeStooqCsvFallbackData({
      csv: ["Date,Open,High,Low,Close,Volume", "2026-04-17,3138,3240,3112,3218,28430000"].join(
        "\n",
      ),
      target: createTarget(),
    });

    expect(history).toEqual({
      bars: [
        {
          close: 3218,
          currency: "JPY",
          date: "2026-04-17",
          high: 3240,
          id: "jp-7203-2026-04-17",
          low: 3112,
          open: 3138,
          region: "JP",
          sourceSymbol: "7203.jp",
          symbolId: "jp-7203",
          volume: 28430000,
        },
      ],
      currency: "JPY",
      instrumentType: "stock",
      region: "JP",
      sourceSymbol: "7203.jp",
      symbolId: "jp-7203",
    });
  });

  it("resolves supported and unsupported category rules from bulk paths", () => {
    expect(resolveBulkCategoryRule("data/daily/hk/hkex reits/0823.hk.txt")).toEqual({
      instrumentType: "reit",
      kind: "supported",
      pathFragment: "hkex reits",
      region: "HK",
    });
    expect(resolveBulkCategoryRule("data/daily/us/nyse bonds/test.us.txt")).toEqual({
      kind: "unsupported",
      pathFragment: "bonds",
      reason: "Bonds are outside the MVP universe.",
    });
  });
});

function createTarget(overrides: Partial<StooqBulkImportTarget> = {}): StooqBulkImportTarget {
  return {
    code: "7203",
    currency: "JPY",
    instrumentType: "stock",
    name: "トヨタ自動車",
    region: "JP",
    sourceSymbol: "7203.jp",
    ...overrides,
  };
}
