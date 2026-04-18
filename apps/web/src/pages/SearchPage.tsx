import { Link } from "react-router-dom";

type StockItem = {
  code: string;
  name: string;
  market: string;
  sector: string;
  price: string;
  changeRate: string;
  note: string;
};

type WatchItem = {
  code: string;
  name: string;
  memo: string;
};

const recentStocks: StockItem[] = [
  {
    code: "7203",
    name: "トヨタ自動車",
    market: "東証プライム",
    sector: "輸送用機器",
    price: "3,218円",
    changeRate: "+2.8%",
    note: "候補ランキングから確認",
  },
  {
    code: "6758",
    name: "ソニーグループ",
    market: "東証プライム",
    sector: "電気機器",
    price: "14,240円",
    changeRate: "+1.9%",
    note: "直近高値を確認",
  },
];

const watchStocks: WatchItem[] = [
  {
    code: "9432",
    name: "日本電信電話",
    memo: "配当目的で監視",
  },
  {
    code: "8306",
    name: "三菱UFJフィナンシャル・グループ",
    memo: "金利感応度を確認",
  },
  {
    code: "8058",
    name: "三菱商事",
    memo: "資源セクターの代表候補",
  },
];

const searchResults: StockItem[] = [
  {
    code: "7203",
    name: "トヨタ自動車",
    market: "東証プライム",
    sector: "輸送用機器",
    price: "3,218円",
    changeRate: "+2.8%",
    note: "大型株。出来高を伴う上昇を確認。",
  },
  {
    code: "7267",
    name: "本田技研工業",
    market: "東証プライム",
    sector: "輸送用機器",
    price: "1,742円",
    changeRate: "+0.8%",
    note: "移動平均線付近で推移。",
  },
  {
    code: "6902",
    name: "デンソー",
    market: "東証プライム",
    sector: "輸送用機器",
    price: "2,183円",
    changeRate: "-0.3%",
    note: "押し目候補として監視。",
  },
  {
    code: "6201",
    name: "豊田自動織機",
    market: "東証プライム",
    sector: "輸送用機器",
    price: "12,880円",
    changeRate: "+1.1%",
    note: "関連銘柄として比較。",
  },
];

export function SearchPage() {
  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <p className="text-sm font-medium text-teal-700">銘柄検索</p>
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">検索</h1>
          <p className="max-w-2xl text-base leading-7 text-zinc-700">
            銘柄名やコードから候補を探します。今は静的な検索結果を表示しています。
          </p>
        </div>
      </div>

      <form className="flex flex-col gap-3 md:flex-row">
        <label className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="text-sm font-medium text-zinc-700">検索キーワード</span>
          <input
            className="min-h-12 rounded-md border border-zinc-300 bg-white px-3 text-base text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-teal-700"
            defaultValue="トヨタ"
            inputMode="search"
            placeholder="銘柄名またはコード"
            type="search"
          />
        </label>
        <button
          className="min-h-12 rounded-md bg-zinc-950 px-5 text-sm font-medium text-white transition hover:bg-teal-700 md:self-end"
          type="button"
        >
          検索
        </button>
      </form>

      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <section className="flex flex-col gap-4" aria-labelledby="recent-stocks-heading">
          <SectionHeader
            description="直近で確認した銘柄です。"
            title="最近見た銘柄"
            titleId="recent-stocks-heading"
          />

          <div className="grid gap-3">
            {recentStocks.map((stock) => (
              <CompactStockCard key={stock.code} stock={stock} />
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-4" aria-labelledby="watch-stocks-heading">
          <SectionHeader
            description="継続して見たい銘柄のメモです。"
            title="ウォッチ銘柄"
            titleId="watch-stocks-heading"
          />

          <div className="grid gap-3 sm:grid-cols-3">
            {watchStocks.map((stock) => (
              <Link
                className="flex min-h-32 flex-col justify-between rounded-md border border-zinc-200 bg-white p-4 text-zinc-950 transition hover:border-teal-700"
                key={stock.code}
                to={`/stocks/${stock.code}`}
              >
                <div>
                  <h2 className="text-lg font-semibold tracking-normal">{stock.name}</h2>
                  <p className="mt-1 text-sm text-zinc-600">{stock.code}</p>
                </div>
                <p className="text-sm leading-6 text-zinc-700">{stock.memo}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <section className="flex flex-col gap-4" aria-labelledby="search-results-heading">
        <SectionHeader
          description="検索キーワードに一致した想定のダミー結果です。"
          title="検索結果"
          titleId="search-results-heading"
        />

        <div className="overflow-hidden rounded-md border border-zinc-200 bg-white">
          <div className="hidden grid-cols-[1fr_8rem_8rem_8rem] border-b border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-600 md:grid">
            <span>銘柄</span>
            <span>市場</span>
            <span>株価</span>
            <span>前日比</span>
          </div>

          <div className="divide-y divide-zinc-200">
            {searchResults.map((stock) => (
              <Link
                className="grid gap-3 p-4 text-zinc-950 transition hover:bg-zinc-50 md:grid-cols-[1fr_8rem_8rem_8rem] md:items-center"
                key={stock.code}
                to={`/stocks/${stock.code}`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold tracking-normal">{stock.name}</h2>
                    <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">
                      {stock.code}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-600">{stock.sector}</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-700 md:hidden">{stock.note}</p>
                </div>
                <p className="text-sm text-zinc-700">{stock.market}</p>
                <p className="text-sm font-semibold text-zinc-950">{stock.price}</p>
                <p
                  className={
                    stock.changeRate.startsWith("+")
                      ? "text-sm font-semibold text-emerald-700"
                      : "text-sm font-semibold text-amber-700"
                  }
                >
                  {stock.changeRate}
                </p>
              </Link>
            ))}
          </div>
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

function CompactStockCard({ stock }: { stock: StockItem }) {
  return (
    <Link
      className="flex min-h-36 flex-col justify-between rounded-md border border-zinc-200 bg-white p-4 text-zinc-950 transition hover:border-teal-700"
      to={`/stocks/${stock.code}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-normal">{stock.name}</h2>
          <p className="mt-1 text-sm text-zinc-600">{stock.code}</p>
        </div>
        <span
          className={
            stock.changeRate.startsWith("+")
              ? "rounded-md bg-emerald-50 px-2 py-1 text-sm font-semibold text-emerald-700"
              : "rounded-md bg-amber-50 px-2 py-1 text-sm font-semibold text-amber-700"
          }
        >
          {stock.changeRate}
        </span>
      </div>
      <div>
        <p className="text-sm font-medium text-zinc-950">{stock.price}</p>
        <p className="mt-1 text-sm leading-6 text-zinc-700">{stock.note}</p>
      </div>
    </Link>
  );
}
