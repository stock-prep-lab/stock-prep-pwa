import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CHART_SETTINGS_ID } from "@stock-prep/shared";

import {
  buildChartSettingsLabels,
  defaultChartSettings,
  loadChartSettingsFromDb,
  normalizeChartSettings,
  saveChartSettingsToDb,
} from "./chartSettings";
import { openStockPrepDb } from "../storage/stockPrepDb";

describe("chartSettings", () => {
  let dbName: string;

  beforeEach(() => {
    dbName = `stock-prep-chart-settings-${Date.now()}-${Math.random()}`;
  });

  afterEach(async () => {
    await deleteTestDatabase(dbName);
  });

  it("returns defaults when no settings are saved", async () => {
    const db = await openStockPrepDb({ dbName });
    db.close();

    await expect(loadChartSettingsFromDb({ dbName })).resolves.toMatchObject(defaultChartSettings);
  });

  it("saves and loads chart settings", async () => {
    const saved = await saveChartSettingsToDb(
      {
        bollingerPeriod: 18,
        bollingerStandardDeviations: 2.5,
        maLongPeriod: 60,
        maShortPeriod: 20,
        macdFastPeriod: 10,
        macdSignalPeriod: 8,
        macdSlowPeriod: 24,
        recentHighLookbackTradingDays: 126,
        rsiPeriod: 12,
        stochasticPeriod: 11,
        stochasticSignalPeriod: 4,
        stopLossPercent: 12.5,
        visibility: {
          ...defaultChartSettings.visibility,
          recentHigh: true,
          stopLoss: true,
        },
      },
      { dbName },
    );

    expect(saved.id).toBe(CHART_SETTINGS_ID);

    const loaded = await loadChartSettingsFromDb({ dbName });

    expect(loaded).toMatchObject({
      bollingerPeriod: 18,
      bollingerStandardDeviations: 2.5,
      maLongPeriod: 60,
      maShortPeriod: 20,
      macdFastPeriod: 10,
      macdSignalPeriod: 8,
      macdSlowPeriod: 24,
      recentHighLookbackTradingDays: 126,
      rsiPeriod: 12,
      stochasticPeriod: 11,
      stochasticSignalPeriod: 4,
      stopLossPercent: 12.5,
    });
    expect(loaded.visibility.recentHigh).toBe(true);
    expect(loaded.visibility.stopLoss).toBe(true);
  });

  it("normalizes unsupported values to defaults", () => {
    const normalized = normalizeChartSettings({
      bollingerPeriod: 3,
      bollingerStandardDeviations: 5,
      maLongPeriod: 10,
      maShortPeriod: 15,
      macdFastPeriod: 30,
      macdSignalPeriod: 0,
      macdSlowPeriod: 10,
      recentHighLookbackTradingDays: 999,
      rsiPeriod: 60,
      stochasticPeriod: 2,
      stochasticSignalPeriod: 25,
      stopLossPercent: 0.2,
      visibility: {
        ...defaultChartSettings.visibility,
        ma25: false,
      },
    });

    expect(normalized.recentHighLookbackTradingDays).toBe(
      500,
    );
    expect(normalized.maShortPeriod).toBe(15);
    expect(normalized.maLongPeriod).toBe(16);
    expect(normalized.rsiPeriod).toBe(50);
    expect(normalized.stochasticPeriod).toBe(5);
    expect(normalized.stochasticSignalPeriod).toBe(20);
    expect(normalized.bollingerPeriod).toBe(5);
    expect(normalized.bollingerStandardDeviations).toBe(4);
    expect(normalized.macdFastPeriod).toBe(30);
    expect(normalized.macdSlowPeriod).toBe(31);
    expect(normalized.macdSignalPeriod).toBe(2);
    expect(normalized.stopLossPercent).toBe(1);
    expect(normalized.visibility.ma25).toBe(false);
  });

  it("builds dynamic labels from settings", () => {
    expect(
      buildChartSettingsLabels({
        bollingerPeriod: 18,
        bollingerStandardDeviations: 2.5,
        maLongPeriod: 60,
        maShortPeriod: 20,
        macdFastPeriod: 10,
        macdSignalPeriod: 8,
        macdSlowPeriod: 24,
        recentHighLookbackTradingDays: 126,
        rsiPeriod: 12,
        stochasticPeriod: 11,
        stochasticSignalPeriod: 4,
      }),
    ).toEqual({
      bollinger: "ボリンジャー(18,±2.5σ)",
      maLong: "60MA",
      maShort: "20MA",
      macd: "MACD(10,24,8)",
      recentHigh: "直近高値(126)",
      rsi: "RSI(12)",
      stochastic: "ストキャスティクス(11,4)",
    });
  });
});

function deleteTestDatabase(dbName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(dbName);

    request.onerror = () => {
      reject(request.error ?? new Error("Failed to delete test database."));
    };
    request.onsuccess = () => {
      resolve();
    };
  });
}
