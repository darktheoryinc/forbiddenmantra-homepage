#!/usr/bin/env python3
"""Cut the FRONT panel out of KDP "author cover files" (full-wrap print covers), ready for scripts/covers-bulk.mjs.

  python3 scripts/cover_wrap_front.py IN_DIR OUT_DIR [--trim 6x9] [--bleed 0.125] [--map trims.csv]

IN_DIR holds the files KDP gave you (PDF, PNG or JPEG), each NAMED BY THE EDITION'S ASIN (B0XXXXXXXX.pdf).
OUT_DIR receives <ASIN>.png (the front cover) and a contact sheet, contact-sheet.png, to check by eye.
A KDP wrap is back | spine | front with the bleed on every outer edge, so the front is the right-hand `trim width`
(minus the right bleed) and the full height minus top and bottom bleed. The spine width is not needed, only the trim size.
--trim is the default trim in inches (width x height); trims.csv rows `file,trim` (e.g. B0ABC12345,5.5x8.5) override it per file.
Nothing is guessed silently: each file's pixel size, trim, implied spine width and crop box are printed; check the contact sheet.
"""
import csv, os, subprocess, sys, tempfile
from PIL import Image
Image.MAX_IMAGE_PIXELS = None

def arg(n, d=None):
    return sys.argv[sys.argv.index(n) + 1] if n in sys.argv else d

def load(path):
    if path.lower().endswith('.pdf'):
        with tempfile.TemporaryDirectory() as t:
            subprocess.run(['pdftoppm', '-r', '300', '-f', '1', '-l', '1', '-png', path, os.path.join(t, 'p')], check=True)
            f = sorted(os.listdir(t))[0]
            im = Image.open(os.path.join(t, f)); im.load(); return im.convert('RGB')
    return Image.open(path).convert('RGB')

def front(im, tw, th, bleed):
    W, H = im.size
    ppi = H / (th + 2 * bleed)                       # pixels per inch from the height
    spine = W / ppi - 2 * tw - 2 * bleed
    x1 = W - bleed * ppi; x0 = x1 - tw * ppi; y0 = bleed * ppi; y1 = H - bleed * ppi
    return im.crop((round(x0), round(y0), round(x1), round(y1))), spine, ppi

def main():
    if len(sys.argv) < 3: print(__doc__); return 2
    src, out = sys.argv[1], sys.argv[2]
    trim = arg('--trim', '6x9'); bleed = float(arg('--bleed', '0.125'))
    per = {}
    if arg('--map'):
        for r in csv.reader(open(arg('--map'))):
            if len(r) >= 2: per[os.path.splitext(r[0])[0]] = r[1]
    os.makedirs(out, exist_ok=True); thumbs = []
    for f in sorted(os.listdir(src)):
        if not f.lower().endswith(('.pdf', '.png', '.jpg', '.jpeg', '.tif', '.tiff')): continue
        asin = os.path.splitext(f)[0]; t = per.get(asin, trim); tw, th = (float(x) for x in t.lower().split('x'))
        try: im = load(os.path.join(src, f))
        except Exception as e: print(f'{f}: cannot read ({e})'); continue
        W, H = im.size
        if W / H < 1.2: print(f'{f}: {W}x{H} is not a wide wrap; if this is already a front cover, copy it as is'); continue
        fr, spine, ppi = front(im, tw, th, bleed)
        flag = '' if 0.03 <= spine <= 1.7 else '  <-- implied spine out of range: wrong trim size?'
        print(f'{f}: {W}x{H}px, trim {t} in, implied spine {spine:.3f} in, front {fr.width}x{fr.height}px{flag}')
        fr.save(os.path.join(out, asin + '.png')); thumbs.append((asin, fr.copy()))
    if thumbs:
        h = 300; ims = [(a, i.resize((int(i.width * h / i.height), h))) for a, i in thumbs]
        cols = 8; rows = (len(ims) + cols - 1) // cols; cw = max(i.width for _, i in ims) + 8
        sheet = Image.new('RGB', (cols * cw, rows * (h + 8)), 'white')
        for k, (a, i) in enumerate(ims): sheet.paste(i, ((k % cols) * cw, (k // cols) * (h + 8)))
        sheet.save(os.path.join(out, 'contact-sheet.png'))
    return 0

if __name__ == '__main__': sys.exit(main())
