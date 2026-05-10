import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listObjectKeysByPrefix, putJsonObject } from "./stockPrepR2";

describe("stockPrepR2", () => {
  const originalBucket = process.env.STOCK_PREP_R2_BUCKET;

  beforeEach(() => {
    process.env.STOCK_PREP_R2_BUCKET = "stock-prep-test";
  });

  afterEach(() => {
    process.env.STOCK_PREP_R2_BUCKET = originalBucket;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("retries transient TLS errors before succeeding", async () => {
    vi.useFakeTimers();
    const transientError = Object.assign(new Error("sslv3 alert bad record mac"), {
      code: "ERR_SSL_SSLV3_ALERT_BAD_RECORD_MAC",
      reason: "sslv3 alert bad record mac",
    });
    const send = vi
      .fn()
      .mockRejectedValueOnce(transientError)
      .mockRejectedValueOnce(transientError)
      .mockResolvedValueOnce({});

    const promise = putJsonObject({
      body: { ok: true },
      key: "current/jp/latest-summary.json",
      r2: { send } as never,
    });

    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBeUndefined();
    expect(send).toHaveBeenCalledTimes(3);
  });

  it("lists object keys by prefix across paginated responses", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({
        Contents: [{ Key: "current/fx/latest-summary.json" }],
        IsTruncated: true,
        NextContinuationToken: "page-2",
      })
      .mockResolvedValueOnce({
        Contents: [{ Key: "current/fx/market-data.exchange-rates.json" }],
        IsTruncated: false,
      });

    await expect(
      listObjectKeysByPrefix({
        prefix: "current/fx/",
        r2: { send } as never,
      }),
    ).resolves.toEqual([
      "current/fx/latest-summary.json",
      "current/fx/market-data.exchange-rates.json",
    ]);
    expect(send).toHaveBeenCalledTimes(2);
  });
});
