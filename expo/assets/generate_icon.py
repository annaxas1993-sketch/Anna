from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

OUT = Path(__file__).parent
SIZE = 1024
FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-BoldOblique.ttf"
font = ImageFont.truetype(FONT_PATH, 760)

# Build the LD monogram directly so the launcher icon and adaptive icon
# always use the requested red/white mark on a pure black background.
canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 255))
draw = ImageDraw.Draw(canvas)
red = (235, 25, 38, 255)
white = (255, 255, 255, 255)

# Draw both glyphs as one compact, centered lockup.
draw.text((38, 82), "L", font=font, fill=red, stroke_width=0)
draw.text((425, 82), "D", font=font, fill=white, stroke_width=0)

# Crop to the combined mark, then fit it with comfortable launcher padding.
alpha = canvas.getchannel("A")
bbox = draw.textbbox((38, 82), "L", font=font)
bbox_d = draw.textbbox((425, 82), "D", font=font)
left = min(bbox[0], bbox_d[0]); top = min(bbox[1], bbox_d[1])
right = max(bbox[2], bbox_d[2]); bottom = max(bbox[3], bbox_d[3])
mark = canvas.crop((left, top, right, bottom))
mark.thumbnail((900, 660), Image.Resampling.LANCZOS)

icon = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 255))
icon.alpha_composite(mark, ((SIZE-mark.width)//2, (SIZE-mark.height)//2))
icon.convert("RGB").save(OUT / "icon.png", optimize=True)

# Adaptive foreground is transparent outside the centered LD mark.
foreground = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
foreground.alpha_composite(mark, ((SIZE-mark.width)//2, (SIZE-mark.height)//2))
foreground.save(OUT / "adaptive-foreground.png", optimize=True)
print("Generated TAXI LIDER LD logo: red L, white D, black background")
