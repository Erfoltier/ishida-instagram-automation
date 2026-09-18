/**
 * Snapshot of https://ishidahihuka.jp/treatment-list/ (fetched 2026-09-18).
 * This is the master index of official treatment pages. themes.ts points each
 * scheduled theme at one or more `slug`s here; officialSource.ts fetches the
 * live page content at generation time (this file only holds stable routing
 * data — title/category — not the page body, so it won't go stale the way a
 * hardcoded summary would).
 *
 * Re-derive this list (via the site's /treatment-list/ page) if the clinic
 * adds or renames treatment pages.
 */
export type TreatmentCatalogEntry = {
  slug: string;
  url: string;
  title: string;
  categories: string[];
};

export const TREATMENT_CATALOG: TreatmentCatalogEntry[] = [
  { slug: "spot-dullness-monitor", url: "https://ishidahihuka.jp/service/spot-dullness-monitor/", title: "シミ・くすみ・肝斑の集中治療モニター", categories: ["シミ", "肝斑・くすみの美白"] },
  { slug: "zoskinhealth", url: "https://ishidahihuka.jp/service/zoskinhealth/", title: "ゼオスキンヘルス", categories: ["シミ", "ニキビ", "二の腕のブツブツ(毛孔性苔癬)", "細かいしわ・肌質改善・ハリ", "肝斑・くすみの美白"] },
  { slug: "q-switch-ruby-laser", url: "https://ishidahihuka.jp/service/q-switch-ruby-laser/", title: "埼玉・大宮のシミ取りレーザー専門治療", categories: ["シミ"] },
  { slug: "hokuro", url: "https://ishidahihuka.jp/service/hokuro/", title: "いしだ美容皮膚科のほくろ除去", categories: ["ほくろ"] },
  { slug: "amalfipeel", url: "https://ishidahihuka.jp/service/amalfipeel/", title: "アマルフィーピール", categories: ["肝斑・くすみの美白"] },
  { slug: "tranexamic-acid", url: "https://ishidahihuka.jp/service/tranexamic-acid/", title: "トラネキサム酸スタンプ注射", categories: ["肝斑・くすみの美白"] },
  { slug: "pinkglow", url: "https://ishidahihuka.jp/service/pinkglow/", title: "ピンクグロー【美白水光注射】", categories: ["細かいしわ・肌質改善・ハリ", "肝斑・くすみの美白"] },
  { slug: "oral-medicine", url: "https://ishidahihuka.jp/service/oral-medicine/", title: "美白・しわ・ニキビ内服", categories: ["ニキビ", "肝斑・くすみの美白"] },
  { slug: "isotretinoin", url: "https://ishidahihuka.jp/service/isotretinoin/", title: "イソトレチノインとは？効果・副作用・治療期間を皮膚科医が解説", categories: ["ニキビ"] },
  { slug: "salicylic-acid-macrogol-peeling", url: "https://ishidahihuka.jp/service/salicylic-acid-macrogol-peeling/", title: "ケミカルピーリング", categories: ["ニキビ", "毛穴", "細かいしわ・肌質改善・ハリ"] },
  { slug: "tca-peeling", url: "https://ishidahihuka.jp/service/tca-peeling/", title: "TCAピーリング", categories: ["ニキビ跡"] },
  { slug: "dye-laser", url: "https://ishidahihuka.jp/service/dye-laser/", title: "【赤いニキビ跡など】色素レーザー（ダイレーザー）", categories: ["ニキビ跡"] },
  { slug: "juvelookvolume", url: "https://ishidahihuka.jp/service/juvelookvolume/", title: "ジュベルックボリューム", categories: ["ニキビ跡", "深いしわ・凹みクマ・頬コケ"] },
  { slug: "co2laser", url: "https://ishidahihuka.jp/service/co2laser/", title: "ニキビ跡・クレーターのフラクショナルレーザー", categories: ["ニキビ跡", "細かいしわ・肌質改善・ハリ"] },
  { slug: "re2o-juveacell", url: "https://ishidahihuka.jp/service/re2o-juveacell/", title: "リトゥオ・ジュブアセル", categories: ["毛穴", "細かいしわ・肌質改善・ハリ"] },
  { slug: "laserfacial-tighteninglaser", url: "https://ishidahihuka.jp/service/laserfacial-tighteninglaser/", title: "赤ら顔にレーザーシャワー・ハリにタイトニングレーザー", categories: ["細かいしわ・肌質改善・ハリ", "赤ら顔"] },
  { slug: "snekos-injection", url: "https://ishidahihuka.jp/service/snekos-injection/", title: "スネコスパフォルマ注射｜目元のちりめんじわ・額の刻みじわ", categories: ["細かいしわ・肌質改善・ハリ"] },
  { slug: "dermapen", url: "https://ishidahihuka.jp/service/dermapen/", title: "ダーマペン", categories: ["細かいしわ・肌質改善・ハリ"] },
  { slug: "fillroad", url: "https://ishidahihuka.jp/service/fillroad/", title: "フィルロード 韓国発肌育注射【痛みの少ないリジュラン】スキンブースター", categories: ["細かいしわ・肌質改善・ハリ"] },
  { slug: "botox", url: "https://ishidahihuka.jp/service/botox/", title: "ボトックス注射", categories: ["深いしわ・凹みクマ・頬コケ", "細かいしわ・肌質改善・ハリ", "部分痩せ・小顔など"] },
  { slug: "massage-peel", url: "https://ishidahihuka.jp/service/massage-peel/", title: "マッサージピール（コラーゲンピール）", categories: ["細かいしわ・肌質改善・ハリ"] },
  { slug: "velvet-skin", url: "https://ishidahihuka.jp/service/velvet-skin/", title: "ヴェルヴェットスキン", categories: ["細かいしわ・肌質改善・ハリ"] },
  { slug: "neck-wrinkle-treatment", url: "https://ishidahihuka.jp/service/neck-wrinkle-treatment/", title: "首のしわ治療｜縦じわ・ちりめんじわ・横じわ", categories: ["たるみ", "深いしわ・凹みクマ・頬コケ", "細かいしわ・肌質改善・ハリ"] },
  { slug: "babycollagen", url: "https://ishidahihuka.jp/service/babycollagen/", title: "ベビーコラーゲン注射｜目の下の青クマ・小じわ治療", categories: ["深いしわ・凹みクマ・頬コケ"] },
  { slug: "hyaluronic-acid", url: "https://ishidahihuka.jp/service/hyaluronic-acid/", title: "埼玉・大宮のヒアルロン酸注射", categories: ["深いしわ・凹みクマ・頬コケ"] },
  { slug: "marionette-treatment", url: "https://ishidahihuka.jp/service/marionette-treatment/", title: "口元たるみ集中治療｜マリオネットライン・口横", categories: ["たるみ"] },
  { slug: "sagging-treatment", url: "https://ishidahihuka.jp/service/sagging-treatment/", title: "埼玉・大宮のたるみ治療｜HIFU・口元・ヒアルロン酸", categories: ["たるみ"] },
  { slug: "hifu", url: "https://ishidahihuka.jp/service/hifu/", title: "埼玉県大宮の医療ハイフ(HIFU)【ウルトラセルZi】", categories: ["たるみ", "部分痩せ・小顔など"] },
  { slug: "fat-x-core", url: "https://ishidahihuka.jp/service/fat-x-core/", title: "Premium Fat X Core, Fat X SILUETA", categories: ["部分痩せ・小顔など"] },
  { slug: "datsumou", url: "https://ishidahihuka.jp/service/datsumou/", title: "埼玉・大宮の医療脱毛｜レーザー・ニードル脱毛（白髪・硬毛化対応）", categories: ["医療脱毛"] },
  { slug: "hyperhidrosis-botox", url: "https://ishidahihuka.jp/service/hyperhidrosis-botox/", title: "ワキ、頭皮の多汗症ボトックス注射", categories: ["多汗症"] },
  { slug: "super-velvet-skin", url: "https://ishidahihuka.jp/service/super-velvet-skin/", title: "スーパーヴェルベットスキン", categories: ["二の腕のブツブツ(毛孔性苔癬)"] },
  { slug: "milano-repeel", url: "https://ishidahihuka.jp/service/milano-repeel/", title: "ミラノリピール", categories: ["ワキや体の黒ずみ", "二の腕のブツブツ(毛孔性苔癬)"] },
  { slug: "topical-medication", url: "https://ishidahihuka.jp/service/topical-medication/", title: "各種外用剤", categories: ["その他"] },
  { slug: "applaura-dgel", url: "https://ishidahihuka.jp/service/applaura-dgel/", title: "塗るニオイケア「アプローラD GEL」", categories: ["その他"] },
  { slug: "applaura", url: "https://ishidahihuka.jp/service/applaura/", title: "飲むニオイケア「アプローラ」", categories: ["その他"] },
  { slug: "miracle-injection", url: "https://ishidahihuka.jp/service/miracle-injection/", title: "首の横シワにミラクルL注射", categories: ["その他"] },
];

export function getTreatmentBySlug(slug: string): TreatmentCatalogEntry {
  const entry = TREATMENT_CATALOG.find(item => item.slug === slug);
  if (!entry) throw new Error(`treatmentCatalog: unknown slug "${slug}"`);
  return entry;
}
