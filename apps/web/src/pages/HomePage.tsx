import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { PaginationControls } from "../components/PaginationControls";
import { UserSymbolBadges } from "../components/UserSymbolBadges";
import { WatchToggleButton } from "../components/WatchToggleButton";
import { subscribeToStockPrepDataChanged } from "../data/dataSyncEvents";
import {
  loadHomePageData,
  type HomeCandidate,
  type HomeLatestSymbolItem,
  type HomePageData,
  type HomePortfolioSummary,
  type HomeRebalanceAlert,
} from "../data/homePageData";
import { buildStockDetailHref } from "../data/stockDetailHref";
import { addWatchSymbol, removeWatchSymbol } from "../data/userSymbolsData";
import { subscribeToUserSymbolsChanged } from "../data/userSymbolsEvents";

type HomePageState =
  | { status: "loading" }
  | { data: HomePageData; status: "ready" }
  | { message: string; status: "error" };

const userSymbolPageSize = 5;

export function HomePage() {
  const [state, setState] = useState<HomePageState>({ status: "loading" });
  const [recentPage, setRecentPage] = useState(1);
  const [watchlistPage, setWatchlistPage] = useState(1);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (active) {
        setState((current) => (current.status === "ready" ? current : { status: "loading" }));
      }

      try {
        const data = await loadHomePageData();

        if (!active) {
          return;
        }

        setState({
          data,
          status: "ready",
        });
      } catch (error) {
        if (!active) {
          return;
        }

        setState({
          message: error instanceof Error ? error.message : "ホームデータを読み込めませんでした。",
          status: "error",
        });
      }
    };

    void load();
    const unsubscribeData = subscribeToStockPrepDataChanged(() => {
      void load();
    });
    const unsubscribeUserSymbols = subscribeToUserSymbolsChanged(() => {
      void load();
    });

    return () => {
      active = false;
      unsubscribeData();
      unsubscribeUserSymbols();
    };
  }, []);

  const data = state.status === "ready" ? state.data : null;
  const recentSymbols = data?.recentSymbols ?? [];
  const watchlist = data?.watchlist ?? [];
  const recentTotalPages = getTotalPages(recentSymbols.length);
  const watchlistTotalPages = getTotalPages(watchlist.length);
  const visibleRecentSymbols = paginateItems(recentSymbols, recentPage);
  const visibleWatchlist = paginateItems(watchlist, watchlistPage);

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
      window.alert(error instanceof Error ? error.message : "ウォッチ銘柄を更新できませんでした。");
    }
  }

  return (
    <section className="flex flex-col gap-8">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <div className="flex flex-col gap-4 py-2">
          <p className="text-sm font-medium text-teal-700">
            {data?.importStatusLabel ?? "ホームを準備しています"}
          </p>
          <div className="flex flex-col gap-3">
            <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">ホーム</h1>
            <p className="max-w-2xl text-base leading-7 text-zinc-700">
              保存済みの最新価格、保有、ウォッチ銘柄、import 状態をまとめて見て、次に確認する銘柄を決めます。
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                className="inline-flex rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition hover:border-teal-700 hover:text-teal-700"
                to="/admin/imports"
              >
                データ取り込み管理へ
              </Link>
              <Link
                className="inline-flex rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition hover:border-teal-700 hover:text-teal-700"
                to="/portfolio"
              >
                保有を見る
              </Link>
            </div>
          </div>

          {state.status === "ready" ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="対象日" value={state.data.marketDateLabel} />
              <MetricCard label="取込反映" value={state.data.importedAtLabel} />
              <MetricCard label="銘柄数" value={state.data.symbolCountLabel} />
              <MetricCard label="終値反映" value={state.data.priceCountLabel} />
            </div>
          ) : null}
        </div>

        {state.status === "loading" ? (
          <StatusPanel message="ホーム表示用データを読み込んでいます。" />
        ) : state.status === "error" ? (
          <StatusPanel message={state.message} tone="error" />
        ) : (
          <SyncSummaryCard data={state.data} />
        )}
      </div>

      <section className="flex flex-col gap-4" aria-labelledby="today-candidates-heading">
        <SectionHeader
          actionLabel="候補一覧へ"
          actionTo="/screening"
          description="直近で見返した銘柄やウォッチ銘柄から、今日優先して確認したいものを並べます。"
          title="今日の候補 TOP"
          titleId="today-candidates-heading"
        />

        {state.status !== "ready" ? null : state.data.candidates.length === 0 ? (
          <EmptyPanel message="最近見た銘柄かウォッチ銘柄が増えると、ここに今日の確認候補が出ます。" />
        ) : (
          <div className="grid gap-3 lg:grid-cols-3">
            {state.data.candidates.map((candidate, index) => (
              <CandidateCard candidate={candidate} key={candidate.id} rank={index + 1} />
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="flex flex-col gap-4" aria-labelledby="portfolio-summary-heading">
          <SectionHeader
            actionLabel="ポートフォリオへ"
            actionTo="/portfolio"
            description="最新価格ベースでざっくりした保有バランスを見ます。"
            title="ポートフォリオ概要"
            titleId="portfolio-summary-heading"
          />

          {state.status !== "ready" ? null : state.data.portfolioSummary ? (
            <PortfolioSummaryPanel summary={state.data.portfolioSummary} />
          ) : (
            <EmptyPanel message="保有や現金を登録すると、ここに最新価格ベースの概要が出ます。" />
          )}
        </section>

        <section className="flex flex-col gap-4" aria-labelledby="rebalance-heading">
          <SectionHeader
            actionLabel="提案を見る"
            actionTo="/rebalance"
            description="現在の構成から見た偏りを先に確認します。"
            title="リバランス注意"
            titleId="rebalance-heading"
          />

          {state.status !== "ready" ? null : state.data.rebalanceAlert ? (
            <RebalanceAlertCard alert={state.data.rebalanceAlert} />
          ) : (
            <EmptyPanel message="保有と最新価格が揃うと、ここに偏りの確認結果が出ます。" />
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-4" aria-labelledby="home-recent-heading">
          <SectionHeader
            description="銘柄詳細を開いた順に、直近で見返した銘柄を残します。"
            title="最近見た銘柄"
            titleId="home-recent-heading"
          />

          {recentSymbols.length === 0 ? (
            <EmptyPanel message="まだ最近見た銘柄はありません。" />
          ) : (
            <>
              <div className="grid gap-3">
                {visibleRecentSymbols.map((item) => (
                  <HomeTrackedSymbolCard
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
                pageSize={userSymbolPageSize}
                totalItems={recentSymbols.length}
                totalPages={recentTotalPages}
              />
            </>
          )}
        </section>

        <section className="flex flex-col gap-4" aria-labelledby="watchlist-heading">
          <SectionHeader
            description="同期済みウォッチ銘柄の最新価格と更新日をまとめて確認します。"
            title="ウォッチ銘柄変化"
            titleId="watchlist-heading"
          />

          {watchlist.length === 0 ? (
            <EmptyPanel message="まだウォッチ銘柄はありません。" />
          ) : (
            <>
              <div className="grid gap-3">
                {visibleWatchlist.map((item) => (
                  <HomeTrackedSymbolCard
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
                pageSize={userSymbolPageSize}
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

function CandidateCard({
  candidate,
  rank,
}: {
  candidate: HomeCandidate;
  rank: number;
}) {
  return (
    <Link
      className="flex min-h-44 flex-col justify-between rounded-md border border-zinc-200 bg-white p-4 text-zinc-950 transition hover:border-teal-700"
      to={buildStockDetailHref({
        code: candidate.code,
        region: candidate.region,
      })}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-teal-700">No. {rank}</p>
          <h2 className="mt-2 text-xl font-semibold tracking-normal">{candidate.name}</h2>
          <p className="mt-1 text-sm text-zinc-600">
            {candidate.code} / {candidate.region}
          </p>
        </div>
        {candidate.lastCloseLabel ? (
          <span className="rounded-md bg-emerald-50 px-2 py-1 text-sm font-semibold text-emerald-700">
            {candidate.lastCloseLabel}
          </span>
        ) : (
          <span className="rounded-md bg-zinc-100 px-2 py-1 text-sm font-medium text-zinc-600">
            終値未取得
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <UserSymbolBadges
          isHeld={candidate.isHeld}
          isWatched={candidate.isWatched}
          wasRecentlyViewed={candidate.wasRecentlyViewed}
        />
        <p className="text-sm leading-6 text-zinc-700">{candidate.reason}</p>
        <p className="text-sm text-zinc-600">
          {candidate.lastCloseDateLabel
            ? `終値基準日: ${candidate.lastCloseDateLabel}`
            : "終値の基準日はまだありません。"}
        </p>
      </div>
    </Link>
  );
}

function PortfolioSummaryPanel({ summary }: { summary: HomePortfolioSummary }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <MetricCard label="評価額" value={summary.totalValueLabel} />
      <MetricCard label="現金比率" value={summary.cashRatioLabel} />
      <MetricCard label="株式比率" value={summary.stockRatioLabel} />
      <MetricCard label="保有数 / 最大保有" value={`${summary.holdingCountLabel} / ${summary.topHoldingLabel}`} />
    </div>
  );
}

function RebalanceAlertCard({ alert }: { alert: HomeRebalanceAlert }) {
  return (
    <Link
      className="flex min-h-40 flex-col justify-between rounded-md border border-rose-200 bg-white p-4 text-zinc-950 transition hover:border-rose-500"
      to="/rebalance"
    >
      <span className="w-fit rounded-md bg-rose-50 px-2 py-1 text-sm font-semibold text-rose-700">
        {alert.severity}
      </span>
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold tracking-normal">{alert.title}</h2>
        <p className="text-sm leading-6 text-zinc-700">{alert.description}</p>
      </div>
    </Link>
  );
}

function SyncSummaryCard({ data }: { data: HomePageData }) {
  return (
    <div className="grid gap-3 rounded-md border border-zinc-200 bg-white p-4">
      <InfoRow label="最新 dataset version" value={data.datasetVersionLabel} />
      <InfoRow label="import 状態" value={data.importStatusLabel} />
      <InfoRow label="job 詳細" value={data.importJobDetailLabel} />
      <InfoRow label="端末同期" value={data.syncStateLabel} />
      <InfoRow label="同期時刻" value={data.syncDetailLabel} />
    </div>
  );
}

function HomeTrackedSymbolCard({
  item,
  markAsRecent = false,
  onToggleWatch,
}: {
  item: HomeLatestSymbolItem;
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
          <p className="text-sm text-zinc-700">
            {item.lastCloseLabel ? `終値 ${item.lastCloseLabel}` : item.latestStatusLabel}
            {item.lastCloseDateLabel ? ` (${item.lastCloseDateLabel})` : ""}
          </p>
        </div>

        <WatchToggleButton isWatched={item.isWatched} onClick={onToggleWatch} />
      </div>
    </div>
  );
}

function paginateItems(items: HomeLatestSymbolItem[], page: number): HomeLatestSymbolItem[] {
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
      <p className="mt-2 text-xl font-semibold tracking-normal text-zinc-950 break-words">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <p className="text-sm font-medium text-zinc-600">{label}</p>
      <p className="text-sm leading-6 text-zinc-950 break-words">{value}</p>
    </div>
  );
}
