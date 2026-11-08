"""
BF6-MC 前端素材生成器（完整版）

产出可直接丢进 FancyMenu 的 PNG：

  fancymenu/assets/
    background.png        主菜单背景 1920x1080
    lobby_bg.png          大厅/结算背景
    logo.png              BF6 字标
    btn_single.png        单人战役按钮
    btn_multi.png         多人对战按钮
    btn_settings.png      设置
    btn_quit.png          退出
    scanline.png          扫描线叠加
    card_info.png         主菜单「作战情报」卡 664x480
    card_mode_conquest.png   征服卡 760x420
    card_mode_br.png         大逃杀卡 760x420
    card_map_<id>.png        地图卡 420x300 x4
    map_<id>_tactical.png    战术俯视图 1760x300 x4
    hud_topbar.png        局内顶条 1920x76
    hud_class.png         兵种卡 400x150
    hud_ammo.png          弹药卡 360x140
    hud_sidebar.png       侧栏底 290x320
    hud_br_panel.png      大逃杀面板 320x180
    result_header.png     结算头部 1000x220

  fancymenu/mockups/      六屏合成效果图（给人看的）

运行： python scripts/gen_all.py
"""

import os
import random
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
ASSETS = os.path.join(ROOT, 'fancymenu', 'assets')
MOCKUPS = os.path.join(ROOT, 'fancymenu', 'mockups')
os.makedirs(ASSETS, exist_ok=True)
os.makedirs(MOCKUPS, exist_ok=True)

# ------------------------------------------------------------------ 色板
BG_DARK = (10, 11, 13)
BG_MID = (18, 20, 24)
PANEL = (13, 14, 17)
ORANGE = (255, 106, 0)
ORANGE_HOT = (255, 168, 60)
CYAN = (60, 200, 220)
WHITE = (238, 240, 242)
GREY = (128, 132, 138)
DIM = (86, 90, 96)
RED = (214, 62, 52)
BLUE = (58, 132, 214)
SAND = (196, 150, 78)
SNOW = (150, 178, 196)
STEEL = (120, 140, 130)

# ------------------------------------------------------------------ 字体
F_CJK_BOLD = r'C:\Windows\Fonts\msyhbd.ttc'
F_CJK = r'C:\Windows\Fonts\msyh.ttc'
F_COND = r'C:\Windows\Fonts\impact.ttf'
F_UI = r'C:\Windows\Fonts\bahnschrift.ttf'
F_MONO = r'C:\Windows\Fonts\consolab.ttf'


def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()


def has_non_ascii(s):
    return any(ord(c) > 127 for c in s)


def pick_font(s, size, style='auto'):
    """
    西文走 Bahnschrift/Impact，任何非 ASCII 字符走微软雅黑。
    西文字体没有中文和几何符号字形，混排会出豆腐块。
    """
    if style == 'cond':
        return font(F_COND, size)
    if style == 'mono':
        return font(F_MONO, size)
    if style == 'ui':
        return font(F_UI, size) if not has_non_ascii(s) else font(F_CJK_BOLD, size)
    return font(F_CJK_BOLD if has_non_ascii(s) else F_UI, size)


def text(d, xy, s, size, fill, anchor=None, style='auto'):
    d.text(xy, s, font=pick_font(s, size, style), fill=fill, anchor=anchor)


def rule(d, x0, y, x1, color=(255, 255, 255, 30), w=1):
    d.line([(x0, y), (x1, y)], fill=color, width=w)


def triangle(d, x, y, size, color):
    d.polygon([(x, y - size), (x + size * 1.5, y), (x, y + size)], fill=color)


def panel(d, box, fill=(13, 14, 17, 215), border=(255, 255, 255, 26),
          accent=None, accent_w=6):
    x0, y0, x1, y1 = box
    d.rectangle([x0, y0, x1, y1], fill=fill)
    d.rectangle([x0, y0, x1, y1], outline=border, width=1)
    if accent:
        d.rectangle([x0, y0, x0 + accent_w, y1], fill=accent)


def new_rgba(w, h, color=(0, 0, 0, 0)):
    return Image.new('RGBA', (w, h), color)


def save(img, name, folder=ASSETS):
    path = os.path.join(folder, name)
    img.save(path, optimize=True)
    kb = os.path.getsize(path) / 1024
    print('  %-30s %4dx%-4d %7.1f KB' % (name, img.width, img.height, kb))
    return path


def grain(img, amount=6, step=2):
    """加胶片颗粒，让纯色区域不死板"""
    px = img.load()
    w, h = img.size
    for y in range(0, h, step):
        for x in range(0, w, step):
            n = random.randint(-amount, amount)
            r, g, b = px[x, y][:3]
            a = px[x, y][3] if img.mode == 'RGBA' else 255
            px[x, y] = (max(0, min(255, r + n)),
                        max(0, min(255, g + n)),
                        max(0, min(255, b + n)), a) if img.mode == 'RGBA' else \
                       (max(0, min(255, r + n)),
                        max(0, min(255, g + n)),
                        max(0, min(255, b + n)))
    return img


# ================================================================== 背景
def make_background():
    random.seed(20261108)
    W, H = 1920, 1080

    sky = Image.new('RGB', (W, H), (0, 0, 0))
    d = ImageDraw.Draw(sky)
    horizon_y = int(H * 0.74)

    for y in range(horizon_y):
        t = y / horizon_y
        if t < 0.55:
            k = t / 0.55
            c = tuple(int((6, 7, 9)[i] + ((18, 19, 22)[i] - (6, 7, 9)[i]) * k) for i in range(3))
        else:
            k = (t - 0.55) / 0.45
            c = tuple(int((18, 19, 22)[i] + ((22, 18, 16)[i] - (18, 19, 22)[i]) * k) for i in range(3))
        d.line([(0, y), (W, y)], fill=c)

    layers = [
        (int(H * 0.60), 50, 130, (13, 14, 16), 0.06, (70, 58, 34)),
        (int(H * 0.66), 80, 200, (17, 18, 21), 0.09, (92, 72, 40)),
        (int(H * 0.72), 120, 300, (22, 23, 27), 0.12, (120, 92, 46)),
        (int(H * 0.78), 160, 420, (30, 31, 36), 0.10, (150, 110, 52)),
    ]

    for base_y, hmin, hmax, col, lamp_p, lamp_c in layers:
        x = -80
        while x < W + 80:
            bw = random.randint(45, 150)
            bh = random.randint(hmin, hmax)
            top_y = base_y - bh
            d.rectangle([x, top_y, x + bw, base_y], fill=col)
            d.line([(x, top_y), (x + bw, top_y)],
                   fill=tuple(min(255, c + 12) for c in col))

            cols = max(1, bw // 14)
            rows = max(1, bh // 18)
            for cx in range(cols):
                for cy in range(rows):
                    if random.random() > lamp_p:
                        continue
                    wx = x + 6 + cx * 14
                    wy = top_y + 8 + cy * 18
                    if wx > x + bw - 5 or wy > base_y - 5:
                        continue
                    d.rectangle([wx, wy, wx + 3, wy + 5], fill=lamp_c)

            if random.random() < 0.18:
                ax = x + bw // 2
                d.line([(ax, top_y), (ax, top_y - random.randint(20, 70))], fill=col)
            x += bw + random.randint(3, 20)

    d.rectangle([0, horizon_y, W, H], fill=(8, 9, 11))

    # 橙色地平线辉光
    glow = Image.new('RGB', (W, H), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.rectangle([0, horizon_y - 4, W, horizon_y + 4], fill=(230, 96, 0))
    for i in range(160):
        y = horizon_y - i
        if y < 0:
            break
        a = (1 - i / 160) ** 2.2
        gd.line([(0, y), (W, y)], fill=(int(150 * a), int(58 * a), 0))
    for i in range(220):
        y = horizon_y + i
        if y >= H:
            break
        a = (1 - i / 220) ** 2.6
        gd.line([(0, y), (W, y)], fill=(int(110 * a), int(42 * a), 0))
    glow = glow.filter(ImageFilter.GaussianBlur(26))
    sky = ImageChops.add(sky, glow)

    # 冷色探照
    spot = Image.new('RGB', (W, H), (0, 0, 0))
    sd = ImageDraw.Draw(spot)
    cx, cy, cr = int(W * 0.72), int(H * 0.30), 340
    for r in range(cr, 0, -4):
        a = (1 - r / cr) ** 3
        sd.ellipse([cx - r, cy - r, cx + r, cy + r],
                   fill=(int(18 * a), int(26 * a), int(32 * a)))
    spot = spot.filter(ImageFilter.GaussianBlur(60))
    sky = ImageChops.add(sky, spot)

    # 左侧压暗
    vig = Image.new('L', (W, H), 0)
    vd = ImageDraw.Draw(vig)
    for x in range(W):
        t = x / W
        v = int(168 * (1 - t / 0.55) ** 1.5) if t < 0.55 else 0
        vd.line([(x, 0), (x, H)], fill=v)
    dark = Image.new('RGB', (W, H), (5, 6, 7))
    sky = Image.composite(dark, sky, vig)

    # 四角压暗
    edge = Image.new('L', (W, H), 0)
    ed = ImageDraw.Draw(edge)
    for i in range(200):
        a = int(90 * (1 - i / 200) ** 2)
        ed.rectangle([i, i, W - i, H - i], outline=a, width=1)
    dark2 = Image.new('RGB', (W, H), (3, 4, 5))
    sky = Image.composite(dark2, sky, edge)

    # 战术网格
    grid = new_rgba(W, H)
    gdd = ImageDraw.Draw(grid)
    step = 64
    for x in range(W // 2, W, step):
        gdd.line([(x, 0), (x, horizon_y)], fill=(120, 200, 220, 12))
    for y in range(0, horizon_y, step):
        gdd.line([(W // 2, y), (W, y)], fill=(120, 200, 220, 12))
    sky = Image.alpha_composite(sky.convert('RGBA'), grid).convert('RGB')

    grain(sky)
    save(sky, 'background.png')


def make_lobby_bg():
    W, H = 1920, 1080
    img = Image.new('RGB', (W, H), (0, 0, 0))
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        c = tuple(int((9, 10, 12)[i] + ((26, 20, 16)[i] - (9, 10, 12)[i]) * t) for i in range(3))
        d.line([(0, y), (W, y)], fill=c)

    # 极淡的网格，暗示战术桌面
    grid = new_rgba(W, H)
    gd = ImageDraw.Draw(grid)
    for x in range(0, W, 80):
        gd.line([(x, 0), (x, H)], fill=(120, 200, 220, 6))
    for y in range(0, H, 80):
        gd.line([(0, y), (W, y)], fill=(120, 200, 220, 6))
    img = Image.alpha_composite(img.convert('RGBA'), grid).convert('RGB')

    d = ImageDraw.Draw(img)
    d.rectangle([0, H - 10, W, H], fill=(120, 48, 0))
    grain(img, 4)
    save(img, 'lobby_bg.png')


# ================================================================== LOGO
def fit_font(text_str, path, max_w, start=260, min_size=40):
    probe = ImageDraw.Draw(Image.new('RGBA', (10, 10)))
    lo, hi, best = min_size, start, min_size
    while lo <= hi:
        mid = (lo + hi) // 2
        f = font(path, mid)
        bb = probe.textbbox((0, 0), text_str, font=f)
        if bb[2] - bb[0] <= max_w:
            best = mid
            lo = mid + 1
        else:
            hi = mid - 1
    return font(path, best)


def text_size(s, f):
    probe = ImageDraw.Draw(Image.new('L', (10, 10)))
    bb = probe.textbbox((0, 0), s, font=f)
    return bb[2] - bb[0], bb[3] - bb[1], bb


def make_logo():
    main = 'BATTLEFIELD'
    pad_x = 36
    f_big = fit_font(main, r'C:\Windows\Fonts\ariblk.ttf', 1080, start=240)
    tw, th, bb = text_size(main, f_big)

    f_six = font(F_COND, max(60, int(f_big.size * 0.62)))
    six_w, six_h, _ = text_size('6', f_six)
    f_mc = font(F_COND, max(26, int(f_big.size * 0.20)))
    mc_w, mc_h, _ = text_size('MC', f_mc)

    w = pad_x + tw + 22 + six_w + 26 + mc_w + pad_x
    h = 48 + th + 34 + six_h + 28
    img = new_rgba(w, h)

    top_y = 44
    ox, oy = pad_x - bb[0], top_y - bb[1]

    glow = new_rgba(w, h)
    ImageDraw.Draw(glow).text((ox, oy), main, font=f_big, fill=(*ORANGE, 255))
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(16)))

    shadow = new_rgba(w, h)
    ImageDraw.Draw(shadow).text((ox + 5, oy + 5), main, font=f_big, fill=(0, 0, 0, 180))
    img = Image.alpha_composite(img, shadow.filter(ImageFilter.GaussianBlur(4)))

    d = ImageDraw.Draw(img)
    d.text((ox, oy), main, font=f_big, fill=(*ORANGE, 255))

    hi = new_rgba(w, h)
    ImageDraw.Draw(hi).text((ox, oy - 2), main, font=f_big, fill=(*ORANGE_HOT, 76))
    img = Image.alpha_composite(img, hi)

    d = ImageDraw.Draw(img)
    line_y = top_y + th + 14
    d.rectangle([pad_x, line_y, pad_x + tw + 14, line_y + 4], fill=(*CYAN, 240))
    d.rectangle([pad_x + tw + 14 - 70, line_y, pad_x + tw + 14, line_y + 4],
                fill=(255, 255, 255, 240))

    six_x = pad_x + tw + 22
    six_y = line_y + 4 - six_h - 6
    d.text((six_x, six_y), '6', font=f_six, fill=(*WHITE, 242),
           stroke_width=max(2, f_six.size // 22), stroke_fill=(20, 21, 24, 255))

    mc_x = six_x + six_w + 26
    mc_y = six_y + (six_h - mc_h) // 2
    d.text((mc_x, mc_y), 'MC', font=f_mc, fill=(*GREY, 205))

    save(img, 'logo.png')


# ================================================================== 按钮
def make_button(name, label, sub, accent):
    w, h = 520, 92
    img = new_rgba(w, h)
    d = ImageDraw.Draw(img)

    d.rectangle([0, 0, w - 1, h - 1], fill=(13, 14, 17, 210))
    d.rectangle([0, 0, 7, h - 1], fill=(*accent, 255))

    fade = new_rgba(w, h)
    fd = ImageDraw.Draw(fade)
    for i in range(90):
        a = int(46 * (1 - i / 90))
        fd.rectangle([8 + i, 0, 8 + i, h - 1], fill=(*accent, a))
    img = Image.alpha_composite(img, fade)

    d = ImageDraw.Draw(img)
    d.line([(8, 0), (w - 1, 0)], fill=(255, 255, 255, 30))
    d.line([(8, h - 1), (w - 1, h - 1)], fill=(255, 255, 255, 14))

    f_label = pick_font(label, 38)
    probe = ImageDraw.Draw(new_rgba(10, 10))
    while f_label.size > 20:
        bb = probe.textbbox((0, 0), label, font=f_label)
        if bb[2] - bb[0] <= w - 100:
            break
        f_label = pick_font(label, f_label.size - 2)

    d.text((30, 10), label, font=f_label, fill=(*WHITE, 252))
    f_sub = pick_font(sub, 17)
    d.text((33, 60), sub, font=f_sub, fill=(*GREY, 235))

    triangle(d, w - 52, 46, 14, (*accent, 245))
    save(img, name)


# ================================================================== 卡片
def make_info_card():
    """主菜单右侧「作战情报」卡，预渲染成 PNG"""
    w, h = 664, 480
    img = new_rgba(w, h)
    d = ImageDraw.Draw(img)

    d.rectangle([0, 0, w - 1, h - 1], fill=(10, 11, 14, 190))
    d.rectangle([0, 0, w - 1, h - 1], outline=(255, 255, 255, 26), width=1)
    d.rectangle([0, 0, 6, h - 1], fill=(*ORANGE, 255))

    text(d, (40, 34), '作战情报', 30, (*WHITE, 255))
    rule(d, 40, 84, w - 40, (*DIM, 140))

    rows = [
        ('当前版本', 'v1.0 · 1.18.2 / Forge 40.2.21'),
        ('支持人数', '1 – 3 人 + AI 补位'),
        ('游戏模式', '征服 · 大逃杀'),
        ('可用地图', '4 张 · 2 张支持双模式'),
        ('语音', 'Simple Voice Chat · UDP 24454'),
    ]
    y = 112
    for k, v in rows:
        text(d, (40, y), k, 18, (*DIM, 255))
        text(d, (240, y), v, 18, (*WHITE, 240))
        y += 48

    rule(d, 40, y + 8, w - 40, (*DIM, 140))
    text(d, (40, y + 32), '按 F 进入全屏', 16, (*DIM, 220))
    text(d, (40, y + 62), '右键终端可在大厅选图', 16, (*DIM, 220))
    text(d, (40, y + 92), 'Esc 可随时打开暂停菜单', 16, (*DIM, 220))

    save(img, 'card_info.png')


def make_mode_card(name, title, sub, desc_lines, accent, meta):
    w, h = 760, 420
    img = new_rgba(w, h)
    d = ImageDraw.Draw(img)

    d.rectangle([0, 0, w - 1, h - 1], fill=(12, 13, 16, 226))
    d.rectangle([0, 0, w - 1, h - 1], outline=(255, 255, 255, 26), width=1)
    d.rectangle([0, 0, 8, h - 1], fill=(*accent, 255))
    d.rectangle([8, 0, w - 1, 4], fill=(*accent, 200))

    text(d, (46, 48), title, 52, (*WHITE, 255))
    text(d, (48, 116), sub, 20, (*accent, 255), style='ui')
    d.rectangle([46, 160, 46 + 60, 164], fill=(*accent, 255))

    y = 190
    for line in desc_lines:
        text(d, (46, y), line, 22, (*GREY, 245))
        y += 36

    rule(d, 46, 300, w - 46, (*DIM, 110))
    text(d, (46, 320), meta, 17, (*DIM, 245))

    triangle(d, w - 90, h - 80, 22, (*accent, 240))

    save(img, name)


# ================================================================== 地图
MAPS = {
    'urban': {
        'name': '港区·破碎天际线',
        'desc': '三层立体巷战，两点室内近距离交火',
        'size': '小',
        'modes': ['征服', '大逃杀'],
        'accent': ORANGE,
        'meta': '支持 征服 / 大逃杀   ·   建议 1-3 人   ·   3 个据点   ·   载具 3 台',
        'terrain': 'city',
    },
    'desert': {
        'name': '沙海·装甲走廊',
        'desc': '开阔地，坦克与直升机主场，狙击位充足',
        'size': '中',
        'modes': ['征服'],
        'accent': SAND,
        'meta': '支持 征服   ·   建议 1-3 人   ·   3 个据点   ·   载具 5 台',
        'terrain': 'desert',
    },
    'alpine': {
        'name': '雪线·白桦林',
        'desc': '高差大，树林与岩壁掩体，适合缩圈生存',
        'size': '中',
        'modes': ['大逃杀'],
        'accent': SNOW,
        'meta': '支持 大逃杀   ·   建议 1-3 人   ·   无据点   ·   无载具',
        'terrain': 'alpine',
    },
    'industrial': {
        'name': '九号货柜场',
        'desc': '集装箱迷宫，近距离缠斗，载具空间有限',
        'size': '小',
        'modes': ['征服', '大逃杀'],
        'accent': STEEL,
        'meta': '支持 征服 / 大逃杀   ·   建议 1-3 人   ·   3 个据点   ·   载具 1 台',
        'terrain': 'industrial',
    },
}


def draw_terrain(d, box, kind, seed):
    """
    画一张抽象的战术俯视图。
    box 是绘制区域 (x0,y0,x1,y1)，用中灰底 + 地形色块 + 极淡网格。
    整体亮度要够，否则缩略图和预览图都会糊成一片黑。
    """
    random.seed(seed)
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0

    base_col = {
        'city': (34, 36, 41),
        'desert': (58, 50, 34),
        'alpine': (36, 44, 50),
        'industrial': (38, 42, 40),
    }[kind]
    d.rectangle(box, fill=(*base_col, 255))

    if kind == 'city':
        road = (22, 23, 27)
        for gx in range(x0, x1, max(40, w // 12)):
            d.rectangle([gx, y0, gx + 7, y1], fill=(*road, 255))
        for gy in range(y0, y1, max(40, h // 8)):
            d.rectangle([x0, gy, x1, gy + 7], fill=(*road, 255))
        for _ in range(110):
            bw = random.randint(18, 52)
            bh = random.randint(16, 44)
            bx = random.randint(x0, max(x0, x1 - bw))
            by = random.randint(y0, max(y0, y1 - bh))
            shade = random.randint(52, 84)
            d.rectangle([bx, by, bx + bw, by + bh],
                        fill=(shade, shade + 2, shade + 6, 255))
            # 楼顶轮廓
            d.rectangle([bx, by, bx + bw, by + bh],
                        outline=(shade + 18, shade + 20, shade + 26, 255), width=1)
        d.rectangle([x0, y1 - int(h * 0.16), x0 + int(w * 0.42), y1],
                    fill=(26, 44, 56, 255))

    elif kind == 'desert':
        for _ in range(150):
            cx = random.randint(x0, x1)
            cy = random.randint(y0, y1)
            rw = random.randint(40, 160)
            rh = random.randint(6, 18)
            shade = random.randint(64, 86)
            d.ellipse([cx - rw, cy - rh, cx + rw, cy + rh],
                      fill=(shade, int(shade * 0.86), int(shade * 0.56), 255))
        d.line([(x0, y0 + h // 2), (x1, y0 + h // 2)], fill=(70, 70, 74, 255), width=16)
        d.line([(x0, y0 + h // 2), (x1, y0 + h // 2)], fill=(120, 120, 124, 255), width=2)
        for _ in range(18):
            bw = random.randint(24, 46)
            bh = random.randint(20, 38)
            bx = random.randint(x0, max(x0, x1 - bw))
            by = random.randint(y0, max(y0, y1 - bh))
            d.rectangle([bx, by, bx + bw, by + bh], fill=(96, 86, 64, 255))
            d.rectangle([bx, by, bx + bw, by + bh], outline=(120, 108, 82, 255), width=1)

    elif kind == 'alpine':
        # 底色改成雪地，林地做点簇，等高线只保留中心一小片
        d.rectangle(box, fill=(92, 104, 116, 255))

        # 雪面斑驳
        for _ in range(900):
            sx = random.randint(x0, x1)
            sy = random.randint(y0, y1)
            r = random.randint(3, 12)
            shade = random.randint(96, 128)
            d.ellipse([sx - r, sy - r // 2, sx + r, sy + r // 2],
                      fill=(shade, shade + 8, shade + 18, 255))

        # 白桦林：成簇的小树，深浅两层
        for _ in range(60):
            cx = random.randint(x0, x1)
            cy = random.randint(y0, y1)
            for _ in range(random.randint(6, 20)):
                tx = cx + random.randint(-34, 34)
                ty = cy + random.randint(-16, 16)
                if not (x0 + 4 < tx < x1 - 4 and y0 + 4 < ty < y1 - 4):
                    continue
                r = random.randint(3, 6)
                d.ellipse([tx - r, ty - r, tx + r, ty + r], fill=(38, 58, 50, 255))
                d.ellipse([tx - r + 2, ty - r + 2, tx + r - 2, ty + r - 2],
                          fill=(52, 78, 66, 255))

        # 岩壁：几条粗折线
        for _ in range(7):
            sx = random.randint(x0, x1)
            sy = random.randint(y0, y1)
            pts = [(sx, sy)]
            for _ in range(4):
                sx += random.randint(30, 90)
                sy += random.randint(-16, 16)
                pts.append((sx, sy))
            d.line(pts, fill=(58, 64, 72, 255), width=random.randint(3, 7))

        # 中心安全区等高线
        cx, cy = x0 + w // 2, y0 + h // 2
        base_r = min(w, h) * 0.13
        for ring in range(6):
            rr = base_r * (0.6 + ring * 0.4)
            d.ellipse([cx - rr * 1.6, cy - rr * 0.7,
                       cx + rr * 1.6, cy + rr * 0.7],
                      outline=(150, 200, 215, 90), width=1)

    elif kind == 'industrial':
        for gx in range(x0 + 10, x1 - 40, 58):
            for gy in range(y0 + 10, y1 - 26, 30):
                if random.random() < 0.72:
                    cw = random.randint(40, 50)
                    ch = random.randint(20, 24)
                    tint = random.choice([(96, 86, 72), (78, 96, 88),
                                          (104, 78, 72), (74, 84, 100)])
                    d.rectangle([gx, gy, gx + cw, gy + ch], fill=(*tint, 255))
                    d.rectangle([gx, gy, gx + cw, gy + ch],
                                outline=(126, 130, 134, 255), width=1)
        d.rectangle([x0, y0 + int(h * 0.46), x1, y0 + int(h * 0.46) + 9],
                    fill=(56, 60, 64, 255))

    # 极淡网格
    for gx in range(x0, x1, 80):
        d.line([(gx, y0), (gx, y1)], fill=(160, 220, 235, 16))
    for gy in range(y0, y1, 80):
        d.line([(x0, gy), (x1, gy)], fill=(160, 220, 235, 16))

    d.rectangle(box, outline=(255, 255, 255, 26), width=1)


def draw_flags(d, box, map_id):
    """在战术图上标 3 个据点"""
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0

    layout = {
        'urban': [(0.26, 0.52, 'A', RED, 'held'),
                  (0.50, 0.38, 'B', ORANGE, 'contested'),
                  (0.74, 0.52, 'C', BLUE, 'held')],
        'desert': [(0.30, 0.40, 'A', RED, 'held'),
                   (0.50, 0.50, 'B', ORANGE, 'contested'),
                   (0.70, 0.60, 'C', BLUE, 'held')],
        'alpine': [(0.50, 0.50, '◆', CYAN, 'zone')],
        'industrial': [(0.36, 0.40, 'A', RED, 'held'),
                       (0.50, 0.50, 'B', ORANGE, 'contested'),
                       (0.64, 0.60, 'C', BLUE, 'held')],
    }

    for fx, fy, lbl, c, state in layout.get(map_id, []):
        cx = int(x0 + w * fx)
        cy = int(y0 + h * fy)

        if state == 'zone':
            # 大逃杀：安全区圆
            r = int(min(w, h) * 0.28)
            d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(*c, 160), width=2)
            r2 = int(r * 0.55)
            d.ellipse([cx - r2, cy - r2, cx + r2, cy + r2], outline=(*c, 90), width=1)
            continue

        d.ellipse([cx - 26, cy - 26, cx + 26, cy + 26], outline=(*c, 220), width=2)
        d.ellipse([cx - 7, cy - 7, cx + 7, cy + 7], fill=(*c, 235))
        text(d, (cx, cy - 54), lbl, 20, (*c, 255), anchor='ma', style='ui')

    # 出生点
    if map_id != 'alpine':
        for sx, sy, c in [(0.08, 0.5, RED), (0.92, 0.5, BLUE)]:
            px = int(x0 + w * sx)
            py = int(y0 + h * sy)
            d.polygon([(px, py - 12), (px + 12, py), (px, py + 12), (px - 12, py)],
                      fill=(*c, 200))


def make_map_card(map_id):
    """地图卡 420x300，缩略图用缩小的战术图"""
    m = MAPS[map_id]
    w, h = 420, 300
    img = new_rgba(w, h)
    d = ImageDraw.Draw(img)

    d.rectangle([0, 0, w - 1, h - 1], fill=(11, 12, 15, 225))
    d.rectangle([0, 0, w - 1, h - 1], outline=(255, 255, 255, 26), width=1)

    # 缩略图
    draw_terrain(d, (1, 1, w - 1, 150), m['terrain'], hash(map_id) & 0xFFFF)

    # 只在缩略图最底部融进卡片，别把整块压黑
    grad = new_rgba(w, 46)
    gd = ImageDraw.Draw(grad)
    for y in range(46):
        a = int(235 * (y / 46) ** 1.8)
        gd.line([(0, y), (w, y)], fill=(11, 12, 15, a))
    img.alpha_composite(grad, (0, 104))
    d = ImageDraw.Draw(img)

    text(d, (20, 168), m['name'], 26, (*WHITE, 255))
    text(d, (20, 208), m['desc'], 15, (*GREY, 245))

    # 模式标签
    tx = 20
    for mode in m['modes']:
        tw = 20 + len(mode) * 15
        d.rectangle([tx, 238, tx + tw, 264], fill=(*m['accent'], 40),
                    outline=(*m['accent'], 130))
        text(d, (tx + tw // 2, 242), mode, 14, (*m['accent'], 255), anchor='ma')
        tx += tw + 8

    text(d, (w - 20, 242), '规模 ' + m['size'], 14, (*DIM, 240), anchor='ra')

    save(img, 'card_map_%s.png' % map_id)


def make_map_tactical(map_id):
    """战术俯视图 1760x300，用于地图选择页的大预览"""
    m = MAPS[map_id]
    w, h = 1760, 300
    img = new_rgba(w, h)
    d = ImageDraw.Draw(img)

    draw_terrain(d, (0, 0, w, h), m['terrain'], hash(map_id) & 0xFFFF)
    draw_flags(d, (0, 0, w, h), map_id)

    # 顶部标签
    d.rectangle([0, 0, w, 34], fill=(8, 9, 11, 210))
    text(d, (20, 8), '战术地图  ·  ' + m['name'], 16, (*GREY, 245))
    text(d, (w - 20, 8), m['meta'], 14, (*DIM, 240), anchor='ra')

    save(img, 'map_%s_tactical.png' % map_id)


# ================================================================== HUD
def make_hud_topbar():
    w, h = 1920, 76
    img = new_rgba(w, h)
    d = ImageDraw.Draw(img)

    d.rectangle([0, 0, w, 74], fill=(8, 9, 11, 215))
    d.rectangle([0, 74, w, 76], fill=(*ORANGE, 160))
    save(img, 'hud_topbar.png')


def make_hud_class():
    w, h = 400, 150
    img = new_rgba(w, h)
    d = ImageDraw.Draw(img)

    d.rectangle([0, 0, w - 1, h - 1], fill=(10, 11, 14, 205))
    d.rectangle([0, 0, 5, h - 1], fill=(*ORANGE, 235))
    save(img, 'hud_class.png')


def make_hud_ammo():
    w, h = 360, 140
    img = new_rgba(w, h)
    d = ImageDraw.Draw(img)

    d.rectangle([0, 0, w - 1, h - 1], fill=(10, 11, 14, 205))
    d.rectangle([0, 0, 5, h - 1], fill=(*CYAN, 235))
    save(img, 'hud_ammo.png')


def make_hud_sidebar():
    w, h = 290, 320
    img = new_rgba(w, h)
    d = ImageDraw.Draw(img)

    d.rectangle([0, 0, w - 1, h - 1], fill=(10, 11, 14, 205))
    d.rectangle([0, 0, w - 1, h - 1], outline=(255, 255, 255, 22), width=1)
    d.rectangle([0, 0, 4, h - 1], fill=(*ORANGE, 255))
    save(img, 'hud_sidebar.png')


def make_hud_br_panel():
    """大逃杀专用面板：存活数 / 缩圈 / 击杀"""
    w, h = 320, 180
    img = new_rgba(w, h)
    d = ImageDraw.Draw(img)

    d.rectangle([0, 0, w - 1, h - 1], fill=(10, 11, 14, 210))
    d.rectangle([0, 0, w - 1, h - 1], outline=(255, 255, 255, 24), width=1)
    d.rectangle([0, 0, 5, h - 1], fill=(*CYAN, 255))

    text(d, (24, 16), '存活', 15, (*DIM, 245))
    text(d, (24, 40), '1', 44, (*WHITE, 255), style='cond')

    rule(d, 24, 96, w - 24, (*DIM, 110))

    text(d, (24, 110), '安全区', 15, (*DIM, 245))
    text(d, (24, 134), '220 格', 20, (*CYAN, 245))
    text(d, (w - 24, 134), '下次 90s', 15, (*DIM, 240), anchor='ra')

    save(img, 'hud_br_panel.png')


def make_result_header():
    w, h = 1000, 220
    img = new_rgba(w, h)
    d = ImageDraw.Draw(img)

    text(d, (w // 2, 20), 'RED 胜利', 72, (*RED, 255), anchor='ma')
    text(d, (w // 2, 108), '票数  186 : 0', 24, (*GREY, 245), anchor='ma')
    rule(d, 60, 152, w - 60, (*ORANGE, 170), 2)
    text(d, (w // 2, 176), '港区·破碎天际线   ·   征服   ·   14:37', 18,
         (*DIM, 245), anchor='ma')

    save(img, 'result_header.png')


def make_scanline():
    img = new_rgba(16, 16)
    d = ImageDraw.Draw(img)
    for y in range(0, 16, 3):
        d.line([(0, y), (15, y)], fill=(255, 255, 255, 12))
    save(img, 'scanline.png')


# ================================================================== 主流程
def build_assets():
    print('\n[背景]')
    make_background()
    make_lobby_bg()
    make_scanline()

    print('\n[标识]')
    make_logo()

    print('\n[按钮]')
    make_button('btn_single.png',   '单人战役', 'SINGLE PLAYER  ·  离线 · 带 AI', ORANGE)
    make_button('btn_multi.png',    '多人对战', 'MULTIPLAYER   ·  1-3 人联机', CYAN)
    make_button('btn_settings.png', '设置',     'OPTIONS', (150, 152, 158))
    make_button('btn_quit.png',     '退出',     'QUIT GAME', (110, 112, 118))

    print('\n[卡片]')
    make_info_card()
    make_mode_card('card_mode_conquest.png', '征服', 'CONQUEST',
                   ['占领据点，票数流血', '先耗光对方票数者胜'],
                   ORANGE, '300 票 · 3 据点 · 15 分钟')
    make_mode_card('card_mode_br.png', '大逃杀', 'BATTLE ROYALE',
                   ['缩圈生存，搜集装备', '最后存活者获胜'],
                   CYAN, '5 段缩圈 · 单命淘汰 · 20 分钟')

    print('\n[地图]')
    for map_id in MAPS:
        make_map_card(map_id)
    for map_id in MAPS:
        make_map_tactical(map_id)

    print('\n[HUD]')
    make_hud_topbar()
    make_hud_class()
    make_hud_ammo()
    make_hud_sidebar()
    make_hud_br_panel()
    make_result_header()


if __name__ == '__main__':
    build_assets()
    print('\nassets ->', ASSETS)
