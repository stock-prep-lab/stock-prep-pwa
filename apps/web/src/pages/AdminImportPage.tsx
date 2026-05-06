import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import type { ImportJobRecord, ImportJobsPayload } from "@stock-prep/shared";

import { importBulkZip, fetchImportJobs } from "../data/adminImportApi";
import { stooqBulkImportScopes } from "../data/stooqBulk";

type UploadPhase = "preparing" | "queueing" | "uploading";

type UploadState = {
  error?: string;
  file: File | null;
  isSubmitting: boolean;
  phase?: UploadPhase;
  progressPercent?: number;
};

const initialUploadState = (): UploadState => ({
  file: null,
  isSubmitting: false,
});

export function AdminImportPage() {
  const [payload, setPayload] = useState<ImportJobsPayload>({
    datasetVersion: null,
    generatedAt: null,
    jobs: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploadStateByScope, setUploadStateByScope] = useState<
    Record<ImportJobRecord["scopeId"], UploadState>
  >({
    FX: initialUploadState(),
    HK: initialUploadState(),
    JP: initialUploadState(),
    US: initialUploadState(),
  });

  useEffect(() => {
    void refreshJobs();
  }, []);

  useEffect(() => {
    const hasActiveJobs = payload.jobs.some(
      (job) => job.status === "processing" || job.status === "queued",
    );

    if (!hasActiveJobs) {
      return;
    }

    const timerId = window.setTimeout(() => {
      void refreshJobs({ showSpinner: false });
    }, 5000);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [payload.jobs]);

  const jobByScope = useMemo(() => {
    const next = new Map<ImportJobRecord["scopeId"], ImportJobRecord>();

    for (const job of payload.jobs) {
      if (!next.has(job.scopeId)) {
        next.set(job.scopeId, job);
      }
    }

    return next;
  }, [payload.jobs]);

  async function refreshJobs({ showSpinner = true }: { showSpinner?: boolean } = {}) {
    if (showSpinner) {
      setIsLoading(true);
    }

    setLoadError(null);

    try {
      setPayload(await fetchImportJobs());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "取り込み状態の取得に失敗しました。");
    } finally {
      if (showSpinner) {
        setIsLoading(false);
      }
    }
  }

  async function handleImport(scopeId: ImportJobRecord["scopeId"]) {
    const state = uploadStateByScope[scopeId];

    if (!state.file) {
      setUploadStateByScope((current) => ({
        ...current,
        [scopeId]: {
          ...current[scopeId],
          error: "ZIP ファイルを選択してください。",
        },
      }));
      return;
    }

    setUploadStateByScope((current) => ({
      ...current,
      [scopeId]: {
        ...current[scopeId],
        error: undefined,
        isSubmitting: true,
        phase: "preparing",
        progressPercent: 0,
      },
    }));

    try {
      const nextJob = await importBulkZip({
        file: state.file,
        onProgress: (progressPercent) => {
          setUploadStateByScope((current) => ({
            ...current,
            [scopeId]: {
              ...current[scopeId],
              phase: "uploading",
              progressPercent,
            },
          }));
        },
        onStageChange: (phase) => {
          setUploadStateByScope((current) => ({
            ...current,
            [scopeId]: {
              ...current[scopeId],
              phase,
              progressPercent: phase === "queueing" ? 100 : (current[scopeId].progressPercent ?? 0),
            },
          }));
        },
        scopeId,
      });

      setPayload((current) => ({
        ...current,
        datasetVersion: nextJob.datasetVersion ?? current.datasetVersion,
        generatedAt: nextJob.finishedAt ?? current.generatedAt,
        jobs: [nextJob, ...current.jobs.filter((job) => job.id !== nextJob.id)].slice(0, 20),
      }));
      setUploadStateByScope((current) => ({
        ...current,
        [scopeId]: initialUploadState(),
      }));
      await refreshJobs({ showSpinner: false });
    } catch (error) {
      setUploadStateByScope((current) => ({
        ...current,
        [scopeId]: {
          ...current[scopeId],
          error: error instanceof Error ? error.message : "取り込みに失敗しました。",
          isSubmitting: false,
          phase: undefined,
          progressPercent: undefined,
        },
      }));
    }
  }

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-3">
            <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">
              手動 bulk 取り込み
            </h1>
            <p className="max-w-3xl text-base leading-7 text-zinc-700">
              日本 / 米国 / 香港 / world(為替) の ZIP を市場別に取り込みます。 ブラウザから
              R2 へ直接アップロードし、その後 Vercel が queue を作成します。
            </p>
          </div>
          <Link
            className="w-fit rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition hover:border-teal-700 hover:text-teal-700"
            to="/"
          >
            ホームへ戻る
          </Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <InfoCard label="最新 dataset version" value={payload.datasetVersion ?? "未取り込み"} />
        <InfoCard
          label="最新 generatedAt"
          value={payload.generatedAt ? formatTimestamp(payload.generatedAt) : "未取り込み"}
        />
        <InfoCard label="最新 job 件数" value={`${payload.jobs.length}件`} />
      </div>

      {loadError ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {loadError}
        </p>
      ) : null}

      <section className="flex flex-col gap-4" aria-labelledby="upload-scopes-heading">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-normal" id="upload-scopes-heading">
            市場別 ZIP 入力
          </h2>
          <button
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:border-teal-700 hover:text-teal-700"
            onClick={() => {
              void refreshJobs();
            }}
            type="button"
          >
            状態を再読み込み
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {stooqBulkImportScopes.map((scope) => {
            const uploadState = uploadStateByScope[scope.id];
            const latestJob = jobByScope.get(scope.id);

            return (
              <article
                className="flex flex-col gap-4 rounded-md border border-zinc-200 bg-white p-4"
                key={scope.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-lg font-semibold tracking-normal">{scope.label}</h3>
                    <p className="text-sm text-zinc-600">{scope.bundleCode}.zip</p>
                  </div>
                  <StatusPill status={latestJob?.status} />
                </div>

                <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                  ZIP ファイル
                  <input
                    accept=".zip,application/zip"
                    className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-800 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-700"
                    onChange={(event) => {
                      const nextFile = event.currentTarget.files?.[0] ?? null;
                      setUploadStateByScope((current) => ({
                        ...current,
                        [scope.id]: {
                          error: undefined,
                          file: nextFile,
                          isSubmitting: false,
                          phase: undefined,
                          progressPercent: undefined,
                        },
                      }));
                    }}
                    type="file"
                  />
                </label>

                <div className="grid gap-2 text-sm text-zinc-700 sm:grid-cols-2">
                  <JobMetric label="対象市場" value={scope.id} />
                  <JobMetric label="最新 file" value={latestJob?.fileName ?? "未実行"} />
                  <JobMetric
                    label="銘柄数"
                    value={latestJob ? `${latestJob.symbolCount}件` : "未実行"}
                  />
                  <JobMetric
                    label="価格数"
                    value={latestJob ? `${latestJob.dailyPriceCount}件` : "未実行"}
                  />
                </div>

                {latestJob?.errorMessage ? (
                  <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {latestJob.errorMessage}
                  </p>
                ) : null}
                {uploadState.error ? (
                  <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {uploadState.error}
                  </p>
                ) : null}
                {uploadState.isSubmitting ? (
                  <div className="flex flex-col gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-3 text-sm text-sky-800">
                    <div className="flex items-center justify-between gap-3">
                      <span>{describeUploadPhase(uploadState.phase)}</span>
                      <span className="font-semibold">
                        {formatProgressPercent(uploadState.progressPercent)}
                      </span>
                    </div>
                    <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-sky-100">
                      <div
                        className="h-full rounded-full bg-sky-600 transition-[width]"
                        style={{ width: `${uploadState.progressPercent ?? 0}%` }}
                      />
                    </div>
                  </div>
                ) : null}

                <button
                  className="w-fit rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
                  disabled={uploadState.isSubmitting}
                  onClick={() => {
                    void handleImport(scope.id);
                  }}
                  type="button"
                >
                  {uploadState.isSubmitting
                    ? buttonLabelForUploadPhase(uploadState.phase)
                    : "取り込み開始"}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="import-jobs-heading">
        <h2 className="text-xl font-semibold tracking-normal" id="import-jobs-heading">
          import job 状態
        </h2>

        {isLoading ? (
          <p className="text-sm text-zinc-600">状態を読み込んでいます...</p>
        ) : payload.jobs.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-sm text-zinc-600">
            まだ import job がありません。
          </p>
        ) : (
          <div className="overflow-hidden rounded-md border border-zinc-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead className="bg-zinc-50 text-left text-zinc-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">市場</th>
                    <th className="px-4 py-3 font-medium">状態</th>
                    <th className="px-4 py-3 font-medium">ファイル</th>
                    <th className="px-4 py-3 font-medium">開始</th>
                    <th className="px-4 py-3 font-medium">終了</th>
                    <th className="px-4 py-3 font-medium">dataset</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.jobs.map((job) => (
                    <tr className="border-t border-zinc-100" key={job.id}>
                      <td className="px-4 py-3 text-zinc-800">{job.scopeId}</td>
                      <td className="px-4 py-3">
                        <StatusPill status={job.status} />
                      </td>
                      <td className="px-4 py-3 text-zinc-700">{job.fileName}</td>
                      <td className="px-4 py-3 text-zinc-700">{formatTimestamp(job.startedAt)}</td>
                      <td className="px-4 py-3 text-zinc-700">
                        {job.finishedAt ? formatTimestamp(job.finishedAt) : "-"}
                      </td>
                      <td className="px-4 py-3 text-zinc-700">
                        {job.datasetVersion ?? "-"}
                        {job.errorMessage ? (
                          <p className="mt-1 text-xs text-rose-700">{job.errorMessage}</p>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </section>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-4">
      <p className="text-sm font-medium text-zinc-600">{label}</p>
      <p className="mt-2 break-all text-base font-semibold text-zinc-950">{value}</p>
    </div>
  );
}

function JobMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-zinc-50 px-3 py-2">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 break-all text-sm font-medium text-zinc-900">{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status?: ImportJobRecord["status"] }) {
  const label =
    status === "queued"
      ? "受付済み"
      : status === "processing"
        ? "処理中"
        : status === "completed"
          ? "完了"
          : status === "failed"
            ? "失敗"
            : "未実行";
  const className =
    status === "queued"
      ? "bg-sky-50 text-sky-700"
      : status === "processing"
        ? "bg-amber-50 text-amber-700"
        : status === "completed"
          ? "bg-emerald-50 text-emerald-700"
          : status === "failed"
            ? "bg-rose-50 text-rose-700"
            : "bg-zinc-100 text-zinc-700";

  return <span className={`rounded-md px-2 py-1 text-xs font-semibold ${className}`}>{label}</span>;
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    day: "2-digit",
  });
}

function describeUploadPhase(phase?: UploadPhase): string {
  switch (phase) {
    case "preparing":
      return "アップロード URL を準備しています...";
    case "uploading":
      return "R2 へ直接アップロードしています...";
    case "queueing":
      return "import job を queued で登録しています...";
    default:
      return "取り込みを準備しています...";
  }
}

function buttonLabelForUploadPhase(phase?: UploadPhase): string {
  switch (phase) {
    case "preparing":
      return "アップロード準備中...";
    case "uploading":
      return "R2 へアップロード中...";
    case "queueing":
      return "キュー登録中...";
    default:
      return "取り込み中...";
  }
}

function formatProgressPercent(progressPercent?: number): string {
  return `${progressPercent ?? 0}%`;
}
