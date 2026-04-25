import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { dummyStockPrepSnapshot } from "../data/seedSnapshot";
import type { MarketDataPayload } from "@stock-prep/shared";

import {
  createEmptyMarketDataPayload,
  extractStooqBulkFilesFromZip,
  importBulkScopeFromZip,
} from "./stockPrepImport";

describe("stockPrepImport", () => {
  it("extracts nested txt files from a ZIP archive", async () => {
    const zipBytes = await createZip({
      "data/daily/jp/tse stocks/1/7203.jp.txt": "20260417,3138,3240,3112,3218,28430000",
      "data/readme.txt": "ignore me",
      "data/daily/jp/tse stocks/ignore.csv": "not picked",
    });

    const files = await extractStooqBulkFilesFromZip(zipBytes);

    expect(files.map((file) => file.path)).toEqual([
      "data/daily/jp/tse stocks/1/7203.jp.txt",
      "data/readme.txt",
    ]);
  });

  it("imports JP market ZIP and overwrites only the selected region", async () => {
    const zipBytes = await createZip({
      "data/daily/jp/tse stocks/1/7203.jp.txt": [
        "<TICKER>,<PER>,<DATE>,<TIME>,<OPEN>,<HIGH>,<LOW>,<CLOSE>,<VOL>,<OPENINT>",
        "7203.JP,D,20260418,000000,3220,3250,3210,3242,30000000,0",
      ].join("\n"),
      "data/daily/jp/tse etfs/1306.jp.txt": [
        "<TICKER>,<PER>,<DATE>,<TIME>,<OPEN>,<HIGH>,<LOW>,<CLOSE>,<VOL>,<OPENINT>",
        "1306.JP,D,20260418,000000,2900,2920,2890,2910,1200000,0",
      ].join("\n"),
      "data/daily/uk/lse stocks intl/0A0A.uk.txt": [
        "<TICKER>,<PER>,<DATE>,<TIME>,<OPEN>,<HIGH>,<LOW>,<CLOSE>,<VOL>,<OPENINT>",
        "0A0A.UK,D,20260418,000000,1,1,1,1,1,0",
      ].join("\n"),
    });

    const currentMarketData: MarketDataPayload = {
      dailyPrices: dummyStockPrepSnapshot.dailyPrices,
      datasetVersion: "seed",
      exchangeRates: dummyStockPrepSnapshot.exchangeRates,
      generatedAt: "2026-04-17T15:35:00+09:00",
      symbols: dummyStockPrepSnapshot.symbols,
    };

    const result = await importBulkScopeFromZip({
      currentMarketData,
      generatedAt: "2026-04-18T15:35:00+09:00",
      scopeId: "JP",
      zipBytes,
    });

    expect(result.summary.scopeId).toBe("JP");
    expect(result.summary.symbolCount).toBe(2);
    expect(result.marketData.symbols).toEqual([
      expect.objectContaining({
        code: "1306",
        securityType: "etf",
      }),
      expect.objectContaining({
        code: "7203",
        securityType: "stock",
      }),
    ]);
    expect(result.marketData.dailyPrices.map((bar) => bar.symbolId)).toEqual([
      "jp-1306",
      "jp-7203",
    ]);
    expect(result.marketData.exchangeRates).toEqual(dummyStockPrepSnapshot.exchangeRates);
  });

  it("imports world currency ZIP and inverts JPY-based pairs", async () => {
    const zipBytes = await createZip({
      "data/daily/world/currencies/major/jpyusd.txt": [
        "<TICKER>,<PER>,<DATE>,<TIME>,<OPEN>,<HIGH>,<LOW>,<CLOSE>,<VOL>,<OPENINT>",
        "JPYUSD,D,20260418,000000,0.0065,0.0065,0.0065,0.0065,0,0",
      ].join("\n"),
      "data/daily/world/currencies/major/jpygbp.txt": [
        "<TICKER>,<PER>,<DATE>,<TIME>,<OPEN>,<HIGH>,<LOW>,<CLOSE>,<VOL>,<OPENINT>",
        "JPYGBP,D,20260418,000000,0.0051,0.0051,0.0051,0.005,0,0",
      ].join("\n"),
    });

    const result = await importBulkScopeFromZip({
      currentMarketData: createEmptyMarketDataPayload(),
      generatedAt: "2026-04-18T15:35:00+09:00",
      scopeId: "FX",
      zipBytes,
    });

    expect(result.summary.exchangeRateCount).toBe(2);
    expect(result.marketData.exchangeRates).toEqual([
      expect.objectContaining({
        close: 200,
        pair: "GBPJPY",
      }),
      expect.objectContaining({
        close: 153.846154,
        pair: "USDJPY",
      }),
    ]);
  });
});

async function createZip(entries: Record<string, string>): Promise<Uint8Array> {
  const zip = new JSZip();

  for (const [path, content] of Object.entries(entries)) {
    zip.file(path, content);
  }

  return zip.generateAsync({ type: "uint8array" });
}
