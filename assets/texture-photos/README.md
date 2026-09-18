# テクスチャ写真ライブラリ

2枚目以降のカルーセルページの背景に使う写真置き場。ChatGPT等で生成した画像をこのフォルダ構成でアップロードすると、`src/render/texturePhotoLibrary.ts`が自動的に読み込みます。コードの変更は不要です。

## フォルダ構成

```
assets/texture-photos/<カテゴリ>/任意のファイル名.jpg
```

カテゴリは公式サイトの「[お悩みから探す](https://ishidahihuka.jp/theme/)」のプルダウンにある詳細項目（23分類）に合わせています（`src/content/themes.ts`の`CONCERN_CATEGORIES`と対応）。

| フォルダ名 | サイト表記 | 内容 |
|---|---|---|
| `spots` | SPOTS | シミ |
| `melasma` | MELASMA | 肝斑・顔のくすみ |
| `brightening` | BRIGHTENING | 透明感・美白 |
| `redness` | REDNESS | 赤ら顔・赤み |
| `pigmentation` | PIGMENTATION | ワキ・体の黒ずみ |
| `moles` | MOLES | ほくろ |
| `pores` | PORES | 毛穴 |
| `firmness` | FIRMNESS | ハリ不足・細かなシワ |
| `texture` | TEXTURE | 肌のキメ・ごわつき |
| `eye-area` | EYE AREA | 目元のクマ・小ジワ |
| `laxity` | LAXITY | 顔のたるみ |
| `mouth-marionette` | MOUTH & MARIONETTE | 口横のたるみ・マリオネットライン |
| `wrinkles` | WRINKLES | ほうれい線・深いシワ |
| `neck` | NECK | 首のシワ |
| `active-acne` | ACTIVE ACNE | 繰り返すニキビ |
| `acne-scars` | ACNE SCARS | 赤い跡・色素沈着・凹み跡 |
| `contour` | CONTOUR | 小顔・エラの張り |
| `body` | BODY | 部分痩せ |
| `hair-removal` | HAIR REMOVAL | 医療脱毛 |
| `arms` | ARMS | 二の腕のブツブツ |
| `sweating` | SWEATING | 多汗症 |
| `odour` | ODOUR | 体臭・ニオイケア |
| `hair-loss` | HAIR LOSS | 薄毛・AGA・FAGA |

（「どれに当てはまるか分からない」はカテゴリ対象外です。）

## 画像の仕様

- 正方形、最低1024×1024px
- JPGまたはPNG
- 肌の質感・手元・水滴などのクローズアップ。文字・ロゴ・院内風景・顔全体は避ける
- アイボリー〜ニュートラルトーンで統一

## 枚数について

各カテゴリに複数枚あるほど投稿ごとの見た目のバリエーションが増えますが、1枚もない状態でも動作します。空のカテゴリは他カテゴリの写真では代用せず、アイコン+ボックスの旧デザインに自動フォールバックします（主題と無関係な写真が使われるのを防ぐため）。今使われている`SCHEDULED_THEME_CATALOG`（`src/content/themes.ts`）のテーマは以下のカテゴリを使うため、優先して用意すると効果的です: `melasma` `spots` `hair-removal` `body` `acne-scars` `firmness` `eye-area` `wrinkles` `neck` `mouth-marionette` `laxity` `pores` `redness`
