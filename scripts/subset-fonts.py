"""
Збирає шрифти сайту src/app/fonts/*.woff2 з оригіналів Google Fonts.

Лишає лише потрібні символи й товщини: 84 КБ у двох файлах замість 124 КБ
у пʼяти, що тягнулись з Google. Перезібрати, якщо в заголовках зʼявився символ,
якого немає в UNBOUNDED (він тоді покажеться запасним шрифтом).

  python3 -m venv /tmp/ft && /tmp/ft/bin/pip install fonttools brotli
  curl -L -o Unbounded.ttf "https://raw.githubusercontent.com/google/fonts/main/ofl/unbounded/Unbounded%5Bwght%5D.ttf"
  curl -L -o Manrope.ttf "https://raw.githubusercontent.com/google/fonts/main/ofl/manrope/Manrope%5Bwght%5D.ttf"
  /tmp/ft/bin/python scripts/subset-fonts.py Unbounded.ttf Manrope.ttf
"""

import io
import sys

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

# Заголовки пишемо ми — лише символи, що є в коді сайту
UNBOUNDED = (
    "U+0020-007E,U+00A0,U+00A9,U+00AB,U+00B1,U+00B7,U+00BB,U+00D7,U+02BC,U+0301,"
    "U+2010-2014,U+2018-201E,U+2026,U+202F,U+2032-2033,U+20B4,U+2116,U+2190-2193,U+2212,"
    "U+0400-045F,U+0490-0491"
)

# Основним шрифтом показуємо й тексти клієнтів: уся кирилиця, латиниця з наголосами
MANROPE = (
    "U+0020-007E,U+00A0-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,"
    "U+0300-0301,U+0304,U+0308,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2010-2027,"
    "U+2030-203A,U+2116,U+20B4,U+2122,U+2190-2193,U+2212"
)


def unicodes(spec: str) -> set[int]:
    out: set[int] = set()
    for part in spec.split(","):
        a, _, b = part.replace("U+", "").partition("-")
        out.update(range(int(a, 16), int(b or a, 16) + 1))
    return out


def build(src: str, dst: str, spec: str, weights: tuple[int, int]) -> None:
    font = TTFont(src)
    opts = subset.Options()
    opts.layout_features = ["kern", "liga", "calt", "ccmp", "locl", "mark", "mkmk", "case", "tnum", "lnum", "pnum"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=unicodes(spec))
    sub.subset(font)

    # Спершу символи, потім товщини: навпаки fontTools падає на змінному шрифті
    buf = io.BytesIO()
    font.save(buf)
    buf.seek(0)
    font = instancer.instantiateVariableFont(TTFont(buf), {"wght": weights})
    font.flavor = "woff2"
    font.save(dst)


if __name__ == "__main__":
    unbounded, manrope = sys.argv[1:3]
    build(unbounded, "src/app/fonts/unbounded.woff2", UNBOUNDED, (300, 700))
    build(manrope, "src/app/fonts/manrope.woff2", MANROPE, (400, 700))
