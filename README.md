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

## スタッフ用の確認・承認Webページ（Cloudflare Workers）

GitHub Issueは技術者向けの画面のため、GitHubアカウントを持たないスタッフ用に、承認・却下・文章編集ができる簡易Webページを`worker/`に用意しています。**常時稼働のサーバーではなく**、押した時だけ動く無料枠のCloudflare Workersで動かすため、追加のホスティング費用は基本的にかかりません。データの実体は今までどおりGitHub Issue・リポジトリのファイルのままで、このページはそれを見やすく操作しやすくする窓口です。

### デプロイ手順

1. [Cloudflare](https://dash.cloudflare.com/sign-up)の無料アカウントを作成（Workers Freeプランでよい）
2. このリポジトリを別途ローカルにcloneしていない場合は、`git clone`してから`worker`フォルダに移動
   ```bash
   cd worker
   npx wrangler login
   ```
   ブラウザが開くのでCloudflareアカウントでログイン・許可する
3. `wrangler.toml`の`GITHUB_REPOSITORY`が実際のリポジトリ名（`Erfoltier/ishida-instagram-automation`）になっているか確認
4. シークレットを2つ登録する
   ```bash
   npx wrangler secret put GH_TOKEN
   npx wrangler secret put STAFF_PASSCODE
   ```
   - `GH_TOKEN`: GitHubの Fine-grained PAT を新規発行（Settings → Developer settings → Fine-grained personal access tokens）。Repository accessをこのリポジトリのみに限定し、Permissionsで **Issues: Read and write**、**Actions: Read and write** を設定する（`REPO_ADMIN_TOKEN`とは別の、専用トークンにしてください）
   - `STAFF_PASSCODE`: スタッフに共有する合言葉（好きな文字列でよい）
5. デプロイ
   ```bash
   npx wrangler deploy
   ```
   完了すると`https://ishida-instagram-staff.<あなたのサブドメイン>.workers.dev`のようなURLが表示されます。これをスタッフに共有してください（合言葉と2つでワンセット）。

### できること

- 承認待ちの投稿案を一覧表示（画像・キャプション・各ページの文章）
- 「承認してInstagramへ公開」ボタン → GitHub Issueに`approve`とコメントするのと同じ効果（`publish.yml`がそのまま動く）
- 「却下」ボタン → 理由コメントを付けてIssueをクローズ
- 各ページのタイトル・本文をその場で編集し「保存して再生成」→ `regenerate-slide.yml`が同じデザインテンプレートで画像を作り直す（表紙の場合、AI写真は再生成せず同じ写真にテキストだけ載せ直すので、費用も発生せず写真が意図せず変わることもない）

### 注意点

- 合言葉は全スタッフ共通の1つです。個人ごとのアカウント管理はしていません（元のManusアプリにあった「招待制・個人ログイン」ほどの厳密さはない前提です）
- 画像の反映には`raw.githubusercontent.com`のキャッシュにより数十秒程度のタイムラグが出ることがあります
- Cloudflareアカウントの2段階認証など、セキュリティ設定はCloudflare側の推奨に従ってください
