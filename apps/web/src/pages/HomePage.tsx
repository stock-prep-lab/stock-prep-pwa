import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { PaginationControls } from "../components/PaginationControls";
import { UserSymbolBadges } from "../components/UserSymbolBadges";
import { WatchToggleButton } from "../components/WatchToggleButton";
import { buildStockDetailHref } from "../data/stockDetailHref";
import { subscribeToStockPrepDataChanged } from "../data/dataSyncEvents";
import {
  addWatchSymbol,
  loadUserSymbolsSnapshotFromIndexedDb,
  removeWatchSymbol,
  type UserSymbolListItem,
} from "../data/userSymbolsData";
import { subscribeToUserSymbolsChanged } from "../data/userSymbolsEvents";

type UpdateSummary = {
  marketDate: string;
  importedAt: string;
  status: string;
  symbolCount: number;
  priceCount: number;
};

type Candidate = {
  rank: number;
  code: string;
  name: string;
  region: "JP";
  signal: string;
  score: number;
  changeRate: string;
};

type PortfolioSummary = {
  totalValue: string;
  cashRatio: string;
  stockRatio: string;
  topHolding: string;
};

type RebalanceAlert = {
  title: string;
  description: string;
  severity: "注意" | "確認";
};

const updateSummary: UpdateSummary = {
  marketDate: "2026年4月17日",
  importedAt: "15:35",
  status: "日次データ更新済み",
  symbolCount: 3821,
  priceCount: 3821,
};

const candidates: Candidate[] = [
  {
    rank: 1,
    code: "7203",
    name: "トヨタ自動車",
    region: "JP",
    signal: "出来高を伴って25日線を上抜け",
    score: 91,
    changeRate: "+2.8%",
  },
  {
    rank: 2,
    code: "6758",
    name: "ソニーグループ",
    region: "JP",
    signal: "直近高値に接近",
    score: 87,
    changeRate: "+1.9%",
  },
  {
    rank: 3,
    code: "8035",
    name: "東京エレクトロン",
    region: "JP",
    signal: "75日線の上で反発",
    score: 84,
    changeRate: "+1.4%",
  },
];

const portfolioSummary: PortfolioSummary = {
  totalValue: "1,842,000円",
  cashRatio: "18%",
  stockRatio: "82%",
  topHolding: "7203 トヨタ自動車",
};

const rebalanceAlert: RebalanceAlert = {
  title: "電気機器の比率が高め",
  description: "上位 2 銘柄に偏りが出ています。次の購入候補は業種分散も確認しましょう。",
  severity: "注意",
};

const marketImageUrl =
  "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=900&q=80";
const userSymbolPageSize = 10;

export function HomePage() {
  const [recentSymbols, setRecentSymbols] = useState<UserSymbolListItem[]>([]);
  const [watchlist, setWatchlist] = useState<UserSymbolListItem[]>([]);
  const [recentPage, setRecentPage] = useState(1);
  const [watchlistPage, setWatchlistPage] = useState(1);

  useEffect(() => {
    let active = true;

    async function load() {
      const snapshot = await loadUserSymbolsSnapshotFromIndexedDb();

      if (!active) {
        return;
      }

      setRecentSymbols(snapshot.recentSymbols);
      setWatchlist(snapshot.watchlist);
    }

    void load().catch(() => undefined);
    const unsubscribeData = subscribeToStockPrepDataChanged(() => {
      void load().catch(() => undefined);
    });
    const unsubscribeUserSymbols = subscribeToUserSymbolsChanged(() => {
      void load().catch(() => undefined);
    });

    return () => {
      active = false;
      unsubscribeData();
      unsubscribeUserSymbols();
    };
  }, []);

  useEffect(() => {
    setRecentPage((current) => clampPage(current, recentSymbols.length));
  }, [recentSymbols.length]);

  useEffect(() => {
    setWatchlistPage((current) => clampPage(current, watchlist.length));
  }, [watchlist.length]);

  async function handleToggleWatch(symbolId: string, isWatched: boolean) {
    try {
      if (isWatched) {
        await removeWatchSymbol(symbolId);
        return;
      }

      await addWatchSymbol(symbolId);
    } catch (error) {
      console.error("Failed to toggle watch symbol from home page.", error);
    }
  }

  const recentTotalPages = getTotalPages(recentSymbols.length);
  const watchlistTotalPages = getTotalPages(watchlist.length);
  const visibleRecentSymbols = paginateItems(recentSymbols, recentPage);
  const visibleWatchlist = paginateItems(watchlist, watchlistPage);

  return (
    <section className="flex flex-col gap-8">
      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr] lg:items-stretch">
        <div className="flex flex-col justify-between gap-6 py-2">
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-teal-700">{updateSummary.status}</p>
            <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">ホーム</h1>
            <p className="max-w-2xl text-base leading-7 text-zinc-700">
              引け後の数字を確認して、翌営業日の候補を絞り込みます。
            </p>
            <div>
              <Link
                className="inline-flex rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition hover:border-teal-700 hover:text-teal-700"
                to="/admin/imports"
              >
                データ取り込み管理へ
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="対象日" value={updateSummary.marketDate} />
            <MetricCard label="取込時刻" value={updateSummary.importedAt} />
            <MetricCard label="銘柄数" value={formatCount(updateSummary.symbolCount)} />
            <MetricCard label="価格件数" value={formatCount(updateSummary.priceCount)} />
          </div>
        </div>

        <img
          alt="株価チャートを確認するワークスペース"
          className="h-56 w-full rounded-md object-cover lg:h-full"
          src={marketImageUrl}
        />
      </div>

      <section className="flex flex-col gap-4" aria-labelledby="today-candidates-heading">
        <SectionHeader
          actionLabel="候補一覧へ"
          actionTo="/screening"
          description="モメンタムと直近の値動きから、確認優先度が高い銘柄です。"
          title="今日の候補 TOP"
          titleId="today-candidates-heading"
        />

        <div className="grid gap-3 lg:grid-cols-3">
          {candidates.map((candidate) => (
            <Link
              className="flex min-h-44 flex-col justify-between rounded-md border border-zinc-200 bg-white p-4 text-zinc-950 transition hover:border-teal-700"
              key={candidate.code}
              to={buildStockDetailHref({
                code: candidate.code,
                region: candidate.region,
              })}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-teal-700">No. {candidate.rank}</p>
                  <h2 className="mt-2 text-xl font-semibold tracking-normal">{candidate.name}</h2>
                  <p className="mt-1 text-sm text-zinc-600">{candidate.code}</p>
                </div>
                <span className="rounded-md bg-emerald-50 px-2 py-1 text-sm font-semibold text-emerald-700">
                  {candidate.changeRate}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-sm leading-6 text-zinc-700">{candidate.signal}</p>
                <p className="text-sm font-medium text-zinc-950">Score {candidate.score}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="flex flex-col gap-4" aria-labelledby="portfolio-summary-heading">
          <SectionHeader
            actionLabel="保有を見る"
            actionTo="/portfolio"
            description="現金と株式のざっくりしたバランスです。"
            title="ポートフォリオ概要"
            titleId="portfolio-summary-heading"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard label="評価額" value={portfolioSummary.totalValue} />
            <MetricCard label="現金比率" value={portfolioSummary.cashRatio} />
            <MetricCard label="株式比率" value={portfolioSummary.stockRatio} />
            <MetricCard label="最大保有" value={portfolioSummary.topHolding} />
          </div>
        </section>

        <section className="flex flex-col gap-4" aria-labelledby="rebalance-heading">
          <SectionHeader
            actionLabel="提案を見る"
            actionTo="/rebalance"
            description="保有比率の偏りを確認します。"
            title="リバランス注意"
            titleId="rebalance-heading"
          />

          <Link
            className="flex min-h-40 flex-col justify-between rounded-md border border-rose-200 bg-white p-4 text-zinc-950 transition hover:border-rose-500"
            to="/rebalance"
          >
            <span className="w-fit rounded-md bg-rose-50 px-2 py-1 text-sm font-semibold text-rose-700">
              {rebalanceAlert.severity}
            </span>
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-semibold tracking-normal">{rebalanceAlert.title}</h2>
              <p className="text-sm leading-6 text-zinc-700">{rebalanceAlert.description}</p>
            </div>
          </Link>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-4" aria-labelledby="home-recent-heading">
          <SectionHeader
            description="銘柄詳細を開いた順に、次に見返したい銘柄を残します。"
            title="最近見た銘柄"
            titleId="home-recent-heading"
          />

          {recentSymbols.length === 0 ? (
            <EmptyPanel message="まだ最近見た銘柄はありません。" />
          ) : (
            <>
              <div className="grid gap-3">
                {visibleRecentSymbols.map((item) => (
                  <HomeUserSymbolCard
                    item={item}
                    key={item.symbol.id}
                    markAsRecent
                    onToggleWatch={() => {
                      void handleToggleWatch(item.symbol.id, item.isWatched);
                    }}
                  />
                ))}
              </div>
              <PaginationControls
                currentPage={recentPage}
                onPageChange={setRecentPage}
                totalItems={recentSymbols.length}
                totalPages={recentTotalPages}
              />
            </>
          )}
        </section>

        <section className="flex flex-col gap-4" aria-labelledby="watchlist-heading">
          <SectionHeader
            description="端末間で同期するウォッチ銘柄をここで確認します。"
            title="ウォッチ銘柄"
            titleId="watchlist-heading"
          />

          {watchlist.length === 0 ? (
            <EmptyPanel message="まだウォッチ銘柄はありません。" />
          ) : (
            <>
              <div className="grid gap-3">
                {visibleWatchlist.map((item) => (
                  <HomeUserSymbolCard
                    item={item}
                    key={item.symbol.id}
                    onToggleWatch={() => {
                      void handleToggleWatch(item.symbol.id, item.isWatched);
                    }}
                  />
                ))}
              </div>
              <PaginationControls
                currentPage={watchlistPage}
                onPageChange={setWatchlistPage}
                totalItems={watchlist.length}
                totalPages={watchlistTotalPages}
              />
            </>
          )}
        </section>
      </div>
    </section>
  );
}

function formatCount(value: number): string {
  return `${new Intl.NumberFormat("ja-JP").format(value)}件`;
}

function paginateItems(items: UserSymbolListItem[], page: number): UserSymbolListItem[] {
  const start = (page - 1) * userSymbolPageSize;
  return items.slice(start, start + userSymbolPageSize);
}

function getTotalPages(totalItems: number): number {
  return Math.max(1, Math.ceil(totalItems / userSymbolPageSize));
}

function clampPage(page: number, totalItems: number): number {
  return Math.min(page, getTotalPages(totalItems));
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-dashed border-zinc-300 bg-white p-5 text-sm leading-6 text-zinc-600">
      {message}
    </div>
  );
}

function HomeUserSymbolCard({
  item,
  markAsRecent = false,
  onToggleWatch,
}: {
  item: UserSymbolListItem;
  markAsRecent?: boolean;
  onToggleWatch: () => void;
}) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              className="text-lg font-semibold tracking-normal text-zinc-950 hover:text-teal-700"
              to={buildStockDetailHref({
                code: item.symbol.code,
                region: item.symbol.region,
              })}
            >
              {item.symbol.name}
            </Link>
            <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">
              {item.symbol.code}
            </span>
          </div>
          <UserSymbolBadges
            isHeld={item.isHeld}
            isWatched={item.isWatched}
            wasRecentlyViewed={markAsRecent}
          />
          <p className="text-sm text-zinc-600">
            {item.symbol.region} / {item.symbol.currency}
          </p>
        </div>

        <WatchToggleButton isWatched={item.isWatched} onClick={onToggleWatch} />
      </div>
    </div>
  );
}

function SectionHeader({
  actionLabel,
  actionTo,
  description,
  title,
  titleId,
}: {
  actionLabel?: string;
  actionTo?: string;
  description: string;
  title: string;
  titleId: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold tracking-normal" id={titleId}>
          {title}
        </h2>
        <p className="max-w-2xl text-sm leading-6 text-zinc-700">{description}</p>
      </div>
      {actionLabel && actionTo ? (
        <Link
          className="w-fit rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-700"
          to={actionTo}
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-h-24 rounded-md border border-zinc-200 bg-white p-4">
      <p className="text-sm font-medium text-zinc-600">{label}</p>
      <p className="mt-2 text-xl font-semibold tracking-normal text-zinc-950">{value}</p>
    </div>
  );
}
