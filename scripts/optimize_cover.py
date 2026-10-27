#!/usr/bin/env python3
"""Optimise one cover image for the web: strips all metadata, never upscales, keeps the aspect ratio, writes 240 px and 480 px wide WebP.
usage: optimize_cover.py INPUT OUTPUT_PREFIX    -> writes OUTPUT_PREFIX-240.webp and OUTPUT_PREFIX-480.webp and prints JSON with the sizes.
Rejects (exit 2): unreadable files, images narrower than 240 px, or a shape that is not a book/audiobook cover (aspect w/h outside 0.50-1.10)."""
import json, sys
from PIL import Image, ImageOps
src, prefix = sys.argv[1], sys.argv[2]
try:
    im = Image.open(src); im.load()
except Exception as e:
    print(json.dumps({"error": f"unreadable image: {e}"})); sys.exit(2)
im = ImageOps.exif_transpose(im)
if im.mode in ("RGBA", "LA", "P"):
    bg = Image.new("RGB", im.size, (255, 255, 255)); im = im.convert("RGBA"); bg.paste(im, mask=im.split()[-1]); im = bg
else:
    im = im.convert("RGB")
w, h = im.size
if w < 240: print(json.dumps({"error": f"too small ({w}x{h}); need at least 240 px wide"})); sys.exit(2)
if not (0.50 <= w / h <= 1.10): print(json.dumps({"error": f"shape {w}x{h} is not a book cover (aspect {w/h:.2f})"})); sys.exit(2)
out = {"original": [w, h]}
for tw in (240, 480):
    if tw > w and tw != 240: tw = w  # never upscale
    th = round(h * tw / w)
    r = im.resize((tw, th), Image.LANCZOS)
    path = f"{prefix}-{240 if tw <= 240 else 480}.webp"
    r.save(path, "WEBP", quality=82, method=6)  # no exif/icc/xmp is passed, so none is written
    out[str(240 if tw <= 240 else 480)] = {"w": tw, "h": th}
    if tw == w: break
print(json.dumps(out))
