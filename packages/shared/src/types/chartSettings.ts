export const CHART_SETTINGS_ID = "chart-settings";

export type ChartSettingsVisibility = {
  bollinger: boolean;
  buyPrice: boolean;
  ichimoku: boolean;
  macd: boolean;
  ma25: boolean;
  ma75: boolean;
  recentHigh: boolean;
  rsi: boolean;
  stopLoss: boolean;
  stochastic: boolean;
};

export type ChartSettings = {
  bollingerPeriod: number;
  bollingerStandardDeviations: number;
  id: typeof CHART_SETTINGS_ID;
  maLongPeriod: number;
  maShortPeriod: number;
  macdFastPeriod: number;
  macdSignalPeriod: number;
  macdSlowPeriod: number;
  recentHighLookbackTradingDays: number;
  rsiPeriod: number;
  stochasticPeriod: number;
  stochasticSignalPeriod: number;
  stopLossPercent: number;
  updatedAt: string;
  visibility: ChartSettingsVisibility;
};
