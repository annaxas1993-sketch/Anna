from PIL import Image, ImageDraw, ImageChops
from pathlib import Path

OUT = Path(__file__).parent
SOURCE = OUT / "lider-logo-source.webp"
SIZE = 1024

# Use the supplied high-resolution TAXI LIDER emblem, removing the white
# canvas outside the circular badge so Android can mask it cleanly.
im = Image.open(SOURCE).convert("RGB")
pix = im.load()
w, h = im.size
points = []
for y in range(h):
    for x in range(w):
        r, g, b = pix[x, y]
        if min(r, g, b) < 238:
            points.append((x, y))
if not points:
    raise RuntimeError("Logo source is blank")
left = min(p[0] for p in points); top = min(p[1] for p in points)
right = max(p[0] for p in points) + 1; bottom = max(p[1] for p in points) + 1
side = max(right-left, bottom-top)
cx = (left+right)//2; cy = (top+bottom)//2
half = side//2
im = im.crop((max(0,cx-half), max(0,cy-half), min(w,cx+half), min(h,cy+half)))
badge = im.resize((SIZE, SIZE), Image.Resampling.LANCZOS).convert("RGBA")

def circular(source):
    mask = Image.new("L", source.size, 0)
    d = ImageDraw.Draw(mask)
    margin = int(source.size[0] * 0.008)
    d.ellipse((margin, margin, source.size[0]-margin, source.size[1]-margin), fill=255)
    source.putalpha(mask)
    return source

# Standard launcher icon: full emblem on a deep-blue square.
icon = circular(badge.copy())
bg = Image.new("RGBA", (SIZE, SIZE), (5, 24, 54, 255))
bg.alpha_composite(icon)
bg.convert("RGB").save(OUT / "icon.png", optimize=True)

# Adaptive foreground: keep the entire circular badge inside Android's safe zone.
fg = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
small = circular(badge.copy().resize((700, 700), Image.Resampling.LANCZOS))
fg.alpha_composite(small, ((SIZE-700)//2, (SIZE-700)//2))
fg.save(OUT / "adaptive-foreground.png", optimize=True)
print("Generated icon.png and adaptive-foreground.png from the new TAXI LIDER logo")
