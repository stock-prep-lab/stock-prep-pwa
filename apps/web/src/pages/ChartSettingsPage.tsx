import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import {
  chartSettingsLookbackOptions,
  defaultChartSettings,
  loadChartSettings,
  saveChartSettings,
  type SaveChartSettingsInput,
} from "../data/chartSettings";

type ChartSettingsPageState =
  | { status: "error"; error: string }
  | { status: "loaded"; settings: SaveChartSettingsInput }
  | { status: "loading" };

const visibilityItems: Array<{
  id: keyof SaveChartSettingsInput["visibility"];
  label: string;
}> = [
  { id: "ma25", label: "25MA" },
  { id: "ma75", label: "75MA" },
  { id: "recentHigh", label: "直近高値ライン" },
  { id: "buyPrice", label: "買値ライン" },
  { id: "stopLoss", label: "損切りライン" },
];

export function ChartSettingsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<ChartSettingsPageState>({ status: "loading" });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const returnTo = useMemo(() => searchParams.get("returnTo") ?? "/search", [searchParams]);

  useEffect(() => {
    let active = true;

    void loadChartSettings()
      .then((settings) => {
        if (!active) {
          return;
        }

        setState({
          status: "loaded",
          settings: {
            recentHighLookbackTradingDays: settings.recentHighLookbackTradingDays,
            stopLossPercent: settings.stopLossPercent,
            visibility: settings.visibility,
          },
        });
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        setState({
          error: error instanceof Error ? error.message : "チャート設定を読み込めませんでした。",
          status: "error",
        });
      });

    return () => {
      active = false;
    };
  }, []);

  function updateLoadedSettings(updater: (current: SaveChartSettingsInput) => SaveChartSettingsInput) {
    setState((current) => {
      if (current.status !== "loaded") {
        return current;
      }

      return { status: "loaded", settings: updater(current.settings) };
    });
  }

  async function handleSave() {
    if (state.status !== "loaded") {
      return;
    }

    setSaveError(null);
    setIsSaving(true);

    try {
      await saveChartSettings(state.settings);
      navigate(returnTo);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "チャート設定を保存できませんでした。");
      setIsSaving(false);
    }
  }

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <p className="text-sm font-medium text-teal-700">チャート設定</p>
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">
            銘柄詳細の初期表示を調整する
          </h1>
          <p className="max-w-3xl text-base leading-7 text-zinc-700">
            ここで保存した内容は端末内の IndexedDB に保持され、銘柄詳細を開いた時の初期表示と損切りライン計算に使われます。
          </p>
        </div>
      </div>

      {state.status === "loading" ? (
        <StatusPanel message="チャート設定を読み込んでいます。" />
      ) : state.status === "error" ? (
        <StatusPanel message={state.error} tone="error" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <section className="flex flex-col gap-4" aria-labelledby="default-visibility-heading">
            <SectionHeader
              description="銘柄詳細を開いた時に最初から表示しておきたいラインを選びます。"
              title="初期表示"
              titleId="default-visibility-heading"
            />

            <div className="rounded-md border border-zinc-200 bg-white p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {visibilityItems.map((item) => (
                  <label
                    className="flex min-h-11 items-center gap-2 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700"
                    key={item.id}
                  >
                    <input
                      checked={state.settings.visibility[item.id]}
                      className="h-4 w-4 accent-teal-700"
                      onChange={() => {
                        updateLoadedSettings((current) => ({
                          ...current,
                          visibility: {
                            ...current.visibility,
                            [item.id]: !current.visibility[item.id],
                          },
                        }));
                      }}
                      type="checkbox"
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-4" aria-labelledby="chart-rule-heading">
            <SectionHeader
              description="直近高値の見方と損切りラインの計算目安を決めます。"
              title="ライン計算"
              titleId="chart-rule-heading"
            />

            <div className="grid gap-4 rounded-md border border-zinc-200 bg-white p-4">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-zinc-700">直近高値の対象期間</span>
                <select
                  className="min-h-11 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-800"
                  onChange={(event) => {
                    updateLoadedSettings((current) => ({
                      ...current,
                      recentHighLookbackTradingDays: Number(event.target.value),
                    }));
                  }}
                  value={state.settings.recentHighLookbackTradingDays}
                >
                  {chartSettingsLookbackOptions.map((option) => (
                    <option key={option} value={option}>
                      直近 {option} 営業日
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-zinc-700">損切りラインの下げ幅 (%)</span>
                <input
                  className="min-h-11 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-800"
                  inputMode="decimal"
                  max="50"
                  min="1"
                  onChange={(event) => {
                    const nextValue = Number(event.target.value);

                    updateLoadedSettings((current) => ({
                      ...current,
                      stopLossPercent: Number.isFinite(nextValue)
                        ? nextValue
                        : current.stopLossPercent,
                    }));
                  }}
                  step="0.5"
                  type="number"
                  value={state.settings.stopLossPercent}
                />
              </label>

              <div className="rounded-md bg-zinc-50 px-3 py-3 text-sm leading-7 text-zinc-600">
                例: 8% にすると、買値 100 の銘柄では損切りラインを 92 として表示します。
              </div>
            </div>
          </section>
        </div>
      )}

      {state.status === "loaded" ? (
        <div className="flex flex-col gap-3 rounded-md border border-zinc-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm leading-7 text-zinc-600">
            今回は端末内保存のみです。ほかの端末へは同期されません。
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="min-h-11 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700"
              onClick={() => {
                setSaveError(null);
                setState({
                  status: "loaded",
                  settings: {
                    recentHighLookbackTradingDays:
                      defaultChartSettings.recentHighLookbackTradingDays,
                    stopLossPercent: defaultChartSettings.stopLossPercent,
                    visibility: defaultChartSettings.visibility,
                  },
                });
              }}
              type="button"
            >
              初期値に戻す
            </button>
            <Link
              className="min-h-11 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700"
              to={returnTo}
            >
              戻る
            </Link>
            <button
              className="min-h-11 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:bg-teal-400"
              disabled={isSaving}
              onClick={() => {
                void handleSave();
              }}
              type="button"
            >
              {isSaving ? "保存中..." : "保存する"}
            </button>
          </div>
        </div>
      ) : null}

      {saveError ? <StatusPanel message={saveError} tone="error" /> : null}
    </section>
  );
}

function SectionHeader({
  description,
  title,
  titleId,
}: {
  description: string;
  title: string;
  titleId: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-xl font-semibold tracking-normal text-zinc-950" id={titleId}>
        {title}
      </h2>
      <p className="text-sm leading-7 text-zinc-600">{description}</p>
    </div>
  );
}

function StatusPanel({ message, tone = "info" }: { message: string; tone?: "error" | "info" }) {
  return (
    <div
      className={[
        "rounded-md border px-4 py-5 text-sm leading-7",
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-zinc-200 bg-white text-zinc-700",
      ].join(" ")}
    >
      {message}
    </div>
  );
}
