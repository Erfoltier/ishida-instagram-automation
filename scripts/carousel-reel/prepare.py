"""
Turns finished carousel images (text already designed into the picture) into
layers for remotion/CarouselReel.tsx, so the reel keeps the exact fonts/colours
of the carousel while the text animates. Each slide is split into:

  * plate-N.png    : an EMPTY background — the slide's cream paper with every
                     element (text, highlighters, frames, icons, photos) removed;
                     only the footer line stays, so each slide is drawn from scratch
  * N-K-decor.png  : the frames / icons / photos that belong to text block K
                     (assigned to the nearest block), drawn just before its text
  * N-K-mark.png   : the highlighter / underline strokes belonging to text block K
                     (pastel yellow/orange/blue near the text), drawn in after the text
  * N-K.png        : the text of block K only, on a transparent background
                     (alpha extracted against the local background, colours kept)
  * layers.json    : positions + animation per layer, read by the composition

  python3 scripts/carousel-reel/prepare.py <reelDir>

<reelDir>/carousel/spec.json lists, per slide, the source image and the text
blocks as [x, y, w, h] rectangles in source pixels (several rectangles in one
block are merged), plus an animation kind: "wipe" (titles, written left→right),
"rise" (body lines), "pop" (numbers / badges). `erase` rectangles are inpainted
but not re-shown (e.g. the carousel's "1/8" page counter).
"""
import json
import os
import sys

import cv2
import numpy as np

PAD = 12
TEXT_LUMA = 175
MARK_SEARCH = 90
MARK_TOUCH = 14


def union(rects):
    x0 = min(r[0] for r in rects)
    y0 = min(r[1] for r in rects)
    x1 = max(r[0] + r[2] for r in rects)
    y1 = max(r[1] + r[3] for r in rects)
    return [x0, y0, x1 - x0, y1 - y0]


def clip_rect(rect, width, height, grow=0):
    x, y, w, h = rect
    x0, y0 = max(0, x - grow), max(0, y - grow)
    x1, y1 = min(width, x + w + grow), min(height, y + h + grow)
    return x0, y0, x1, y1


def marker_pixels(hsv):
    """Pastel decoration colours used for highlighter/underline strokes."""
    h, s, v = hsv[..., 0].astype(int), hsv[..., 1].astype(int), hsv[..., 2].astype(int)
    warm = (h >= 15) & (h <= 38) & (s >= 35) & (v >= 170)
    blue = (h >= 90) & (h <= 115) & (s >= 25) & (v >= 170)
    return (warm | blue).astype(np.uint8) * 255


def rects_touch(a, b):
    return not (a[2] <= b[0] or b[2] <= a[0] or a[3] <= b[1] or b[3] <= a[1])


def main():
    reel_dir = sys.argv[1]
    src_dir = os.path.join(reel_dir, "carousel")
    out_dir = os.path.join(reel_dir, "layers")
    os.makedirs(out_dir, exist_ok=True)
    for old in os.listdir(out_dir):
        if old.endswith(".png"):
            os.remove(os.path.join(out_dir, old))
    spec = json.load(open(os.path.join(src_dir, "spec.json")))
    slides_out = []

    for n, slide in enumerate(spec["slides"], start=1):
        image = cv2.imread(os.path.join(src_dir, slide["image"]))
        height, width = image.shape[:2]
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        marks_raw = marker_pixels(hsv)
        marks_all = cv2.morphologyEx(marks_raw, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))

        text_mask = np.zeros_like(gray)
        mark_mask = np.zeros_like(gray)
        claimed = np.zeros_like(gray)
        blocks = []
        for block in slide["blocks"]:
            rect = union(block["rects"])
            bt = np.zeros_like(gray)
            for r in block["rects"]:
                x0, y0, x1, y1 = clip_rect(r, width, height, 4)
                bt[y0:y1, x0:x1] = (gray[y0:y1, x0:x1] < TEXT_LUMA).astype(np.uint8) * 255

            # Highlighter / underline strokes: pastel components that touch this block
            # (thin outlines such as card borders are skipped by their fill ratio).
            bm = np.zeros_like(gray)
            sx0, sy0, sx1, sy1 = clip_rect(rect, width, height, MARK_SEARCH)
            touch = clip_rect(rect, width, height, MARK_TOUCH)
            region = marks_all[sy0:sy1, sx0:sx1] & ~claimed[sy0:sy1, sx0:sx1]
            count, labels, stats, _ = cv2.connectedComponentsWithStats(region)
            for c in range(1, count):
                x, y, w, h, area = stats[c]
                box = (sx0 + x, sy0 + y, sx0 + x + w, sy0 + y + h)
                if area < 250 or area / float(w * h) < 0.2 or not rects_touch(box, touch):
                    continue
                # Highlighters sit behind or just under the text; anything reaching
                # well above it (tablets, illustrations) is part of the picture.
                text_h = rect[3]
                if box[1] < rect[1] - 0.6 * text_h or box[3] > rect[1] + rect[3] + 0.8 * text_h + 15:
                    continue
                bm[sy0:sy1, sx0:sx1][labels == c] = 255
            # Pastel pixels inside the text box are always part of its decoration, and a
            # selected stroke takes its loose fragments (brush texture) with it.
            tx0, ty0, tx1, ty1 = clip_rect(rect, width, height, 6)
            inside = np.zeros_like(gray)
            inside[ty0:ty1, tx0:tx1] = marks_raw[ty0:ty1, tx0:tx1]
            bm |= inside
            if bm.any():
                near = cv2.dilate(bm, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (21, 21)))
                local = np.zeros_like(gray)
                local[sy0:sy1, sx0:sx1] = 255
                bm |= marks_raw & near & local
            bm &= ~bt & ~claimed
            claimed |= bm
            text_mask |= bt
            mark_mask |= bm
            blocks.append({**block, "rect": rect, "text": bt, "mark": bm})

        for r in slide.get("erase", []):
            x0, y0, x1, y1 = clip_rect(r, width, height)
            text_mask[y0:y1, x0:x1] |= (gray[y0:y1, x0:x1] < TEXT_LUMA).astype(np.uint8) * 255

        grow = lambda m, k: cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
        # Background behind the text only (highlights kept): used to pull the text out.
        under_text = cv2.inpaint(image, grow(text_mask, 7), 7, cv2.INPAINT_TELEA)
        cleaned = cv2.inpaint(image, grow(text_mask | mark_mask, 9), 9, cv2.INPAINT_TELEA)

        # Paper model: a smooth quadratic colour gradient fitted to pixels that are
        # clearly plain paper (bright, unsaturated). This is the empty background.
        lum = cv2.cvtColor(cleaned, cv2.COLOR_BGR2GRAY)
        sat = cv2.cvtColor(cleaned, cv2.COLOR_BGR2HSV)[..., 1]
        yy, xx = np.mgrid[0:height, 0:width].astype(np.float32)
        u, v = xx / width - 0.5, yy / height - 0.5
        basis = np.stack([np.ones_like(u), u, v, u * u, v * v, u * v], axis=-1)
        sample = (lum > 225) & (sat < 30)
        sample[::3, ::3] &= True
        idx = np.nonzero(sample[::4, ::4])
        A = basis[::4, ::4][idx]
        paper = np.zeros_like(cleaned, dtype=np.float32)
        for ch in range(3):
            coef, *_ = np.linalg.lstsq(A, cleaned[::4, ::4, ch][idx].astype(np.float32), rcond=None)
            paper[..., ch] = basis @ coef
        paper = np.clip(paper, 0, 255)

        # Everything that is not paper: off the paper colour, saturated or edged,
        # closed into shapes (small enclosed holes such as tablet faces are filled,
        # big ones such as the inside of a note frame stay paper).
        off = np.abs(cleaned.astype(np.float32) - paper).max(axis=2)
        edges = cv2.Canny(lum, 40, 110)
        fg = ((off > 22) | (sat > 40) | (edges > 0)).astype(np.uint8) * 255
        fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11)))
        contours, hierarchy = cv2.findContours(fg, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
        if hierarchy is not None:
            for c, info in zip(contours, hierarchy[0]):
                if info[3] >= 0 and cv2.contourArea(c) < 20000:
                    cv2.drawContours(fg, [c], -1, 255, -1)
        # Pale objects that barely differ from the paper (white tablets) can be
        # pinned with `decorRects`: inside them a much lower threshold is used.
        for r in slide.get("decorRects", []):
            x0, y0, x1, y1 = clip_rect(r, width, height)
            weak = ((off[y0:y1, x0:x1] > 7) | (edges[y0:y1, x0:x1] > 0)).astype(np.uint8) * 255
            weak = cv2.morphologyEx(weak, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))
            fg[y0:y1, x0:x1] |= weak
        fg &= ~(text_mask | mark_mask)

        # The footer (rule + clinic name) stays on every plate: its pieces are small
        # separate shapes that start below 92% of the height.
        static = np.zeros_like(gray)
        count, labels, stats, _ = cv2.connectedComponentsWithStats(fg)
        for c in range(1, count):
            if stats[c][1] > height * 0.92:
                static[labels == c] = 255
        fg &= ~static

        # Group the remaining elements and give each to the nearest text block.
        count, labels, stats, _ = cv2.connectedComponentsWithStats(grow(fg, 9))
        owner = {}
        for c in range(1, count):
            x, y, w, h, area = stats[c]
            comp = (labels == c) & (fg > 0)
            if area < 150:
                continue
            best, best_d = 0, 1e9
            for k, block in enumerate(blocks):
                bx, by, bw, bh = block["rect"]
                dx = max(bx - (x + w), x - (bx + bw), 0)
                dy = max(by - (y + h), y - (by + bh), 0)
                d = (dx * dx + dy * dy) ** 0.5
                if d < best_d:
                    best, best_d = k, d
            owner.setdefault(best, np.zeros_like(gray))
            owner[best][comp] = 255
        s_alpha = cv2.GaussianBlur(grow(static, 5).astype(np.float32) / 255, (0, 0), 1.5)[..., None]
        plate = (paper * (1 - s_alpha) + cleaned * s_alpha).astype(np.uint8)
        cv2.imwrite(os.path.join(out_dir, f"plate-{n}.png"), plate)
        under_text_marks = cleaned

        layers = []
        for k, block in enumerate(blocks, start=1):
            entry = {"anim": block.get("anim", "rise")}
            if block.get("count"):
                entry["count"] = block["count"]
            decor = owner.get(k - 1)
            if decor is not None and decor.any():
                ys, xs = np.nonzero(decor)
                dx0, dy0 = max(0, xs.min() - 6), max(0, ys.min() - 6)
                dx1, dy1 = min(width, xs.max() + 7), min(height, ys.max() + 7)
                d_alpha = cv2.GaussianBlur(grow(decor, 3)[dy0:dy1, dx0:dx1].astype(np.float32) / 255, (0, 0), 1.2)
                dname = f"{n}-{k}-decor.png"
                cv2.imwrite(os.path.join(out_dir, dname), np.dstack([under_text_marks[dy0:dy1, dx0:dx1], (d_alpha * 255).astype(np.uint8)]))
                entry["decor"] = {"src": dname, "x": int(dx0), "y": int(dy0), "w": int(dx1 - dx0), "h": int(dy1 - dy0)}
            # --- text layer: alpha from how much darker each pixel is than the
            # background behind it, colour from the solid core of the strokes.
            tm = grow(block["text"], 5)
            ys, xs = np.nonzero(tm)
            x0, y0 = max(0, xs.min() - PAD), max(0, ys.min() - PAD)
            x1, y1 = min(width, xs.max() + PAD), min(height, ys.max() + PAD)
            img = image[y0:y1, x0:x1].astype(np.float32)
            bg = under_text[y0:y1, x0:x1].astype(np.float32)
            luma = lambda a: a @ np.array([0.114, 0.587, 0.299], np.float32)
            core = (block["text"][y0:y1, x0:x1] > 0) & (luma(bg) - luma(img) > 90)
            color = image[y0:y1, x0:x1].copy()
            if core.any():
                color = cv2.inpaint(color, (~core).astype(np.uint8) * 255, 3, cv2.INPAINT_TELEA)
            depth = np.maximum(luma(bg) - luma(color.astype(np.float32)), 25)
            alpha = np.clip((luma(bg) - luma(img)) / depth, 0, 1) * (tm[y0:y1, x0:x1] > 0)
            name = f"{n}-{k}.png"
            cv2.imwrite(os.path.join(out_dir, name), np.dstack([color, (alpha * 255).astype(np.uint8)]))
            entry.update({"src": name, "x": int(x0), "y": int(y0), "w": int(x1 - x0), "h": int(y1 - y0)})

            # --- highlighter layer (if this block has one)
            if block["mark"].any():
                ys, xs = np.nonzero(block["mark"])
                mx0, my0 = max(0, xs.min() - 4), max(0, ys.min() - 4)
                mx1, my1 = min(width, xs.max() + 5), min(height, ys.max() + 5)
                # Fill the gaps the text left inside the stroke, then soften the edge.
                full = cv2.morphologyEx(block["mark"] | (block["text"] & grow(block["mark"], 25)), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
                m_alpha = cv2.GaussianBlur(full[my0:my1, mx0:mx1].astype(np.float32) / 255, (0, 0), 1.2)
                m_color = under_text[my0:my1, mx0:mx1]
                mname = f"{n}-{k}-mark.png"
                cv2.imwrite(os.path.join(out_dir, mname), np.dstack([m_color, (m_alpha * 255).astype(np.uint8)]))
                entry["mark"] = {"src": mname, "x": int(mx0), "y": int(my0), "w": int(mx1 - mx0), "h": int(my1 - my0)}
            layers.append(entry)
        slides_out.append({"plate": f"plate-{n}.png", "seconds": slide["seconds"], "layers": layers})

    json.dump({"width": width, "height": height, "background": spec.get("background", "#FEFAF1"), "slides": slides_out}, open(os.path.join(out_dir, "layers.json"), "w"), indent=2)
    print(f"{len(slides_out)} slides -> {out_dir}")


if __name__ == "__main__":
    main()
