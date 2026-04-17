# stock-prep-pwa

日本株を引け後や土日に分析し、翌営業日の朝に仕込む候補を決める個人用 PWA。

## 概要

このアプリは、日次の株価データをもとに以下を行う。

- 銘柄検索
- 銘柄詳細表示
- ローソク足チャート表示
- トレンド分析
- スクリーニング
- 候補ランキング
- ポートフォリオ管理
- リバランス提案
- 購入シミュレーション
- Push 通知

## 想定ユーザー

- 個人投資家
- 日中にリアルタイム売買はしない
- 引け後や土日に分析する
- 翌営業日の朝に仕込む判断をする
- スマホ中心に使う

## MVP の範囲

- 日次価格データの取り込み
- 銘柄検索
- 銘柄詳細
- チャート表示
- トレンド分析
- スクリーニング
- モメンタムベースの候補ランキング
- ポートフォリオ管理
- リバランス提案
- 購入シミュレーション
- Push 通知
- 日次自動更新

## 技術スタック

- React
- TypeScript
- Vite
- Tailwind CSS
- IndexedDB
- lightweight-charts
- Recharts
- Vercel
- Vercel Functions
- Vercel Cron
- GitHub Actions

## repository 構成

- `apps/web`: PWA 本体
- `packages/shared`: 共通型 / 定数 / schema
- `packages/domain`: 計算ロジック
- `vercel/functions`: API / cron / push
- `docs`: 要件 / 設計 / 計画

## ドキュメント

- `AGENTS.md`
- `docs/requirements/overview.md`
- `docs/requirements/features.md`
- `docs/requirements/screens.md`
- `docs/requirements/data.md`
- `docs/design/architecture.md`
- `docs/design/frontend.md`
- `docs/design/data-flow.md`
- `docs/design/notifications.md`
- `docs/plan/slices.md`

## 開発方針

- 一気に実装しない
- Slice 単位で小さく進める
- PR はレビュー可能な最小単位にする
- 仕様に書かれていない大きな拡張は勝手に入れない
- CI は GitHub Actions、デプロイは Vercel を基本とする
- モバイル幅とデスクトップ幅の両方で主要画面が崩れないことを完了条件に含める
