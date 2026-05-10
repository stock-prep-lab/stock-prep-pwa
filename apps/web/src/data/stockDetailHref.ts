import type { RegionCode } from "@stock-prep/shared";

export function buildStockDetailHref({
  code,
  region,
}: {
  code: string;
  region?: RegionCode | null;
}): string {
  if (!region) {
    return `/stocks/${code}`;
  }

  return `/stocks/${code}?region=${region}`;
}

export function buildHoldingFormHref({
  code,
  region,
}: {
  code: string;
  region?: RegionCode | null;
}): string {
  if (!region) {
    return `/holdings/${code}/edit`;
  }

  return `/holdings/${code}/edit?region=${region}`;
}
