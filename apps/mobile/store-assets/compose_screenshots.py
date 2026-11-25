"""Turn raw simulator captures into App Store and Google Play screenshots.

    python compose_screenshots.py raw/   (raw/01.png ... raw/06.png, iPhone captures)

Each output: dark background, gold accent, headline + subline on top, the capture
below with rounded corners. iPhone only (ios.supportsTablet is false). Sizes (Nov 2026):

  App Store iPhone 6.9"  1320x2868   (required)
  App Store iPhone 6.5"  1284x2778
  Google Play phone      1080x1920
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).parent
FONT = HERE.parent / "assets" / "fonts" / "hankengrotesk.ttf"

CAPTIONS = [
    ("Every reference.\nLive prices.", "Sell and buy offers from dealers worldwide"),
    ("Your watchlist,\nalways current", "Follow references and see the market move"),
    ("The full order book", "Lowest ask, highest bid and every offer"),
    ("Price history", "See where a reference is heading"),
    ("Check before you buy", "Serial numbers, dealer numbers, bracelets"),
    ("Trade with dealers", "Post what you sell or want to buy"),
]

SIZES = {
    "app-store/iphone-6.9": (1320, 2868),
    "app-store/iphone-6.5": (1284, 2778),
    "google-play/phone": (1080, 1920),
}


def font(size, weight):
    f = ImageFont.truetype(str(FONT), size)
    try:
        f.set_variation_by_axes([weight])
    except Exception:
        pass
    return f


def rounded(img, radius):
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, *img.size], radius, fill=255)
    out = img.copy()
    out.putalpha(mask)
    return out


def compose(capture: Image.Image, title: str, sub: str, size):
    W, H = size
    bg = Image.new("RGB", size, (26, 26, 26))
    d = ImageDraw.Draw(bg)
    for y in range(H):
        c = int(30 - 10 * y / H)
        d.line([(0, y), (W, y)], fill=(c, c, c))
    unit = min(W, H * 0.46)
    t_font, s_font = font(int(unit * 0.085), 700), font(int(unit * 0.04), 400)
    top = int(H * 0.05)
    d.multiline_text((W // 2, top), title, font=t_font, fill="white", anchor="ma", align="center",
                     spacing=int(unit * 0.015))
    tb = d.multiline_textbbox((W // 2, top), title, font=t_font, anchor="ma", align="center",
                              spacing=int(unit * 0.015))
    y = tb[3] + int(unit * 0.035)
    d.rectangle([W // 2 - int(unit * 0.05), y, W // 2 + int(unit * 0.05), y + max(4, int(unit * 0.006))],
                fill=(212, 175, 55))
    y += int(unit * 0.04)
    d.text((W // 2, y), sub, font=s_font, fill=(190, 190, 190), anchor="ma")
    y += int(unit * 0.09)

    avail_h = H - y - int(H * 0.035)
    scale = min(avail_h / capture.height, (W * 0.82) / capture.width)
    shot = capture.resize((int(capture.width * scale), int(capture.height * scale)), Image.LANCZOS)
    shot = rounded(shot.convert("RGBA"), int(shot.width * 0.09))
    frame = Image.new("RGBA", (shot.width + 16, shot.height + 16), (0, 0, 0, 0))
    ImageDraw.Draw(frame).rounded_rectangle([0, 0, *frame.size], int(shot.width * 0.095), fill=(70, 70, 70, 255))
    frame.alpha_composite(shot, (8, 8))
    bg.paste(frame, ((W - frame.width) // 2, y), frame)
    return bg.convert("RGB")


def main(raw_dir: str):
    raws = sorted(Path(raw_dir).glob("*.png"))
    if not raws:
        sys.exit(f"no PNG captures in {raw_dir}")
    for name, size in SIZES.items():
        out = HERE / name
        out.mkdir(parents=True, exist_ok=True)
        for i, raw in enumerate(raws):
            title, sub = CAPTIONS[i % len(CAPTIONS)]
            compose(Image.open(raw).convert("RGB"), title, sub, size).save(out / f"{i + 1:02d}.png")
        print(f"{name}: {len(raws)} screenshot(s) at {size[0]}x{size[1]}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else str(HERE / "raw"))
