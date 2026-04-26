export const APP_NAME = "Stock Prep Lab";
const TYPE_MARKER = undefined as never;

export type RegionCode = "JP" | "US" | "UK" | "HK";
export const RegionCode = TYPE_MARKER as RegionCode;

export type CurrencyCode = "JPY" | "USD" | "GBP" | "HKD";
export const CurrencyCode = TYPE_MARKER as CurrencyCode;

export type DataSourceCode = "stooq";
export const DataSourceCode = TYPE_MARKER as DataSourceCode;

export type SecurityType = "currency" | "etf" | "stock";
export const SecurityType = TYPE_MARKER as SecurityType;
