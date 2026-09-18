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

function splitCarouselText(value: string, maxLineLength = 15) {
  const normalized = value.replace(/\s+/g, "").trim();
  if (normalized.length <= maxLineLength) return [normalized];
  const lines: string[] = [];
  let remaining = normalized;
  while (remaining.length > maxLineLength && lines.length < 2) {
    const candidate = remaining.slice(0, maxLineLength + 1);
    const breakAt = Math.max(candidate.lastIndexOf("、"), candidate.lastIndexOf("。"), candidate.lastIndexOf("を"), candidate.lastIndexOf("に"));
    const cut = breakAt >= 7 ? breakAt + 1 : maxLineLength;
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

function getSlideLabel(kind: GeneratedCarouselSlide["kind"]) {
  const labels: Record<GeneratedCarouselSlide["kind"], string> = {
    cover: "SKIN CARE", insight: "POINT 01", background: "POINT 01", caution: "POINT 02",
    option: "OPTIONS", consultation: "CONSULTATION", summary: "FOR YOUR VISIT", cta: "RESERVATION",
  };
  return labels[kind];
}

/** Info slides (2nd page onward): pure template + text, no photo. No generative AI involved. */
export function buildCarouselInformationSvg(slide: GeneratedCarouselSlide, eyebrow: string) {
  const titleLines = splitCarouselText(slide.title, 14);
  const bodyLines = splitCarouselText(slide.body, 20);
  const slideLabel = slide.kind === "cta" ? getSlideLabel(slide.kind) : `${eyebrow} · ${getSlideLabel(slide.kind)}`;
  const titleSvg = titleLines.map((line, index) => `<text x="116" y="${325 + index * 72}" class="headline">${escapeXml(line)}</text>`).join("");
  const bodySvg = bodyLines.map((line, index) => `<text x="116" y="${570 + index * 42}" class="body">${escapeXml(line)}</text>`).join("");
  const reservation = slide.kind === "cta" ? `<text x="116" y="780" class="reservation">公式LINE  https://lin.ee/OFlfdeH</text>` : "";
  return `
  <svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="1080" height="1080" fill="#FBFAF6"/>
    <rect x="72" y="100" width="7" height="880" fill="#B8A060"/>
    <rect x="78" y="100" width="546" height="6" fill="#3D6270"/>
    <rect x="730" y="172" width="238" height="238" rx="119" fill="#E9E3D4"/>
    <rect x="775" y="218" width="148" height="148" rx="74" fill="#D2DFDC"/>
    <path d="M704 606 C805 500, 894 705, 1001 598" fill="none" stroke="#B8A060" stroke-width="5"/>
    <circle cx="790" cy="598" r="13" fill="#3D6270"/>
    <circle cx="895" cy="598" r="13" fill="#B8A060"/>
    <circle cx="1001" cy="598" r="13" fill="#3D6270"/>
    <style>
      .eyebrow { font-family: 'Noto Sans CJK JP', 'Noto Sans JP', sans-serif; font-size: 19px; font-weight: 700; letter-spacing: 4px; fill: #3D6270; }
      .headline { font-family: 'Noto Sans CJK JP', 'Noto Sans JP', sans-serif; font-size: 50px; font-weight: 700; letter-spacing: -1px; fill: #1F292E; }
      .body { font-family: 'Noto Sans CJK JP', 'Noto Sans JP', sans-serif; font-size: 25px; font-weight: 400; fill: #3D6270; }
      .number { font-family: 'Noto Sans CJK JP', 'Noto Sans JP', sans-serif; font-size: 19px; font-weight: 700; letter-spacing: 2px; fill: #B8A060; }
      .reservation { font-family: 'Noto Sans CJK JP', 'Noto Sans JP', sans-serif; font-size: 21px; font-weight: 700; fill: #1F292E; }
      .clinic { font-family: 'Noto Sans CJK JP', 'Noto Sans JP', sans-serif; font-size: 24px; font-weight: 700; fill: #1F292E; }
      .station { font-family: 'Noto Sans CJK JP', 'Noto Sans JP', sans-serif; font-size: 18px; font-weight: 400; fill: #3D6270; }
    </style>
    <text x="116" y="164" class="eyebrow">${escapeXml(slideLabel)}</text>
    <text x="870" y="920" class="number">${String(slide.order).padStart(2, "0")}</text>
    ${titleSvg}
    <rect x="114" y="492" width="365" height="3" fill="#B8A060"/>
    ${bodySvg}
    ${reservation}
    <text x="114" y="919" class="clinic">いしだ皮フ科・美容皮膚科</text>
    <text x="114" y="960" class="station">東大宮駅東口 徒歩1分</text>
  </svg>`;
}
