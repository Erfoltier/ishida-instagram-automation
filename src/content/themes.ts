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

export type ArticleFormat = "解説" | "症例" | "ケア" | "Q&A" | "お知らせ";
export type ArticlePersona = "A" | "B" | "C" | "共通";
/**
 * Strategy doc ch.13 (2026-09-20 revision): "narrative" covers must NOT reveal the
 * answer (question + clinic info only); "price" covers show treatment/area/price
 * directly instead of a question hook; "announcement" covers show info directly
 * (schedule, access) — same as narrative rendering-wise, just no answer to hide.
 */
export type CoverStyle = "narrative" | "price" | "announcement";

export type ScheduledTheme = {
  /** M1-01 .. M4-12 — also the sequential publish order (see selectScheduledTheme). */
  articleId: string;
  /** ネタ帳 title — internal label fed to the LLM as the theme, not necessarily the final on-image headline. */
  subject: string;
  persona: ArticlePersona;
  format: ArticleFormat;
  coverStyle: CoverStyle;
  /**
   * 症例 (case-study) articles: real, consented patient photos are required and
   * must never be AI-generated (strategy doc ch.9). The pipeline generates only
   * the surrounding text/captions and renders a flat placeholder cover instead of
   * calling the AI photo provider; staff must replace drafts/<id>/slide-01.jpg
   * with a real photo (via GitHub's file upload) before approving.
   */
  requiresManualPhoto: boolean;
  /** Official-site (or, for S7, external) pages this article is grounded on. */
  sourceUrls: string[];
  /** The core answer/message this article delivers (fed to the LLM as grounding intent, not the cover). */
  request: string;
  /** 次の行動 — the one specific call-to-action for this article. */
  nextAction: string;
  /** Concern category for the eyebrow badge + texture-photo folder. Omitted for お知らせ (uses "NEWS" instead — see draftGeneration.ts). */
  category?: ConcernCategory;
};

const S0 = "https://ishidahihuka.jp/";
const S1 = getTreatmentBySlug("q-switch-ruby-laser").url;
const S1_MELASMA = getTreatmentBySlug("tranexamic-acid").url;
const S1_MONITOR = getTreatmentBySlug("spot-dullness-monitor").url;
const S2 = getTreatmentBySlug("pore-overview").url;
const S3 = getTreatmentBySlug("acne-overview").url;
const S4 = getTreatmentBySlug("hifu").url;
const S4_HYALURONIC = getTreatmentBySlug("hyaluronic-acid").url;
const S4_BOTOX = getTreatmentBySlug("botox").url;
const S5 = getTreatmentBySlug("datsumou").url;
const S6_FILLROAD = getTreatmentBySlug("fillroad").url;
const S6_RE2O = getTreatmentBySlug("re2o-juveacell").url;
const S7 = "https://www.aad.org/public/everyday-care/sun-protection/shade-clothing-sunscreen/how-to-apply-sunscreen";
const S8 = getTreatmentBySlug("hokuro").url;
const S9 = getTreatmentBySlug("neck-wrinkle-treatment").url;
const S10 = getTreatmentBySlug("zoskinhealth").url;

/**
 * The 4-month, 48-article calendar from
 * 「いしだ美容皮膚科_Instagram集客戦略_4か月48記事_記事型別表紙改訂版.docx」(2026-09-20).
 * Publish order is sequential by articleId (see selectScheduledTheme) — this is a
 * fixed editorial calendar, not a priority/season rotation like the old catalog.
 *
 * リール (video) articles are produced as carousels here — this pipeline has no
 * video capability. 症例 (case-study) articles auto-generate text only; see
 * `requiresManualPhoto`.
 */
export const SCHEDULED_THEME_CATALOG: ScheduledTheme[] = [
  // --- Month 1: 顔の悩みについて基礎情報をそろえる ---
  { articleId: "M1-01", subject: "顔の茶色いシミは全部レーザーで取れるのか", persona: "A", format: "解説", coverStyle: "narrative", requiresManualPhoto: false, sourceUrls: [S1, S1_MELASMA], category: CONCERN_CATEGORIES.spots,
    request: "老人性色素斑・肝斑・炎症後色素沈着で治療の方向が異なる。全顔プランの対象外も見える化する。", nextAction: "シミの詳細へ。" },
  { articleId: "M1-02", subject: "毛穴の黒ずみと凹みは同じ治療ではありません", persona: "B", format: "解説", coverStyle: "narrative", requiresManualPhoto: false, sourceUrls: [S2], category: CONCERN_CATEGORIES.pores,
    request: "詰まり・ハリ低下・瘢痕性の凹凸を分け、洗浄やピーリングだけでは対応できない悩みを示す。", nextAction: "分類を保存。" },
  { articleId: "M1-03", subject: "シミ1個と全顔まとめ取り 費用はどう違う", persona: "A", format: "Q&A", coverStyle: "narrative", requiresManualPhoto: false, sourceUrls: [S1, S1_MONITOR], category: CONCERN_CATEGORIES.spots,
    request: "大きさ・個数・適応・追加費用を同じ条件で比較する。単なる安さではなく自分の費用の見方が分かるようにする。", nextAction: "料金ページへ。" },
  { articleId: "M1-04", subject: "赤い跡 茶色い跡 凹み跡 治療が違う理由", persona: "B", format: "解説", coverStyle: "narrative", requiresManualPhoto: false, sourceUrls: [S3, getTreatmentBySlug("dye-laser").url], category: CONCERN_CATEGORIES.acneScars,
    request: "赤み・色素沈着・凹みの作用対象と治療の方向を対照表にする。", nextAction: "ニキビ跡の詳細へ。" },
  { articleId: "M1-05", subject: "日焼け止め 塗っているのに忘れやすい3つのこと", persona: "B", format: "ケア", coverStyle: "narrative", requiresManualPhoto: false, sourceUrls: [S7], category: CONCERN_CATEGORIES.spots,
    request: "露出部位・使用量・塗り直しを具体化する。日陰や衣服も併用し、既存のシミが消えるとは言わない。", nextAction: "外出前に保存。" },
  { articleId: "M1-06", subject: "ほうれい線とフェイスラインのたるみ 同じ治療でよいのか", persona: "A", format: "解説", coverStyle: "narrative", requiresManualPhoto: false, sourceUrls: [S4_HYALURONIC, S4], category: CONCERN_CATEGORIES.wrinkles,
    request: "ボリューム不足と皮膚・組織のたるみは異なる。ヒアルロン酸とHIFUの目的・限界を整理する。", nextAction: "顔の治療ページへ。" },
  { articleId: "M1-07", subject: "ニキビをつぶす前に 跡を増やさないためのケア", persona: "B", format: "ケア", coverStyle: "narrative", requiresManualPhoto: false, sourceUrls: [S3, getTreatmentBySlug("isotretinoin").url], category: CONCERN_CATEGORIES.activeAcne,
    request: "触る・つぶす刺激を避ける。進行中の炎症への治療と、残った跡への治療の順序を解説する。", nextAction: "ケアを保存。" },
  { articleId: "M1-08", subject: "シミ取り後 2週間で完成とは限りません", persona: "A", format: "Q&A", coverStyle: "narrative", requiresManualPhoto: false, sourceUrls: [S1], category: CONCERN_CATEGORIES.spots,
    request: "かさぶた後の赤みや色素沈着まで時間軸で説明する。治療時期の判断に使える情報にする。", nextAction: "経過表を保存。" },
  { articleId: "M1-09", subject: "シミ治療の実記録 選んだ理由と途中経過", persona: "A", format: "症例", coverStyle: "narrative", requiresManualPhoto: true, sourceUrls: [S1], category: CONCERN_CATEGORIES.spots,
    request: "実写真で適応・回数・観察期間・変化と残存を示す。未準備時は「全顔シミ取りの対象外」を解説する。", nextAction: "症例条件と詳細へ。" },
  { articleId: "M1-10", subject: "ヒゲ脱毛 レーザーとニードルはどう使い分ける", persona: "C", format: "解説", coverStyle: "narrative", requiresManualPhoto: false, sourceUrls: [S5], category: CONCERN_CATEGORIES.hairRemoval,
    request: "毛の色や残毛などにより方法が変わる。既存ニードル紹介から選択の比較へ進める。", nextAction: "脱毛の詳細へ。" },
  { articleId: "M1-11", subject: "ニキビ跡の実記録 何を治して何が残ったか", persona: "B", format: "症例", coverStyle: "narrative", requiresManualPhoto: true, sourceUrls: [S3], category: CONCERN_CATEGORIES.acneScars,
    request: "治療対象・実施回数・期間・費用・負担を示す。未準備時は「凹みの形で治療が変わる」を解説する。", nextAction: "経過と治療条件へ。" },
  { articleId: "M1-12", subject: "東大宮で受けられる美容診療と予約先", persona: "共通", format: "お知らせ", coverStyle: "announcement", requiresManualPhoto: false, sourceUrls: [S0],
    request: "主な悩み別ページ・診療曜日・駅徒歩1分・予約方法をまとめる。価格は検証済みページへ接続する。", nextAction: "公式LINEへ。" },

  // --- Month 2: 治療候補を比較し選ぶ理由を伝える ---
  { articleId: "M2-01", subject: "ルビー ピコ IPL 名前だけで選ばないシミ治療", persona: "A", format: "解説", coverStyle: "narrative", requiresManualPhoto: false, sourceUrls: [S1], category: CONCERN_CATEGORIES.spots,
    request: "照射方式・対象・範囲・経過の違いを説明する。機器の新旧を優劣にしない。", nextAction: "比較表を保存。" },
  { articleId: "M2-02", subject: "毛穴が気になる人にピーリングが向く場合", persona: "B", format: "解説", coverStyle: "narrative", requiresManualPhoto: false, sourceUrls: [S2, getTreatmentBySlug("salicylic-acid-macrogol-peeling").url], category: CONCERN_CATEGORIES.pores,
    request: "詰まりと凹凸を分け、できることと対応しにくいことを説明する。", nextAction: "毛穴の詳細へ。" },
  { articleId: "M2-03", subject: "肝斑があるとシミ取りレーザーは受けられないのか", persona: "A", format: "Q&A", coverStyle: "narrative", requiresManualPhoto: false, sourceUrls: [S1_MELASMA, S1], category: CONCERN_CATEGORIES.melasma,
    request: "肝斑そのものへのスポット照射と、混在する別のシミの治療を分けて説明する。", nextAction: "対象条件を読む。" },
  { articleId: "M2-04", subject: "深い凹みのニキビ跡は治療を組み合わせる理由", persona: "B", format: "解説", coverStyle: "narrative", requiresManualPhoto: false, sourceUrls: [getTreatmentBySlug("co2laser").url, S3], category: CONCERN_CATEGORIES.acneScars,
    request: "凹みの形・癒着・深さとCO2フラクショナル等の役割を説明する。", nextAction: "治療比較へ。" },
  { articleId: "M2-05", subject: "毛穴の黒ずみをこすり落とそうとしていませんか", persona: "B", format: "ケア", coverStyle: "narrative", requiresManualPhoto: false, sourceUrls: [S2], category: CONCERN_CATEGORIES.pores,
    request: "摩擦と無理な角栓押し出しを避け、日常ケアと治療の役割を分ける。", nextAction: "日々のケアを保存。" },
  { articleId: "M2-06", subject: "動かすと出るしわと常にある溝 治療の考え方", persona: "A", format: "解説", coverStyle: "narrative", requiresManualPhoto: false, sourceUrls: [S4_BOTOX, S4_HYALURONIC], category: CONCERN_CATEGORIES.wrinkles,
    request: "表情筋の動きとボリューム・構造の違いを説明する。ボトックスとヒアルロン酸を万能な代替関係にしない。", nextAction: "しわ治療の詳細へ。" },
  { articleId: "M2-07", subject: "レーザー脱毛前 毛抜きと剃毛は違います", persona: "C", format: "ケア", coverStyle: "narrative", requiresManualPhoto: false, sourceUrls: [S5], category: CONCERN_CATEGORIES.hairRemoval,
    request: "毛のメラニンを利用する仕組みと準備を説明する。ニードル前の伸ばす準備と混同しない。", nextAction: "施術前に保存。" },
  { articleId: "M2-08", subject: "顔の肌育注射 翌日に予定を入れてもよいのか", persona: "B", format: "Q&A", coverStyle: "narrative", requiresManualPhoto: false, sourceUrls: [S6_FILLROAD, S6_RE2O], category: CONCERN_CATEGORIES.firmness,
    request: "製剤・注入法ごとの腫れ・内出血・膨疹を確認する。首の経過を顔に転用しない。", nextAction: "製剤別の経過へ。" },
  { articleId: "M2-09", subject: "顔のしわ治療の実記録 注入量と変化の範囲", persona: "A", format: "症例", coverStyle: "narrative", requiresManualPhoto: true, sourceUrls: [S4], category: CONCERN_CATEGORIES.wrinkles,
    request: "実際の製剤・部位・量・費用・リスクを併記する。未準備時は「注入量で費用が変わる理由」を解説する。", nextAction: "条件と詳細へ。" },
  { articleId: "M2-10", subject: "シミとほくろ 除去の方法と料金を分ける理由", persona: "A", format: "解説", coverStyle: "narrative", requiresManualPhoto: false, sourceUrls: [S1, S8], category: CONCERN_CATEGORIES.moles,
    request: "色が似ていても病変と方法が異なる。診断と傷の経過を説明する。", nextAction: "ほくろの詳細へ。" },
  { articleId: "M2-11", subject: "毛穴治療の実記録 どの種類の毛穴を治したか", persona: "B", format: "症例", coverStyle: "narrative", requiresManualPhoto: true, sourceUrls: [S2], category: CONCERN_CATEGORIES.pores,
    request: "毛穴の分類と実治療を対応させる。未準備時は「詰まりと瘢痕性毛穴の比較」を解説する。", nextAction: "治療条件を読む。" },
  { articleId: "M2-12", subject: "翌月の美容診療日と確定した受付案内", persona: "共通", format: "お知らせ", coverStyle: "announcement", requiresManualPhoto: false, sourceUrls: [S0],
    request: "日程と予約先を確認できるカレンダーを示す。空き情報は確認日時を付けてストーリーズへ。", nextAction: "LINEで日程調整。" },

  // --- Month 3: 経過と費用を深め部位を広げる ---
  { articleId: "M3-01", subject: "レーザー後の茶色はシミの残りとは限らない", persona: "A", format: "解説", coverStyle: "narrative", requiresManualPhoto: false, sourceUrls: [S1], category: CONCERN_CATEGORIES.spots,
    request: "炎症後色素沈着と残存は同じではない。自己判断の追加照射を勧めず経過の見方を説明する。", nextAction: "経過の詳細へ。" },
  { articleId: "M3-02", subject: "肌育注射とヒアルロン酸 何を変える治療なのか", persona: "B", format: "解説", coverStyle: "narrative", requiresManualPhoto: false, sourceUrls: [S6_FILLROAD, S4_HYALURONIC], category: CONCERN_CATEGORIES.firmness,
    request: "肌質と形・ボリュームの目的を区別する。製剤間の違いと限界を示す。", nextAction: "比較を保存。" },
  { articleId: "M3-03", subject: "ニキビ跡治療 1回料金と治療全体の費用", persona: "B", format: "Q&A", coverStyle: "narrative", requiresManualPhoto: false, sourceUrls: [S3], category: CONCERN_CATEGORIES.acneScars,
    request: "標準的な回数・間隔・麻酔薬剤を含む条件で試算する。回数の保証はしない。", nextAction: "料金条件へ。" },
  { articleId: "M3-04", subject: "首の横じわ 細かいしわ たるみで治療が違う", persona: "A", format: "解説", coverStyle: "narrative", requiresManualPhoto: false, sourceUrls: [S9], category: CONCERN_CATEGORIES.neck,
    request: "顔の基礎記事がそろった後の部位展開。既存首投稿を引用し、読者の疑問に合わせ比較を更新する。", nextAction: "首の詳細へ。" },
  { articleId: "M3-05", subject: "シミ治療後の紫外線対策 日常で気をつけること", persona: "A", format: "ケア", coverStyle: "narrative", requiresManualPhoto: false, sourceUrls: [S1, S7], category: CONCERN_CATEGORIES.spots,
    request: "個別指示を優先し、露出や摩擦を減らす生活上の具体策を説明する。", nextAction: "治療後に保存。" },
  { articleId: "M3-06", subject: "白い毛と残った毛 脱毛方法を見直す理由", persona: "C", format: "解説", coverStyle: "narrative", requiresManualPhoto: false, sourceUrls: [S5], category: CONCERN_CATEGORIES.hairRemoval,
    request: "メラニンを使う方法の限界とニードルの役割を説明する。回数と時間を条件付きで示す。", nextAction: "脱毛詳細へ。" },
  { articleId: "M3-07", subject: "ゼオスキン 短期集中と維持期は同じケアなのか", persona: "B", format: "ケア", coverStyle: "narrative", requiresManualPhoto: false, sourceUrls: [S10], category: CONCERN_CATEGORIES.texture,
    request: "治療段階で製品や頻度が変わることを説明する。処方薬の自己調整は促さない。", nextAction: "ホームケア詳細へ。" },
  { articleId: "M3-08", subject: "ヒアルロン酸の内出血と連絡が必要な症状", persona: "A", format: "Q&A", coverStyle: "narrative", requiresManualPhoto: false, sourceUrls: [S4_HYALURONIC], category: CONCERN_CATEGORIES.wrinkles,
    request: "一般的経過と重い合併症の警告を混同しない。緊急時の院内連絡先を確認する。", nextAction: "安全情報を保存。" },
  { articleId: "M3-09", subject: "シミ治療の長期経過 途中の色の変化を振り返る", persona: "A", format: "症例", coverStyle: "narrative", requiresManualPhoto: true, sourceUrls: [S1], category: CONCERN_CATEGORIES.spots,
    request: "十分な観察期間の実記録を示す。未準備時は「かさぶた後の確認項目」を解説する。", nextAction: "経過条件へ。" },
  { articleId: "M3-10", subject: "目の下のクマ 色と影で考え方が変わる", persona: "A", format: "解説", coverStyle: "narrative", requiresManualPhoto: false, sourceUrls: [getTreatmentBySlug("babycollagen").url], category: CONCERN_CATEGORIES.eyeArea,
    request: "青み・色素・影などを分け、注入で全種類に対応できるとはしない。", nextAction: "目まわりの詳細へ。" },
  { articleId: "M3-11", subject: "凹み治療の実記録 組合せを選んだ理由", persona: "B", format: "症例", coverStyle: "narrative", requiresManualPhoto: true, sourceUrls: [getTreatmentBySlug("co2laser").url, getTreatmentBySlug("juvelookvolume").url], category: CONCERN_CATEGORIES.acneScars,
    request: "実際の順番と回数、改善点・残存を提示する。未準備時は「組合せ治療の順序Q&A」を解説する。", nextAction: "費用と経過へ。" },
  { articleId: "M3-12", subject: "翌月の診療日と記事別の読み方ガイド", persona: "共通", format: "お知らせ", coverStyle: "announcement", requiresManualPhoto: false, sourceUrls: [S0],
    request: "シミ・毛穴・ニキビ跡・顔のしわの代表記事を再案内する。日程は確定情報だけ掲載する。", nextAction: "該当記事からLINEへ。" },

  // --- Month 4: 複合悩みと継続判断を支える ---
  { articleId: "M4-01", subject: "シミとくすみが重なるとき 治療を分ける理由", persona: "A", format: "解説", coverStyle: "narrative", requiresManualPhoto: false, sourceUrls: [S1, getTreatmentBySlug("amalfipeel").url], category: CONCERN_CATEGORIES.brightening,
    request: "局所の色素斑と顔全体の色むらで目的を分ける。全部を一度に治す保証をしない。", nextAction: "治療の組立てを読む。" },
  { articleId: "M4-02", subject: "毛穴とニキビ跡が混在するときの治療順", persona: "B", format: "解説", coverStyle: "narrative", requiresManualPhoto: false, sourceUrls: [S2, S3], category: CONCERN_CATEGORIES.pores,
    request: "詰まり・炎症・赤み・凹みの優先順位を一例として説明する。", nextAction: "順序の図を保存。" },
  { articleId: "M4-03", subject: "シミ治療の追加照射は何で決まるのか", persona: "A", format: "Q&A", coverStyle: "narrative", requiresManualPhoto: false, sourceUrls: [S1], category: CONCERN_CATEGORIES.spots,
    request: "残存・再発・色素沈着を区別し、追加費用と同一プランの範囲を説明する。", nextAction: "料金条件へ。" },
  { articleId: "M4-04", subject: "顔のHIFU 部位や照射方法で何が違う", persona: "A", format: "解説", coverStyle: "narrative", requiresManualPhoto: false, sourceUrls: [S4], category: CONCERN_CATEGORIES.laxity,
    request: "施術範囲と目的・限界を整理する。ショット数だけで効果や優劣を判断しない。", nextAction: "部位別の詳細へ。" },
  { articleId: "M4-05", subject: "乾燥する時期のスキンケア 増やす前に見直すこと", persona: "B", format: "ケア", coverStyle: "narrative", requiresManualPhoto: false, sourceUrls: [S10], category: CONCERN_CATEGORIES.texture,
    request: "洗浄・保湿・刺激の扱いを具体化する。症状が続く場合の受診情報を添える。", nextAction: "ケア表を保存。" },
  { articleId: "M4-06", subject: "首の治療は初期費用と維持費で比較する", persona: "A", format: "解説", coverStyle: "narrative", requiresManualPhoto: false, sourceUrls: [S9], category: CONCERN_CATEGORIES.neck,
    request: "3か月目の分類に続く詳細。回数・維持頻度・ダウンタイムを同条件で比較する。", nextAction: "首の料金条件へ。" },
  { articleId: "M4-07", subject: "ニードル脱毛前は毛を伸ばす なぜ必要なのか", persona: "C", format: "ケア", coverStyle: "narrative", requiresManualPhoto: false, sourceUrls: [S5], category: CONCERN_CATEGORIES.hairRemoval,
    request: "レーザーと異なる準備と毛の長さを説明する。院内の最新準備案内に合わせる。", nextAction: "予約前に保存。" },
  { articleId: "M4-08", subject: "ホームケアの初期費用と継続費用は同じか", persona: "B", format: "Q&A", coverStyle: "narrative", requiresManualPhoto: false, sourceUrls: [S10], category: CONCERN_CATEGORIES.texture,
    request: "製品購入と処方薬を分け、短期集中・維持の実例を示す。未確認額は作らない。", nextAction: "費用例を読む。" },
  { articleId: "M4-09", subject: "顔の治療の実記録 変化と残る課題を確認", persona: "A", format: "症例", coverStyle: "narrative", requiresManualPhoto: true, sourceUrls: [S4], category: CONCERN_CATEGORIES.laxity,
    request: "実際の同意症例から顔の悩みを選ぶ。未準備時は「顔のたるみ治療が向かない場合」を解説する。", nextAction: "治療条件へ。" },
  { articleId: "M4-10", subject: "同じニキビ跡に同じ治療を続ければよいのか", persona: "B", format: "解説", coverStyle: "narrative", requiresManualPhoto: false, sourceUrls: [S3], category: CONCERN_CATEGORIES.acneScars,
    request: "反応・跡の形・炎症の有無で見直す理由を説明する。固定回数での完治を約束しない。", nextAction: "治療計画を読む。" },
  { articleId: "M4-11", subject: "毛穴や肌質の実記録 回数と観察期間を示す", persona: "B", format: "症例", coverStyle: "narrative", requiresManualPhoto: true, sourceUrls: [S2, S6_RE2O], category: CONCERN_CATEGORIES.pores,
    request: "肌育等の実治療と実記録を対応させる。未準備時は「肌質治療の維持頻度Q&A」を解説する。", nextAction: "経過と負担へ。" },
  { articleId: "M4-12", subject: "翌月の診療日と4か月の人気テーマ案内", persona: "共通", format: "お知らせ", coverStyle: "announcement", requiresManualPhoto: false, sourceUrls: [S0],
    request: "実測でよく読まれた記事だけを再案内する。効果人気No.1等の治療優越表現にしない。", nextAction: "詳細と予約先へ。" },
];

export type PublishedPostRecord = { subject: string; publishedAt: string; articleId?: string };

/**
 * Sequential editorial calendar (M1-01 -> M4-12), not a priority/season rotation:
 * publish the first articleId that hasn't appeared in history yet, and isn't
 * already sitting in an open approval Issue (`pendingArticleIds` — see
 * listOpenDraftArticleIds in src/approval/issue.ts). Without that second check,
 * re-running the generate workflow before staff approve the current draft would
 * pick the same next-in-sequence article again and create a duplicate.
 * Falls back to matching on `subject` for history entries recorded before
 * articleId existed.
 */
export function selectScheduledTheme(
  publishedPosts: PublishedPostRecord[],
  pendingArticleIds: ReadonlySet<string> = new Set(),
  catalog: readonly ScheduledTheme[] = SCHEDULED_THEME_CATALOG
): ScheduledTheme {
  const publishedIds = new Set(publishedPosts.map(post => post.articleId).filter(Boolean));
  const publishedSubjects = new Set(publishedPosts.map(post => post.subject));
  const next = catalog.find(
    theme => !publishedIds.has(theme.articleId) && !publishedSubjects.has(theme.subject) && !pendingArticleIds.has(theme.articleId)
  );
  return next ?? catalog[catalog.length - 1]!;
}

/**
 * Reels can't use 症例 articles: those need real consented photos (strategy doc
 * ch.9), and the reel pipeline only has the AI cover photo + texture library.
 */
export const REEL_THEME_CATALOG: readonly ScheduledTheme[] = SCHEDULED_THEME_CATALOG.filter(theme => !theme.requiresManualPhoto);

export function getThemeSourceUrls(theme: ScheduledTheme): string[] {
  return theme.sourceUrls;
}

/** Exact-match lookup for a staff-specified theme (see scripts/generate-draft.ts's THEME_SUBJECT override). Matches by articleId or subject. */
export function findThemeBySubject(subjectOrArticleId: string): ScheduledTheme | undefined {
  return SCHEDULED_THEME_CATALOG.find(theme => theme.subject === subjectOrArticleId || theme.articleId === subjectOrArticleId);
}
