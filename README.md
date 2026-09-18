# いしだ皮フ科 Instagram自動投稿（GitHub Actions版）

Manus上で動いていた承認Webアプリを廃止し、GitHub Actionsだけで完結する構成に作り直したもの。投稿処理はもともとMeta Graph APIを直接呼んでいたため変更していない。変わったのは以下の3点。

1. 文章生成・画像生成をManus独自ゲートウェイ（forge.manus.im）から、Anthropic Claude API / OpenAI API の直接呼び出しに変更
2. 承認前の草案の中身（各画像のテキスト）を、抽象的なテンプレート文言ではなく、公式サイト（`https://ishidahihuka.jp/`）の実際の施術ページの記載を根拠に生成するよう変更（`src/content/officialSource.ts` + `src/content/carouselPlan.ts`）
3. 常時稼働のWebアプリ・MySQLを廃止し、状態はリポジトリ内の`data/post-history.json`、承認はGitHub Issueのコメントで行う

## 全体の流れ

```
[毎週火・土 10:00 JST] generate.yml
  → テーマ選定(data/post-history.jsonで既出テーマを除外)
  → 該当テーマの公式サイトの施術ページを取得(src/content/officialSource.ts)
  → Claude APIで、その本文を根拠にした文章を生成(src/content/draftGeneration.ts)
  → 表紙写真をOpenAI画像生成、説明ページはSVG+sharpのテンプレート合成(src/render/)
  → drafts/<draftId>/ にコミット
  → GitHub Issueを起票（画像プレビュー・キャプション・各ページ文言つき）

[担当者がIssueで内容確認]
  → 問題なければ "approve" とコメント

[issue_comment イベント] publish.yml
  → Instagram Graph APIでカルーセル公開
  → data/post-history.json を更新してコミット
  → Issueに結果をコメントしてクローズ

[毎週月曜] refresh-token.yml
  → Instagramアクセストークンを更新し、GitHub Secretsに書き戻す
```

## セットアップ手順

### 1. リポジトリの公開設定について（重要）

Instagram側（Meta）は投稿する画像を「認証なしで取得できるURL」で受け取る必要があります。このリポジトリは`drafts/<id>/*.jpg`をコミットし、`raw.githubusercontent.com`のURLをそのままMetaに渡す設計です。**これはリポジトリがPublicである場合のみ機能します。** Privateのままにしたい場合は、画像を一時的に外部ストレージ（Cloudflare R2やAWS S3の無料枠など）にアップロードする処理を`src/render/renderSlides.ts`の保存先として追加する必要があります（現状は未実装）。

承認前の下書き画像もPublicリポジトリでは一般公開される点にご留意ください（内容は投稿予定の一般向けSNS素材であり、患者情報等は含みません）。

### 2. GitHub Secretsに登録するもの

| Secret名 | 内容 |
|---|---|
| `ANTHROPIC_API_KEY` | Claude APIキー |
| `OPENAI_API_KEY` | OpenAI APIキー（表紙画像生成用） |
| `META_IG_ACCESS_TOKEN` | Instagramの長期アクセストークン（Meta Dashboardで生成） |
| `META_IG_PROFESSIONAL_ACCOUNT_ID` | 投稿先のInstagramプロアカウントID |
| `REPO_ADMIN_TOKEN` | このリポジトリの Secrets: write 権限を持つ Fine-grained PAT（トークン自動更新用。発行方法は下記） |

`GITHUB_TOKEN`はActionsが自動的に発行するため登録不要。

### 3. `REPO_ADMIN_TOKEN`の発行方法

1. GitHubの Settings → Developer settings → Fine-grained personal access tokens → Generate new token
2. Repository access をこのリポジトリのみに限定
3. Permissions → Secrets を **Read and write** に設定
4. 発行されたトークンを、このリポジトリの Settings → Secrets and variables → Actions に `REPO_ADMIN_TOKEN` として登録

このトークン自体には有効期限があるため、GitHubの上限（最大1年）に応じて手動更新が必要です。

### 4. Meta側の準備（既存のドキュメントを流用）

`docs/`フォルダに元アプリの運用文書（サニタイズ済みzipより）がある場合はそちらを参照してください。最低限必要なもの:

- Instagramをビジネス/クリエイターアカウントにし、Facebookページと連携
- Meta App作成、Instagram Graph APIの権限申請
- Meta DashboardのInstagram API Setupから長期アクセストークンを生成

### 5. ローカルでの動作確認

```bash
npm install
cp .env.example .env   # 値を入れてから
npm run generate
```

`.env`は`.gitignore`済みなのでコミットされません。

## テーマと参照ページの追加・変更

`src/content/themes.ts`の`SCHEDULED_THEME_CATALOG`にテーマを追加する際は、`src/content/treatmentCatalog.ts`に該当する公式サイトのページ（`/treatment-list/`から）を追加し、`sourceSlugs`で紐づけてください。文章生成はこの参照ページの実際の本文だけを根拠にするため、ここに正しいページを紐づけることが「具体性のある文章」の生成品質に直結します。

## 表紙画像プロバイダーの差し替え

`src/render/coverImage.ts`の`coverPhotoProvider`が唯一の差し替えポイントです。現在はOpenAI画像生成(`openAiCoverPhotoProvider`)。Adobe Stock for Enterprise等の契約が整い次第、同じ`CoverPhotoProvider`インターフェースを実装した新しいプロバイダーに差し替えるだけで移行できます。他のファイルは変更不要です。
