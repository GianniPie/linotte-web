#!/usr/bin/env python3
"""Generates the Ice background pictures: background.svg (sky + mountains), range.svg (the mountains and the ice alone, laid
over the aurora) and aurora.svg (tall curtains of rays). Seeded, so the output is always the same: change the numbers here,
not in the pictures.   Run:  python3 make-ice.py   (writes next to the script; --out DIR writes somewhere else)"""
import math, random, os, sys

OUT = os.path.dirname(os.path.abspath(__file__))
if "--out" in sys.argv:
    OUT = sys.argv[sys.argv.index("--out") + 1]
BASE = 1100  # below the picture, so the faces run off the bottom


def hex2rgb(h):
    h = h.lstrip("#")
    return [int(h[i:i + 2], 16) for i in (0, 2, 4)]


def mix(a, b, t):
    ca, cb = hex2rgb(a), hex2rgb(b)
    return "#%02x%02x%02x" % tuple(max(0, min(255, round(ca[i] + (cb[i] - ca[i]) * t))) for i in range(3))


def f(v):
    s = ("%.1f" % v).rstrip("0").rstrip(".")
    return s if s != "-0" else "0"


def pts(points):
    return " ".join(f(x) + "," + f(y) for x, y in points)


def lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def range_svg(ridge, seed, lit, lit2, shade, shade2, snow_lit, snow_shade, rim, cap, haze, haze_a):
    """One range of mountains as low-poly faces: every peak has a lit side (toward the low sun on the left) and a
    shadow side, each split in two, a jagged snow cap and a bright rim along the lit ridge."""
    rnd = random.Random(seed)
    out = []
    n = len(ridge)
    vb = [random.Random(seed * 100 + k).uniform(-40, 40) for k in range(n)]  # where each valley's line meets the bottom
    peaks = [i for i in range(1, n - 1) if ridge[i][1] < ridge[i - 1][1] and ridge[i][1] < ridge[i + 1][1]]
    for i in peaks:
        P, L, R = ridge[i], ridge[i - 1], ridge[i + 1]
        spine_x = P[0] + rnd.uniform(-8, 26)
        S = (spine_x, BASE)
        # lit side: upper facet and lower facet
        M = (L[0] + (spine_x - L[0]) * rnd.uniform(.3, .5), L[1] + (BASE - L[1]) * rnd.uniform(.28, .4))
        j = rnd.uniform(-.05, .05)
        out.append('<polygon points="%s" fill="%s"/>' % (pts([P, L, (L[0] + vb[i - 1], BASE), S]), mix(lit2, "#ffffff", .12 + j)))
        out.append('<polygon points="%s" fill="%s"/>' % (pts([P, L, M]), mix(lit, "#ffffff", .1 + j)))
        # shadow side
        M2 = (R[0] - (R[0] - spine_x) * rnd.uniform(.3, .5), R[1] + (BASE - R[1]) * rnd.uniform(.25, .38))
        out.append('<polygon points="%s" fill="%s"/>' % (pts([P, R, (R[0] + vb[i + 1], BASE), S]), mix(shade2, "#000000", .06 + j)))
        out.append('<polygon points="%s" fill="%s"/>' % (pts([P, R, M2]), mix(shade, "#ffffff", .04 + j)))
        # a secondary arete down the lit face, for the angular look
        A = (P[0] - (P[0] - L[0]) * .42, P[1] + (L[1] - P[1]) * .42)
        out.append('<polygon points="%s" fill="%s" opacity=".55"/>' % (pts([A, (L[0] + (spine_x - L[0]) * .22, L[1] + (BASE - L[1]) * .5), (spine_x - 6, P[1] + (BASE - P[1]) * .45)]), mix(lit2, shade, .35)))
        # snow cap, jagged underneath
        h = (min(L[1], R[1]) - P[1]) * cap
        Lc, Rc = lerp(P, L, min(.9, h / max(1, abs(L[1] - P[1])) * 1.05)), lerp(P, R, min(.9, h / max(1, abs(R[1] - P[1])) * 1.05))
        mids_l = [(Lc[0] + (spine_x - Lc[0]) * k / 4 + rnd.uniform(-5, 5), Lc[1] + (h * .35 if k % 2 else -h * .1) + rnd.uniform(-h * .08, h * .12)) for k in range(1, 4)]
        Sp = (spine_x, P[1] + h * 1.05)
        mids_r = [(spine_x + (Rc[0] - spine_x) * k / 4 + rnd.uniform(-5, 5), Rc[1] + (h * .3 if k % 2 == 0 else -h * .05) + rnd.uniform(-h * .08, h * .12)) for k in range(1, 4)]
        out.append('<polygon points="%s" fill="%s"/>' % (pts([P, Lc] + mids_l + [Sp]), snow_lit))
        out.append('<polygon points="%s" fill="%s"/>' % (pts([P, Sp] + mids_r + [Rc]), snow_shade))
    # a bright rim along the lit side of every ridge
    rim_pts = []
    for i in range(n - 1):
        a, b = ridge[i], ridge[i + 1]
        if b[1] < a[1]:  # climbing toward a peak: this is the lit side
            rim_pts.append('M%s %s L%s %s' % (f(a[0]), f(a[1]), f(b[0]), f(b[1])))
    out.append('<path d="%s" fill="none" stroke="%s" stroke-width="1.6" stroke-linecap="round" opacity=".75"/>' % (" ".join(rim_pts), rim))
    # depth: the foot of the range fades into the haze
    sil = [(-60, BASE)] + ridge + [(1060, BASE)]
    out.append('<polygon points="%s" fill="url(#%s)"/>' % (pts(sil), haze))
    return "\n".join(out)


def ridge_of(points):
    return [(float(x), float(y)) for x, y in points]


# the middle range: taller and sharper; the one in front: broad and low
mid = ridge_of([(-80, 790), (-10, 726), (60, 776), (120, 700), (185, 770), (255, 718), (325, 790), (395, 668), (470, 776), (540, 724), (600, 792), (670, 690), (735, 780), (800, 722), (870, 794), (945, 684), (1010, 784), (1090, 736)])
near = ridge_of([(-80, 884), (40, 818), (175, 872), (305, 808), (440, 880), (570, 826), (700, 884), (830, 814), (965, 872), (1100, 832)])
DOWN_MID, DOWN_NEAR = 58, 62  # how far down they sit: under the board, between the dice and the buttons
mid = [(x, y + DOWN_MID) for x, y in mid]
near = [(x, y + DOWN_NEAR) for x, y in near]


def mountains():
    defs = '''
    <linearGradient id="hazeMid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e3f0fa" stop-opacity="0"/><stop offset=".3" stop-color="#e3f0fa" stop-opacity=".08"/><stop offset=".58" stop-color="#e9f4fc" stop-opacity=".65"/><stop offset="1" stop-color="#e9f4fc" stop-opacity="1"/></linearGradient>
    <linearGradient id="hazeNear" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0f8fe" stop-opacity="0"/><stop offset=".4" stop-color="#f0f8fe" stop-opacity=".05"/><stop offset=".62" stop-color="#eef7fd" stop-opacity=".55"/><stop offset="1" stop-color="#eef7fd" stop-opacity="1"/></linearGradient>
    <linearGradient id="mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4fbff" stop-opacity="0"/><stop offset=".5" stop-color="#f4fbff" stop-opacity=".78"/><stop offset="1" stop-color="#f4fbff" stop-opacity="0"/></linearGradient>
    <linearGradient id="ice" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f8fdff"/><stop offset=".5" stop-color="#dbeefa"/><stop offset="1" stop-color="#b9d9ef"/></linearGradient>
    <linearGradient id="shardL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#bfe3f7"/></linearGradient>
    <linearGradient id="shardR" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8ec3ea"/><stop offset="1" stop-color="#5f9fd6"/></linearGradient>'''
    body = []
    body.append(range_svg(mid, 23, "#d2e6f6", "#c4dcf1", "#97b4de", "#86a5d6", "#fbfdff", "#cddcf2", "#ffffff", .52, "hazeMid", 1))
    body.append(range_svg(near, 37, "#e4f3fb", "#d3eaf6", "#9bbfe0", "#8ab0d8", "#ffffff", "#d6e8f6", "#ffffff", .36, "hazeNear", 1))
    # the ice in front: a plateau with crevasses and a few shards of ice
    body.append('<path d="M-60 972 C90 958 230 970 380 966 C540 962 690 952 830 962 C920 968 1000 960 1070 966 L1070 1100 L-60 1100 Z" fill="url(#ice)"/>')
    body.append('<path d="M-60 988 C120 980 300 990 470 987 C650 984 800 976 1070 986 L1070 1100 L-60 1100 Z" fill="#cfe5f5" opacity=".7"/>')
    cre = []
    for (x0, x1, y1) in [(150, 60, 1000), (300, 250, 1000), (430, 430, 1000), (560, 610, 1000), (700, 790, 1000), (830, 960, 1000)]:
        cre.append('M%s %s L%s %s' % (f(x0), f(978), f(x1), f(y1)))
    body.append('<path d="%s" fill="none" stroke="#8fbde0" stroke-width="1.5" stroke-linecap="round" opacity=".6"/>' % " ".join(cre))
    shards = []
    rnd = random.Random(5)
    for cx, h, w in [(268, 78, 15), (292, 54, 11), (246, 40, 9), (726, 86, 16), (752, 52, 10), (704, 38, 9), (120, 60, 13), (880, 64, 13), (-10, 70, 14), (1010, 68, 14)]:
        top = (cx + rnd.uniform(-3, 3), 1000 - h)
        shards.append('<polygon points="%s" fill="url(#shardL)"/>' % pts([top, (cx - w, 1004), (cx + 1, 1004)]))
        shards.append('<polygon points="%s" fill="url(#shardR)"/>' % pts([top, (cx + 1, 1004), (cx + w, 1004)]))
    body.append("\n".join(shards))
    return defs, "\n".join(body)


def sky():
    rnd = random.Random(3)
    stars = []
    for _ in range(90):
        x, y = rnd.uniform(0, 1000), rnd.uniform(0, 420) ** 1.0
        r = rnd.choice([.7, .9, 1.1, 1.4, 1.8])
        a = max(.12, .9 - y / 520 + rnd.uniform(-.2, .2))
        stars.append('<circle cx="%s" cy="%s" r="%s" fill="#fff" opacity="%.2f"/>' % (f(x), f(y), r, a))
    for _ in range(9):
        x, y = rnd.uniform(40, 960), rnd.uniform(10, 300)
        s = rnd.uniform(5, 9)
        stars.append('<path d="M%s %s L%s %s L%s %s L%s %s L%s %s L%s %s L%s %s L%s %s Z" fill="#fff" opacity=".85"/>' % (
            f(x), f(y - s), f(x + s * .18), f(y - s * .18), f(x + s), f(y), f(x + s * .18), f(y + s * .18), f(x), f(y + s), f(x - s * .18), f(y + s * .18), f(x - s), f(y), f(x - s * .18), f(y - s * .18)))
    defs = '''
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2f78c6"/>
      <stop offset=".3" stop-color="#4d9fdc"/>
      <stop offset=".54" stop-color="#8ec9f0"/>
      <stop offset=".7" stop-color="#cfeaf8"/>
      <stop offset=".82" stop-color="#f0f9fd"/>
      <stop offset="1" stop-color="#f0f9fd"/>
    </linearGradient>
    <radialGradient id="sun" cx=".2" cy=".72" r=".34">
      <stop offset="0" stop-color="#fff3d2" stop-opacity=".95"/>
      <stop offset=".3" stop-color="#ffe2bd" stop-opacity=".5"/>
      <stop offset="1" stop-color="#ffe2bd" stop-opacity="0"/>
    </radialGradient>'''
    body = '<rect width="1000" height="1000" fill="url(#sky)"/>\n<rect width="1000" height="1000" fill="url(#sun)"/>\n' + "\n".join(stars)
    return defs, body


def write_pictures():
    mdefs, mbody = mountains()
    sdefs, sbody = sky()
    head = '<?xml version="1.0" encoding="UTF-8"?>\n'
    open(os.path.join(OUT, "background.svg"), "w").write(
        head + "<!-- Ice background, the still part: a deep polar sky with stars, a low sun, two ranges of faceted icy mountains (a lit and a shadow side to every peak, snow caps, mist between the ranges) and the ice in front. The aurora, the snow and the glints are drawn apart and moved by the GPU (aurora.svg, range.svg, flake.svg, glint.svg and background.css, in this folder). Generated by make-ice.py: change the script, not the numbers. -->\n"
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" width="100%" height="100%">\n<defs>' + sdefs + mdefs + "\n</defs>\n" + sbody + "\n" + mbody + "\n</svg>\n")
    open(os.path.join(OUT, "range.svg"), "w").write(
        head + "<!-- Ice background, the mountains and the ice alone: the same drawing as in background.svg, laid on top of the aurora (.fx-range in background.css) so the aurora rises from behind the peaks. Generated by make-ice.py. -->\n"
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" width="100%" height="100%">\n<defs>' + mdefs + "\n</defs>\n" + mbody + "\n</svg>\n")


def write_aurora():
    """Tall curtains: many thin vertical rays, bright at the foot (the horizon) and fading up, in three colours; and curtains
    that hang from the top of the sky (they show in the band above the board)."""
    rnd = random.Random(8)
    W, H = 1400, 1000
    defs = []
    for name, c in (("a1", "#46ffb4"), ("a2", "#3cd6f7"), ("a3", "#a384ff")):
        defs.append('<linearGradient id="%s" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="%s" stop-opacity="0"/><stop offset=".1" stop-color="%s" stop-opacity="1"/><stop offset=".45" stop-color="%s" stop-opacity=".7"/><stop offset="1" stop-color="%s" stop-opacity="0"/></linearGradient>' % (name, c, c, c, c))
    defs.append('<radialGradient id="foot" cx=".5" cy="1" r=".6"><stop offset="0" stop-color="#7dffd0" stop-opacity=".55"/><stop offset="1" stop-color="#7dffd0" stop-opacity="0"/></radialGradient>')
    body = ['<ellipse cx="700" cy="%d" rx="760" ry="150" fill="url(#foot)"/>' % (H - 190)]
    curtains = [("a3", 790, 0.55, 520, 9, 14), ("a2", 830, 0.8, 440, 7, 12), ("a1", 870, 1.0, 340, 6, 10)]
    for grad, foot, op, hmax, step, wid in curtains:
        phase = rnd.uniform(0, 6)
        x = -20
        while x < W + 20:
            wave = math.sin(x / 180 + phase) * 34 + math.sin(x / 71 + phase * 2) * 12
            fy = foot + wave
            h = hmax * (0.45 + 0.55 * (0.5 + 0.5 * math.sin(x / 130 + phase * 1.7))) * rnd.uniform(.72, 1.08)
            a = min(1, op * rnd.uniform(.55, 1.15))
            w = wid * rnd.uniform(.7, 1.3)
            body.append('<rect x="%d" y="%d" width="%d" height="%d" fill="url(#%s)" opacity="%.2f"/>' % (x, fy - h, round(w), h + 40, grad, a))
            x += step * 1.25 * rnd.uniform(.8, 1.25)
    for name, c in (("h1", "#52ffc0"), ("h2", "#4fb8ff"), ("h3", "#b48cff")):
        defs.append('<linearGradient id="%s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="%s" stop-opacity=".95"/><stop offset=".45" stop-color="%s" stop-opacity=".5"/><stop offset="1" stop-color="%s" stop-opacity="0"/></linearGradient>' % (name, c, c, c))
    for grad, top, op, hmax, step, wid in (("h3", 6, .8, 210, 10, 14), ("h2", 0, .85, 170, 8, 11), ("h1", -6, .9, 120, 7, 9)):
        phase = rnd.uniform(0, 6)
        x = -20
        while x < W + 20:
            wave = math.sin(x / 150 + phase) * 22 + math.sin(x / 63 + phase * 2) * 8
            h = hmax * (0.45 + 0.55 * (0.5 + 0.5 * math.sin(x / 110 + phase * 1.3))) * rnd.uniform(.7, 1.1)
            body.append('<rect x="%d" y="%d" width="%d" height="%d" fill="url(#%s)" opacity="%.2f"/>' % (x, top + wave - 30, round(wid * rnd.uniform(.7, 1.3)), h + 30, grad, min(1, op * rnd.uniform(.5, 1.1))))
            x += step * 1.25 * rnd.uniform(.8, 1.25)
    svg = ('<?xml version="1.0" encoding="UTF-8"?>\n<!-- The aurora of the ice background, still: tall curtains of thin rays, green, cyan and violet, bright at the horizon and fading up. CSS drifts it and lets it swell (.fx-aurora in background.css). Generated by make-ice.py. -->\n'
           '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" preserveAspectRatio="none">\n<defs>%s</defs>\n%s\n</svg>\n' % (W, H, "".join(defs), "\n".join(body)))
    open(os.path.join(OUT, "aurora.svg"), "w").write(svg)


write_pictures()
write_aurora()
