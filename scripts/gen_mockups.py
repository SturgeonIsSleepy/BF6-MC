"""
BF6-MC 六屏合成效果图生成器

直接用 fancymenu/assets 里的真实素材拼装，不再重复画元素，
保证「效果图 == 最终 UI」。

输出 fancymenu/mockups/
  mock_01_main.png     主菜单
  mock_02_mode.png     模式选择
  mock_03_map.png      地图选择
  mock_04_lobby.png    大厅
  mock_05_hud.png      局内 HUD（征服）
  mock_06_br.png       局内 HUD（大逃杀）
  mock_07_result.png   结算
"""

import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
ASSETS = os.path.join(ROOT, 'fancymenu', 'assets')
MOCKUPS = os.path.join(ROOT, 'fancymenu', 'mockups')
os.makedirs(MOCKUPS, exist_ok=True)

W, H = 1920, 1080

ORANGE = (255, 106, 0)
CYAN = (60, 200, 220)
WHITE = (238, 240, 242)
GREY = (128, 132, 138)
DIM = (86, 90, 96)
RED = (214, 62, 52)
BLUE = (58, 132, 214)

F_CJK_BOLD = r'C:\Windows\Fonts\msyhbd.ttc'
F_COND = r'C:\Windows\Fonts\impact.ttf'
F_UI = r'C:\Windows\Fonts\bahnschrift.ttf'


def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()


def pick(s, size, style='auto'):
    if style == 'cond':
        return font(F_COND, size)
    if style == 'ui':
        return font(F_UI, size)
    if any(ord(c) > 127 for c in s):
        return font(F_CJK_BOLD, size)
    return font(F_UI, size)


def text(d, xy, s, size, fill, anchor=None, style='auto'):
    d.text(xy, s, font=pick(s, size, style), fill=fill, anchor=anchor)


def rule(d, x0, y, x1, color=(255, 255, 255, 30), w=1):
    d.line([(x0, y), (x1, y)], fill=color, width=w)


def triangle(d, x, y, size, color):
    d.polygon([(x, y - size), (x + size * 1.5, y), (x, y + size)], fill=color)


def load(name, w=None, h=None):
    p = os.path.join(ASSETS, name)
    if not os.path.isfile(p):
        return None
    img = Image.open(p).convert('RGBA')
    if w:
        img = img.resize((w, h or int(img.height * w / img.width)), Image.LANCZOS)
    return img


def canvas(bg='background.png', dim=0.0):
    img = load(bg)
    if img is None:
        img = Image.new('RGBA', (W, H), (10, 11, 13, 255))
    img = img.resize((W, H), Image.LANCZOS)
    if dim > 0:
        veil = Image.new('RGBA', (W, H), (0, 0, 0, int(255 * dim)))
        img = Image.alpha_composite(img, veil)
    return img


def put(img, asset, x, y, w=None, h=None):
    a = load(asset, w, h)
    if a:
        img.alpha_composite(a, (int(x), int(y)))
    return a


def save(img, name):
    path = os.path.join(MOCKUPS, name)
    img.convert('RGB').save(path, optimize=True)
    print('  %-24s %6.1f KB' % (name, os.path.getsize(path) / 1024))


# ============================================================ 01 主菜单
def mock_main():
    img = canvas()
    d = ImageDraw.Draw(img)

    text(d, (80, 44), 'BF6 // MINECRAFT', 17, (*DIM, 255), style='ui')
    rule(d, 80, 72, 470, (*DIM, 120))

    put(img, 'logo.png', 76, 96, 792)
    d = ImageDraw.Draw(img)

    for y, n in [(360, 'btn_single.png'), (470, 'btn_multi.png'),
                 (580, 'btn_settings.png'), (690, 'btn_quit.png')]:
        put(img, n, 80, y)
    d = ImageDraw.Draw(img)

    # 当前选中：多人
    d.rectangle([78, 468, 78 + 524, 468 + 96], outline=(*CYAN, 200), width=2)

    put(img, 'card_info.png', 1180, 296)

    d = ImageDraw.Draw(img)
    rule(d, 80, 1010, 1840, (*DIM, 100))
    text(d, (80, 1030), 'BF6-MC  ·  整合包前端原型', 15, (*DIM, 255))
    text(d, (1840, 1030), '1.18.2', 15, (*DIM, 255), anchor='ra', style='ui')

    save(img, 'mock_01_main.png')


# ============================================================ 02 模式选择
def mock_mode():
    img = canvas(dim=0.45)
    d = ImageDraw.Draw(img)

    text(d, (80, 60), '多人对战', 44, (*WHITE, 255))
    text(d, (80, 120), 'MULTIPLAYER  ·  选择游戏模式', 18, (*DIM, 255))
    rule(d, 80, 168, 1840, (*ORANGE, 160), 2)

    # 两张模式卡，选中征服
    put(img, 'card_mode_conquest.png', 200, 280)
    put(img, 'card_mode_br.png', 1040, 280)

    d = ImageDraw.Draw(img)
    d.rectangle([196, 276, 196 + 768, 276 + 428], outline=(*ORANGE, 210), width=3)

    text(d, (W // 2, 800), '← →  选择      Enter  确认      Esc  返回', 18,
         (*DIM, 240), anchor='ma')

    save(img, 'mock_02_mode.png')


# ============================================================ 03 地图选择
MAP_ORDER = [
    ('urban', 'card_map_urban.png', 'map_urban_tactical.png',
     '港区·破碎天际线', '支持 征服 / 大逃杀   ·   建议 1-3 人   ·   3 个据点   ·   载具 3 台'),
    ('desert', 'card_map_desert.png', 'map_desert_tactical.png',
     '沙海·装甲走廊', '支持 征服   ·   建议 1-3 人   ·   3 个据点   ·   载具 5 台'),
    ('alpine', 'card_map_alpine.png', 'map_alpine_tactical.png',
     '雪线·白桦林', '支持 大逃杀   ·   建议 1-3 人   ·   无据点   ·   无载具'),
    ('industrial', 'card_map_industrial.png', 'map_industrial_tactical.png',
     '九号货柜场', '支持 征服 / 大逃杀   ·   建议 1-3 人   ·   3 个据点   ·   载具 1 台'),
]


def mock_map():
    img = canvas(dim=0.5)
    d = ImageDraw.Draw(img)

    text(d, (80, 56), '选择地图', 40, (*WHITE, 255))
    text(d, (80, 112), '征服  ·  4 张可用地图', 17, (*DIM, 255))
    rule(d, 80, 156, 1840, (*ORANGE, 150), 2)

    for i, (mid, card, _, _, _) in enumerate(MAP_ORDER):
        put(img, card, 80 + i * 450, 200)

    d = ImageDraw.Draw(img)
    # 选中第一张
    d.rectangle([78, 198, 78 + 424, 198 + 304], outline=(*ORANGE, 230), width=3)
    d.rectangle([96, 316, 96 + 74, 316 + 24], fill=(*ORANGE, 235))
    text(d, (104, 318), '已选', 15, (12, 12, 14, 255))

    rule(d, 80, 560, 1840, (*DIM, 100))
    text(d, (80, 586), MAP_ORDER[0][3], 22, (*WHITE, 255))
    text(d, (80, 620), MAP_ORDER[0][4], 16, (*GREY, 240))

    put(img, MAP_ORDER[0][2], 80, 680)

    save(img, 'mock_03_map.png')


# ============================================================ 04 大厅
PLAYERS = [('YG', '红队', RED, '突击兵', '已准备'),
           ('PLAYER_02', '蓝队', BLUE, '医疗兵', '未准备'),
           ('PLAYER_03', '蓝队', BLUE, '侦察兵', '未准备')]

LOBBY_MAPS = [('港区·破碎天际线', '征服 / 大逃杀', True),
              ('沙海·装甲走廊', '征服', False),
              ('雪线·白桦林', '大逃杀', False),
              ('九号货柜场', '征服 / 大逃杀', False)]

LOBBY_MODES = [('征服', 'CONQUEST', '3 据点 · 300 票 · 15 分钟', True),
               ('大逃杀', 'BATTLE ROYALE', '5 段缩圈 · 单命 · 20 分钟', False)]


def mock_lobby():
    img = canvas('lobby_bg.png')
    d = ImageDraw.Draw(img)

    d.rectangle([0, 0, W, 56], fill=(8, 9, 11, 235))
    d.rectangle([0, 56, W, 58], fill=(*ORANGE, 180))
    text(d, (40, 16), 'BF6', 24, (*ORANGE, 255), style='cond')
    text(d, (108, 18), '大厅  ·  LOBBY', 20, (*WHITE, 250))
    text(d, (W - 40, 18), '等待部署', 18, (*DIM, 250), anchor='ra')

    ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    cd = ImageDraw.Draw(ov)

    # 地图终端
    cd.rectangle([120, 220, 720, 700], fill=(11, 12, 15, 228),
                 outline=(255, 255, 255, 26))
    cd.rectangle([120, 220, 128, 700], fill=(*ORANGE, 255))
    text(cd, (160, 260), '地图终端', 34, (*WHITE, 255))
    text(cd, (162, 310), 'MAP TERMINAL', 16, (*ORANGE, 240), style='ui')
    rule(cd, 160, 352, 680, (*DIM, 130))

    y = 378
    for name, modes, sel in LOBBY_MAPS:
        if sel:
            cd.rectangle([152, y - 8, 688, y + 52], fill=(*ORANGE, 34),
                         outline=(*ORANGE, 120))
            triangle(cd, 170, y + 18, 7, (*ORANGE, 255))
        text(cd, (192, y), name, 22, (*WHITE, 255) if sel else (*GREY, 235))
        text(cd, (194, y + 30), modes, 14, (*DIM, 240))
        y += 70

    # 模式终端
    cd.rectangle([1200, 220, 1800, 700], fill=(11, 12, 15, 228),
                 outline=(255, 255, 255, 26))
    cd.rectangle([1200, 220, 1208, 700], fill=(*CYAN, 255))
    text(cd, (1240, 260), '模式终端', 34, (*WHITE, 255))
    text(cd, (1242, 310), 'MODE TERMINAL', 16, (*CYAN, 240), style='ui')
    rule(cd, 1240, 352, 1760, (*DIM, 130))

    y = 384
    for name, sub, meta, sel in LOBBY_MODES:
        if sel:
            cd.rectangle([1232, y - 10, 1768, y + 96], fill=(*ORANGE, 34),
                         outline=(*ORANGE, 120))
            triangle(cd, 1252, y + 18, 8, (*ORANGE, 255))
        text(cd, (1276, y), name, 26, (*WHITE, 255) if sel else (*GREY, 235))
        text(cd, (1278, y + 36), sub, 15, (*DIM, 240), style='ui')
        text(cd, (1278, y + 60), meta, 14, (*DIM, 230))
        y += 128

    # 准备区
    cd.rectangle([780, 300, 1140, 620], fill=(10, 11, 14, 210),
                 outline=(255, 255, 255, 60))
    text(cd, (960, 336), '准备就绪', 26, (*WHITE, 255), anchor='ma')
    text(cd, (960, 374), 'READY UP', 14, (*DIM, 240), anchor='ma', style='ui')

    cd.rectangle([810, 410, 1110, 500], fill=(*ORANGE, 235))
    text(cd, (960, 436), '开始部署', 32, (12, 12, 14, 255), anchor='ma')
    text(cd, (960, 476), 'START', 13, (30, 30, 34, 255), anchor='ma', style='ui')

    text(cd, (960, 530), '1 / 3 已准备', 18, (*GREY, 245), anchor='ma')
    text(cd, (960, 560), '全员就绪后 10 秒自动开始', 14, (*DIM, 235), anchor='ma')

    img = Image.alpha_composite(img, ov)
    d = ImageDraw.Draw(img)

    rule(d, 120, 760, 1800, (*DIM, 110))
    text(d, (120, 782), '参战人员', 18, (*WHITE, 250))

    y = 818
    for name, team, tc, klass, state in PLAYERS:
        d.rectangle([120, y, 1800, y + 58], fill=(12, 13, 16, 190))
        d.rectangle([120, y, 126, y + 58], fill=(*tc, 235))
        text(d, (150, y + 10), name, 20, (*WHITE, 250), style='ui')
        text(d, (420, y + 14), team, 16, (*tc, 250))
        text(d, (620, y + 14), klass, 16, (*GREY, 240))
        text(d, (1760, y + 14), state, 16,
             (*ORANGE, 250) if state == '已准备' else (*DIM, 240), anchor='ra')
        y += 66

    save(img, 'mock_04_lobby.png')


# ============================================================ 05 征服 HUD
def mock_hud():
    img = canvas(dim=0.35)
    d = ImageDraw.Draw(img)

    # 顶条
    put(img, 'hud_topbar.png', 0, 0)
    d = ImageDraw.Draw(img)

    text(d, (44, 14), '186', 38, (*RED, 255), style='cond')
    text(d, (44, 58), 'RED', 12, (*DIM, 240), style='ui')
    text(d, (W - 44, 14), '241', 38, (*BLUE, 255), anchor='ra', style='cond')
    text(d, (W - 44, 58), 'BLUE', 12, (*DIM, 240), anchor='ra', style='ui')

    # 据点
    fx = W // 2 - 210
    for lbl, owner, prog in [('A', RED, 1.0), ('B', None, 0.45), ('C', BLUE, 1.0)]:
        d.rectangle([fx, 18, fx + 120, 56], fill=(14, 15, 18, 235),
                    outline=(255, 255, 255, 30))
        if owner:
            d.rectangle([fx + 1, 19, fx + 119, 55], fill=(*owner, 46),
                        outline=(*owner, 210))
        d.rectangle([fx + 1, 51, fx + 1 + int(118 * prog), 55], fill=(*ORANGE, 220))
        text(d, (fx + 60, 26), lbl, 24, (*WHITE, 255), anchor='ma')
        fx += 150

    text(d, (W // 2, 84), '11:24', 20, (*WHITE, 245), anchor='ma', style='ui')

    # 兵种卡
    put(img, 'hud_class.png', 40, 890)
    d = ImageDraw.Draw(img)
    text(d, (68, 904), '突击兵', 22, (*WHITE, 250))
    text(d, (68, 936), 'ASSAULT', 13, (*DIM, 240), style='ui')
    rule(d, 68, 962, 356, (*DIM, 120))
    d.rectangle([68, 976, 356, 996], fill=(26, 28, 32, 255))
    d.rectangle([68, 976, 68 + int(288 * 0.72), 996], fill=(*ORANGE, 235))
    text(d, (356, 1000), '72 / 100', 14, (*DIM, 240), anchor='ra', style='ui')

    # 弹药卡
    put(img, 'hud_ammo.png', 1520, 900)
    d = ImageDraw.Draw(img)
    text(d, (1550, 914), 'AK-47', 18, (*GREY, 245), style='ui')
    text(d, (1550, 938), '30 / 120', 15, (*DIM, 240), style='ui')
    text(d, (1856, 912), '30', 62, (*WHITE, 255), anchor='ra', style='cond')
    text(d, (1856, 988), '120', 24, (*DIM, 245), anchor='ra', style='cond')

    # 击杀播报
    feed = [('YG', RED, 'PLAYER_02', BLUE, '枪械'),
            ('PLAYER_03', BLUE, 'YG', RED, '爆炸')]
    y = 780
    for k, kc, v, vc, w in feed:
        d.rectangle([1300, y, 1880, y + 40], fill=(10, 11, 14, 180))
        d.rectangle([1300, y, 1304, y + 40], fill=(*kc, 235))
        text(d, (1320, y + 9), k, 17, (*kc, 250), style='ui')
        text(d, (1480, y + 12), '[' + w + ']', 13, (*DIM, 240))
        text(d, (1860, y + 9), v, 17, (*vc, 250), anchor='ra', style='ui')
        y += 48

    # 侧栏
    put(img, 'hud_sidebar.png', 1590, 150)
    d = ImageDraw.Draw(img)
    text(d, (1630, 168), '港区·破碎天际线', 16, (*WHITE, 245))
    rule(d, 1630, 200, 1860, (*DIM, 120))

    for i, (name, c, st) in enumerate([('A 码头', RED, 'held'),
                                       ('B 中庭', ORANGE, 'contested'),
                                       ('C 仓库', BLUE, 'held')]):
        yy = 218 + i * 32
        if st == 'held':
            d.ellipse([1630, yy + 3, 1642, yy + 15], fill=(*c, 255))
        else:
            d.ellipse([1630, yy + 3, 1642, yy + 15], outline=(*c, 255), width=2)
            d.arc([1628, yy + 1, 1644, yy + 17], 90, 270, fill=(*c, 255), width=2)
        text(d, (1654, yy), name, 16, (*c, 245))

    rule(d, 1630, 322, 1860, (*DIM, 120))
    text(d, (1630, 336), '小队', 15, (*DIM, 245))

    for i, (n, c, st) in enumerate([('YG', WHITE, 'alive'), ('PLAYER_02', RED, 'down')]):
        yy = 362 + i * 28
        if st == 'alive':
            d.ellipse([1630, yy + 4, 1641, yy + 15], fill=(*c, 255))
        else:
            cx0, cy0 = 1636, yy + 10
            d.rectangle([cx0 - 6, cy0 - 1, cx0 + 6, cy0 + 1], fill=(*c, 255))
            d.rectangle([cx0 - 1, cy0 - 6, cx0 + 1, cy0 + 6], fill=(*c, 255))
        text(d, (1654, yy), n, 15, (*c, 240), style='ui')

    save(img, 'mock_05_hud.png')


# ============================================================ 06 大逃杀 HUD
def mock_br():
    img = canvas(dim=0.35)
    d = ImageDraw.Draw(img)

    put(img, 'hud_topbar.png', 0, 0)
    d = ImageDraw.Draw(img)

    # 顶栏只放模式与计时，存活/安全区交给右上角面板，避免重复
    text(d, (44, 22), 'BATTLE ROYALE', 22, (*CYAN, 250), style='ui')
    text(d, (W - 44, 22), '雪线·白桦林', 20, (*WHITE, 250), anchor='ra')
    text(d, (W // 2, 84), '14:52', 20, (*WHITE, 245), anchor='ma', style='ui')

    # 右上：缩圈面板
    put(img, 'hud_br_panel.png', 1560, 110)

    # 左下：兵种
    put(img, 'hud_class.png', 40, 890)
    d = ImageDraw.Draw(img)
    text(d, (68, 904), '侦察兵', 22, (*WHITE, 250))
    text(d, (68, 936), 'RECON', 13, (*DIM, 240), style='ui')
    rule(d, 68, 962, 356, (*DIM, 120))
    d.rectangle([68, 976, 356, 996], fill=(26, 28, 32, 255))
    d.rectangle([68, 976, 68 + int(288 * 0.41), 996], fill=(*RED, 235))
    text(d, (356, 1000), '41 / 100', 14, (*DIM, 240), anchor='ra', style='ui')

    # 右下：弹药
    put(img, 'hud_ammo.png', 1520, 900)
    d = ImageDraw.Draw(img)
    text(d, (1550, 914), 'M700', 18, (*GREY, 245), style='ui')
    text(d, (1550, 938), '5 / 60', 15, (*DIM, 240), style='ui')
    text(d, (1856, 912), '5', 62, (*WHITE, 255), anchor='ra', style='cond')
    text(d, (1856, 988), '60', 24, (*DIM, 245), anchor='ra', style='cond')

    # 击杀播报
    d.rectangle([1300, 780, 1880, 820], fill=(10, 11, 14, 180))
    d.rectangle([1300, 780, 1304, 820], fill=(*RED, 235))
    text(d, (1320, 789), 'YG', 17, (*RED, 250), style='ui')
    text(d, (1480, 792), '[狙击]', 13, (*DIM, 240))
    text(d, (1860, 789), 'PLAYER_03', 17, (*BLUE, 250), anchor='ra', style='ui')

    save(img, 'mock_06_br.png')


# ============================================================ 07 结算
def mock_result():
    img = canvas(dim=0.55)
    d = ImageDraw.Draw(img)

    put(img, 'result_header.png', 460, 80)
    d = ImageDraw.Draw(img)

    ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    cd = ImageDraw.Draw(ov)
    cd.rectangle([260, 310, 1660, 790], fill=(10, 11, 14, 226),
                 outline=(255, 255, 255, 26))
    cd.rectangle([260, 310, 266, 790], fill=(*ORANGE, 255))

    cols = [(320, '玩家'), (820, '击杀'), (960, '死亡'), (1100, '助攻'),
            (1240, 'K/D'), (1420, '分数')]
    for x, label in cols:
        text(cd, (x, 336), label, 17, (*DIM, 245))
    rule(cd, 300, 372, 1620, (*DIM, 130))

    rows = [('YG', RED, 18, 6, 4, '3.00', 2680),
            ('PLAYER_03', BLUE, 12, 14, 2, '0.86', 1420),
            ('PLAYER_02', BLUE, 9, 16, 6, '0.56', 1180)]
    y = 392
    for i, (name, tc, k, dd, a, kd, sc) in enumerate(rows):
        if i == 0:
            cd.rectangle([300, y - 10, 1620, y + 50], fill=(*ORANGE, 26))
        cd.rectangle([300, y - 10, 306, y + 50], fill=(*tc, 235))
        text(cd, (320, y), name, 21, (*WHITE, 250), style='ui')
        text(cd, (820, y + 2), str(k), 21, (*WHITE, 245), style='ui')
        text(cd, (960, y + 2), str(dd), 21, (*GREY, 245), style='ui')
        text(cd, (1100, y + 2), str(a), 21, (*GREY, 245), style='ui')
        text(cd, (1240, y + 2), kd, 21, (*CYAN, 245), style='ui')
        text(cd, (1420, y + 2), str(sc), 21, (*ORANGE, 250), style='ui')
        y += 78

    rule(cd, 300, y + 6, 1620, (*DIM, 130))
    text(cd, (320, y + 26), '生涯统计', 16, (*DIM, 245))
    text(cd, (320, y + 54), 'YG  ·  124 杀 / 18 场 / 11 胜', 17, (*GREY, 240))
    text(cd, (320, y + 82), 'PLAYER_02  ·  76 杀 / 18 场 / 4 胜', 17, (*GREY, 240))
    text(cd, (320, y + 110), 'PLAYER_03  ·  91 杀 / 18 场 / 5 胜', 17, (*GREY, 240))

    img = Image.alpha_composite(img, ov)
    d = ImageDraw.Draw(img)

    text(d, (W // 2, 860), '15 秒后返回大厅', 20, (*DIM, 245), anchor='ma')

    d.rectangle([640, 906, 940, 966], fill=(*ORANGE, 235))
    text(d, (790, 924), '返回大厅', 22, (12, 12, 14, 255), anchor='ma')

    d.rectangle([980, 906, 1280, 966], fill=(20, 22, 26, 235),
                outline=(255, 255, 255, 60))
    text(d, (1130, 924), '再来一局', 22, (*WHITE, 245), anchor='ma')

    save(img, 'mock_07_result.png')


if __name__ == '__main__':
    print('[渲染效果图]')
    mock_main()
    mock_mode()
    mock_map()
    mock_lobby()
    mock_hud()
    mock_br()
    mock_result()
    print('->', MOCKUPS)
