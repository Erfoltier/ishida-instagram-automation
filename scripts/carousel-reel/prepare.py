"""
Turns finished carousel images (text already designed into the picture) into
layers for remotion/CarouselReel.tsx, so the reel keeps the exact fonts/colours
of the carousel while the text animates. Each slide is split into:

  * plate-N.png    : the slide with the animated text AND its highlighter /
                     underline strokes removed (OpenCV inpaint)
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
        # Clean plate: text and highlights both removed.
        plate = cv2.inpaint(image, grow(text_mask | mark_mask, 9), 9, cv2.INPAINT_TELEA)
        cv2.imwrite(os.path.join(out_dir, f"plate-{n}.png"), plate)

        layers = []
        for k, block in enumerate(blocks, start=1):
            entry = {"anim": block.get("anim", "rise")}
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
