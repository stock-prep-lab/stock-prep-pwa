# Mac `launchd` 取り込み worker セットアップ

この文書は、Mac 上で `launchd` を使って取り込み worker を定期実行するためのセットアップをまとめる。

対象:

- 手動実行コマンド
- `launchd` 用 plist の配置
- `launchctl` による登録 / 確認 / 停止

非対象:

- Windows / Linux 常駐ジョブ
- Cloud Run / GitHub Actions への移植
- direct-to-R2 upload のクライアント実装

## 前提

- repository root で `pnpm install` 済み
- Supabase / R2 の環境変数をローカルでも解決できる
- 管理画面から raw ZIP が R2 へ保存され、`import_jobs` が `queued` で作成されている

必要な環境変数:

- `STOCK_PREP_SUPABASE_URL`
- `STOCK_PREP_SUPABASE_SERVICE_ROLE_KEY`
- `STOCK_PREP_R2_ACCOUNT_ID`
- `STOCK_PREP_R2_ACCESS_KEY_ID`
- `STOCK_PREP_R2_SECRET_ACCESS_KEY`
- `STOCK_PREP_R2_BUCKET`

## 手動実行

まずは 1 回だけ手動で worker を動かし、`queued` job を処理できることを確認する。

```bash
pnpm import:worker -- --once
```

複数 job をまとめて処理したい場合:

```bash
pnpm import:worker
```

件数を制限したい場合:

```bash
pnpm import:worker -- --max-jobs=2
```

## `launchd` 用 plist

テンプレートは [com.stockpreplab.import-worker.plist](/Users/nishizakishogo/Project/stock-prep-lab/stock-prep-pwa/docs/setup/launchd/com.stockpreplab.import-worker.plist) を使う。

配置先:

```text
~/Library/LaunchAgents/com.stockpreplab.import-worker.plist
```

置き換える値:

- `__REPO_ROOT__`
  - この repository の絶対パス
- `__PNPM_BIN__`
  - `which pnpm` で見つかる絶対パス
- `__LOG_DIR__`
  - ログを書き出したいディレクトリの絶対パス
- `__SUPABASE_URL__`
- `__SUPABASE_SERVICE_ROLE_KEY__`
- `__R2_ACCOUNT_ID__`
- `__R2_ACCESS_KEY_ID__`
- `__R2_SECRET_ACCESS_KEY__`
- `__R2_BUCKET__`

## 登録

```bash
launchctl unload ~/Library/LaunchAgents/com.stockpreplab.import-worker.plist 2>/dev/null || true
launchctl load ~/Library/LaunchAgents/com.stockpreplab.import-worker.plist
launchctl list | grep stockpreplab
```

補足:

- plist の `StartInterval` は 3600 秒（1 時間）にしてある
- backlog がたまっている場合でも、1 回の起動で queue が空になるまで順次処理する

## 停止

```bash
launchctl unload ~/Library/LaunchAgents/com.stockpreplab.import-worker.plist
```

## 確認ポイント

- `pnpm import:worker -- --once` で `queued` job を 1 件以上処理できる
- 処理成功時に `stock_prep_import_jobs.status` が `completed` になる
- 処理失敗時に `stock_prep_import_jobs.status` が `failed` になる
- R2 の `current/manifest.json`、`current/market-data.json`、`current/latest-summary.json` が更新される
- raw ZIP が `incoming/...` から削除される
