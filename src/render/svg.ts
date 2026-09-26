import type { GeneratedDraft } from "../content/draftGeneration";
import type { GeneratedCarouselSlide } from "../content/draftGeneration";

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, char => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[char] ?? char);
}

const ASCII_ALNUM = /[A-Za-z0-9]/;

/** Nudges a line-break index so it never lands inside a Latin word/acronym (e.g. "LINE", "HIFU"). */
function avoidWordBreak(text: string, cut: number): number {
  if (cut <= 0 || cut >= text.length) return cut;
  if (!ASCII_ALNUM.test(text[cut - 1]!) || !ASCII_ALNUM.test(text[cut]!)) return cut;
  let start = cut;
  while (start > 0 && ASCII_ALNUM.test(text[start - 1]!)) start -= 1;
  if (start > 2) return start; // push the whole word onto the next line
  let end = cut;
  while (end < text.length && ASCII_ALNUM.test(text[end]!)) end += 1;
  return end; // word starts too close to the line start — keep it on this line instead
}

/**
 * Greedy word-wrap for the big (80px) cover headline. maxLineLength=8 keeps
 * each line within the ivory panel at that size (panel is ~600px wide, and a
 * bold CJK glyph at 80px is roughly 80px wide). Capped at 3 lines — anything
 * left over after that goes on the final line as-is rather than growing the
 * card indefinitely.
 */
function splitHeadline(headline: string): string[] {
  const normalized = headline.replace(/\s+/g, "").trim();
  const maxLineLength = 8;
  const maxLines = 3;
  const lines: string[] = [];
  let remaining = normalized;
  while (remaining.length > maxLineLength && lines.length < maxLines - 1) {
    const candidate = remaining.slice(0, maxLineLength + 1);
    const punctuationIndex = candidate.lastIndexOf("、");
    let cut: number;
    if (punctuationIndex >= 4) {
      cut = punctuationIndex + 1;
    } else {
      const particleIndexes = Array.from(candidate.matchAll(/[をはがにでとへ]/g), match => match.index ?? -1).filter(
        index => index >= 4 && index < maxLineLength
      );
      const particleIndex = particleIndexes.at(-1);
      cut = particleIndex === undefined ? maxLineLength : particleIndex + 1;
    }
    cut = avoidWordBreak(remaining, cut);
    lines.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut);
  }
  if (remaining) lines.push(remaining);
  return lines;
}

function splitCarouselText(value: string, maxLineLength = 15) {
  const normalized = value.replace(/\s+/g, "").trim();
  if (normalized.length <= maxLineLength) return [normalized];
  const lines: string[] = [];
  let remaining = normalized;
  while (remaining.length > maxLineLength && lines.length < 2) {
    const candidate = remaining.slice(0, maxLineLength + 1);
    const breakAt = Math.max(candidate.lastIndexOf("、"), candidate.lastIndexOf("。"), candidate.lastIndexOf("を"), candidate.lastIndexOf("に"));
    const cut = avoidWordBreak(remaining, breakAt >= 7 ? breakAt + 1 : maxLineLength);
    lines.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut);
  }
  if (remaining) lines.push(remaining.slice(0, maxLineLength + 4));
  return lines.slice(0, 3);
}

/**
 * Brand palette (2026-09-26 revision, corrected): unified with the clinic's
 * actual published post (instagram.com/p/Ddb5wNKksMS/). A close look at the
 * full-resolution image shows pointed, brush-tapered serifs on both the kanji
 * and the Latin numerals — a decorative Mincho display face, NOT Gothic (an
 * earlier pass here misread a low-res copy as bold sans and switched the whole
 * template to Noto Sans; that was wrong). Using Shippori Mincho, a Google
 * Fonts face built for exactly this kind of dramatic Japanese headline, with
 * Noto Serif CJK JP as the fallback for any glyph it doesn't cover.
 */
const INK = "#3C3033";
const SUB_ACCENT = "#C98F96";
const GOLD = "#A58B62";
const IVORY = "#FFFAFA";
const IVORY_PANEL = "#FBF4F3";
const MUTED = "#8A8078";
const FONT = "'Shippori Mincho', 'Noto Serif CJK JP', 'Noto Serif JP', serif";

/** Crude Latin-glyph width estimate (uppercase, bold) for sizing the eyebrow's trailing rule line. */
function estimateLatinLabelWidth(text: string, fontSize: number, letterSpacing: number): number {
  return text.length * (fontSize * 0.62 + letterSpacing);
}

/**
 * The one "colored text" element (eyebrow label, price figure, accent rules)
 * rotates through this palette per post — picked deterministically from the
 * draftId so every page WITHIN one carousel matches, but different posts land
 * on different colors. All muted/desaturated so any of them reads as premium
 * against the ivory background, per the reference post
 * (instagram.com/p/Ddb5wNKksMS/).
 */
export const ACCENT_PALETTE = ["#925D66", "#3D6270", "#6B7B5E", "#8A7048", "#7A5D74", "#5D6B82"] as const;

export function pickAccentColor(seed: string): string {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return ACCENT_PALETTE[hash % ACCENT_PALETTE.length]!;
}

function clinicStyle(accentColor: string) {
  return `
<style>
  .eyebrow { font-family: ${FONT}; font-size: 23px; font-weight: 700; letter-spacing: 6px; fill: ${accentColor}; }
  .headline { font-family: ${FONT}; font-size: 80px; font-weight: 800; letter-spacing: -1px; fill: ${INK}; }
  .sub { font-family: ${FONT}; font-size: 30px; font-weight: 400; fill: ${accentColor}; }
  .clinic { font-family: ${FONT}; font-size: 26px; font-weight: 700; fill: ${INK}; }
  .footerDivider { font-family: ${FONT}; font-size: 24px; font-weight: 400; fill: ${MUTED}; }
  .station { font-family: ${FONT}; font-size: 20px; font-weight: 400; fill: ${MUTED}; }
  .pageIndicator { font-family: ${FONT}; font-size: 20px; font-weight: 400; fill: ${MUTED}; }
  .priceValue { font-family: ${FONT}; font-size: 92px; font-weight: 800; fill: ${accentColor}; }
  .priceSuffix { font-family: ${FONT}; font-size: 34px; font-weight: 700; fill: ${accentColor}; }
  .treatmentName { font-family: ${FONT}; font-size: 36px; font-weight: 700; fill: ${accentColor}; }
  .fineprint { font-family: ${FONT}; font-size: 24px; font-weight: 400; fill: ${MUTED}; }
</style>`;
}

export type CoverPriceInfo = {
  /** e.g. "医療脱毛（ヒゲ）" */
  treatmentName: string;
  /** e.g. "顔全体" */
  targetArea: string;
  /** e.g. "1回" */
  unit: string;
  /** e.g. "11,000円（税込）" */
  price: string;
  /** true if there are other pricing patterns/add-ons covered later in the carousel */
  hasAdditionalFees: boolean;
};

/**
 * Cover slide: ivory information panel composited over a photo (AI-generated or
 * licensed stock — see render/coverImage.ts).
 *
 * Two modes, per the strategy doc's chapter 13:
 * - Narrative (default): headline is the reader's specific worry/question only.
 *   subheadline must NOT reveal the answer — pass "" to leave that space as
 *   genuine whitespace rather than filling it with another conclusion.
 * - Price (`priceInfo` provided): shows treatment/area/unit/price directly,
 *   since price-menu posts should never hide the number behind a question hook.
 */
export function buildLayoutSvg(
  draft: Pick<GeneratedDraft, "eyebrow"> & { headline: string; subheadline: string; priceInfo?: CoverPriceInfo },
  accentColor: string = ACCENT_PALETTE[0],
  pageInfo?: { order: number; total: number }
) {
  const LEFT_X = 64;
  const headlineLines = splitHeadline(draft.headline);
  const headlineBaseY = 280;
  const headlineLineHeight = 92;
  const headlineSvg = headlineLines
    .map((line, index) => `<text x="${LEFT_X}" y="${headlineBaseY + index * headlineLineHeight}" class="headline">${escapeXml(line)}</text>`)
    .join("");
  const ruleY = headlineBaseY + (headlineLines.length - 1) * headlineLineHeight + 50;

  const eyebrowText = draft.eyebrow.toUpperCase();
  const eyebrowLineStartX = LEFT_X + estimateLatinLabelWidth(eyebrowText, 23, 6) + 28;

  let contentBlock: string;
  if (draft.priceInfo) {
    // Price cover, matching the reference post's structure: huge price figure (with
    // a smaller trailing unit/tax suffix on the same baseline), treatment name below
    // it in the accent color, then two small gray fine-print lines — no separate
    // "targetArea/unit" label line above the price like the old template had.
    const priceMatch = draft.priceInfo.price.match(/^([\d,]+)(.*)$/);
    const priceMain = priceMatch ? priceMatch[1]! : draft.priceInfo.price;
    const priceSuffix = priceMatch ? priceMatch[2]! : "";
    const priceY = ruleY + 130;
    const treatmentY = priceY + 70;
    const fineprint1Y = treatmentY + 56;
    const fineprint2Y = fineprint1Y + 40;
    contentBlock = `
    <text x="${LEFT_X}" y="${priceY}" class="priceValue">${escapeXml(priceMain)}<tspan class="priceSuffix">${escapeXml(priceSuffix)}</tspan></text>
    <text x="${LEFT_X}" y="${treatmentY}" class="treatmentName">${escapeXml(draft.priceInfo.treatmentName)}</text>
    <text x="${LEFT_X}" y="${fineprint1Y}" class="fineprint">${escapeXml(draft.priceInfo.targetArea)}／${escapeXml(draft.priceInfo.unit)}</text>
    ${draft.priceInfo.hasAdditionalFees ? `<text x="${LEFT_X}" y="${fineprint2Y}" class="fineprint">別途費用あり（詳しくは次のページへ）</text>` : ""}`;
  } else if (draft.subheadline.trim()) {
    contentBlock = `<text x="${LEFT_X}" y="${ruleY + 90}" class="sub">${escapeXml(draft.subheadline)}</text>`;
  } else {
    contentBlock = ""; // narrative cover with no answer to give away — leave as whitespace, per strategy doc ch.13
  }

  const pageIndicator = pageInfo
    ? `<text x="1016" y="1000" text-anchor="end" class="pageIndicator">${String(pageInfo.order).padStart(2, "0")} / ${String(pageInfo.total).padStart(2, "0")}</text>`
    : "";

  return `
  <svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="veil" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0%" stop-color="${IVORY}" stop-opacity="0.95"/>
        <stop offset="55%" stop-color="${IVORY}" stop-opacity="0.95"/>
        <stop offset="70%" stop-color="${IVORY}" stop-opacity="0.75"/>
        <stop offset="88%" stop-color="${IVORY}" stop-opacity="0.10"/>
        <stop offset="100%" stop-color="${IVORY}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${clinicStyle(accentColor)}
    <rect x="0" y="0" width="1080" height="1080" fill="url(#veil)"/>
    <text x="${LEFT_X}" y="108" class="eyebrow">${escapeXml(eyebrowText)}</text>
    <line x1="${eyebrowLineStartX}" y1="100" x2="620" y2="100" stroke="${accentColor}" stroke-width="2"/>
    ${headlineSvg}
    <rect x="${LEFT_X}" y="${ruleY}" width="600" height="3" fill="${accentColor}"/>
    ${contentBlock}
    <text x="${LEFT_X}" y="1000" class="clinic">いしだ皮フ科・美容皮膚科</text>
    <text x="398" y="1000" class="footerDivider">｜</text>
    <text x="420" y="1000" class="station">東大宮駅東口 徒歩1分</text>
    ${pageIndicator}
  </svg>`;
}

/** Simple line-icon markup (white strokes, ~28px extent) centered on the origin — placed inside a colored badge circle. */
function getSlideIcon(kind: GeneratedCarouselSlide["kind"]): string {
  const icons: Record<GeneratedCarouselSlide["kind"], string> = {
    cover: "",
    background: `<circle cx="-4" cy="-4" r="11" fill="none" stroke="#fff" stroke-width="3.2"/><line x1="5" y1="5" x2="15" y2="15" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/>`,
    caution: `<circle cx="0" cy="0" r="16" fill="none" stroke="#fff" stroke-width="3.2"/><line x1="0" y1="-8" x2="0" y2="3" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/><circle cx="0" cy="9" r="2" fill="#fff"/>`,
    option: `<circle cx="-10" cy="-9" r="4" fill="#fff"/><circle cx="10" cy="-9" r="4" fill="#fff"/><circle cx="0" cy="11" r="4" fill="#fff"/><path d="M-10 -5 L0 7 L10 -5" fill="none" stroke="#fff" stroke-width="2.6"/>`,
    consultation: `<path d="M-15 -10 h30 a4 4 0 0 1 4 4 v9 a4 4 0 0 1 -4 4 h-17 l-8 7 v-7 h-5 a4 4 0 0 1 -4 -4 v-9 a4 4 0 0 1 4 -4 z" fill="none" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/>`,
    summary: `<rect x="-12" y="-15" width="24" height="30" rx="3" fill="none" stroke="#fff" stroke-width="2.6"/><line x1="-6" y1="-6" x2="6" y2="-6" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><line x1="-6" y1="2" x2="6" y2="2" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><line x1="-6" y1="10" x2="1" y2="10" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>`,
    cta: `<line x1="-10" y1="0" x2="9" y2="0" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/><path d="M2 -9 L14 0 L2 9" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`,
  };
  return icons[kind];
}

/**
 * Info slides (2nd page onward): pure template + text, no photo, no generative AI.
 * Each slide gets an icon that actually means something for its content role
 * (magnifier for background/insight, warning mark for caution, branch for options,
 * speech bubble for consultation, checklist for summary, arrow for the CTA), body
 * copy sits inside a bordered card instead of floating on the bare background, and
 * a large low-opacity arc varies per slide so the carousel doesn't read as one
 * repeated background seven times.
 */
export function buildCarouselInformationSvg(slide: GeneratedCarouselSlide, eyebrow: string, totalSlides: number, accentColor: string = ACCENT_PALETTE[0]) {
  const titleLines = splitCarouselText(slide.title, 14);
  const bodyLines = splitCarouselText(slide.body, 24);
  const isCta = slide.kind === "cta";
  const titleSvg = titleLines.map((line, index) => `<text x="116" y="${300 + index * 68}" class="headline">${escapeXml(line)}</text>`).join("");

  const boxY = 500;
  const bodyBlockHeight = bodyLines.length * 46;
  const reservationGap = isCta ? 56 : 0; // extra room for the LINE line, kept clear of the last body line
  const boxHeight = 72 + bodyBlockHeight + reservationGap;
  const bodySvg = bodyLines.map((line, index) => `<text x="150" y="${boxY + 62 + index * 46}" class="${isCta ? "bodyOnDark" : "body"}">${escapeXml(line)}</text>`).join("");
  const reservation = isCta ? `<text x="150" y="${boxY + 62 + bodyBlockHeight + 34}" class="reservation">公式LINE　${escapeXml("https://lin.ee/OFlfdeH")}</text>` : "";

  // Alternate a large, faint accent arc between two corners so pages don't look identical.
  const arcTransform = slide.order % 2 === 0 ? "translate(1080,0)" : "translate(0,1080) rotate(180)";

  return `
  <svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
    <style>
      .eyebrow { font-family: ${FONT}; font-size: 19px; font-weight: 700; letter-spacing: 4px; fill: ${accentColor}; }
      .headline { font-family: ${FONT}; font-size: 48px; font-weight: 700; letter-spacing: -1px; fill: ${INK}; }
      .body { font-family: ${FONT}; font-size: 27px; font-weight: 400; fill: ${INK}; }
      .bodyOnDark { font-family: ${FONT}; font-size: 27px; font-weight: 400; fill: ${IVORY}; }
      .pageNumber { font-family: ${FONT}; font-size: 20px; font-weight: 700; letter-spacing: 1px; fill: ${GOLD}; }
      .pageTotal { font-family: ${FONT}; font-size: 20px; font-weight: 400; fill: ${GOLD}; opacity: 0.55; }
      .reservation { font-family: ${FONT}; font-size: 22px; font-weight: 700; fill: ${IVORY}; }
      .clinic { font-family: ${FONT}; font-size: 24px; font-weight: 700; fill: ${INK}; }
      .station { font-family: ${FONT}; font-size: 18px; font-weight: 400; fill: ${MUTED}; }
    </style>
    <rect x="0" y="0" width="1080" height="1080" fill="${IVORY}"/>
    <g transform="${arcTransform}" opacity="0.14">
      <circle cx="0" cy="0" r="360" fill="none" stroke="${GOLD}" stroke-width="2"/>
    </g>
    <rect x="72" y="100" width="7" height="880" fill="${GOLD}"/>
    <rect x="78" y="100" width="546" height="6" fill="${accentColor}"/>
    <text x="116" y="164" class="eyebrow">${escapeXml(eyebrow.toUpperCase())}</text>
    <text x="964" y="171" text-anchor="end" class="pageNumber">${String(slide.order).padStart(2, "0")}<tspan class="pageTotal"> / ${String(totalSlides).padStart(2, "0")}</tspan></text>
    <circle cx="940" cy="230" r="46" fill="${accentColor}"/>
    <g transform="translate(940,230)">${getSlideIcon(slide.kind)}</g>
    ${titleSvg}
    <rect x="114" y="452" width="365" height="3" fill="${GOLD}"/>
    <rect x="114" y="${boxY}" width="852" height="${boxHeight}" rx="16" fill="${isCta ? accentColor : IVORY_PANEL}" stroke="${isCta ? accentColor : SUB_ACCENT}" stroke-width="1.5"/>
    ${bodySvg}
    ${reservation}
    <text x="114" y="919" class="clinic">いしだ皮フ科・美容皮膚科</text>
    <text x="114" y="960" class="station">東大宮駅東口 徒歩1分</text>
  </svg>`;
}

/**
 * Transparent overlay (gradient scrim + pill badges + bold bottom-anchored text)
 * composited BY SHARP on top of a pre-uploaded texture photo — see
 * render/texturePhotoLibrary.ts and renderSlides.ts. No background rect here;
 * the photo underneath is the background. Used when a texture photo is available
 * for the theme's category; buildCarouselInformationSvg is the flat-design
 * fallback for categories with no photos uploaded yet.
 */
export function buildPhotoOverlaySvg(slide: GeneratedCarouselSlide, eyebrow: string, totalSlides: number, needsStrongScrim: boolean, accentColor: string = ACCENT_PALETTE[0]) {
  const titleLines = splitCarouselText(slide.title, 14);
  const bodyLines = splitCarouselText(slide.body, 24);
  const isCta = slide.kind === "cta";
  const titleSvg = titleLines.map((line, index) => `<text x="116" y="${460 + index * 68}" class="headline">${escapeXml(line)}</text>`).join("");

  const boxY = 660;
  const bodyBlockHeight = bodyLines.length * 46;
  const bodySvg = bodyLines.map((line, index) => `<text x="116" y="${boxY + 62 + index * 46}" class="bodyOnDark">${escapeXml(line)}</text>`).join("");
  const reservation = isCta ? `<text x="116" y="${boxY + 62 + bodyBlockHeight + 34}" class="reservation">公式LINE　${escapeXml("https://lin.ee/OFlfdeH")}</text>` : "";

  // Measured against the actual cropped photo (see renderSlides.ts): a naturally
  // dark photo only needs the normal gradient, but a bright one (light background,
  // pale clothing, etc.) gets a stronger scrim so white text stays legible instead
  // of washing out.
  const scrimStops = needsStrongScrim
    ? `<stop offset="0%" stop-color="${INK}" stop-opacity="0.08"/>
       <stop offset="30%" stop-color="${INK}" stop-opacity="0.38"/>
       <stop offset="60%" stop-color="${INK}" stop-opacity="0.78"/>
       <stop offset="100%" stop-color="${INK}" stop-opacity="0.95"/>`
    : `<stop offset="0%" stop-color="${INK}" stop-opacity="0"/>
       <stop offset="38%" stop-color="${INK}" stop-opacity="0.22"/>
       <stop offset="70%" stop-color="${INK}" stop-opacity="0.62"/>
       <stop offset="100%" stop-color="${INK}" stop-opacity="0.92"/>`;

  return `
  <svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
        ${scrimStops}
      </linearGradient>
    </defs>
    <style>
      .pill { font-family: ${FONT}; font-size: 19px; font-weight: 700; letter-spacing: 2px; fill: #FFFFFF; }
      .headline { font-family: ${FONT}; font-size: 54px; font-weight: 700; letter-spacing: -1px; fill: #FFFFFF; }
      .bodyOnDark { font-family: ${FONT}; font-size: 27px; font-weight: 400; fill: ${IVORY}; }
      .reservation { font-family: ${FONT}; font-size: 22px; font-weight: 700; fill: ${IVORY}; }
      .clinic { font-family: ${FONT}; font-size: 24px; font-weight: 700; fill: #FFFFFF; }
      .station { font-family: ${FONT}; font-size: 18px; font-weight: 400; fill: ${SUB_ACCENT}; }
    </style>
    <rect x="0" y="0" width="1080" height="1080" fill="url(#scrim)"/>
    <rect x="80" y="90" width="${eyebrow.length * 15 + 60}" height="46" rx="23" fill="${INK}" fill-opacity="0.32" stroke="#FFFFFF" stroke-width="1.5" opacity="0.9"/>
    <text x="${80 + (eyebrow.length * 15 + 60) / 2}" y="120" text-anchor="middle" class="pill">${escapeXml(eyebrow.toUpperCase())}</text>
    <rect x="898" y="90" width="112" height="46" rx="23" fill="${INK}" fill-opacity="0.32" stroke="#FFFFFF" stroke-width="1.5" opacity="0.9"/>
    <text x="954" y="120" text-anchor="middle" class="pill">${String(slide.order).padStart(2, "0")}/${String(totalSlides).padStart(2, "0")}</text>
    ${titleSvg}
    <rect x="118" y="${460 + (titleLines.length - 1) * 68 + 32}" width="140" height="5" fill="${accentColor}"/>
    ${bodySvg}
    ${reservation}
    <text x="116" y="919" class="clinic">いしだ皮フ科・美容皮膚科</text>
    <text x="116" y="960" class="station">東大宮駅東口 徒歩1分</text>
  </svg>`;
}
