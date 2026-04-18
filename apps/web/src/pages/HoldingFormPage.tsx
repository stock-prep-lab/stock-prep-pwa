import { Link, useParams } from "react-router-dom";

type HoldingTarget = {
  code: string;
  name: string;
  market: string;
  currency: string;
  sector: string;
  close: string;
  defaultQuantity: string;
  defaultAveragePrice: string;
  cashMemo: string;
};

const holdingTargets: Record<string, HoldingTarget> = {
  "7203": {
    code: "7203",
    name: "トヨタ自動車",
    market: "東証プライム",
    currency: "JPY",
    sector: "輸送用機器",
    close: "3,218円",
    defaultQuantity: "200",
    defaultAveragePrice: "2840",
    cashMemo: "現金 331,000円から追加候補を検討",
  },
  "6758": {
    code: "6758",
    name: "ソニーグループ",
    market: "東証プライム",
    currency: "JPY",
    sector: "電気機器",
    close: "14,240円",
    defaultQuantity: "30",
    defaultAveragePrice: "12900",
    cashMemo: "電気機器の比率が高め。追加前に構成比を確認",
  },
};

const fallbackTarget = holdingTargets["7203"];

export function HoldingFormPage() {
  const { symbolCode } = useParams();
  const target = symbolCode ? (holdingTargets[symbolCode] ?? fallbackTarget) : fallbackTarget;

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <p className="text-sm font-medium text-teal-700">保有登録 / 編集</p>
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">保有を記録する</h1>
          <p className="max-w-2xl text-base leading-7 text-zinc-700">
            保有株数と取得単価を入力します。今は静的なフォーム表示で、保存処理は行いません。
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <section className="flex flex-col gap-4" aria-labelledby="holding-target-heading">
          <SectionHeader
            description="登録対象の銘柄です。"
            title="対象銘柄"
            titleId="holding-target-heading"
          />

          <Link
            className="flex min-h-56 flex-col justify-between rounded-md border border-zinc-200 bg-white p-4 text-zinc-950 transition hover:border-teal-700"
            to={`/stocks/${target.code}`}
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-semibold tracking-normal">{target.name}</h2>
                <span className="rounded-md bg-zinc-100 px-2 py-1 text-sm font-medium text-zinc-700">
                  {target.code}
                </span>
              </div>
              <p className="mt-2 text-sm text-zinc-600">{target.sector}</p>
            </div>

            <div className="grid gap-2">
              <InfoRow label="市場" value={target.market} />
              <InfoRow label="通貨" value={target.currency} />
              <InfoRow label="終値" value={target.close} />
            </div>
          </Link>
        </section>

        <section className="flex flex-col gap-4" aria-labelledby="holding-form-heading">
          <SectionHeader
            description="永続化は後続 Slice で接続します。"
            title="入力内容"
            titleId="holding-form-heading"
          />

          <form className="grid gap-4 rounded-md border border-zinc-200 bg-white p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex min-w-0 flex-col gap-2">
                <span className="text-sm font-medium text-zinc-700">保有株数</span>
                <input
                  className="min-h-12 rounded-md border border-zinc-300 bg-white px-3 text-base text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-teal-700"
                  defaultValue={target.defaultQuantity}
                  inputMode="numeric"
                  type="text"
                />
              </label>

              <label className="flex min-w-0 flex-col gap-2">
                <span className="text-sm font-medium text-zinc-700">取得単価</span>
                <input
                  className="min-h-12 rounded-md border border-zinc-300 bg-white px-3 text-base text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-teal-700"
                  defaultValue={target.defaultAveragePrice}
                  inputMode="decimal"
                  type="text"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex min-w-0 flex-col gap-2">
                <span className="text-sm font-medium text-zinc-700">市場</span>
                <input
                  className="min-h-12 rounded-md border border-zinc-200 bg-zinc-50 px-3 text-base text-zinc-700"
                  readOnly
                  value={target.market}
                />
              </label>

              <label className="flex min-w-0 flex-col gap-2">
                <span className="text-sm font-medium text-zinc-700">通貨</span>
                <input
                  className="min-h-12 rounded-md border border-zinc-200 bg-zinc-50 px-3 text-base text-zinc-700"
                  readOnly
                  value={target.currency}
                />
              </label>
            </div>

            <label className="flex min-w-0 flex-col gap-2">
              <span className="text-sm font-medium text-zinc-700">現金メモ</span>
              <textarea
                className="min-h-28 rounded-md border border-zinc-300 bg-white px-3 py-3 text-base text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-teal-700"
                defaultValue={target.cashMemo}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <Link
                className="flex min-h-12 items-center justify-center rounded-md bg-zinc-950 px-5 text-sm font-medium text-white transition hover:bg-teal-700"
                to="/portfolio"
              >
                保存して戻る
              </Link>
              <Link
                className="flex min-h-12 items-center justify-center rounded-md border border-zinc-300 bg-white px-5 text-sm font-medium text-zinc-950 transition hover:border-teal-700 hover:text-teal-700"
                to={`/stocks/${target.code}`}
              >
                キャンセル
              </Link>
            </div>
          </form>
        </section>
      </div>
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
      <span className="text-sm font-semibold text-zinc-950">{value}</span>
    </div>
  );
}
