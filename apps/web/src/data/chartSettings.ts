import {
  CHART_SETTINGS_ID,
  type ChartSettings,
  type ChartSettingsVisibility,
} from "@stock-prep/shared";

import { createStockPrepDbRepository, openStockPrepDb } from "../storage/stockPrepDb";

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
  bollingerPeriod: 20,
  bollingerStandardDeviations: 2,
  id: CHART_SETTINGS_ID,
  maLongPeriod: 75,
  maShortPeriod: 25,
  macdFastPeriod: 12,
  macdSignalPeriod: 9,
  macdSlowPeriod: 26,
  recentHighLookbackTradingDays: 252,
  rsiPeriod: 14,
  stochasticPeriod: 14,
  stochasticSignalPeriod: 3,
  stopLossPercent: 8,
  updatedAt: "1970-01-01T00:00:00.000Z",
  visibility: defaultChartSettingsVisibility,
};

export type SaveChartSettingsInput = Omit<ChartSettings, "id" | "updatedAt">;

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
  return 1 - clampDecimal(stopLossPercent, 1, 50, defaultChartSettings.stopLossPercent) / 100;
}

export function buildChartSettingsLabels(settings: Pick<
  ChartSettings,
  | "bollingerPeriod"
  | "bollingerStandardDeviations"
  | "maLongPeriod"
  | "maShortPeriod"
  | "macdFastPeriod"
  | "macdSignalPeriod"
  | "macdSlowPeriod"
  | "recentHighLookbackTradingDays"
  | "rsiPeriod"
  | "stochasticPeriod"
  | "stochasticSignalPeriod"
>) {
  const sigmaText = trimTrailingZeros(settings.bollingerStandardDeviations);

  return {
    bollinger: `ボリンジャー(${settings.bollingerPeriod},±${sigmaText}σ)`,
    maLong: `${settings.maLongPeriod}MA`,
    maShort: `${settings.maShortPeriod}MA`,
    macd: `MACD(${settings.macdFastPeriod},${settings.macdSlowPeriod},${settings.macdSignalPeriod})`,
    recentHigh: `直近高値(${settings.recentHighLookbackTradingDays})`,
    rsi: `RSI(${settings.rsiPeriod})`,
    stochastic: `ストキャスティクス(${settings.stochasticPeriod},${settings.stochasticSignalPeriod})`,
  };
}

export function normalizeChartSettings(
  settings: Partial<ChartSettings> | null | undefined,
): ChartSettings {
  const maShortPeriod = clampInteger(
    settings?.maShortPeriod,
    5,
    120,
    defaultChartSettings.maShortPeriod,
  );
  const maLongPeriod = clampInteger(
    settings?.maLongPeriod,
    maShortPeriod + 1,
    300,
    Math.max(defaultChartSettings.maLongPeriod, maShortPeriod + 1),
  );
  const rsiPeriod = clampInteger(settings?.rsiPeriod, 2, 50, defaultChartSettings.rsiPeriod);
  const stochasticPeriod = clampInteger(
    settings?.stochasticPeriod,
    5,
    50,
    defaultChartSettings.stochasticPeriod,
  );
  const stochasticSignalPeriod = clampInteger(
    settings?.stochasticSignalPeriod,
    2,
    20,
    defaultChartSettings.stochasticSignalPeriod,
  );
  const bollingerPeriod = clampInteger(
    settings?.bollingerPeriod,
    5,
    100,
    defaultChartSettings.bollingerPeriod,
  );
  const bollingerStandardDeviations = clampDecimal(
    settings?.bollingerStandardDeviations,
    0.5,
    4,
    defaultChartSettings.bollingerStandardDeviations,
  );
  const macdFastPeriod = clampInteger(
    settings?.macdFastPeriod,
    2,
    30,
    defaultChartSettings.macdFastPeriod,
  );
  const macdSlowPeriod = clampInteger(
    settings?.macdSlowPeriod,
    macdFastPeriod + 1,
    100,
    Math.max(defaultChartSettings.macdSlowPeriod, macdFastPeriod + 1),
  );
  const macdSignalPeriod = clampInteger(
    settings?.macdSignalPeriod,
    2,
    30,
    defaultChartSettings.macdSignalPeriod,
  );

  return {
    bollingerPeriod,
    bollingerStandardDeviations,
    id: CHART_SETTINGS_ID,
    maLongPeriod,
    maShortPeriod,
    macdFastPeriod,
    macdSignalPeriod,
    macdSlowPeriod,
    recentHighLookbackTradingDays: clampInteger(
      settings?.recentHighLookbackTradingDays,
      20,
      500,
      defaultChartSettings.recentHighLookbackTradingDays,
    ),
    rsiPeriod,
    stochasticPeriod,
    stochasticSignalPeriod,
    stopLossPercent: clampDecimal(
      settings?.stopLossPercent,
      1,
      50,
      defaultChartSettings.stopLossPercent,
    ),
    updatedAt: settings?.updatedAt ?? defaultChartSettings.updatedAt,
    visibility: {
      ...defaultChartSettingsVisibility,
      ...settings?.visibility,
    },
  };
}

function clampInteger(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.round(numericValue)));
}

function clampDecimal(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Number(numericValue.toFixed(1))));
}

function trimTrailingZeros(value: number): string {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}
