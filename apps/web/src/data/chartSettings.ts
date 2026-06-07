import { CHART_SETTINGS_ID, type ChartSettings, type ChartSettingsVisibility } from "@stock-prep/shared";

import { createStockPrepDbRepository, openStockPrepDb } from "../storage/stockPrepDb";

export const chartSettingsLookbackOptions = [60, 126, 252] as const;
export const defaultChartSettingsVisibility: ChartSettingsVisibility = {
  bollinger: false,
  buyPrice: true,
  ichimoku: false,
  macd: false,
  ma25: true,
  ma75: true,
  recentHigh: false,
  rsi: false,
  stopLoss: false,
  stochastic: false,
};

export const defaultChartSettings: ChartSettings = {
  id: CHART_SETTINGS_ID,
  recentHighLookbackTradingDays: 252,
  stopLossPercent: 8,
  updatedAt: "1970-01-01T00:00:00.000Z",
  visibility: defaultChartSettingsVisibility,
};

export type SaveChartSettingsInput = Pick<
  ChartSettings,
  "recentHighLookbackTradingDays" | "stopLossPercent" | "visibility"
>;

export async function loadChartSettings(): Promise<ChartSettings> {
  return loadChartSettingsFromDb();
}

export async function loadChartSettingsFromDb({
  dbName,
}: {
  dbName?: string;
} = {}): Promise<ChartSettings> {
  const db = await openStockPrepDb({ dbName });

  try {
    const repository = createStockPrepDbRepository(db);
    const savedSettings = await repository.getChartSettings(CHART_SETTINGS_ID);
    return normalizeChartSettings(savedSettings);
  } finally {
    db.close();
  }
}

export async function saveChartSettings(input: SaveChartSettingsInput): Promise<ChartSettings> {
  return saveChartSettingsToDb(input);
}

export async function saveChartSettingsToDb(
  input: SaveChartSettingsInput,
  {
    dbName,
  }: {
    dbName?: string;
  } = {},
): Promise<ChartSettings> {
  const nextSettings = normalizeChartSettings({
    ...input,
    id: CHART_SETTINGS_ID,
    updatedAt: new Date().toISOString(),
  });
  const db = await openStockPrepDb({ dbName });

  try {
    const repository = createStockPrepDbRepository(db);
    await repository.putChartSettings(nextSettings);
    return nextSettings;
  } finally {
    db.close();
  }
}

export function buildInitialChartVisibility(
  visibility: ChartSettingsVisibility,
  hasHolding: boolean,
): ChartSettingsVisibility {
  return {
    ...visibility,
    buyPrice: hasHolding ? visibility.buyPrice : false,
    stopLoss: hasHolding ? visibility.stopLoss : false,
  };
}

export function toStopLossRatio(stopLossPercent: number): number {
  return 1 - clampStopLossPercent(stopLossPercent) / 100;
}

export function normalizeChartSettings(
  settings: Partial<ChartSettings> | null | undefined,
): ChartSettings {
  return {
    id: CHART_SETTINGS_ID,
    recentHighLookbackTradingDays: normalizeLookback(settings?.recentHighLookbackTradingDays),
    stopLossPercent: clampStopLossPercent(settings?.stopLossPercent ?? defaultChartSettings.stopLossPercent),
    updatedAt: settings?.updatedAt ?? defaultChartSettings.updatedAt,
    visibility: {
      ...defaultChartSettingsVisibility,
      ...settings?.visibility,
    },
  };
}

function clampStopLossPercent(value: number): number {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return defaultChartSettings.stopLossPercent;
  }

  return Math.max(1, Math.min(50, Number(numericValue.toFixed(1))));
}

function normalizeLookback(value: number | undefined): number {
  return chartSettingsLookbackOptions.includes(
    value as (typeof chartSettingsLookbackOptions)[number],
  )
    ? (value as (typeof chartSettingsLookbackOptions)[number])
    : defaultChartSettings.recentHighLookbackTradingDays;
}
