import { describe, expect, it } from "vitest";

import {
  findClaimableImportJobRow,
  isStaleImportJobRow,
  type ImportJobRow,
} from "./stockPrepBackend";

describe("stockPrepBackend import job leasing", () => {
  it("treats old processing jobs as stale", () => {
    expect(
      isStaleImportJobRow(
        createImportJobRow({
          heartbeat_at: "2026-04-29T13:00:00.000Z",
          status: "processing",
        }),
        new Date("2026-04-29T13:11:00.000Z"),
      ),
    ).toBe(true);
  });

  it("does not treat fresh processing jobs as stale", () => {
    expect(
      isStaleImportJobRow(
        createImportJobRow({
          heartbeat_at: "2026-04-29T13:05:30.000Z",
          status: "processing",
        }),
        new Date("2026-04-29T13:11:00.000Z"),
      ),
    ).toBe(false);
  });

  it("claims the oldest stale processing job when no queued job exists", () => {
    const row = findClaimableImportJobRow(
      [
        createImportJobRow({
          heartbeat_at: "2026-04-29T13:00:00.000Z",
          id: "job-stale",
          processing_started_at: "2026-04-29T13:00:00.000Z",
          started_at: "2026-04-29T13:00:00.000Z",
          status: "processing",
        }),
        createImportJobRow({
          heartbeat_at: "2026-04-29T13:10:30.000Z",
          id: "job-fresh",
          processing_started_at: "2026-04-29T13:10:00.000Z",
          started_at: "2026-04-29T13:10:00.000Z",
          status: "processing",
        }),
      ],
      new Date("2026-04-29T13:11:00.000Z"),
    );

    expect(row?.id).toBe("job-stale");
  });
});

function createImportJobRow(overrides: Partial<ImportJobRow> = {}): ImportJobRow {
  return {
    attempt_count: 0,
    daily_price_count: 0,
    dataset_version: null,
    error_message: null,
    exchange_rate_count: 0,
    file_name: "d_jp_txt.zip",
    finished_at: null,
    heartbeat_at: null,
    id: "job-1",
    manifest_key: null,
    processing_started_at: null,
    raw_object_key: "incoming/jp/job-1-d_jp_txt.zip",
    scope_id: "JP",
    started_at: "2026-04-29T13:00:00.000Z",
    status: "queued",
    symbol_count: 0,
    ...overrides,
  };
}
