"""Generate font-independent SVG path data for the qintar wordmark.

Pulls Geist SemiBold glyph outlines, shapes them with HarfBuzz (so kerning matches
the browser-rendered original), scales to a 48px em with CSS letter-spacing
-0.02em, flips Y for SVG, and emits a single combined `d` attribute.
"""

import os
import re
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

FONT_PATH = os.path.join(os.path.dirname(__file__), ".geist-semibold.ttf")
FONT_SIZE = 48.0
LETTER_SPACING_EM = -0.02
BASELINE_Y = 48.0
X_OFFSET = 0.0

tt = TTFont(FONT_PATH)
upem = tt["head"].unitsPerEm
scale = FONT_SIZE / upem
letter_spacing_units = LETTER_SPACING_EM * upem  # in font units
glyph_set = tt.getGlyphSet()

with open(FONT_PATH, "rb") as fh:
    face = hb.Face(fh.read())
buf = hb.Buffer()
font = hb.Font(face)


def shape(text):
    b = hb.Buffer()
    b.add_str(text)
    b.guess_segment_properties()
    hb.shape(font, b, {"kern": True, "liga": True})
    infos = b.glyph_infos
    positions = b.glyph_positions
    return list(zip(infos, positions))


def gid_to_name(gid):
    return tt.getGlyphName(gid)


def render(text, x_offset, baseline_y):
    """Return SVG path d-string covering all glyphs in *text*."""
    pen = SVGPathPen(glyph_set)
    x_pen = 0  # in font units
    for info, pos in shape(text):
        name = gid_to_name(info.codepoint)
        glyph = glyph_set[name]
        # transform: scale, flip Y, translate
        # SVG y = baseline - glyph_y * scale ; SVG x = x_offset + (x_pen + glyph_x + xOffset) * scale
        gx = x_pen + pos.x_offset
        # affine: a, b, c, d, e, f -> x' = a*x + c*y + e ; y' = b*x + d*y + f
        a = scale
        d = -scale
        e = x_offset + gx * scale
        f = baseline_y + pos.y_offset * scale
        tp = TransformPen(pen, (a, 0, 0, d, e, f))
        glyph.draw(tp)
        x_pen += pos.x_advance + letter_spacing_units
    return pen.getCommands()


def round_path(d, decimals=2):
    """Round all numeric values in the SVG path string."""
    def _r(m):
        v = float(m.group(0))
        if abs(v) < 0.005:
            return "0"
        return f"{round(v, decimals):g}"
    return re.sub(r"-?\d+\.\d+", _r, d)


# Wordmark "qintar" -- baseline aligned to original y=48 in 240x64 viewBox
wordmark_d = round_path(render("qintar", X_OFFSET, BASELINE_Y))

# Favicon glyph "q" at x=12, y=50 in 64x64 viewBox
favicon_d = round_path(render("q", 12.0, 50.0))

print("==WORDMARK_D==")
print(wordmark_d)
print("==FAVICON_D==")
print(favicon_d)

# Also print the right edge of 'qi' so we can sanity-check the dot position
def width_of(prefix, total):
    x = 0
    for info, pos in shape(total):
        if shape(prefix) and info.codepoint == shape(prefix)[0][0].codepoint:
            pass
    # simpler: shape prefix and total separately, advance
    x_prefix = 0
    for _, pos in shape(prefix):
        x_prefix += pos.x_advance + letter_spacing_units
    return x_prefix * scale


print("==WIDTH q==", width_of("q", "qintar"))
print("==WIDTH qi==", width_of("qi", "qintar"))
print("==WIDTH qin==", width_of("qin", "qintar"))
print("==WIDTH qintar==", width_of("qintar", "qintar"))
