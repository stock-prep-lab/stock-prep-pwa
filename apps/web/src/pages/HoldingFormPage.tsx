import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import type { HoldingFormTarget } from "../data/portfolioRebalanceData";
import {
  loadHoldingFormTargetFromIndexedDb,
  saveHoldingToIndexedDb,
} from "../data/portfolioRebalanceData";

type HoldingFormState =
  | {
      error: string;
      status: "error";
    }
  | {
      status: "loaded";
      target: HoldingFormTarget;
    }
  | {
      status: "loading";
    }
  | {
      status: "not-found";
    };

export function HoldingFormPage() {
  const navigate = useNavigate();
  const { symbolCode } = useParams();
  const [formState, setFormState] = useState<HoldingFormState>({ status: "loading" });
  const [quantity, setQuantity] = useState("");
  const [averagePrice, setAveragePrice] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    loadHoldingFormTargetFromIndexedDb(symbolCode ?? "")
      .then((target) => {
        if (!isMounted) {
          return;
        }

        if (!target) {
          setFormState({ status: "not-found" });
          return;
        }

        setQuantity(target.existingHolding?.quantity.toString() ?? "");
        setAveragePrice(
          target.existingHolding?.averagePrice.toString() ??
            target.latestPrice?.close.toString() ??
            "",
        );
        setFormState({ status: "loaded", target });
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setFormState({
            error:
              error instanceof Error ? error.message : "保有登録データを読み込めませんでした。",
            status: "error",
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [symbolCode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (formState.status !== "loaded") {
      return;
    }

    const parsedQuantity = Number(quantity);
    const parsedAveragePrice = Number(averagePrice);

    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setSubmitError("保有株数は0より大きい数値で入力してください。");
      return;
    }

    if (!Number.isFinite(parsedAveragePrice) || parsedAveragePrice <= 0) {
      setSubmitError("取得単価は0より大きい数値で入力してください。");
      return;
    }

    setSubmitError(null);
    setIsSaving(true);

    try {
      await saveHoldingToIndexedDb({
        averagePrice: parsedAveragePrice,
        quantity: parsedQuantity,
        symbolId: formState.target.symbol.id,
      });
      navigate("/portfolio");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "保有を保存できませんでした。");
      setIsSaving(false);
    }
  }

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <p className="text-sm font-medium text-teal-700">保有登録 / 編集</p>
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">保有を記録する</h1>
          <p className="max-w-2xl text-base leading-7 text-zinc-700">
            保有株数と取得単価を IndexedDB に保存し、ポートフォリオ評価へ反映します。
          </p>
        </div>
      </div>

      {formState.status === "loading" ? (
        <StatusPanel message="保存済み銘柄を読み込んでいます。" />
      ) : formState.status === "error" ? (
        <StatusPanel message={formState.error} tone="error" />
      ) : formState.status === "not-found" ? (
        <StatusPanel message="対象銘柄が IndexedDB に見つかりません。先に Stooq CSV を取得してください。" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <section className="flex flex-col gap-4" aria-labelledby="holding-target-heading">
            <SectionHeader
              description="登録対象の銘柄です。"
              title="対象銘柄"
              titleId="holding-target-heading"
            />

            <Link
              className="flex min-h-56 flex-col justify-between rounded-md border border-zinc-200 bg-white p-4 text-zinc-950 transition hover:border-teal-700"
              to={`/stocks/${formState.target.symbol.code}`}
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-semibold tracking-normal">
                    {formState.target.symbol.name}
                  </h2>
                  <span className="rounded-md bg-zinc-100 px-2 py-1 text-sm font-medium text-zinc-700">
                    {formState.target.symbol.code}
                  </span>
                </div>
                <p className="mt-2 text-sm text-zinc-600">
                  {formState.target.symbol.region} / {formState.target.symbol.sourceSymbol}
                </p>
              </div>

              <div className="grid gap-2">
                <InfoRow label="通貨" value={formState.target.symbol.currency} />
                <InfoRow
                  label="終値"
                  value={
                    formState.target.latestPrice
                      ? formatCurrency(
                          formState.target.latestPrice.close,
                          formState.target.latestPrice.currency,
                        )
                      : "価格なし"
                  }
                />
                <InfoRow
                  label="既存保有"
                  value={
                    formState.target.existingHolding
                      ? `${formatQuantity(formState.target.existingHolding.quantity)} / 取得 ${formatCurrency(
                          formState.target.existingHolding.averagePrice,
                          formState.target.existingHolding.currency,
                        )}`
                      : "未登録"
                  }
                />
              </div>
            </Link>
          </section>

          <section className="flex flex-col gap-4" aria-labelledby="holding-form-heading">
            <SectionHeader
              description="保存後、ポートフォリオ画面の評価額と構成比に反映します。"
              title="入力内容"
              titleId="holding-form-heading"
            />

            <form
              className="grid gap-4 rounded-md border border-zinc-200 bg-white p-4"
              onSubmit={handleSubmit}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex min-w-0 flex-col gap-2">
                  <span className="text-sm font-medium text-zinc-700">保有株数</span>
                  <input
                    className="min-h-12 rounded-md border border-zinc-300 bg-white px-3 text-base text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-teal-700"
                    inputMode="decimal"
                    onChange={(event) => {
                      setQuantity(event.target.value);
                    }}
                    type="text"
                    value={quantity}
                  />
                </label>

                <label className="flex min-w-0 flex-col gap-2">
                  <span className="text-sm font-medium text-zinc-700">取得単価</span>
                  <input
                    className="min-h-12 rounded-md border border-zinc-300 bg-white px-3 text-base text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-teal-700"
                    inputMode="decimal"
                    onChange={(event) => {
                      setAveragePrice(event.target.value);
                    }}
                    type="text"
                    value={averagePrice}
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex min-w-0 flex-col gap-2">
                  <span className="text-sm font-medium text-zinc-700">市場</span>
                  <input
                    className="min-h-12 rounded-md border border-zinc-200 bg-zinc-50 px-3 text-base text-zinc-700"
                    readOnly
                    value={formState.target.symbol.region}
                  />
                </label>

                <label className="flex min-w-0 flex-col gap-2">
                  <span className="text-sm font-medium text-zinc-700">通貨</span>
                  <input
                    className="min-h-12 rounded-md border border-zinc-200 bg-zinc-50 px-3 text-base text-zinc-700"
                    readOnly
                    value={formState.target.symbol.currency}
                  />
                </label>
              </div>

              {submitError ? (
                <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                  {submitError}
                </p>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  className="flex min-h-12 items-center justify-center rounded-md bg-zinc-950 px-5 text-sm font-medium text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
                  disabled={isSaving}
                  type="submit"
                >
                  {isSaving ? "保存中" : "保存して戻る"}
                </button>
                <Link
                  className="flex min-h-12 items-center justify-center rounded-md border border-zinc-300 bg-white px-5 text-sm font-medium text-zinc-950 transition hover:border-teal-700 hover:text-teal-700"
                  to={`/stocks/${formState.target.symbol.code}`}
                >
                  キャンセル
                </Link>
              </div>
            </form>
          </section>
        </div>
      )}
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
      <h2 className="text-2xl font-semibold tracking-normal" id={titleId}>
        {title}
      </h2>
      <p className="max-w-2xl text-sm leading-6 text-zinc-700">{description}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium text-zinc-600">{label}</span>
      <span className="text-right text-sm font-semibold text-zinc-950">{value}</span>
    </div>
  );
}

function StatusPanel({ message, tone = "info" }: { message: string; tone?: "error" | "info" }) {
  return (
    <div
      className={
        tone === "error"
          ? "rounded-md border border-rose-200 bg-white p-4 text-sm leading-6 text-rose-700"
          : "rounded-md border border-zinc-200 bg-white p-4 text-sm leading-6 text-zinc-700"
      }
    >
      {message}
    </div>
  );
}

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("ja-JP", {
    currency,
    maximumFractionDigits: currency === "JPY" ? 0 : 2,
    style: "currency",
  }).format(value);
}

function formatQuantity(value: number): string {
  return `${new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 4 }).format(value)}株`;
}
