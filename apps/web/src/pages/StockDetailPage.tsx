import { Link, useParams } from "react-router-dom";

type PriceMetric = {
  label: string;
  value: string;
  note?: string;
};

type TrendSignal = {
  label: string;
  value: string;
  description: string;
  tone: "positive" | "neutral" | "warning";
};

type StockDetail = {
  code: string;
  name: string;
  market: string;
  currency: string;
  sector: string;
  close: string;
  change: string;
  changeRate: string;
  high: string;
  low: string;
  volume: string;
  week52High: string;
  week52Low: string;
  comment: string;
  priceMetrics: PriceMetric[];
  trendSignals: TrendSignal[];
};

const stockDetails: Record<string, StockDetail> = {
  "7203": {
    code: "7203",
    name: "トヨタ自動車",
    market: "東証プライム",
    currency: "JPY",
    sector: "輸送用機器",
    close: "3,218円",
    change: "+88円",
    changeRate: "+2.8%",
    high: "3,240円",
    low: "3,112円",
    volume: "28,430,000株",
    week52High: "3,386円",
    week52Low: "2,418円",
    comment:
      "出来高を伴って25日線を上回っています。候補として見る場合は、直近高値との距離と保有比率を合わせて確認します。",
    priceMetrics: [
      { label: "終値", value: "3,218円", note: "2026年4月17日" },
      { label: "前日比", value: "+2.8%", note: "+88円" },
      { label: "高値 / 安値", value: "3,240円 / 3,112円" },
      { label: "出来高", value: "28,430,000株" },
    ],
    trendSignals: [
      {
        label: "25MA",
        value: "上回り",
        description: "短期線を上回り、押し目からの反発を確認できます。",
        tone: "positive",
      },
      {
        label: "75MA",
        value: "上回り",
        description: "中期のトレンドも上向きの範囲にあります。",
        tone: "positive",
      },
      {
        label: "高値接近",
        value: "95%",
        description: "直近高値に近く、追いかけすぎには注意します。",
        tone: "warning",
      },
    ],
  },
  "6758": {
    code: "6758",
    name: "ソニーグループ",
    market: "東証プライム",
    currency: "JPY",
    sector: "電気機器",
    close: "14,240円",
    change: "+265円",
    changeRate: "+1.9%",
    high: "14,380円",
    low: "13,920円",
    volume: "4,820,000株",
    week52High: "15,120円",
    week52Low: "10,840円",
    comment:
      "直近高値に近い位置で推移しています。保有に追加する場合は、電気機器への偏りを先に確認します。",
    priceMetrics: [
      { label: "終値", value: "14,240円", note: "2026年4月17日" },
      { label: "前日比", value: "+1.9%", note: "+265円" },
      { label: "高値 / 安値", value: "14,380円 / 13,920円" },
      { label: "出来高", value: "4,820,000株" },
    ],
    trendSignals: [
      {
        label: "25MA",
        value: "上回り",
        description: "短期トレンドは上向きです。",
        tone: "positive",
      },
      {
        label: "75MA",
        value: "上回り",
        description: "中期線の上で推移しています。",
        tone: "positive",
      },
      {
        label: "高値接近",
        value: "94%",
        description: "高値に近く、購入価格の設定を慎重に見ます。",
        tone: "warning",
      },
    ],
  },
};

const fallbackStock = stockDetails["7203"];

export function StockDetailPage() {
  const { symbolCode } = useParams();
  const stock = symbolCode ? (stockDetails[symbolCode] ?? fallbackStock) : fallbackStock;

  return (
    <section className="flex flex-col gap-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="flex flex-col gap-4">
          <p className="text-sm font-medium text-teal-700">銘柄詳細</p>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">{stock.name}</h1>
              <span className="rounded-md bg-zinc-100 px-2 py-1 text-sm font-medium text-zinc-700">
                {stock.code}
              </span>
            </div>
            <p className="max-w-2xl text-base leading-7 text-zinc-700">
              価格情報、チャート、トレンド分析を確認します。今は静的な銘柄情報を表示しています。
            </p>
          </div>
        </div>

        <div className="grid gap-3 rounded-md border border-zinc-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-zinc-600">市場</span>
            <span className="text-sm font-semibold text-zinc-950">{stock.market}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-zinc-600">通貨</span>
            <span className="text-sm font-semibold text-zinc-950">{stock.currency}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-zinc-600">業種</span>
            <span className="text-sm font-semibold text-zinc-950">{stock.sector}</span>
          </div>
        </div>
      </div>

      <section className="flex flex-col gap-4" aria-labelledby="price-summary-heading">
        <SectionHeader
          description="引け後に確認するための価格サマリーです。"
          title="価格サマリー"
          titleId="price-summary-heading"
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stock.priceMetrics.map((metric) => (
            <MetricCard key={metric.label} metric={metric} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="chart-heading">
        <SectionHeader
          description="ローソク足、25MA、75MA を置く想定のダミーチャートです。"
          title="チャート"
          titleId="chart-heading"
        />

        <div className="rounded-md border border-zinc-200 bg-white p-4">
          <div className="relative min-h-72 overflow-hidden rounded-md bg-zinc-50 p-4">
            <div className="absolute inset-x-4 top-1/4 border-t border-dashed border-zinc-300" />
            <div className="absolute inset-x-4 top-1/2 border-t border-dashed border-zinc-300" />
            <div className="absolute inset-x-4 top-3/4 border-t border-dashed border-zinc-300" />
            <div className="absolute left-8 right-8 top-28 h-1 rotate-[-8deg] rounded-full bg-teal-700" />
            <div className="absolute left-8 right-8 top-36 h-1 rotate-[-4deg] rounded-full bg-amber-600" />

            <div className="absolute inset-x-6 bottom-8 grid grid-cols-12 items-end gap-2">
              {[64, 88, 72, 104, 96, 118, 108, 132, 126, 148, 136, 158].map((height, index) => (
                <div
                  className={
                    index % 3 === 0 ? "rounded-t-sm bg-amber-600" : "rounded-t-sm bg-teal-700"
                  }
                  key={height}
                  style={{ height }}
                />
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <LegendItem colorClass="bg-teal-700" label="ローソク足ダミー" />
            <LegendItem colorClass="bg-teal-700" label="25MA" />
            <LegendItem colorClass="bg-amber-600" label="75MA" />
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="flex flex-col gap-4" aria-labelledby="trend-heading">
          <SectionHeader
            description="候補に入れる前に見る短い判定です。"
            title="トレンド分析"
            titleId="trend-heading"
          />

          <div className="grid gap-3">
            {stock.trendSignals.map((signal) => (
              <TrendCard key={signal.label} signal={signal} />
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-4" aria-labelledby="comment-heading">
          <SectionHeader
            description="確認時のメモとして使う想定です。"
            title="コメント"
            titleId="comment-heading"
          />

          <div className="flex min-h-56 flex-col justify-between rounded-md border border-zinc-200 bg-white p-4">
            <p className="text-sm leading-7 text-zinc-700">{stock.comment}</p>
            <div className="grid gap-2 pt-4 sm:grid-cols-2 lg:grid-cols-1">
              <p className="text-sm text-zinc-600">52週高値: {stock.week52High}</p>
              <p className="text-sm text-zinc-600">52週安値: {stock.week52Low}</p>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-md border border-teal-200 bg-white p-4" aria-label="アクション">
        <div className="grid gap-3 sm:grid-cols-3">
          <Link
            className="flex min-h-12 items-center justify-center rounded-md bg-zinc-950 px-5 text-sm font-medium text-white transition hover:bg-teal-700"
            to={`/holdings/${stock.code}/edit`}
          >
            保有に追加
          </Link>
          <Link
            className="flex min-h-12 items-center justify-center rounded-md border border-zinc-300 bg-white px-5 text-sm font-medium text-zinc-950 transition hover:border-teal-700 hover:text-teal-700"
            to="/simulation"
          >
            シミュレーションする
          </Link>
          <button
            className="min-h-12 rounded-md border border-zinc-300 bg-white px-5 text-sm font-medium text-zinc-950 transition hover:border-teal-700 hover:text-teal-700"
            type="button"
          >
            ウォッチ追加
          </button>
        </div>
      </section>
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

function MetricCard({ metric }: { metric: PriceMetric }) {
  const valueClass = metric.value.startsWith("+") ? "text-emerald-700" : "text-zinc-950";

  return (
    <div className="min-h-28 rounded-md border border-zinc-200 bg-white p-4">
      <p className="text-sm font-medium text-zinc-600">{metric.label}</p>
      <p className={`mt-2 text-xl font-semibold tracking-normal ${valueClass}`}>{metric.value}</p>
      {metric.note ? <p className="mt-2 text-sm leading-6 text-zinc-700">{metric.note}</p> : null}
    </div>
  );
}

function LegendItem({ colorClass, label }: { colorClass: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`size-3 rounded-sm ${colorClass}`} />
      <span className="text-sm font-medium text-zinc-700">{label}</span>
    </div>
  );
}

function TrendCard({ signal }: { signal: TrendSignal }) {
  const valueClass =
    signal.tone === "positive"
      ? "text-emerald-700"
      : signal.tone === "warning"
        ? "text-amber-700"
        : "text-zinc-950";

  return (
    <div className="min-h-32 rounded-md border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-zinc-600">{signal.label}</p>
        <p className={`text-lg font-semibold tracking-normal ${valueClass}`}>{signal.value}</p>
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-700">{signal.description}</p>
    </div>
  );
}
