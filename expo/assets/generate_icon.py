from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

OUT = Path(__file__).parent
S = 1024
NAVY = (8, 19, 33, 255)
TEAL = (32, 214, 160, 255)
GOLD = (255, 193, 66, 255)
WHITE = (245, 249, 252, 255)

def font(size):
    for path in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
                 "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf"):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            pass
    return ImageFont.load_default()

def draw_mark(draw, ox=0, oy=0, scale=1.0):
    def p(v): return int(v * scale)
    # Stylized taxi roof sign
    draw.rounded_rectangle((ox+p(385), oy+p(205), ox+p(639), oy+p(300)),
                           radius=p(25), fill=GOLD)
    draw.rounded_rectangle((ox+p(414), oy+p(224), ox+p(610), oy+p(282)),
                           radius=p(13), fill=NAVY)
    draw.text((ox+p(512), oy+p(253)), "TAXI", font=font(p(43)),
              fill=GOLD, anchor="mm")
    # Car body and cabin
    draw.rounded_rectangle((ox+p(180), oy+p(390), ox+p(844), oy+p(650)),
                           radius=p(105), fill=GOLD)
    draw.polygon([(ox+p(300),oy+p(405)),(ox+p(385),oy+p(300)),
                  (ox+p(655),oy+p(300)),(ox+p(745),oy+p(405))], fill=GOLD)
    draw.polygon([(ox+p(395),oy+p(385)),(ox+p(435),oy+p(324)),
                  (ox+p(605),oy+p(324)),(ox+p(655),oy+p(385))], fill=NAVY)
    # Front grille and lamps
    draw.rounded_rectangle((ox+p(390),oy+p(525),ox+p(634),oy+p(585)),
                           radius=p(22), fill=NAVY)
    draw.rounded_rectangle((ox+p(215),oy+p(475),ox+p(300),oy+p(525)),
                           radius=p(18), fill=WHITE)
    draw.rounded_rectangle((ox+p(724),oy+p(475),ox+p(809),oy+p(525)),
                           radius=p(18), fill=WHITE)
    # Wheels
    for x in (310, 710):
        draw.ellipse((ox+p(x-73),oy+p(590),ox+p(x+73),oy+p(736)), fill=NAVY)
        draw.ellipse((ox+p(x-34),oy+p(629),ox+p(x+34),oy+p(697)), fill=TEAL)
    # Small road accent
    draw.rounded_rectangle((ox+p(250),oy+p(790),ox+p(774),oy+p(815)),
                           radius=p(12), fill=TEAL)

# Transparent adaptive foreground; Android supplies its own background.
fg = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(fg)
draw_mark(d)
d.text((512, 895), "LIDER", font=font(104), fill=WHITE, anchor="mm",
       stroke_width=1, stroke_fill=NAVY)
fg.save(OUT / "adaptive-foreground.png", optimize=True)

# Full square launcher icon for platforms using the legacy icon field.
icon = Image.new("RGBA", (S, S), NAVY)
d = ImageDraw.Draw(icon)
# Subtle inset border and corner-safe brand composition.
d.rounded_rectangle((28, 28, 996, 996), radius=210,
                    outline=(32, 214, 160, 115), width=12)
draw_mark(d, scale=0.88, ox=61, oy=25)
d.text((512, 850), "TAXI LIDER", font=font(86), fill=WHITE, anchor="mm")
icon.convert("RGB").save(OUT / "icon.png", optimize=True)
print("Generated icon.png and adaptive-foreground.png")
