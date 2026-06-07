import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CHART_SETTINGS_ID } from "@stock-prep/shared";

import {
  chartSettingsLookbackOptions,
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
        recentHighLookbackTradingDays: chartSettingsLookbackOptions[1],
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
      recentHighLookbackTradingDays: 126,
      stopLossPercent: 12.5,
    });
    expect(loaded.visibility.recentHigh).toBe(true);
    expect(loaded.visibility.stopLoss).toBe(true);
  });

  it("normalizes unsupported values to defaults", () => {
    const normalized = normalizeChartSettings({
      recentHighLookbackTradingDays: 999,
      stopLossPercent: 0.2,
      visibility: {
        ...defaultChartSettings.visibility,
        ma25: false,
      },
    });

    expect(normalized.recentHighLookbackTradingDays).toBe(
      defaultChartSettings.recentHighLookbackTradingDays,
    );
    expect(normalized.stopLossPercent).toBe(1);
    expect(normalized.visibility.ma25).toBe(false);
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
