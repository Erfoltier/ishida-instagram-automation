import type { GeneratedDraft } from "../content/draftGeneration";
import type { GeneratedCarouselSlide } from "../content/draftGeneration";

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, char => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[char] ?? char);
}

function splitHeadline(headline: string) {
  const normalized = headline.replace(/\s+/g, "").trim();
  const maxLineLength = 11;
  if (normalized.length <= maxLineLength) return [normalized];
  const punctuationIndex = normalized.slice(0, maxLineLength + 1).lastIndexOf("、");
  if (punctuationIndex >= 5) return [normalized.slice(0, punctuationIndex + 1), normalized.slice(punctuationIndex + 1)];
  const particleIndexes = Array.from(normalized.matchAll(/[をはがにでとへ]/g), match => match.index ?? -1).filter(index => index >= 5 && index < maxLineLength);
  const particleIndex = particleIndexes.at(-1);
  const splitAt = particleIndex === undefined ? maxLineLength : particleIndex + 1;
  return [normalized.slice(0, splitAt), normalized.slice(splitAt)];
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

const CLINIC_STYLE = `
<style>
  .eyebrow { font-family: 'Noto Sans CJK JP', 'Noto Sans JP', sans-serif; font-size: 24px; font-weight: 700; letter-spacing: 7px; fill: #3D6270; }
  .headline { font-family: 'Noto Sans CJK JP', 'Noto Sans JP', sans-serif; font-size: 54px; font-weight: 700; letter-spacing: -1px; fill: #1F292E; }
  .sub { font-family: 'Noto Sans CJK JP', 'Noto Sans JP', sans-serif; font-size: 25px; font-weight: 400; fill: #3D6270; }
  .clinic { font-family: 'Noto Sans CJK JP', 'Noto Sans JP', sans-serif; font-size: 24px; font-weight: 700; fill: #1F292E; }
  .station { font-family: 'Noto Sans CJK JP', 'Noto Sans JP', sans-serif; font-size: 18px; font-weight: 400; fill: #3D6270; }
</style>`;

/** Cover slide: ivory information panel composited over a photo (AI-generated or licensed stock — see render/coverImage.ts). */
export function buildLayoutSvg(draft: Pick<GeneratedDraft, "eyebrow"> & { headline: string; subheadline: string }) {
  const [line1, line2] = splitHeadline(draft.headline);
  const line2Svg = line2 ? `<text x="112" y="405" class="headline">${escapeXml(line2)}</text>` : "";
  return `
  <svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="veil" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0%" stop-color="#FBFAF6" stop-opacity="0.95"/>
        <stop offset="55%" stop-color="#FBFAF6" stop-opacity="0.95"/>
        <stop offset="70%" stop-color="#FBFAF6" stop-opacity="0.75"/>
        <stop offset="88%" stop-color="#FBFAF6" stop-opacity="0.10"/>
        <stop offset="100%" stop-color="#FBFAF6" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${CLINIC_STYLE}
    <rect x="0" y="0" width="1080" height="1080" fill="url(#veil)"/>
    <rect x="72" y="100" width="7" height="880" fill="#B8A060"/>
    <rect x="78" y="100" width="546" height="6" fill="#3D6270"/>
    <text x="116" y="164" class="eyebrow">${escapeXml(draft.eyebrow.toUpperCase())}</text>
    <text x="112" y="315" class="headline">${escapeXml(line1 ?? "")}</text>
    ${line2Svg}
    <rect x="114" y="482" width="365" height="3" fill="#B8A060"/>
    <text x="114" y="545" class="sub">${escapeXml(draft.subheadline)}</text>
    <text x="114" y="919" class="clinic">いしだ皮フ科・美容皮膚科</text>
    <text x="114" y="960" class="station">東大宮駅東口 徒歩1分</text>
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
export function buildCarouselInformationSvg(slide: GeneratedCarouselSlide, eyebrow: string, totalSlides: number) {
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
      .eyebrow { font-family: 'Noto Sans CJK JP', 'Noto Sans JP', sans-serif; font-size: 19px; font-weight: 700; letter-spacing: 4px; fill: #3D6270; }
      .headline { font-family: 'Noto Sans CJK JP', 'Noto Sans JP', sans-serif; font-size: 48px; font-weight: 700; letter-spacing: -1px; fill: #1F292E; }
      .body { font-family: 'Noto Sans CJK JP', 'Noto Sans JP', sans-serif; font-size: 27px; font-weight: 400; fill: #33424A; }
      .bodyOnDark { font-family: 'Noto Sans CJK JP', 'Noto Sans JP', sans-serif; font-size: 27px; font-weight: 400; fill: #FBFAF6; }
      .pageNumber { font-family: 'Noto Sans CJK JP', 'Noto Sans JP', sans-serif; font-size: 20px; font-weight: 700; letter-spacing: 1px; fill: #B8A060; }
      .pageTotal { font-family: 'Noto Sans CJK JP', 'Noto Sans JP', sans-serif; font-size: 20px; font-weight: 400; fill: #B8A88F; }
      .reservation { font-family: 'Noto Sans CJK JP', 'Noto Sans JP', sans-serif; font-size: 22px; font-weight: 700; fill: #FBFAF6; }
      .clinic { font-family: 'Noto Sans CJK JP', 'Noto Sans JP', sans-serif; font-size: 24px; font-weight: 700; fill: #1F292E; }
      .station { font-family: 'Noto Sans CJK JP', 'Noto Sans JP', sans-serif; font-size: 18px; font-weight: 400; fill: #3D6270; }
    </style>
    <rect x="0" y="0" width="1080" height="1080" fill="#FBFAF6"/>
    <g transform="${arcTransform}" opacity="0.14">
      <circle cx="0" cy="0" r="360" fill="none" stroke="#B8A060" stroke-width="2"/>
    </g>
    <rect x="72" y="100" width="7" height="880" fill="#B8A060"/>
    <rect x="78" y="100" width="546" height="6" fill="#3D6270"/>
    <text x="116" y="164" class="eyebrow">${escapeXml(eyebrow.toUpperCase())}</text>
    <text x="964" y="171" text-anchor="end" class="pageNumber">${String(slide.order).padStart(2, "0")}<tspan class="pageTotal"> / ${String(totalSlides).padStart(2, "0")}</tspan></text>
    <circle cx="940" cy="230" r="46" fill="#3D6270"/>
    <g transform="translate(940,230)">${getSlideIcon(slide.kind)}</g>
    ${titleSvg}
    <rect x="114" y="452" width="365" height="3" fill="#B8A060"/>
    <rect x="114" y="${boxY}" width="852" height="${boxHeight}" rx="16" fill="${isCta ? "#3D6270" : "#FFFFFF"}" stroke="${isCta ? "#3D6270" : "#E9E3D4"}" stroke-width="1.5"/>
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
export function buildPhotoOverlaySvg(slide: GeneratedCarouselSlide, eyebrow: string, totalSlides: number) {
  const titleLines = splitCarouselText(slide.title, 14);
  const bodyLines = splitCarouselText(slide.body, 24);
  const isCta = slide.kind === "cta";
  const titleSvg = titleLines.map((line, index) => `<text x="116" y="${460 + index * 68}" class="headline">${escapeXml(line)}</text>`).join("");

  const boxY = 660;
  const bodyBlockHeight = bodyLines.length * 46;
  const bodySvg = bodyLines.map((line, index) => `<text x="116" y="${boxY + 62 + index * 46}" class="bodyOnDark">${escapeXml(line)}</text>`).join("");
  const reservation = isCta ? `<text x="116" y="${boxY + 62 + bodyBlockHeight + 34}" class="reservation">公式LINE　${escapeXml("https://lin.ee/OFlfdeH")}</text>` : "";

  return `
  <svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#1F292E" stop-opacity="0"/>
        <stop offset="42%" stop-color="#1F292E" stop-opacity="0.12"/>
        <stop offset="100%" stop-color="#1F292E" stop-opacity="0.90"/>
      </linearGradient>
    </defs>
    <style>
      .pill { font-family: 'Noto Sans CJK JP', 'Noto Sans JP', sans-serif; font-size: 19px; font-weight: 700; letter-spacing: 2px; fill: #FFFFFF; }
      .headline { font-family: 'Noto Sans CJK JP', 'Noto Sans JP', sans-serif; font-size: 54px; font-weight: 700; letter-spacing: -1px; fill: #FFFFFF; }
      .bodyOnDark { font-family: 'Noto Sans CJK JP', 'Noto Sans JP', sans-serif; font-size: 27px; font-weight: 400; fill: #FBFAF6; }
      .reservation { font-family: 'Noto Sans CJK JP', 'Noto Sans JP', sans-serif; font-size: 22px; font-weight: 700; fill: #FBFAF6; }
      .clinic { font-family: 'Noto Sans CJK JP', 'Noto Sans JP', sans-serif; font-size: 24px; font-weight: 700; fill: #FFFFFF; }
      .station { font-family: 'Noto Sans CJK JP', 'Noto Sans JP', sans-serif; font-size: 18px; font-weight: 400; fill: #E9E3D4; }
    </style>
    <rect x="0" y="0" width="1080" height="1080" fill="url(#scrim)"/>
    <rect x="80" y="90" width="${eyebrow.length * 15 + 60}" height="46" rx="23" fill="none" stroke="#FFFFFF" stroke-width="1.5" opacity="0.85"/>
    <text x="${80 + (eyebrow.length * 15 + 60) / 2}" y="120" text-anchor="middle" class="pill">${escapeXml(eyebrow.toUpperCase())}</text>
    <rect x="898" y="90" width="112" height="46" rx="23" fill="none" stroke="#FFFFFF" stroke-width="1.5" opacity="0.85"/>
    <text x="954" y="120" text-anchor="middle" class="pill">${String(slide.order).padStart(2, "0")}/${String(totalSlides).padStart(2, "0")}</text>
    ${titleSvg}
    <rect x="118" y="${460 + (titleLines.length - 1) * 68 + 32}" width="140" height="5" fill="#B8A060"/>
    ${bodySvg}
    ${reservation}
    <text x="116" y="919" class="clinic">いしだ皮フ科・美容皮膚科</text>
    <text x="116" y="960" class="station">東大宮駅東口 徒歩1分</text>
  </svg>`;
}
