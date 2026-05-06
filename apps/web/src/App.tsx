import { BrowserRouter, Link, Navigate, NavLink, Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";

import { APP_NAME } from "@stock-prep/shared";

import { AdminImportPage } from "./pages/AdminImportPage";
import { HoldingFormPage } from "./pages/HoldingFormPage";
import { HomePage } from "./pages/HomePage";
import { PortfolioPage } from "./pages/PortfolioPage";
import { RebalancePage } from "./pages/RebalancePage";
import { ScreeningPage } from "./pages/ScreeningPage";
import { SearchPage } from "./pages/SearchPage";
import { SimulationPage } from "./pages/SimulationPage";
import { StockDetailPage } from "./pages/StockDetailPage";
import {
  getApiActivitySnapshot,
  getBackgroundApiActivitySnapshot,
  subscribeToApiActivity,
  subscribeToBackgroundApiActivity,
} from "./data/apiActivity";
import { useStartupDataSync } from "./data/useStartupDataSync";

type AppRoute = {
  id: string;
  path: string;
  href: string;
  label: string;
  title: string;
  description: string;
};

type PrimaryRoute = AppRoute & {
  tabLabel: string;
};

const primaryRoutes = [
  {
    id: "home",
    path: "/",
    href: "/",
    label: "ホーム",
    tabLabel: "ホーム",
    title: "ホーム",
    description: "引け後の確認を始めるための入口。",
  },
  {
    id: "search",
    path: "/search",
    href: "/search",
    label: "検索",
    tabLabel: "検索",
    title: "検索",
    description: "銘柄を探して詳細へ進むための画面。",
  },
  {
    id: "screening",
    path: "/screening",
    href: "/screening",
    label: "スクリーニング",
    tabLabel: "スクリーニング",
    title: "スクリーニング",
    description: "候補銘柄を条件で絞り込むための画面。",
  },
  {
    id: "portfolio",
    path: "/portfolio",
    href: "/portfolio",
    label: "ポートフォリオ",
    tabLabel: "ポートフォリオ",
    title: "ポートフォリオ",
    description: "保有状況を確認するための画面。",
  },
] satisfies PrimaryRoute[];

const secondaryRoutes = [
  {
    id: "admin-imports",
    path: "/admin/imports",
    href: "/admin/imports",
    label: "データ取り込み管理",
    title: "データ取り込み管理",
    description: "市場別 ZIP を手動取り込みするための画面。",
  },
  {
    id: "stock-detail",
    path: "/stocks/:symbolCode",
    href: "/stocks/sample",
    label: "銘柄詳細",
    title: "銘柄詳細",
    description: "個別銘柄の情報を確認するための画面。",
  },
  {
    id: "holding-form",
    path: "/holdings/:symbolCode/edit",
    href: "/holdings/7203/edit",
    label: "保有登録 / 編集",
    title: "保有登録 / 編集",
    description: "保有株数と取得単価を登録するための画面。",
  },
  {
    id: "rebalance",
    path: "/rebalance",
    href: "/rebalance",
    label: "リバランス提案",
    title: "リバランス提案",
    description: "保有バランスの見直し候補を確認するための画面。",
  },
  {
    id: "simulation",
    path: "/simulation",
    href: "/simulation",
    label: "購入シミュレーション",
    title: "購入シミュレーション",
    description: "購入後の変化を事前に確認するための画面。",
  },
] satisfies AppRoute[];

const allRoutes = [...primaryRoutes, ...secondaryRoutes];

function AppShell() {
  useStartupDataSync();
  const [apiLoading, setApiLoading] = useState(getApiActivitySnapshot());
  const [backgroundApiLoading, setBackgroundApiLoading] = useState(
    getBackgroundApiActivitySnapshot(),
  );

  useEffect(() => {
    return subscribeToApiActivity(setApiLoading);
  }, []);

  useEffect(() => {
    return subscribeToBackgroundApiActivity(setBackgroundApiLoading);
  }, []);

  return (
    <div className="min-h-dvh bg-zinc-50 text-zinc-950">
      {apiLoading ? <ApiLoadingOverlay /> : null}
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-4">
          <Link className="text-base font-semibold text-zinc-950" to="/">
            {APP_NAME}
          </Link>
          <div className="flex items-center gap-4">
            {backgroundApiLoading ? (
              <div className="hidden items-center gap-2 rounded-md bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-700 md:flex">
                <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-teal-700" />
                同期中
              </div>
            ) : null}
            <nav aria-label="主要画面" className="hidden items-center gap-2 md:flex">
              {primaryRoutes.map((route) => (
                <HeaderNavLink key={route.path} route={route} />
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 pb-28 pt-8 md:pb-12 md:pt-10">
        <Routes>
          {allRoutes.map((route) => (
            <Route
              key={route.path}
              element={
                route.id === "home" ? (
                  <HomePage />
                ) : route.id === "search" ? (
                  <SearchPage />
                ) : route.id === "screening" ? (
                  <ScreeningPage />
                ) : route.id === "portfolio" ? (
                  <PortfolioPage />
                ) : route.id === "admin-imports" ? (
                  <AdminImportPage />
                ) : route.id === "stock-detail" ? (
                  <StockDetailPage />
                ) : route.id === "holding-form" ? (
                  <HoldingFormPage />
                ) : route.id === "rebalance" ? (
                  <RebalancePage />
                ) : route.id === "simulation" ? (
                  <SimulationPage />
                ) : (
                  <PlaceholderPage route={route} />
                )
              }
              path={route.path}
            />
          ))}
          <Route element={<Navigate replace to="/" />} path="*" />
        </Routes>
      </main>

      <BottomTabNav />
    </div>
  );
}

function ApiLoadingOverlay() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="fixed inset-0 z-50 flex items-start justify-center bg-zinc-950/18 px-4 pt-20"
      role="status"
    >
      <div className="flex min-h-14 items-center gap-3 rounded-md border border-zinc-200 bg-white px-4 py-3 shadow-lg">
        <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-teal-700" />
        <p className="text-sm font-medium text-zinc-800">データを読み込んでいます。</p>
      </div>
    </div>
  );
}

function HeaderNavLink({ route }: { route: PrimaryRoute }) {
  return (
    <NavLink
      className={({ isActive }) =>
        [
          "rounded-md px-3 py-2 text-sm font-medium transition",
          isActive
            ? "bg-teal-700 text-white"
            : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950",
        ].join(" ")
      }
      end={route.path === "/"}
      to={route.path}
    >
      {route.label}
    </NavLink>
  );
}

function BottomTabNav() {
  return (
    <nav
      aria-label="下タブ"
      className="fixed inset-x-0 bottom-0 border-t border-zinc-200 bg-white md:hidden"
    >
      <div className="grid grid-cols-4">
        {primaryRoutes.map((route) => (
          <NavLink
            className={({ isActive }) =>
              [
                "flex min-h-16 items-center justify-center px-1 text-center text-xs font-medium sm:text-sm",
                isActive ? "text-teal-700" : "text-zinc-600",
              ].join(" ")
            }
            end={route.path === "/"}
            key={route.path}
            to={route.path}
          >
            {route.tabLabel}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function PlaceholderPage({ route }: { route: AppRoute }) {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-teal-700">Slice 1</p>
        <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">{route.title}</h1>
        <p className="max-w-2xl text-base leading-7 text-zinc-700">{route.description}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {allRoutes
          .filter((linkedRoute) => linkedRoute.id !== route.id)
          .map((linkedRoute) => (
            <Link
              className="rounded-md border border-zinc-200 bg-white p-4 text-sm font-medium text-zinc-800 transition hover:border-teal-700 hover:text-teal-700"
              key={linkedRoute.id}
              to={linkedRoute.href}
            >
              {linkedRoute.label}
            </Link>
          ))}
      </div>
    </section>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
