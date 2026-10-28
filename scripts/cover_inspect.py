#!/usr/bin/env python3
"""Inspect candidate cover images without changing them.
usage: cover_inspect.py FILE [FILE ...]  -> prints a JSON list: path, sha256, width, height, aspect, shape, dhash (64-bit hex), flags.
shape: portrait (0.50-0.80 w/h, a front cover), square (0.90-1.10, an audiobook cover), wide (>1.10, a full-wrap or banner), other.
flags: small (<600 px on the short side), unreadable."""
import hashlib, json, sys
from PIL import Image, ImageOps
out = []
for p in sys.argv[1:]:
    rec = {"path": p}
    try:
        rec["sha256"] = hashlib.sha256(open(p, "rb").read()).hexdigest()
        im = ImageOps.exif_transpose(Image.open(p)); im.load()
        w, h = im.size
        g = im.convert("L").resize((9, 8), Image.LANCZOS)
        px = list(g.getdata()); bits = 0
        for r in range(8):
            for c in range(8):
                bits = (bits << 1) | (1 if px[r * 9 + c] > px[r * 9 + c + 1] else 0)
        a = w / h
        rec.update({"width": w, "height": h, "aspect": round(a, 3), "dhash": f"{bits:016x}",
                    "shape": "portrait" if 0.50 <= a <= 0.80 else "square" if 0.90 <= a <= 1.10 else "wide" if a > 1.10 else "other",
                    "flags": (["small"] if min(w, h) < 600 else [])})
    except Exception as e:
        rec.update({"error": str(e), "flags": ["unreadable"]})
    out.append(rec)
print(json.dumps(out))
