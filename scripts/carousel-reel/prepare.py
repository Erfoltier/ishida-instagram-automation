"""
Turns finished carousel images (text already designed into the picture) into
layers for remotion/CarouselReel.tsx, so the reel keeps the exact fonts/colours
of the carousel while the text animates:

  * plate-N.png   : the slide with the animated text removed (OpenCV inpaint)
  * N-K.png       : each text block cut from the ORIGINAL slide with a feathered
                    alpha edge, revealed on top of the plate in the video
  * layers.json   : positions + animation per block, read by the composition

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

PAD = 10
FEATHER = 9


def union(rects):
    xs = [r[0] for r in rects]
    ys = [r[1] for r in rects]
    x2 = [r[0] + r[2] for r in rects]
    y2 = [r[1] + r[3] for r in rects]
    return [min(xs), min(ys), max(x2) - min(xs), max(y2) - min(ys)]


def text_mask(gray, rect, threshold):
    x, y, w, h = rect
    mask = np.zeros_like(gray)
    region = gray[y : y + h, x : x + w]
    mask[y : y + h, x : x + w] = (region < threshold).astype(np.uint8) * 255
    return mask


def main():
    reel_dir = sys.argv[1]
    src_dir = os.path.join(reel_dir, "carousel")
    out_dir = os.path.join(reel_dir, "layers")
    os.makedirs(out_dir, exist_ok=True)
    spec = json.load(open(os.path.join(src_dir, "spec.json")))
    slides_out = []
    for n, slide in enumerate(spec["slides"], start=1):
        image = cv2.imread(os.path.join(src_dir, slide["image"]))
        height, width = image.shape[:2]
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        threshold = slide.get("threshold", 175)

        mask = np.zeros_like(gray)
        blocks = []
        for block in slide["blocks"]:
            rect = union(block["rects"])
            x, y, w, h = rect
            x0, y0 = max(0, x - PAD), max(0, y - PAD)
            x1, y1 = min(width, x + w + PAD), min(height, y + h + PAD)
            for r in block["rects"]:
                mask |= text_mask(gray, [max(0, r[0] - 4), max(0, r[1] - 4), r[2] + 8, r[3] + 8], threshold)
            blocks.append({**block, "box": [x0, y0, x1 - x0, y1 - y0]})
        for r in slide.get("erase", []):
            mask |= text_mask(gray, r, threshold)

        # Grow the mask over anti-aliased stroke edges, then inpaint.
        mask = cv2.dilate(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
        plate = cv2.inpaint(image, mask, 7, cv2.INPAINT_TELEA)
        plate_name = f"plate-{n}.png"
        cv2.imwrite(os.path.join(out_dir, plate_name), plate)

        layers = []
        for k, block in enumerate(blocks, start=1):
            x, y, w, h = block["box"]
            crop = image[y : y + h, x : x + w]
            alpha = np.zeros((h, w), np.float32)
            alpha[FEATHER : h - FEATHER, FEATHER : w - FEATHER] = 1
            alpha = cv2.GaussianBlur(alpha, (0, 0), FEATHER / 2.5)
            rgba = np.dstack([crop, (alpha * 255).astype(np.uint8)])
            name = f"{n}-{k}.png"
            cv2.imwrite(os.path.join(out_dir, name), rgba)
            layers.append({"src": name, "x": x, "y": y, "w": w, "h": h, "anim": block.get("anim", "rise"), "at": block.get("at")})
        slides_out.append({"plate": plate_name, "seconds": slide["seconds"], "layers": layers})

    json.dump({"width": width, "height": height, "background": spec.get("background", "#FEFAF1"), "slides": slides_out}, open(os.path.join(out_dir, "layers.json"), "w"), indent=2)
    print(f"{len(slides_out)} slides -> {out_dir}")


if __name__ == "__main__":
    main()
