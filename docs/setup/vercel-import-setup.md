# Vercel 手動 bulk 取り込みセットアップ

この文書は、管理画面を本運用の入口として使うための Vercel 側セットアップをまとめる。

対象:

- Vercel Project の作成
- 環境変数の設定
- 管理画面 `/admin/imports` の利用前提

非対象:

- Mac `launchd` worker の本実装
- Cloud Run / GitHub Actions など別 runner への移植

## 目的

- 管理画面アップロードの入口を Vercel 上で固定する
- Vercel Functions が Supabase / R2 へ接続できる前提を明文化する
- 本番 URL と管理画面 URL の確認方法を揃える

## 前提

- GitHub リポジトリを Vercel Project として import 済み
- Root Directory は repository root (`./`)
- Supabase Project と Cloudflare R2 bucket を作成済み

## 想定する環境変数

Vercel Project の Environment Variables に、少なくとも以下を設定する。

- `STOCK_PREP_SUPABASE_URL`
- `STOCK_PREP_SUPABASE_SERVICE_ROLE_KEY`
- `STOCK_PREP_R2_ACCOUNT_ID`
- `STOCK_PREP_R2_ACCESS_KEY_ID`
- `STOCK_PREP_R2_SECRET_ACCESS_KEY`
- `STOCK_PREP_R2_BUCKET`

補足:

- `STOCK_PREP_SUPABASE_SERVICE_ROLE_KEY` と `STOCK_PREP_R2_SECRET_ACCESS_KEY` はサーバー専用の値として扱い、クライアントへ露出しない
- 環境変数の更新後は、必要に応じて再 deploy して反映を確認する

## Project 作成時の設定メモ

- Vercel Team: 利用中の個人またはチーム
- Project Name: `stock-prep-pwa` 系の名前を推奨
- Root Directory: `./`
- `apps/web` を Root Directory にしない

理由:

- `api/` 配下の Vercel Functions を同じ Project で扱うため
- 管理画面と API を同じ origin で運用するため

## 管理画面の URL

デプロイ後のアプリ URL を起点に、管理画面は次の URL で開く。

- `https://<your-vercel-app>.vercel.app/admin/imports`

例:

- `https://stock-prep-pwa-web.vercel.app/admin/imports`

補足:

- `vercel.com/...` の URL は管理画面であり、ユーザーが実際に開くアプリ URL ではない
- 管理画面からの API 呼び出しは同一 origin の `/api/...` を使う

## 管理画面からの利用イメージ

1. 管理者が Stooq から市場別 bulk ZIP を手動取得する
2. Vercel 上の `/admin/imports` を開く
3. 日本 / 米国 / 香港 / world(為替) の対象 ZIP をアップロードする
4. Vercel Functions が raw ZIP の保存先払い出しと `import_jobs` 作成を行う
5. Mac `launchd` worker が `queued` job を拾って処理する

## R2 直接アップロード用の CORS

管理画面からブラウザが Cloudflare R2 へ直接 `PUT` するため、bucket 側で CORS を許可する。

最低限の考え方:

- Origin:
  - 本番の Vercel URL
  - 必要ならローカル開発 URL (`http://localhost:5173` など)
- Methods:
  - `PUT`
  - `HEAD`
- Allowed Headers:
  - `Content-Type`

R2 側で CORS が不足していると、presigned URL が発行されていてもブラウザ upload が失敗する。

## Vercel 側で担う責務

- 管理画面の配信
- `api/` 配下の Vercel Functions 実行
- raw ZIP の presigned upload URL 発行
- upload 完了後の `import_jobs` 作成
- dataset version / market data / holdings など軽い API の返却

## Vercel 側で担わない責務

- 巨大 ZIP の重い解凍
- `.txt` の再帰収集と正規化の本処理
- Mac worker の定期実行

## 確認ポイント

- アプリ URL で画面が開く
- `/admin/imports` に到達できる
- `/api/admin/import-jobs` が同じ origin で応答する
- `/api/admin/import-jobs` から direct-to-R2 用 URL を払い出せる
- 環境変数未設定時は remote backend ではなく fallback に寄ることが分かる
- 環境変数設定後は Supabase / R2 接続を前提に動かせる
