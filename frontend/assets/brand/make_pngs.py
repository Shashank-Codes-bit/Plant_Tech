"""Renders the Hara Hisaab app images from the mark's shapes (the same ones as icon.svg / mark-*.svg here).

    python frontend/assets/brand/make_pngs.py      # needs Pillow (in backend/requirements.txt)

Writes assets/images/{icon,adaptive-icon,adaptive-icon-monochrome,splash-image,favicon}.png and
assets/brand/play-store-icon-512.png. Drawn 4x larger, then shrunk, for smooth edges.
"""
from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
IMAGES = HERE.parent / "images"

GREEN = (0x1B, 0x5E, 0x3B, 255)
LIME = (0x9B, 0xDB, 0x8F, 255)
WHITE = (255, 255, 255, 255)
SS = 4  # supersampling


def cubic(p0, p1, p2, p3, n=96):
    pts = []
    for i in range(n + 1):
        t = i / n
        a, b, c, d = (1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t * t, t ** 3
        pts.append((a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]))
    return pts


# The mark in its 120 x 120 design grid (see mark-on-dark.svg).
STEM = [(60, 50), (60, 31)]
LEAF_LEFT = cubic((60, 35), (49, 35), (41, 29), (39, 18)) + cubic((39, 18), (50, 18), (58, 24), (60, 35))[1:]
LEAF_RIGHT = cubic((60, 31), (62, 19), (72, 12), (85, 12)) + cubic((85, 12), (83, 24), (73, 31), (60, 31))[1:]
RUPEE = [
    [(36, 50), (84, 50)],
    [(36, 64), (84, 64)],
    cubic((50, 50), (77, 50), (77, 78), (50, 78)) + [(40, 78), (75, 106)],
]
CENTER = (60, 59)  # middle of the mark's bounding box


def stroke(d: ImageDraw.ImageDraw, pts, width, color):
    """A stroke with round caps and joins: thick segments plus a dot at every point."""
    d.line(pts, fill=color, width=max(1, round(width)))
    r = width / 2
    for x, y in pts:
        d.ellipse([x - r, y - r, x + r, y + r], fill=color)


def render(px: int, *, scale: float, background=None, rounded=False, leaf=LIME, rupee=WHITE) -> Image.Image:
    """`scale` = how big the mark is in the square (0.8 = as in the app icon)."""
    s = px * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if background:
        if rounded:
            d.rounded_rectangle([0, 0, s - 1, s - 1], radius=s * 28 / 120, fill=background)
        else:
            d.rectangle([0, 0, s - 1, s - 1], fill=background)
    k = s / 120 * scale

    def at(points):
        return [((x - CENTER[0]) * k + s / 2, (y - CENTER[1]) * k + s / 2) for x, y in points]

    stroke(d, at(STEM), 6 * k, leaf)
    d.polygon(at(LEAF_LEFT), fill=leaf)
    d.polygon(at(LEAF_RIGHT), fill=leaf)
    for part in RUPEE:
        stroke(d, at(part), 9 * k, rupee)
    return img.resize((px, px), Image.LANCZOS)


def main():
    # iOS / older Android icon: square, no transparency (the phone rounds the corners).
    render(1024, scale=0.8, background=GREEN).convert("RGB").save(IMAGES / "icon.png", optimize=True)
    # Android adaptive icon: the mark alone inside the safe circle; app.json gives the green background.
    render(1024, scale=0.68).save(IMAGES / "adaptive-icon.png", optimize=True)
    # Android 13+ "themed icons": one colour, the phone tints it.
    render(1024, scale=0.68, leaf=WHITE, rupee=WHITE).save(IMAGES / "adaptive-icon-monochrome.png", optimize=True)
    # Opening screen: the mark on the green background set in app.json.
    render(1024, scale=1.12).save(IMAGES / "splash-image.png", optimize=True)
    # Browser tab.
    render(48, scale=0.8, background=GREEN, rounded=True).save(IMAGES / "favicon.png", optimize=True)
    # Play Store listing (512 x 512, Google rounds it).
    render(512, scale=0.8, background=GREEN).save(HERE / "play-store-icon-512.png", optimize=True)
    for f in ("icon", "adaptive-icon", "adaptive-icon-monochrome", "splash-image", "favicon"):
        print("wrote", IMAGES / f"{f}.png")
    print("wrote", HERE / "play-store-icon-512.png")


if __name__ == "__main__":
    main()
