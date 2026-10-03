---
name: remotion
description: Remotion で Instagram リール動画（1080x1920）を作成・編集・レンダリングするとき、リールのデザインや台本生成・承認・投稿フローを変更するときに使う
---

# Remotion リール動画

このリポジトリでは、カルーセル投稿とは別に Remotion でリール動画を生成し、GitHub Issue での承認後に Instagram Graph API でリールとして公開する。

## ファイル構成

| 場所 | 役割 |
|---|---|
| `remotion/index.ts` / `remotion/Root.tsx` | Remotion のエントリーポイントとコンポジション定義（id: `Reel`） |
| `remotion/Reel.tsx` | 動画テンプレート本体（冒頭フック → ポイント3〜5個 → 締め＋クリニック情報） |
| `remotion/timing.ts` | 尺の計算と props の型。React に依存しないので Node 側からも import する |
| `src/content/reelScript.ts` | Claude API でリール専用の台本を生成し、医療広告の禁止表現と文字数をチェックする |
| `src/render/renderReel.ts` | Node API（`@remotion/bundler` + `@remotion/renderer`）で mp4 とプレビュー静止画を書き出す |
| `scripts/generate-reel.ts` | テーマ選定 → 台本生成 → レンダリング → `reels/<reelId>/` に保存 |
| `scripts/create-reel-issue.ts` | 承認 Issue（ラベル `instagram-reel`）を作成する |
| `scripts/publish-approved-reel.ts` | `approve` コメントでリールを公開し、`data/reel-history.json` を更新する |
| `remotion/ReelPop.tsx` / `remotion/popTiming.ts` | 拍同期のテロップ型テンプレート（id: `ReelPop`）。112.5BPM＝1拍16フレームで、場面転換を小節頭に合わせる |
| `scripts/render-manual-reel.ts` | 手書きの台本 `reels/<reelId>/script.json` から書き出す（`template: "pop"` で ReelPop、省略時は従来の Reel） |
| `scripts/music/chill-house-bgm.py` | 著作権フリーの自作BGM（チルハウス、112.5BPM）を numpy で合成する。`python3 scripts/music/chill-house-bgm.py out.wav 16` |
| `assets/bgm/` | BGM（著作権フリーの音源）を置く場所。空なら無音で書き出し、Issue に警告を出す |

## ルール

- テキストは Instagram の UI と重ならない範囲（上から約250px・下から380px・右160pxを避ける）に収める。値は `Reel.tsx` の `SAFE_*` 定数。
- ブランドカラー（INK / GOLD / IVORY）とフォント（Shippori Mincho / Noto Sans JP）はカルーセルの `src/render/svg.ts` と揃える。
- 台本の文字数上限は `src/content/reelScript.ts` の `REEL_TEXT_LIMITS`。変えるときはテンプレートの文字サイズも確認する。
- 症例記事（`requiresManualPhoto: true`）は実写真が必須なのでリールの対象外にする。
- `remotion`・`@remotion/*` のバージョンは全て同じ値に固定する（`package.json` で `^` を付けない）。
- Remotion は従業員4人以上の企業が利用する場合に有償の Company License が必要。
- 日本語の改行は `lang="ja"` + `word-break: auto-phrase` で文節単位にしている。フォントは `remotion/fonts.ts` で同梱。

## よく使うコマンド

```bash
npm run studio                           # ブラウザでテンプレートをプレビュー（サンプル props）
npm run generate-reel                    # 台本生成〜mp4書き出し（ANTHROPIC_API_KEY / OPENAI_API_KEY が必要）
npm run typecheck
```

ローカルに Chromium がある場合は `REMOTION_BROWSER_EXECUTABLE` にパスを設定すると、Remotion がブラウザをダウンロードしない。
