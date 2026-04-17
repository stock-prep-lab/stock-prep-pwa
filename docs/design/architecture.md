# アーキテクチャ設計

## 全体方針

- フロントは PWA
- データ保存は IndexedDB
- 日次更新と通知は Vercel Functions / Cron
- GitHub Actions は CI と品質担保
- デプロイは Vercel の Git 連携を使う

## repository 構成

- `apps/web`: PWA 本体
- `packages/shared`: 共通型 / 定数 / schema
- `packages/domain`: 計算ロジック
- `vercel/functions`: API / cron / push
- `docs`: 要件 / 設計 / 計画

## フロント

- React
- TypeScript
- Vite
- Tailwind CSS
- TanStack Query
- IndexedDB
- lightweight-charts
- Recharts

## バックエンド相当

### Vercel Functions
- Push 購読登録
- Push 購読解除
- 最新データ配信
- 手動更新トリガ
- 必要な集計結果の返却

### Vercel Cron
- 外部データ取得
- データ整形
- 候補計算
- 通知判定
- Push 通知送信

## ドメインロジック

- 指標計算
- モメンタム計算
- トレンド判定
- 共分散 / 分散計算
- リバランス改善度
- シミュレーション計算

## デプロイ方針

- Preview / Production は Vercel
- CI は GitHub Actions
- Production 反映前に CI 成功を必須とする
