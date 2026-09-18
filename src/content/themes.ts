import { getTreatmentBySlug } from "./treatmentCatalog";

/**
 * The clinic's own "お悩みから探す" (search by concern) menu at
 * https://ishidahihuka.jp/theme/ (fetched 2026-09-18) lists 6 parent sections,
 * each broken into specific concern items (SPOTS, MELASMA, EYE AREA, etc.) —
 * this is that full, granular list. Reusing it — instead of inventing our own —
 * for both the on-image eyebrow label and the texture-photo library folder (see
 * render/texturePhotoLibrary.ts) keeps everything traceable to how the clinic
 * already categorizes itself. CONSULTATION ("どれに当てはまるか分からない") is
 * omitted: it's a catch-all for undecided visitors, not a photographable concern.
 */
export const CONCERN_CATEGORIES = {
  // 01 SKIN TONE — 色・くすみ
  spots: { slug: "spots", label: "SPOTS" },
  melasma: { slug: "melasma", label: "MELASMA" },
  brightening: { slug: "brightening", label: "BRIGHTENING" },
  redness: { slug: "redness", label: "REDNESS" },
  pigmentation: { slug: "pigmentation", label: "PIGMENTATION" },
  moles: { slug: "moles", label: "MOLES" },
  // 02 SKIN QUALITY — 毛穴・肌質
  pores: { slug: "pores", label: "PORES" },
  firmness: { slug: "firmness", label: "FIRMNESS" },
  texture: { slug: "texture", label: "TEXTURE" },
  // 03 AGEING CONCERNS — 目元・シワ・たるみ
  eyeArea: { slug: "eye-area", label: "EYE AREA" },
  laxity: { slug: "laxity", label: "LAXITY" },
  mouthMarionette: { slug: "mouth-marionette", label: "MOUTH & MARIONETTE" },
  wrinkles: { slug: "wrinkles", label: "WRINKLES" },
  neck: { slug: "neck", label: "NECK" },
  // 04 ACNE — ニキビ・ニキビ跡
  activeAcne: { slug: "active-acne", label: "ACTIVE ACNE" },
  acneScars: { slug: "acne-scars", label: "ACNE SCARS" },
  // 05 CONTOUR AND BODY — 輪郭・ボディ
  contour: { slug: "contour", label: "CONTOUR" },
  body: { slug: "body", label: "BODY" },
  hairRemoval: { slug: "hair-removal", label: "HAIR REMOVAL" },
  arms: { slug: "arms", label: "ARMS" },
  // 06 OTHER CONCERNS — 汗・ニオイ・薄毛など
  sweating: { slug: "sweating", label: "SWEATING" },
  odour: { slug: "odour", label: "ODOUR" },
  hairLoss: { slug: "hair-loss", label: "HAIR LOSS" },
} as const;

export type ConcernCategory = (typeof CONCERN_CATEGORIES)[keyof typeof CONCERN_CATEGORIES];

export type ScheduledTheme = {
  subject: string;
  request: string;
  months: number[];
  priority: number;
  /** Official treatment-page slugs (see treatmentCatalog.ts) this theme should be grounded on. */
  sourceSlugs: string[];
  /** Which /theme/ section this concern belongs to on the official site. */
  category: ConcernCategory;
};

/**
 * Ported from the original Manus app's contentThemeSelection.ts, with `sourceSlugs`
 * added so draftGeneration.ts can fetch the real official-site text for each theme
 * instead of asking the LLM to invent generic phrasing.
 */
export const SCHEDULED_THEME_CATALOG: ScheduledTheme[] = [
  { subject: "肝斑の見分け方", request: "秋冬に肝斑が気になるとき、自己判断でシミと混同しないための診断の重要性。シミ取り施術の宣伝に寄せず、肝斑だけを主題にしてください。", months: [9, 10, 11, 12, 1, 2], priority: 100, sourceSlugs: ["tranexamic-acid", "spot-dullness-monitor"], category: CONCERN_CATEGORIES.melasma },
  { subject: "シミの診断とケア", request: "秋冬にシミが気になるときの診断とケア。肝斑やくすみとは混同せず、シミだけを主題にしてください。", months: [9, 10, 11, 12, 1, 2], priority: 95, sourceSlugs: ["q-switch-ruby-laser", "spot-dullness-monitor"], category: CONCERN_CATEGORIES.spots },
  { subject: "医療脱毛の相談", request: "春夏に向けた医療脱毛の相談。肌状態や予約時に確認したいことを扱い、効果保証や価格訴求をせず、医療脱毛だけを主題にしてください。", months: [3, 4, 5, 6, 7, 8], priority: 100, sourceSlugs: ["datsumou"], category: CONCERN_CATEGORIES.hairRemoval },
  { subject: "部分痩せの脂肪ケア", request: "春夏に向けて部分痩せが気になる方の脂肪ケア相談。たるみや肌質改善を主題に混ぜず、部分痩せだけを扱ってください。", months: [3, 4, 5, 6, 7, 8], priority: 95, sourceSlugs: ["fat-x-core", "hifu"], category: CONCERN_CATEGORIES.body },
  { subject: "ニキビ跡の赤み", request: "ニキビ跡の赤みが気になる方に、現役のニキビや凹み跡と混同しない相談の考え方。赤みだけを主題にしてください。", months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], priority: 60, sourceSlugs: ["dye-laser"], category: CONCERN_CATEGORIES.acneScars },
  { subject: "ニキビ跡の凹み", request: "ニキビ跡の凹みが気になる方に、治療選択前に確認したい肌状態。赤みや現役ニキビを主題に混ぜず、凹み跡だけを扱ってください。", months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], priority: 60, sourceSlugs: ["co2laser", "juvelookvolume"], category: CONCERN_CATEGORIES.acneScars },
  { subject: "肌育による肌質相談", request: "肌育による肌質改善について、ハリや質感を主題にした相談の考え方。治療効果の保証はせず、肌育だけを扱ってください。", months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], priority: 55, sourceSlugs: ["fillroad", "re2o-juveacell"], category: CONCERN_CATEGORIES.firmness },
  { subject: "目元のちりめんじわ", request: "目元にできる細かい縮緬じわが気になるときの相談の考え方。額や首のしわ、たるみと混同せず、目元のちりめんじわだけを主題にしてください。", months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], priority: 50, sourceSlugs: ["snekos-injection"], category: CONCERN_CATEGORIES.eyeArea },
  { subject: "額のしわ", request: "額にできる表情じわ・刻みじわが気になるときの相談の考え方。目元や首のしわと混同せず、額のしわだけを主題にしてください。", months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], priority: 50, sourceSlugs: ["snekos-injection", "botox"], category: CONCERN_CATEGORIES.wrinkles },
  { subject: "首のしわ", request: "首にできる横じわ・縦じわ・ちりめんじわが気になるときの相談の考え方。顔のしわやたるみと混同せず、首のしわだけを主題にしてください。", months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], priority: 50, sourceSlugs: ["neck-wrinkle-treatment"], category: CONCERN_CATEGORIES.neck },
  { subject: "ほうれい線", request: "ほうれい線が気になるときの相談の考え方。マリオネットラインや頬のたるみと混同せず、ほうれい線だけを主題にしてください。", months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], priority: 50, sourceSlugs: ["hyaluronic-acid"], category: CONCERN_CATEGORIES.wrinkles },
  { subject: "マリオネットライン", request: "口元のマリオネットラインが気になるときの相談の考え方。ほうれい線や頬のたるみと混同せず、マリオネットラインだけを主題にしてください。", months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], priority: 50, sourceSlugs: ["marionette-treatment"], category: CONCERN_CATEGORIES.mouthMarionette },
  { subject: "医療HIFU", request: "医療HIFUによるたるみ・フェイスライン相談。効果保証や過度な変化の訴求をせず、自然な輪郭治療を検討する際の考え方を扱ってください。", months: [9, 10, 11, 12, 1, 2], priority: 50, sourceSlugs: ["hifu"], category: CONCERN_CATEGORIES.laxity },
  { subject: "紫外線後のシミケア", request: "夏の紫外線後、シミが気になるときの診断とケア。肝斑やくすみとは混同せず、シミを主題にしてください。", months: [8, 9], priority: 45, sourceSlugs: ["q-switch-ruby-laser", "spot-dullness-monitor"], category: CONCERN_CATEGORIES.spots },
  { subject: "毛穴の目立ちにくいケア", request: "毛穴の目立ちが気になる方への相談の考え方。ニキビや肌質改善と混同せず、毛穴だけを主題にしてください。", months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], priority: 50, sourceSlugs: ["re2o-juveacell", "salicylic-acid-macrogol-peeling"], category: CONCERN_CATEGORIES.pores },
  { subject: "赤ら顔の相談", request: "赤ら顔が気になる方への診断の考え方。ニキビ跡の赤みと混同せず、赤ら顔だけを主題にしてください。", months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], priority: 45, sourceSlugs: ["laserfacial-tighteninglaser"], category: CONCERN_CATEGORIES.redness },
];

function normalized(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, "").toLowerCase();
}

export type PublishedPostRecord = { subject: string; publishedAt: string };

export function selectScheduledTheme(publishedPosts: PublishedPostRecord[], date = new Date()): ScheduledTheme {
  const month = date.getMonth() + 1;
  const publishedText = publishedPosts.map(post => normalized(post.subject));
  const isUsed = (candidate: ScheduledTheme) => publishedText.some(text => text.includes(normalized(candidate.subject)));
  const candidates = [...SCHEDULED_THEME_CATALOG].sort((a, b) => {
    const aScore = (isUsed(a) ? 0 : 1_000) + (a.months.includes(month) ? a.priority : 0);
    const bScore = (isUsed(b) ? 0 : 1_000) + (b.months.includes(month) ? b.priority : 0);
    return bScore - aScore;
  });
  return candidates[0] ?? SCHEDULED_THEME_CATALOG[0]!;
}

export function getThemeSourceUrls(theme: ScheduledTheme): string[] {
  return theme.sourceSlugs.map(slug => getTreatmentBySlug(slug).url);
}

/** Exact-match lookup for a staff-specified theme (see scripts/generate-draft.ts's THEME_SUBJECT override). */
export function findThemeBySubject(subject: string): ScheduledTheme | undefined {
  return SCHEDULED_THEME_CATALOG.find(theme => theme.subject === subject);
}
