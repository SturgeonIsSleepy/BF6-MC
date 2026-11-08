"""
把 server_scripts/*.js 合并成单个 bf6.js。

原因：KubeJS 5.x (1.18.2) 各脚本文件的作用域隔离策略在不同 build 间不一致，
      跨文件裸函数调用可能失败。合并成单文件后，函数在同一个顶层作用域内
      声明，加载顺序与调用顺序都不再有风险。

合并后删除原分片文件（KubeJS 会把目录下所有 .js 都加载，留着会重复注册事件）。
"""

import os
import re
import sys

BASE = os.path.abspath(os.path.join(
    os.path.dirname(os.path.abspath(__file__)), '..', 'kubejs', 'server_scripts'))

ORDER = [
    '00_core.js',
    '01_maps_lobby.js',
    '02_conquest.js',
    '03_battle_royale.js',
    '04_ai_bots.js',
    '05_results.js',
    '06_feed_damage.js',
    '07_hud.js',
]

HEADER = """// ================================================================
//  BF6-MC  |  bf6.js  (single-file bundle)
//
//  MC 1.18.2 / Forge 40.2.21 / KubeJS 5.5
//
//  由 scripts/bundle.py 从以下分片合并生成，请勿直接改本文件：
//    00_core.js          状态机 / 队伍 / 持久化 / 工具
//    01_maps_lobby.js    地图表 / 大厅 / 投票 / 命令
//    02_conquest.js      征服模式 / 兵种 / 重生
//    03_battle_royale.js 大逃杀 / 缩圈 / 空投
//    04_ai_bots.js       AI 补位
//    05_results.js       结算 / 生涯统计
//    06_feed_damage.js   击杀播报 / 倒地救援
//    07_hud.js           sidebar
//
//  改逻辑请改分片后重跑： python scripts/bundle.py
// ================================================================

"""


def main():
    parts = []
    missing = []

    for name in ORDER:
        path = os.path.join(BASE, name)
        if not os.path.isfile(path):
            missing.append(name)
            continue
        with open(path, 'r', encoding='utf-8') as fh:
            body = fh.read().strip('\n')
        parts.append('// ================================================================\n'
                     '//  SOURCE: %s\n'
                     '// ================================================================\n\n%s\n'
                     % (name, body))

    if missing:
        print('missing shards:', ', '.join(missing))
        return 1

    out_path = os.path.join(BASE, 'bf6.js')
    with open(out_path, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write(HEADER + '\n\n'.join(parts) + '\n')

    # 删除分片，避免重复注册
    for name in ORDER:
        os.remove(os.path.join(BASE, name))

    size = os.path.getsize(out_path)
    print('wrote %s (%d bytes)' % (out_path, size))
    print('removed %d shards' % len(ORDER))
    return 0


if __name__ == '__main__':
    sys.exit(main())
