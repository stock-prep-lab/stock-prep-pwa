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
  id: typeof CHART_SETTINGS_ID;
  recentHighLookbackTradingDays: number;
  stopLossPercent: number;
  updatedAt: string;
  visibility: ChartSettingsVisibility;
};
