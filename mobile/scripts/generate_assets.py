#!/usr/bin/env python3
"""
generate_assets.py — Generate Verity app icon and splash screen assets.

Outputs:
  assets/icon.png                  1024x1024  App Store icon
  assets/splash.png                1284x2778  iOS splash (iPhone 14 Pro Max)
  assets/android-icon-foreground.png  1024x1024  Android adaptive icon foreground
  assets/favicon.png               48x48      Web favicon
"""

import os
from PIL import Image, ImageDraw

ASSETS = os.path.join(os.path.dirname(__file__), '..', 'assets')
GREEN = '#00843D'
WHITE = '#FFFFFF'


def hex_to_rgb(h: str) -> tuple:
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))


def draw_v(draw: ImageDraw.Draw, cx: float, cy: float, size: float, colour: str, width: float):
    """Draw a bold V lettermark centred at (cx, cy) with given size."""
    # V has two diagonal strokes meeting at the bottom centre
    half_w = size * 0.42
    top_y = cy - size * 0.38
    bottom_y = cy + size * 0.38
    mid_x_l = cx - half_w
    mid_x_r = cx + half_w

    cap = 'round'
    draw.line([(mid_x_l, top_y), (cx, bottom_y)], fill=colour, width=int(width), joint=cap)
    draw.line([(mid_x_r, top_y), (cx, bottom_y)], fill=colour, width=int(width), joint=cap)


def make_icon(size: int, bg: str, fg: str, v_scale=0.55) -> Image.Image:
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Rounded square background (radius ~22%)
    radius = int(size * 0.22)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=bg)

    # Bold V
    v_size = size * v_scale
    stroke = max(int(size * 0.085), 4)
    draw_v(draw, size / 2, size / 2, v_size, fg, stroke)

    return img


def make_splash(width: int, height: int) -> Image.Image:
    img = Image.new('RGB', (width, height), WHITE)
    draw = ImageDraw.Draw(img)

    # Centred green circle with V
    circle_r = int(min(width, height) * 0.14)
    cx, cy = width // 2, height // 2
    draw.ellipse(
        [cx - circle_r, cy - circle_r, cx + circle_r, cy + circle_r],
        fill=GREEN,
    )
    v_size = circle_r * 1.1
    stroke = max(int(circle_r * 0.16), 4)
    draw_v(draw, cx, cy, v_size, WHITE, stroke)

    return img


def main():
    os.makedirs(ASSETS, exist_ok=True)

    # App icon (1024x1024, RGBA)
    icon = make_icon(1024, GREEN, WHITE)
    icon.save(os.path.join(ASSETS, 'icon.png'))
    print('icon.png — 1024x1024')

    # Android foreground (1024x1024, transparent bg, green V)
    fg = make_icon(1024, '#00000000', GREEN, v_scale=0.5)
    fg_white_bg = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    fg_white_bg.paste(fg, (0, 0), fg)
    # Save as RGB with transparent = white for compatibility
    android_fg = Image.new('RGBA', (1024, 1024), (255, 255, 255, 0))
    android_fg.paste(make_icon(1024, (0, 0, 0, 0), WHITE, v_scale=0.5), (0, 0))
    android_fg.save(os.path.join(ASSETS, 'android-icon-foreground.png'))
    print('android-icon-foreground.png — 1024x1024')

    # Splash (1284x2778)
    splash = make_splash(1284, 2778)
    splash.save(os.path.join(ASSETS, 'splash.png'))
    print('splash.png — 1284x2778')

    # Favicon (48x48)
    favicon = make_icon(48, GREEN, WHITE, v_scale=0.6)
    favicon_rgb = Image.new('RGBA', (48, 48), (0, 0, 0, 0))
    favicon_rgb.paste(favicon, (0, 0), favicon)
    favicon_rgb.save(os.path.join(ASSETS, 'favicon.png'))
    print('favicon.png — 48x48')

    print('\nAll assets generated.')


if __name__ == '__main__':
    main()
