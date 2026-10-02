// Bundled with the composition instead of relying on system fonts, so the
// GitHub Actions runner doesn't need any CJK font install for reels.
import "@fontsource/shippori-mincho/700.css";
import "@fontsource/shippori-mincho/800.css";
import "@fontsource/noto-sans-jp/400.css";
import "@fontsource/noto-sans-jp/700.css";
import { useEffect, useState } from "react";
import { continueRender, delayRender } from "remotion";

export const SERIF = "'Shippori Mincho', 'Noto Serif CJK JP', serif";
export const SANS = "'Noto Sans JP', 'Noto Sans CJK JP', sans-serif";

/**
 * The @fontsource CSS splits Japanese into ~120 unicode-range files that the
 * browser only fetches once a glyph is used — explicitly load the ones this
 * reel's text needs before any frame is captured.
 */
export function useFontsReady(text: string) {
  const [handle] = useState(() => delayRender("Loading Japanese fonts"));
  useEffect(() => {
    const faces = ["700 10px 'Shippori Mincho'", "800 10px 'Shippori Mincho'", "400 10px 'Noto Sans JP'", "700 10px 'Noto Sans JP'"];
    Promise.all(faces.map(face => document.fonts.load(face, text)))
      .then(() => document.fonts.ready)
      .then(() => continueRender(handle))
      .catch(() => continueRender(handle));
  }, [handle, text]);
}
