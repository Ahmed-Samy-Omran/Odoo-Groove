"""Generates the Odoo Groove tool/popup icons with Pillow.

Design space is 128x128. The monkey stands inside a dark rounded tile with a
soft green glow and one raised hand (the brand gesture). Drawn at a high
resolution then downsampled for antialiasing.

Usage: python3 scripts/make_icons.py
"""

import os

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "src", "assets", "icons")

FUR = (90, 69, 53, 255)
FUR_LIGHT = (122, 92, 69, 255)
FUR_DEEP = (60, 45, 34, 255)
SKIN = (231, 185, 142, 255)
NOSE = (168, 120, 84, 255)
EYE = (33, 24, 18, 255)
WHITE = (255, 255, 255, 255)
GLOW = (139, 216, 62, 30)
TILE = (21, 26, 31, 255)
TILE_RING = (86, 108, 124, 160)

SS = 8  # supersample factor


def draw_monkey(size):
    img = Image.new("RGBA", (size * SS, size * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    s = size * SS / 128.0

    def P(x, y):
        return (x * s, y * s)

    def R(x, y, rx, ry):
        x0, y0 = P(x - rx, y - ry)
        x1, y1 = P(x + rx, y + ry)
        return [x0, y0, x1, y1]

    def round_line(a, b, color, width):
        d.line([P(*a), P(*b)], fill=color, width=width)
        r = width / 2.0
        for pt in (a, b):
            d.ellipse(R(pt[0], pt[1], r, r), fill=color)

    # Soft glow behind the monkey.
    d.ellipse(R(64, 54, 66, 62), fill=GLOW)

    # Dark tile + thin premium ring.
    d.rounded_rectangle(P(6, 6) + P(122, 122), radius=30 * s, fill=TILE)
    d.rounded_rectangle(P(9, 9) + P(119, 119), radius=27 * s, outline=TILE_RING, width=round(2 * s))

    # Tail.
    round_line((56, 104), (69, 110), FUR, 8)
    round_line((69, 110), (82, 107), FUR, 8)
    round_line((82, 107), (88, 98), FUR, 7)

    # Torso + belly.
    d.ellipse(R(64, 96, 21, 15), fill=FUR)
    d.ellipse(R(64, 99, 12, 8), fill=FUR_LIGHT)

    # Left arm hanging down.
    round_line((50, 82), (42, 112), FUR, 9)
    d.ellipse(R(41, 114, 6.5, 6.5), fill=SKIN)

    # Right arm raised (brand gesture).
    round_line((78, 84), (104, 48), FUR, 9)
    d.ellipse(R(106, 45, 7, 7), fill=SKIN)

    # Ears.
    d.ellipse(R(33, 44, 11, 11), fill=FUR)
    d.ellipse(R(95, 44, 11, 11), fill=FUR)
    d.ellipse(R(33, 44, 5.5, 5.5), fill=SKIN)
    d.ellipse(R(95, 44, 5.5, 5.5), fill=SKIN)

    # Head + face.
    d.ellipse(R(64, 48, 28, 28), fill=FUR)
    d.ellipse(R(64, 54, 19, 16), fill=SKIN)

    # Brows.
    d.line([P(49, 45), P(55, 43)], fill=FUR_DEEP, width=round(3 * s))
    d.line([P(73, 43), P(79, 45)], fill=FUR_DEEP, width=round(3 * s))

    # Eyes + highlights.
    d.ellipse(R(55, 50, 4.6, 4.6), fill=EYE)
    d.ellipse(R(73, 50, 4.6, 4.6), fill=EYE)
    d.ellipse(R(53.8, 48.6, 1.8, 1.8), fill=WHITE)
    d.ellipse(R(71.8, 48.6, 1.8, 1.8), fill=WHITE)

    # Nose + smile.
    d.ellipse(R(64, 59, 3, 2), fill=NOSE)
    d.arc(R(59, 62, 69, 68), start=15, end=165, fill=FUR_DEEP, width=round(2.6 * s))

    # Feet.
    d.ellipse(R(52, 116, 7, 4.5), fill=FUR)
    d.ellipse(R(76, 116, 7, 4.5), fill=FUR)

    img = img.resize((size, size), Image.LANCZOS)
    return img


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for size in (16, 32, 48, 128):
        out = os.path.join(OUT_DIR, f"icon{size}.png")
        draw_monkey(size).save(out)
        print("wrote", out)


if __name__ == "__main__":
    main()