import { describe, expect, it } from "vitest";

import {
  buildStooqCsvUrl,
  buildStooqSourceSymbol,
  createStooqClient,
  parseStooqDailyPriceCsv,
  parseStooqExchangeRateCsv,
  resolveStooqApiKey,
  StooqApiKeyMissingError,
  stooqExchangeRatePairs,
  StooqUnsupportedDataError,
  toStoredStockSymbol,
  type StooqEquityImportTarget,
} from "./stooqClient";

const toyotaTarget: StooqEquityImportTarget = {
  code: "7203",
  currency: "JPY",
  name: "トヨタ自動車",
  region: "JP",
  sourceSymbol: "7203.jp",
};

const dailyCsv = [
  "Date,Open,High,Low,Close,Volume",
  "2026-04-16,3130,3220,3100,3190,26000000",
  "2026-04-17,3138,3240,3112,3218,28430000",
].join("\n");

describe("stooqClient", () => {
  it("builds Stooq source symbols for each supported region", () => {
    expect(buildStooqSourceSymbol({ code: "7203", region: "JP" })).toBe("7203.jp");
    expect(buildStooqSourceSymbol({ code: "AAPL", region: "US" })).toBe("aapl.us");
    expect(buildStooqSourceSymbol({ code: "HSBA", region: "UK" })).toBe("hsba.uk");
    expect(buildStooqSourceSymbol({ code: "0700", region: "HK" })).toBe("0700.hk");
  });

  it("keeps the Slice 10 exchange-rate targets explicit", () => {
    expect(stooqExchangeRatePairs).toEqual(["USDJPY", "GBPJPY", "HKDJPY"]);
  });

  it("resolves the API key from the Vite environment shape", () => {
    expect(resolveStooqApiKey({ VITE_STOOQ_API_KEY: " test-key " })).toBe("test-key");
    expect(resolveStooqApiKey({ VITE_STOOQ_API_KEY: " " })).toBeNull();
  });

  it("requires an API key before creating a Stooq client", () => {
    expect(() => createStooqClient({ apiKey: null })).toThrow(StooqApiKeyMissingError);
  });

  it("builds the CSV URL with the API key and daily interval", () => {
    const url = buildStooqCsvUrl({
      apiKey: "test-key",
      baseUrl: "https://stooq.example/q/d/l/",
      sourceSymbol: "7203.jp",
    });

    expect(url.toString()).toBe("https://stooq.example/q/d/l/?s=7203.jp&i=d&apikey=test-key");
  });

  it("parses Stooq daily price CSV into local daily price bars", () => {
    expect(parseStooqDailyPriceCsv(dailyCsv, toyotaTarget)).toEqual([
      {
        close: 3190,
        currency: "JPY",
        date: "2026-04-16",
        high: 3220,
        id: "jp-7203-2026-04-16",
        low: 3100,
        open: 3130,
        region: "JP",
        sourceSymbol: "7203.jp",
        symbolId: "jp-7203",
        volume: 26000000,
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

  it("parses Stooq exchange-rate CSV into local exchange-rate bars", () => {
    expect(parseStooqExchangeRateCsv(dailyCsv, "USDJPY")).toEqual([
      {
        baseCurrency: "USD",
        close: 3190,
        date: "2026-04-16",
        id: "USDJPY-2026-04-16",
        pair: "USDJPY",
        quoteCurrency: "JPY",
      },
      {
        baseCurrency: "USD",
        close: 3218,
        date: "2026-04-17",
        id: "USDJPY-2026-04-17",
        pair: "USDJPY",
        quoteCurrency: "JPY",
      },
    ]);
  });

  it("treats empty CSV responses as unsupported Stooq data", () => {
    expect(() =>
      parseStooqDailyPriceCsv("Date,Open,High,Low,Close,Volume\n", toyotaTarget),
    ).toThrow(StooqUnsupportedDataError);
  });

  it("treats unexpected CSV columns as unsupported Stooq data", () => {
    const mismatchedCsv = [
      "Date,Close,Open,High,Low,Volume",
      "2026-04-17,3218,3138,3240,3112,28430000",
    ].join("\n");

    expect(() => parseStooqDailyPriceCsv(mismatchedCsv, toyotaTarget)).toThrow(
      "Unexpected Stooq CSV columns for 7203.jp.",
    );
  });

  it("fetches and parses daily prices through the Stooq client", async () => {
    const fetchedUrls: string[] = [];
    const client = createStooqClient({
      apiKey: "test-key",
      baseUrl: "https://stooq.example/q/d/l/",
      fetcher: async (input) => {
        fetchedUrls.push(input.toString());
        return new Response(dailyCsv);
      },
    });

    const prices = await client.fetchDailyPrices(toyotaTarget);

    expect(fetchedUrls).toEqual(["https://stooq.example/q/d/l/?s=7203.jp&i=d&apikey=test-key"]);
    expect(prices).toHaveLength(2);
    expect(prices[0].sourceSymbol).toBe("7203.jp");
  });

  it("treats Stooq API key rejection text as an API-key error", async () => {
    const client = createStooqClient({
      apiKey: "test-key",
      fetcher: async () => new Response("Get your apikey at stooq.com"),
    });

    await expect(client.fetchDailyPrices(toyotaTarget)).rejects.toThrow(StooqApiKeyMissingError);
  });

  it("converts an import target into a stored Stooq symbol", () => {
    expect(toStoredStockSymbol(toyotaTarget)).toEqual({
      code: "7203",
      currency: "JPY",
      id: "jp-7203",
      name: "トヨタ自動車",
      region: "JP",
      source: "stooq",
      sourceSymbol: "7203.jp",
    });
  });
});
