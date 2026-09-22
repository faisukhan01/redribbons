"""Red Ribbons logo processing v2: remove background (incl. enclosed counters),
trim, split mark/wordmark, extract brand colors."""
from PIL import Image
import numpy as np
from scipy import ndimage as ndi

SRC = '/home/z/my-project/upload/pasted_image_1789989303119.png'
OUT_FULL = '/home/z/my-project/public/logo.png'
OUT_MARK = '/home/z/my-project/public/logo-mark.png'
OUT_FAV = '/home/z/my-project/public/favicon.png'

img = Image.open(SRC).convert('RGB')
arr = np.array(img).astype(np.float64)
h, w = arr.shape[:2]

corner_px = np.concatenate([
    arr[:10, :10].reshape(-1, 3), arr[:10, -10:].reshape(-1, 3),
    arr[-10:, :10].reshape(-1, 3), arr[-10:, -10:].reshape(-1, 3),
])
bg = np.median(corner_px, axis=0)
dist = np.sqrt(((arr - bg) ** 2).sum(axis=2))

# --- 1) Border-connected background ---
bg_candidate = dist < 55
labels, n = ndi.label(bg_candidate)
border_labels = set(labels[0, :]) | set(labels[-1, :]) | set(labels[:, 0]) | set(labels[:, -1])
border_labels.discard(0)
fill_mask = np.isin(labels, list(border_labels)) if border_labels else np.zeros((h, w), bool)
print('border bg removed:', int(fill_mask.sum()))

# --- 2) Enclosed PURE background regions (letter counters) ---
# tight threshold so ribbon sheen is never touched
enclosed_candidate = (dist < 22) & ~fill_mask
labels2, n2 = ndi.label(enclosed_candidate)
if n2:
    lab_ids = np.arange(1, n2 + 1)
    sizes = ndi.sum(np.ones_like(labels2), labels2, lab_ids)
    medians = ndi.median(dist, labels2, lab_ids)
    for lid, size, med in zip(lab_ids, sizes, medians):
        if size > 600 and med < 8:
            fill_mask |= labels2 == lid
print('total bg removed:', int(fill_mask.sum()))

# --- 3) Alpha with soft edges ---
eroded = ndi.binary_erosion(fill_mask, iterations=1)
edge_ring = ndi.binary_dilation(fill_mask, iterations=2) & ~eroded
soft = np.clip((dist - 18.0) / 60.0, 0, 1)
alpha = np.where(fill_mask, 0, 255).astype(np.float64)
alpha = np.where(edge_ring, soft * 255.0, alpha)

# --- 4) Decontaminate partial (anti-aliased) pixels ---
a01 = alpha / 255.0
safe_a = np.maximum(a01, 1e-3)[:, :, None]
unmixed = np.clip((arr - (1 - safe_a) * bg[None, None, :]) / safe_a, 0, 255)
partial = (a01 > 0.02) & (a01 < 0.98)
out_rgb = np.where(partial[:, :, None], unmixed, arr)
rgba = np.dstack([out_rgb, alpha]).astype(np.uint8)

# --- 5) Trim ---
ys, xs = np.where(alpha > 8)
pad = 8
y0, y1 = max(0, ys.min() - pad), min(h, ys.max() + pad)
x0, x1 = max(0, xs.min() - pad), min(w, xs.max() + pad)
full = Image.fromarray(rgba[y0:y1, x0:x1])
full.save(OUT_FULL)
print('saved', OUT_FULL, full.size)

# --- 6) Split mark (monogram) from wordmark: find last blank gap >= 20 rows ---
sub_alpha = rgba[y0:y1, x0:x1, 3]
rows = (sub_alpha > 8).sum(axis=1)
blank = rows < 3
cut = None
content_idx = np.where(~blank)[0]
if len(content_idx):
    i = int(content_idx[-1])  # last content row (bottom of wordmark)
    while i >= 0 and not blank[i]:  # skip wordmark band
        i -= 1
    b = i
    while i >= 0 and blank[i]:  # walk up through the blank gap
        i -= 1
    if i >= 0 and (b - i) >= 20 and (i + 1) > len(rows) * 0.5:
        cut = i + 1  # everything above the gap = monogram
if cut:
    mark = full.crop((0, 0, full.size[0], cut))
else:
    mark = full
m = np.array(mark)
ys2, xs2 = np.where(m[:, :, 3] > 8)
mark = mark.crop((max(0, xs2.min() - 4), max(0, ys2.min() - 4),
                  min(m.shape[1], xs2.max() + 4), min(m.shape[0], ys2.max() + 4)))
mark.save(OUT_MARK)
print('saved', OUT_MARK, mark.size)

# --- 7) Favicon ---
fav_size = 256
ratio = fav_size / max(mark.size)
fav = mark.resize((max(1, int(mark.size[0] * ratio)), max(1, int(mark.size[1] * ratio))), Image.LANCZOS)
canvas = Image.new('RGBA', (fav_size, fav_size), (0, 0, 0, 0))
canvas.paste(fav, ((fav_size - fav.size[0]) // 2, (fav_size - fav.size[1]) // 2), fav)
canvas.save(OUT_FAV)
print('saved', OUT_FAV)


def hexc(c):
    return '#%02X%02X%02X' % tuple(int(round(v)) for v in c)


# --- 8) Brand colors ---
op = rgba[rgba[:, :, 3] > 240][:, :3].astype(np.float64)
red_mask = (op[:, 0] - op[:, 1] > 60) & (op[:, 0] - op[:, 2] > 60) & (op[:, 0] > 90) & (op[:, 0] < 235)
reds = op[red_mask]
primary = np.median(reds, axis=0)
dark_reds = reds[reds[:, 0] < np.percentile(reds[:, 0], 22)]
dark = np.median(dark_reds, axis=0) if len(dark_reds) else primary * 0.78
print('primary red:', hexc(primary), '| samples:', len(reds))
print('dark red:', hexc(dark))
print('cream bg:', hexc(bg))
# wordmark color (bottom band)
band = rgba[y0:y1, x0:x1]
wm = band[-int((y1 - y0) * 0.10):]
wmpx = wm[wm[:, :, 3] > 220][:, :3].astype(np.float64)
if len(wmpx):
    print('wordmark color:', hexc(np.median(wmpx, axis=0)))
