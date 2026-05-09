function getPriceFractionDigitRange(currency: string): {
  maximumFractionDigits: number;
  minimumFractionDigits: number;
} {
  if (currency === "JPY") {
    return {
      maximumFractionDigits: 1,
      minimumFractionDigits: 1,
    };
  }

  if (currency === "HKD") {
    return {
      maximumFractionDigits: 3,
      minimumFractionDigits: 2,
    };
  }

  return {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  };
}

export function formatPriceNumber(value: number, currency: string): string {
  const { maximumFractionDigits, minimumFractionDigits } = getPriceFractionDigitRange(currency);

  return new Intl.NumberFormat("ja-JP", {
    maximumFractionDigits,
    minimumFractionDigits,
  }).format(value);
}

export function formatPriceCurrency(value: number, currency: string): string {
  const { maximumFractionDigits, minimumFractionDigits } = getPriceFractionDigitRange(currency);

  return new Intl.NumberFormat("ja-JP", {
    currency,
    maximumFractionDigits,
    minimumFractionDigits,
    style: "currency",
  }).format(value);
}
