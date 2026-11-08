// ================================================================
//  BF6-MC  |  bf6.js   —— 直接编辑本文件
//
//  MC 1.18.2 / Forge 40.2.21 / KubeJS 5.5
//
//  历史：本文件早期由 8 个分片（00_core.js ~ 07_hud.js）合并而成。
//        分片已删除，scripts/bundle.py 仅作存档、运行必然失败。
//        **所有改动请直接编辑本文件。**
//
//  分区索引（下方 //#region 标注）：
//    core          状态机 / 队伍 / 持久化 / 工具
//    maps_lobby    地图表 / 大厅 / 投票 / 命令
//    conquest      征服模式 / 兵种 / 重生
//    battle_royale 大逃杀 / 缩圈 / 空投
//    ai_bots       AI 补位
//    results       结算 / 生涯统计
//    feed_damage   击杀播报 / 倒地救援
//    hud           sidebar
//
//  ⚠ 不要把本文件拆回多个 .js —— KubeJS 会加载 server_scripts/ 下
//     所有 .js，拆分会重复注册事件。
// ================================================================

// ================================================================
//  SOURCE: 00_core.js
// ================================================================

// ============================================================
//  BF6-MC  |  00_core.js
//  核心状态机 / 玩家档案 / 队伍 / 全局计时
//  MC 1.18.2 - Forge 40.2.21 - KubeJS 5.5 (1802.5.5-build.569)
// ============================================================

//#region 常量

global.BF6 = global.BF6 || {}

var S = {
    LOBBY:    'lobby',
    BRIEFING: 'briefing',
    PLAYING:  'playing',
    RESULT:   'result'
}

var TEAM = {
    RED:  'bf6_red',
    BLUE: 'bf6_blue'
}

var TEAM_COLOR = {
    bf6_red:  '§c',
    bf6_blue: '§9'
}

// 大厅坐标：setblock 只接受整数，这里全部用整数。
// 玩家传送时会自动落在方块中心，不需要 0.5 偏移。
var LOBBY = {
    dimension: 'minecraft:overworld',
    x: 0, y: 200, z: 0,
    spawn:    { x: 0,  y: 200, z: 0  },
    terminal: { x: 8,  y: 200, z: 0  },   // 右侧讲台：选地图
    mode:     { x: -8, y: 200, z: 0  },   // 左侧讲台：选模式
    ready:    { x: 0,  y: 200, z: 6  }
}

//#endregion
//#region 全局运行时

global.BF6.state = S.LOBBY
global.BF6.tick  = 0
global.BF6.timer = 0
global.BF6.match = null
global.BF6.players = {}
global.BF6.vote = {
    map:  null,
    mode: null,
    pool: [],
    votes: {}
}

// 谁按过「准备」。用集合而不是计数器，避免掉线/重进导致计数漂移。
global.BF6.readySet = {}

//#endregion
//#region 持久化

function pdata(server) {
    var d = server.persistentData
    if (!d.contains('bf6')) d.putCompound('bf6', {})
    return d.getCompound('bf6')
}

function pget(server, key, def) {
    var d = pdata(server)
    return d.contains(key) ? d.get(key) : def
}

function pset(server, key, value) {
    pdata(server).put(key, value)
}

function profile(server, username) {
    var all = pget(server, 'profiles', {})
    if (!all[username]) {
        all[username] = { kills: 0, deaths: 0, wins: 0, matches: 0, brBest: 0 }
    }
    return all[username]
}

function saveProfile(server, username, p) {
    var all = pget(server, 'profiles', {})
    all[username] = p
    pset(server, 'profiles', all)
}

//#endregion
//#region 玩家运行时对象

function newPlayer(username) {
    return {
        name: username,
        team: null,
        klass: 'assault',
        kills: 0,
        deaths: 0,
        assists: 0,
        score: 0,
        alive: true,
        downed: false,
        reviveTicks: 0,
        streak: 0,
        spawnedAt: 0,
        lastDamager: null,
        brLives: 1,
        isBot: false
    }
}

function P(username) {
    if (!global.BF6.players[username]) {
        global.BF6.players[username] = newPlayer(username)
    }
    return global.BF6.players[username]
}

function onlinePlayers(server) {
    return server.players.map(function (p) { return p.username })
}

//#endregion
//#region 队伍

function ensureTeams(server) {
    var defs = [
        ['bf6_red',  '§cRED',  'red'],
        ['bf6_blue', '§9BLUE', 'blue']
    ]
    defs.forEach(function (d) {
        var id = d[0], display = d[1], color = d[2]
        server.runCommandSilent('team add ' + id)
        server.runCommandSilent('team modify ' + id + ' displayName {"text":"' + display + '"}')
        server.runCommandSilent('team modify ' + id + ' color ' + color)
        server.runCommandSilent('team modify ' + id + ' friendlyFire false')
        server.runCommandSilent('team modify ' + id + ' seeFriendlyInvisibles true')
        server.runCommandSilent('team modify ' + id + ' nametagVisibility hideForOtherTeams')
        server.runCommandSilent('team modify ' + id + ' collisionRule pushOtherTeams')
    })
}

function setTeam(server, username, teamId) {
    if (teamId) {
        server.runCommandSilent('team join ' + teamId + ' ' + username)
    } else {
        server.runCommandSilent('team leave ' + username)
    }
    P(username).team = teamId
}

function autoBalance(server) {
    var list = onlinePlayers(server).filter(function (u) { return !P(u).isBot })
    list.forEach(function (u, i) {
        setTeam(server, u, i % 2 === 0 ? TEAM.RED : TEAM.BLUE)
    })
}

function teamOf(username) {
    var p = global.BF6.players[username]
    return p ? p.team : null
}

/**
 * 重新统计准备人数，并同步 global.BF6.readyCount。
 * 只算当前在线的玩家，掉线的人自动作废。
 */
function recountReady(server) {
    var online = onlinePlayers(server)
    var set = global.BF6.readySet
    var n = 0
    online.forEach(function (u) { if (set[u]) n++ })
    // 清掉已下线玩家的标记，防止集合无限增长
    Object.keys(set).forEach(function (u) {
        if (online.indexOf(u) < 0) delete set[u]
    })
    global.BF6.readyCount = n
    return n
}

function teamPlayers(teamId) {
    return Object.values(global.BF6.players).filter(function (p) { return p.team === teamId })
}

//#endregion
//#region 主循环

ServerEvents.loaded(function (event) {
    var server = event.server
    ensureTeams(server)
    global.BF6.state = S.LOBBY
    global.BF6.tick  = 0
    console.info('[BF6] core loaded, state = LOBBY')
})

ServerEvents.tick(function (event) {
    var server = event.server
    if (!server) return

    global.BF6.tick++

    if (global.BF6.tick % 20 !== 0) return

    switch (global.BF6.state) {
        case S.LOBBY:    onLobbyTick(server);    break
        case S.BRIEFING: onBriefingTick(server); break
        case S.PLAYING:  onPlayingTick(server);  break
        case S.RESULT:   onResultTick(server);   break
    }

    if (global.BF6._hudTick)        global.BF6._hudTick(server)
    if (global.BF6._pointScoreHook) global.BF6._pointScoreHook(server)

    // 倒地计时 + 救援扫描
    reviveScan(server)

    // AI 补位（每 5 秒一次，避免每秒 summon 造成卡顿）
    if (global.BF6.state === S.PLAYING && global.BF6.tick % 100 === 0) {
        maintainBots(server)
    }

    Object.keys(global.BF6.players).forEach(function (u) {
        var p = global.BF6.players[u]
        if (p.downed) {
            p.reviveTicks++
            if (p.reviveTicks >= 30) {
                p.downed = false
                p.reviveTicks = 0
                p.alive = false
                onPlayerEliminated(server, p.name)
            }
        }
    })
})

function onLobbyTick(server)    { if (global.BF6._lobbyTick)    global.BF6._lobbyTick(server) }
function onBriefingTick(server) { if (global.BF6._briefingTick) global.BF6._briefingTick(server) }
function onPlayingTick(server)  { if (global.BF6._playingTick)  global.BF6._playingTick(server) }
function onResultTick(server)   { if (global.BF6._resultTick)   global.BF6._resultTick(server) }
function onPlayerEliminated(server, name) {
    if (global.BF6._onEliminated) global.BF6._onEliminated(server, name)
}

//#endregion
//#region 通用工具

function bar(server, username, json) {
    server.runCommandSilent('title ' + username + ' actionbar ' + json)
}

function title(server, username, main, sub, fadeIn, stay, fadeOut) {
    fadeIn  = fadeIn  === undefined ? 10 : fadeIn
    stay    = stay    === undefined ? 60 : stay
    fadeOut = fadeOut === undefined ? 20 : fadeOut
    server.runCommandSilent('title ' + username + ' times ' + fadeIn + ' ' + stay + ' ' + fadeOut)
    server.runCommandSilent('title ' + username + ' title ' + JSON.stringify({ text: main }))
    if (sub) {
        server.runCommandSilent('title ' + username + ' subtitle ' + JSON.stringify({ text: sub }))
    }
}

function bc(server, msg) {
    server.runCommandSilent('tellraw @a {"text":' + JSON.stringify(msg) + '}')
}

function bcTeam(server, teamId, msg) {
    server.runCommandSilent('tellraw @a[team=' + teamId + '] {"text":' + JSON.stringify(msg) + '}')
}

function tp(server, username, dim, x, y, z, yaw, pitch) {
    var rot = (yaw !== undefined) ? (' ' + yaw + ' ' + (pitch === undefined ? 0 : pitch)) : ''
    server.runCommandSilent('execute in ' + dim + ' run tp ' + username + ' ' + x + ' ' + y + ' ' + z + rot)
}

function toLobby(server, username) {
    server.runCommandSilent('gamemode adventure ' + username)
    server.runCommandSilent('effect clear ' + username)
    tp(server, username, LOBBY.dimension, LOBBY.spawn.x, LOBBY.spawn.y, LOBBY.spawn.z, 0, 0)
    var p = P(username)
    p.alive = true
    p.downed = false
    p.reviveTicks = 0
}

function clearInv(server, username) {
    server.runCommandSilent('clear ' + username)
}

function mmss(sec) {
    sec = Math.max(0, Math.floor(sec))
    var m = Math.floor(sec / 60)
    var s = sec % 60
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s
}

/**
 * 从任意实体对象里稳妥地取出玩家名。
 * KubeJS 1.18.2 在不同事件里给的包装类型不完全一致
 * （EntityJS / PlayerJS / LivingEntityJS），这里做兼容。
 */
function nameOf(entity) {
    if (!entity) return null
    try { if (entity.username) return String(entity.username) } catch (e) {}
    try { if (entity.name && entity.name.getString) return entity.name.getString() } catch (e) {}
    try { if (entity.displayName && entity.displayName.getString) return entity.displayName.getString() } catch (e) {}
    try { if (entity.stringUuid) return String(entity.stringUuid) } catch (e) {}
    return null
}

/** 取实体血量，兼容不同包装 */
function healthOf(entity) {
    if (!entity) return 0
    try { return Number(entity.health) } catch (e) { return 0 }
}

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)]
}

function shuffle(arr) {
    var a = arr.slice()
    for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1))
        var t = a[i]; a[i] = a[j]; a[j] = t
    }
    return a
}

//#endregion


// ================================================================
//  SOURCE: 01_maps_lobby.js
// ================================================================

// ============================================================
//  BF6-MC  |  01_maps_lobby.js
//  地图注册表 / 大厅 / 选图选模式 / 准备与开局
// ============================================================

//#region 地图注册表
// 全部在同一个 overworld 里，用 8000 格偏移分开，不需要自定义维度。
// 坐标是"设计坐标"，落地时进游戏用 /bf6 mark 实际标定后回填。

var WORLD = 'minecraft:overworld'

global.BF6.maps = {

    // 港区巷战：小图，节奏最快
    urban: {
        id: 'urban',
        name: '港区·破碎天际线',
        desc: '三层立体巷战，两点室内近距离交火',
        size: 'small',
        modes: ['conquest', 'br'],
        spawns: {
            bf6_red:  { x: 8120, y: 70, z: 8000, yaw: -90 },
            bf6_blue: { x: 7880, y: 70, z: 8000, yaw: 90  }
        },
        flags: [
            { id: 'A', x: 8060, y: 68, z: 8000, r: 14, name: '码头' },
            { id: 'B', x: 8000, y: 72, z: 8040, r: 12, name: '中庭' },
            { id: 'C', x: 7940, y: 68, z: 8000, r: 14, name: '仓库' }
        ],
        br: { cx: 8000, cz: 8000, r0: 220, rEnd: 40 },
        vehicles: [
            { type: 'iv:mtank', x: 8100, y: 70, z: 8020 },
            { type: 'iv:mtank', x: 7900, y: 70, z: 7980 },
            { type: 'iv:car',   x: 8090, y: 70, z: 7990 }
        ]
    },

    // 沙海装甲走廊：中图，载具主导
    desert: {
        id: 'desert',
        name: '沙海·装甲走廊',
        desc: '开阔地，坦克与直升机主场，狙击位充足',
        size: 'medium',
        modes: ['conquest'],
        spawns: {
            bf6_red:  { x: 16200, y: 70, z: 16000, yaw: -90 },
            bf6_blue: { x: 15800, y: 70, z: 16000, yaw: 90  }
        },
        flags: [
            { id: 'A', x: 16120, y: 66, z: 16060, r: 16, name: '油井' },
            { id: 'B', x: 16000, y: 66, z: 16000, r: 14, name: '十字路口' },
            { id: 'C', x: 15880, y: 66, z: 15940, r: 16, name: '雷达站' }
        ],
        br: { cx: 16000, cz: 16000, r0: 300, rEnd: 60 },
        vehicles: [
            { type: 'iv:mtank', x: 16180, y: 70, z: 16030 },
            { type: 'iv:mtank', x: 15820, y: 70, z: 15970 },
            { type: 'iv:heli',  x: 16170, y: 72, z: 16000 },
            { type: 'iv:heli',  x: 15830, y: 72, z: 16000 },
            { type: 'iv:car',   x: 16190, y: 70, z: 15980 }
        ]
    },

    // 雪线白桦林：大逃杀专用
    alpine: {
        id: 'alpine',
        name: '雪线·白桦林',
        desc: '高差大，树林与岩壁掩体，适合缩圈生存',
        size: 'medium',
        modes: ['br'],
        spawns: {
            bf6_red:  { x: 24000, y: 90, z: 24150, yaw: 180 },
            bf6_blue: { x: 24000, y: 90, z: 23850, yaw: 0   }
        },
        flags: [],
        br: { cx: 24000, cz: 24000, r0: 240, rEnd: 30 },
        vehicles: []
    },

    // 九号货柜场：小图，容器迷宫
    industrial: {
        id: 'industrial',
        name: '九号货柜场',
        desc: '集装箱迷宫，近距离缠斗，载具空间有限',
        size: 'small',
        modes: ['conquest', 'br'],
        spawns: {
            bf6_red:  { x: 32090, y: 66, z: 32090, yaw: -135 },
            bf6_blue: { x: 31910, y: 66, z: 31910, yaw: 45   }
        },
        flags: [
            { id: 'A', x: 32050, y: 64, z: 32050, r: 12, name: '吊臂' },
            { id: 'B', x: 32000, y: 64, z: 32000, r: 12, name: '中央堆场' },
            { id: 'C', x: 31950, y: 64, z: 31950, r: 12, name: '控制塔' }
        ],
        br: { cx: 32000, cz: 32000, r0: 160, rEnd: 25 },
        vehicles: [
            { type: 'iv:car', x: 32080, y: 66, z: 32070 }
        ]
    }
}

var MODE_INFO = {
    conquest: {
        id: 'conquest',
        name: '征服',
        sub: 'CONQUEST',
        desc: '占领据点，票数流血，先耗光对方票数者胜',
        duration: 900,
        tickets: 300
    },
    br: {
        id: 'br',
        name: '大逃杀',
        sub: 'BATTLE ROYALE',
        desc: '缩圈生存，最后存活者获胜',
        duration: 1200,
        tickets: 0
    }
}

//#endregion
//#region 大厅搭建
// 虚空平台，一次性 setblock 铺好，不依赖结构文件。

function buildLobby(server) {
    var y = LOBBY.spawn.y
    var dx, dz

    for (dx = -15; dx <= 15; dx++) {
        for (dz = -15; dz <= 15; dz++) {
            server.runCommandSilent(
                'execute in ' + LOBBY.dimension + ' run setblock ' + dx + ' ' + (y - 1) + ' ' + dz + ' minecraft:polished_deepslate'
            )
        }
    }
    for (dx = -15; dx <= 15; dx++) {
        server.runCommandSilent('execute in ' + LOBBY.dimension + ' run setblock ' + dx + ' ' + y + ' -15 minecraft:polished_blackstone_wall')
        server.runCommandSilent('execute in ' + LOBBY.dimension + ' run setblock ' + dx + ' ' + y + ' 15 minecraft:polished_blackstone_wall')
    }
    for (dz = -15; dz <= 15; dz++) {
        server.runCommandSilent('execute in ' + LOBBY.dimension + ' run setblock -15 ' + y + ' ' + dz + ' minecraft:polished_blackstone_wall')
        server.runCommandSilent('execute in ' + LOBBY.dimension + ' run setblock 15 ' + y + ' ' + dz + ' minecraft:polished_blackstone_wall')
    }

    // 两个终端讲台
    server.runCommandSilent('execute in ' + LOBBY.dimension + ' run setblock ' + LOBBY.terminal.x + ' ' + y + ' ' + LOBBY.terminal.z + ' minecraft:lectern')
    server.runCommandSilent('execute in ' + LOBBY.dimension + ' run setblock ' + LOBBY.mode.x + ' ' + y + ' ' + LOBBY.mode.z + ' minecraft:lectern')

    // 中央准备区
    server.runCommandSilent('execute in ' + LOBBY.dimension + ' run setblock ' + LOBBY.spawn.x + ' ' + (y - 1) + ' ' + LOBBY.spawn.z + ' minecraft:lodestone')
    server.runCommandSilent('execute in ' + LOBBY.dimension + ' run setblock ' + LOBBY.ready.x + ' ' + (y - 1) + ' ' + LOBBY.ready.z + ' minecraft:polished_deepslate')

    console.info('[BF6] lobby built')
}

//#endregion
//#region 大厅阶段

global.BF6.lobbyTimer = 0
global.BF6.readyCount = 0
global.BF6.lobbyBuilt = false

global.BF6._lobbyTick = function (server) {
    global.BF6.lobbyTimer++

    if (!global.BF6.lobbyBuilt) {
        buildLobby(server)
        global.BF6.lobbyBuilt = true
    }

    if (global.BF6.lobbyTimer % 5 !== 0) return

    var v = global.BF6.vote
    var mapName  = v.map  ? global.BF6.maps[v.map].name : '未选择'
    var modeName = v.mode ? MODE_INFO[v.mode].name      : '未选择'
    var total = onlinePlayers(server).length
    var ready = recountReady(server)

    onlinePlayers(server).forEach(function (u) {
        bar(server, u, JSON.stringify({
            text: '§8[§6BF6§8] §7地图 §f' + mapName + ' §8| §7模式 §f' + modeName +
                  ' §8| §7准备 §a' + ready + '§7/§f' + total
        }))
    })

    // 全员准备 + 已选图选模式 → 开简报
    if (total > 0 && ready >= total && v.map && v.mode) {
        startBriefing(server)
    }
}

PlayerEvents.loggedIn(function (event) {
    var server = event.server
    var name = nameOf(event.player)
    if (!name) return

    global.BF6.players[name] = newPlayer(name)
    recountReady(server)

    if (global.BF6.state === S.LOBBY) {
        toLobby(server, name)
        clearInv(server, name)
        title(server, name, '§6§lBF6', '§7等待部署 · 右键终端选图 / 选模式', 10, 50, 20)
    } else {
        server.runCommandSilent('gamemode spectator ' + name)
        server.runCommandSilent('tellraw ' + name + ' {"text":"§e对局进行中，下一局加入","color":"yellow"}')
    }
})

PlayerEvents.loggedOut(function (event) {
    var name = nameOf(event.player)
    if (!name) return
    delete global.BF6.players[name]
    if (global.BF6.vote.votes) delete global.BF6.vote.votes[name]
    delete global.BF6.readySet[name]
    recountReady(event.server)
})

// 大厅里右键讲台 = 打开选择菜单
BlockEvents.rightClicked('minecraft:lectern', function (event) {
    if (global.BF6.state !== S.LOBBY) return
    var block = event.block
    if (block.y !== LOBBY.spawn.y) return

    var who = nameOf(event.player)
    if (!who) return

    if (block.x > 4) {
        showMapMenu(event.server, who)
        event.cancel()
    } else if (block.x < -4) {
        showModeMenu(event.server, who)
        event.cancel()
    }
})

//#endregion
//#region 选择菜单

function showMapMenu(server, username) {
    server.runCommandSilent('tellraw ' + username + ' {"text":"§8──── §6选择地图 §8────"}')
    Object.keys(global.BF6.maps).forEach(function (key) {
        var m = global.BF6.maps[key]
        var modes = m.modes.map(function (x) { return MODE_INFO[x].name }).join('/')
        server.runCommandSilent(
            'tellraw ' + username + ' ' + JSON.stringify({
                text: '§f' + m.name + ' §8(' + modes + ') §7— ' + m.desc,
                clickEvent: { action: 'run_command', value: '/bf6 vote map ' + m.id },
                hoverEvent: { action: 'show_text', contents: '点击投票' }
            })
        )
    })
    server.runCommandSilent('tellraw ' + username + ' {"text":"§8──────────────"}')
}

function showModeMenu(server, username) {
    server.runCommandSilent('tellraw ' + username + ' {"text":"§8──── §6选择模式 §8────"}')
    Object.keys(MODE_INFO).forEach(function (key) {
        var mo = MODE_INFO[key]
        server.runCommandSilent(
            'tellraw ' + username + ' ' + JSON.stringify({
                text: '§f' + mo.name + ' §8(' + mo.sub + ') §7— ' + mo.desc,
                clickEvent: { action: 'run_command', value: '/bf6 vote mode ' + mo.id },
                hoverEvent: { action: 'show_text', contents: '点击投票' }
            })
        )
    })
    server.runCommandSilent('tellraw ' + username + ' {"text":"§8──────────────"}')
}

//#endregion
//#region 投票统计

function setMapVote(server, username, mapId) {
    var map = global.BF6.maps[mapId]
    if (!map) return
    global.BF6.vote.votes[username] = global.BF6.vote.votes[username] || {}
    global.BF6.vote.votes[username].map = mapId
    recountVotes(server)
    server.runCommandSilent('tellraw ' + username + ' {"text":"§a已投票：' + map.name + '","color":"green"}')
}

function setModeVote(server, username, modeId) {
    if (!MODE_INFO[modeId]) return
    global.BF6.vote.votes[username] = global.BF6.vote.votes[username] || {}
    global.BF6.vote.votes[username].mode = modeId
    recountVotes(server)
    server.runCommandSilent('tellraw ' + username + ' {"text":"§a已投票：' + MODE_INFO[modeId].name + '","color":"green"}')
}

function recountVotes(server) {
    var v = global.BF6.vote
    var mapCount = {}, modeCount = {}

    Object.keys(v.votes).forEach(function (who) {
        var x = v.votes[who]
        if (x.map)  mapCount[x.map]   = (mapCount[x.map]   || 0) + 1
        if (x.mode) modeCount[x.mode] = (modeCount[x.mode] || 0) + 1
    })

    v.map  = topKey(mapCount)
    v.mode = topKey(modeCount)

    if (v.map && v.mode && global.BF6.maps[v.map].modes.indexOf(v.mode) < 0) {
        v.mode = global.BF6.maps[v.map].modes[0]
    }
}

function topKey(counts) {
    var best = null, bestN = -1
    Object.keys(counts).forEach(function (k) {
        if (counts[k] > bestN) { best = k; bestN = counts[k] }
    })
    return best
}

function rollRandomMap(modeId) {
    var pool = []
    Object.keys(global.BF6.maps).forEach(function (k) {
        if (global.BF6.maps[k].modes.indexOf(modeId) >= 0) pool.push(global.BF6.maps[k])
    })
    return pool.length ? pick(pool).id : null
}

//#endregion
//#region 开局

function startBriefing(server) {
    var v = global.BF6.vote

    if (!v.mode) v.mode = 'conquest'
    if (!v.map)  v.map  = rollRandomMap(v.mode)
    if (!v.map) {
        bc(server, '§c没有可用地图，请检查 maps 配置')
        return
    }

    var map = global.BF6.maps[v.map]
    if (map.modes.indexOf(v.mode) < 0) v.mode = map.modes[0]

    global.BF6.state = S.BRIEFING
    global.BF6.timer = 10

    autoBalance(server)

    onlinePlayers(server).forEach(function (u) {
        var c = TEAM_COLOR[teamOf(u)] || '§7'
        title(server, u,
            '§6' + map.name,
            c + MODE_INFO[v.mode].name + ' §7· 10 秒后部署',
            10, 70, 20
        )
        server.runCommandSilent('gamemode adventure ' + u)
        clearInv(server, u)
    })

    bc(server, '§8──────── §6BF6 §8────────')
    bc(server, '§7地图 §f' + map.name + ' §8— §7' + map.desc)
    bc(server, '§7模式 §f' + MODE_INFO[v.mode].name + ' §8— §7' + MODE_INFO[v.mode].desc)
    bc(server, '§8──────────────────────')
}

global.BF6._briefingTick = function (server) {
    global.BF6.timer--

    if (global.BF6.timer > 0) {
        if (global.BF6.timer <= 5) {
            var n = global.BF6.timer
            onlinePlayers(server).forEach(function (u) {
                title(server, u, '§e' + n, '', 0, 20, 5)
            })
        }
        return
    }

    var v = global.BF6.vote
    if (v.mode === 'conquest') {
        startConquest(server, global.BF6.maps[v.map])
    } else {
        startBattleRoyale(server, global.BF6.maps[v.map])
    }
}

//#endregion
//#region 命令

ServerEvents.commandRegistry(function (event) {
    var Commands = event.commands
    var Arguments = event.arguments

    // 权限：OP 专属的子命令各自挂 requires(2)；
    // vote / class 开放给所有人，否则大厅讲台的 clickEvent 对非 OP 无效。
    function opOnly(src) { return src.hasPermission(2) }

    var root = Commands.literal('bf6')

        .then(Commands.literal('start')
            .requires(opOnly)
            .then(Commands.argument('mode', Arguments.STRING.create(event))
                .suggests(function (ctx, b) { b.suggest('conquest'); b.suggest('br'); return b.build() })
                .executes(function (ctx) {
                    var server = ctx.source.server
                    var mode = Arguments.STRING.getResult(ctx, 'mode')
                    if (!MODE_INFO[mode]) return 0
                    global.BF6.vote.mode = mode
                    global.BF6.vote.map  = global.BF6.vote.map || rollRandomMap(mode)
                    // OP 强制开局：把所有在线玩家标记为已准备，再走统一的开局流程
                    onlinePlayers(server).forEach(function (u) {
                        global.BF6.readySet[u] = true
                    })
                    recountReady(server)
                    startBriefing(server)
                    return 1
                })))

        .then(Commands.literal('stop')
            .requires(opOnly)
            .executes(function (ctx) { endMatch(ctx.source.server, 'admin'); return 1 }))

        .then(Commands.literal('map')
            .requires(opOnly)
            .then(Commands.argument('id', Arguments.STRING.create(event))
                .suggests(function (ctx, b) {
                    Object.keys(global.BF6.maps).forEach(function (k) { b.suggest(k) })
                    return b.build()
                })
                .executes(function (ctx) {
                    var server = ctx.source.server
                    var id = Arguments.STRING.getResult(ctx, 'id')
                    if (!global.BF6.maps[id]) return 0
                    global.BF6.vote.map = id
                    bc(server, '§a地图锁定：' + global.BF6.maps[id].name)
                    return 1
                })))

        // vote / class：所有人可用（大厅讲台靠它们工作）
        .then(Commands.literal('vote')
            .then(Commands.literal('map')
                .then(Commands.argument('id', Arguments.STRING.create(event))
                    .suggests(function (ctx, b) {
                        Object.keys(global.BF6.maps).forEach(function (k) { b.suggest(k) })
                        return b.build()
                    })
                    .executes(function (ctx) {
                        var who = nameOf(ctx.source.player)
                        if (!who) return 0
                        setMapVote(ctx.source.server, who,
                                   Arguments.STRING.getResult(ctx, 'id'))
                        return 1
                    })))
            .then(Commands.literal('mode')
                .then(Commands.argument('id', Arguments.STRING.create(event))
                    .suggests(function (ctx, b) { b.suggest('conquest'); b.suggest('br'); return b.build() })
                    .executes(function (ctx) {
                        var who = nameOf(ctx.source.player)
                        if (!who) return 0
                        setModeVote(ctx.source.server, who,
                                    Arguments.STRING.getResult(ctx, 'id'))
                        return 1
                    }))))

        // ready：所有人可用（否则非 OP 的队友无法表示就绪）
        .then(Commands.literal('ready')
            .executes(function (ctx) {
                var server = ctx.source.server
                var who = nameOf(ctx.source.player)
                if (who) global.BF6.readySet[who] = true
                recountReady(server)
                return 1
            }))

        .then(Commands.literal('class')
            .then(Commands.argument('id', Arguments.STRING.create(event))
                .suggests(function (ctx, b) {
                    Object.keys(LOADOUTS).forEach(function (k) { b.suggest(k) })
                    return b.build()
                })
                .executes(function (ctx) {
                    var server = ctx.source.server
                    var id = Arguments.STRING.getResult(ctx, 'id')
                    var name = nameOf(ctx.source.player)
                    if (!name || !LOADOUTS[id]) return 0
                    P(name).klass = id
                    server.runCommandSilent('tellraw ' + name + ' {"text":"§a兵种切换：' + LOADOUTS[id].name + '","color":"green"}')
                    return 1
                })))

        .then(Commands.literal('bot')
            .requires(opOnly)
            .then(Commands.argument('count', Arguments.INTEGER.create(event))
                .then(Commands.argument('team', Arguments.STRING.create(event))
                    .suggests(function (ctx, b) { b.suggest('bf6_red'); b.suggest('bf6_blue'); return b.build() })
                    .executes(function (ctx) {
                        spawnBots(ctx.source.server,
                            Arguments.INTEGER.getResult(ctx, 'count'),
                            Arguments.STRING.getResult(ctx, 'team'))
                        return 1
                    }))))

        .then(Commands.literal('lobby')
            .requires(opOnly)
            .executes(function (ctx) {
                endMatch(ctx.source.server, 'admin')
                return 1
            }))

        .then(Commands.literal('status')
            .executes(function (ctx) {
                var server = ctx.source.server
                var v = global.BF6.vote
                bc(server, '§7状态 §f' + global.BF6.state + ' §8| §7地图 §f' + (v.map || '-') +
                          ' §8| §7模式 §f' + (v.mode || '-'))
                return 1
            }))

    event.register(root)
})

//#endregion


// ================================================================
//  SOURCE: 02_conquest.js
// ================================================================

// ============================================================
//  BF6-MC  |  02_conquest.js
//  征服模式：多点占领 / 票数流血 / 兵种装备 / 重生
// ============================================================

//#region 常量

var CQ = {
    TICKETS: 300,
    DURATION: 900,
    RESPAWN_DELAY: 5,
    CAP_RATE: 1,
    FLAG_MAX: 100,
    BLEED_PER_FLAG: 1
}

//#endregion
//#region 开局

function startConquest(server, map) {
    global.BF6.state = S.PLAYING
    global.BF6.timer = CQ.DURATION
    global.BF6.bots.bf6_red  = 0
    global.BF6.bots.bf6_blue = 0

    global.BF6.match = {
        mode: 'conquest',
        map: map,
        tickets: { bf6_red: CQ.TICKETS, bf6_blue: CQ.TICKETS },
        flags: map.flags.map(function (f) {
            return {
                id: f.id, name: f.name,
                x: f.x, y: f.y, z: f.z, r: f.r,
                owner: null,
                progress: 0,
                contested: false
            }
        }),
        respawnQueue: [],
        startedAt: global.BF6.tick,
        endedAt: null
    }

    onlinePlayers(server).forEach(function (u) {
        var p = P(u)
        p.kills = 0; p.deaths = 0; p.assists = 0; p.score = 0
        p.alive = true; p.streak = 0; p.brLives = 1
        p.downed = false; p.reviveTicks = 0

        var sp = map.spawns[p.team] || map.spawns.bf6_red
        tp(server, u, WORLD, sp.x, sp.y, sp.z, sp.yaw, 0)
        server.runCommandSilent('gamemode survival ' + u)
        server.runCommandSilent('effect give ' + u + ' minecraft:resistance 3 255 true')
        giveLoadout(server, u, p.klass)
    })

    spawnVehicles(server, map)

    bc(server, '§8──────── §6征服 §8────────')
    bc(server, '§7占领 §f' + map.flags.length + ' §7个据点，每多占一个点，敌方票数流失更快')
    bc(server, '§7先耗尽对方 §c300 §7票数者胜')
    bc(server, '§8─────────────────────')
}

//#endregion
//#region 主循环

global.BF6._playingTick = function (server) {
    var m = global.BF6.match
    if (!m) return

    global.BF6.timer--

    if (m.mode === 'conquest') tickConquest(server, m)
    else if (m.mode === 'br')  tickBattleRoyale(server, m)

    if (global.BF6.timer <= 0) {
        endMatch(server, 'timeout')
    }
}

function tickConquest(server, m) {
    var players = Object.keys(global.BF6.players)

    // 1. 占领点进度
    m.flags.forEach(function (f) {
        var red = 0, blue = 0

        players.forEach(function (u) {
            var p = global.BF6.players[u]
            if (!p.alive || p.downed) return
            var pl = server.getPlayer(u)
            if (!pl) return

            var d = Math.sqrt(
                Math.pow(pl.x - f.x, 2) +
                Math.pow(pl.y - f.y, 2) +
                Math.pow(pl.z - f.z, 2)
            )
            if (d > f.r) return

            if (p.team === 'bf6_red')  red++
            if (p.team === 'bf6_blue') blue++
        })

        f.contested = red > 0 && blue > 0

        // 争夺中进度冻结
        if (f.contested) return

        if (red > 0 && blue === 0) {
            f.progress = Math.min(CQ.FLAG_MAX, f.progress + red * CQ.CAP_RATE)
        } else if (blue > 0 && red === 0) {
            f.progress = Math.max(-CQ.FLAG_MAX, f.progress - blue * CQ.CAP_RATE)
        } else if (red === 0 && blue === 0 &&
                   f.progress !== 0 && f.progress !== CQ.FLAG_MAX && f.progress !== -CQ.FLAG_MAX) {
            f.progress += f.progress > 0 ? -0.5 : 0.5
        }

        if (f.progress >= CQ.FLAG_MAX && f.owner !== 'bf6_red') {
            f.owner = 'bf6_red'
            announceFlag(server, f, 'bf6_red')
        } else if (f.progress <= -CQ.FLAG_MAX && f.owner !== 'bf6_blue') {
            f.owner = 'bf6_blue'
            announceFlag(server, f, 'bf6_blue')
        }
    })

    // 2. 票数流血
    var redFlags  = m.flags.filter(function (f) { return f.owner === 'bf6_red' }).length
    var blueFlags = m.flags.filter(function (f) { return f.owner === 'bf6_blue' }).length
    var diff = redFlags - blueFlags

    if (diff > 0) {
        m.tickets.bf6_blue -= diff * CQ.BLEED_PER_FLAG
    } else if (diff < 0) {
        m.tickets.bf6_red -= (-diff) * CQ.BLEED_PER_FLAG
    }

    m.tickets.bf6_red  = Math.max(0, m.tickets.bf6_red)
    m.tickets.bf6_blue = Math.max(0, m.tickets.bf6_blue)

    // 3. 重生队列
    var now = global.BF6.tick / 20
    m.respawnQueue = m.respawnQueue.filter(function (r) {
        if (now >= r.at) {
            respawnConquest(server, r.name)
            return false
        }
        return true
    })

    // 4. HUD
    if (global.BF6.tick % 20 === 0) {
        renderConquestHUD(server, m, redFlags, blueFlags)
    }

    // 5. 胜负
    if (m.tickets.bf6_red <= 0)  return endMatch(server, 'bf6_blue')
    if (m.tickets.bf6_blue <= 0) return endMatch(server, 'bf6_red')
}

//#endregion
//#region 占领点播报

function announceFlag(server, flag, team) {
    var c = TEAM_COLOR[team]
    var label = team === 'bf6_red' ? 'RED' : 'BLUE'
    bc(server, '§8[§6据点§8] ' + c + label + ' §7夺取了 §f' + flag.id + ' · ' + flag.name)
    onlinePlayers(server).forEach(function (u) {
        bar(server, u, JSON.stringify({ text: c + label + ' §7占领 §f' + flag.id }))
    })
}

//#endregion
//#region HUD

function renderConquestHUD(server, m, redFlags, blueFlags) {
    var t = mmss(global.BF6.timer)
    var r = m.tickets.bf6_red
    var b = m.tickets.bf6_blue

    var flagBar = m.flags.map(function (f) {
        if (f.owner === 'bf6_red')  return '§c[' + f.id + ']'
        if (f.owner === 'bf6_blue') return '§9[' + f.id + ']'
        if (f.contested)            return '§e[' + f.id + ']'
        return '§8[' + f.id + ']'
    }).join('')

    onlinePlayers(server).forEach(function (u) {
        var p = global.BF6.players[u]
        if (!p) return
        var myTickets    = p.team === 'bf6_red' ? r : b
        var enemyTickets = p.team === 'bf6_red' ? b : r
        var tc = TEAM_COLOR[p.team] || '§7'

        bar(server, u, JSON.stringify({
            text: tc + myTickets + ' §8| ' + flagBar + ' §8| §7' + t + ' §8| §f' + enemyTickets
        }))
    })

    if (r <= 50 || b <= 50) {
        var lowTeam = r <= 50 ? 'bf6_red' : 'bf6_blue'
        if (global.BF6.tick % 100 === 0) {
            bcTeam(server, lowTeam, '§c⚠ 票数告急：' + (lowTeam === 'bf6_red' ? r : b))
        }
    }
}

//#endregion
//#region 兵种装备

var LOADOUTS = {
    assault: {
        name: '突击兵',
        desc: '中距离主力，步枪 + 医疗包',
        items: [
            'tacz:modern_kinetic_gun{GunId:"tacz:ak47",GunCurrentAmmoCount:30}',
            'tacz:ammo{Type:"tacz:762x39",Count:120}',
            'minecraft:golden_apple 2',
            'minecraft:cooked_beef 8'
        ]
    },
    engineer: {
        name: '工程兵',
        desc: '反载具，SMG + 维修工具',
        items: [
            'tacz:modern_kinetic_gun{GunId:"tacz:mp5",GunCurrentAmmoCount:30}',
            'tacz:ammo{Type:"tacz:9mm",Count:150}',
            'iv:repair_pack 2',
            'minecraft:cooked_beef 8'
        ]
    },
    support: {
        name: '支援兵',
        desc: '火力压制，LMG + 弹药箱',
        items: [
            'tacz:modern_kinetic_gun{GunId:"tacz:m249",GunCurrentAmmoCount:100}',
            'tacz:ammo{Type:"tacz:556x45",Count:300}',
            'minecraft:cooked_beef 8'
        ]
    },
    recon: {
        name: '侦察兵',
        desc: '远距离，狙击 + 望远镜',
        items: [
            'tacz:modern_kinetic_gun{GunId:"tacz:m700",GunCurrentAmmoCount:5}',
            'tacz:ammo{Type:"tacz:762x51",Count:60}',
            'minecraft:spyglass',
            'minecraft:cooked_beef 8'
        ]
    },
    medic: {
        name: '医疗兵',
        desc: '救援核心，SMG + 大量医疗物资',
        items: [
            'tacz:modern_kinetic_gun{GunId:"tacz:ump45",GunCurrentAmmoCount:25}',
            'tacz:ammo{Type:"tacz:45acp",Count:200}',
            'firstaid:bandage 16',
            'firstaid:plaster 8',
            'minecraft:cooked_beef 8'
        ]
    }
}

function giveLoadout(server, username, klass) {
    var lo = LOADOUTS[klass] || LOADOUTS.assault
    clearInv(server, username)

    lo.items.forEach(function (spec) {
        var m = spec.match(/^(.+?)(?:\s+(\d+))?$/)
        if (!m) return
        var itemId = m[1]
        var count = m[2] ? parseInt(m[2]) : 1
        server.runCommandSilent('give ' + username + ' ' + itemId + ' ' + count)
    })

    server.runCommandSilent('tellraw ' + username + ' {"text":"§a兵种：' + lo.name + ' §8— §7' + lo.desc + '","color":"green"}')
}

//#endregion
//#region 死亡与重生

EntityEvents.death('minecraft:player', function (event) {
    var server = event.server
    var name = nameOf(event.entity)
    if (!name) return

    var m = global.BF6.match
    if (!m) return

    var p = P(name)
    p.deaths++
    p.alive = false
    p.downed = false
    p.streak = 0

    var killer = event.source.player
    if (killer) {
        var kn = nameOf(killer)
        if (kn && kn !== name) {
            var kp = P(kn)
            kp.kills++
            kp.score += 100
            kp.streak++
            p.lastDamager = kn

            killFeed(server, kn, name, '§8[枪械]')

            if (kp.streak === 3)  bc(server, '§6' + kn + ' §7正在 §c3 §7连杀')
            if (kp.streak === 5)  bc(server, '§6' + kn + ' §7正在 §c5 §7连杀 §8(统治战场)')
            if (kp.streak === 10) bc(server, '§6' + kn + ' §7正在 §c10 §7连杀 §8(无法阻挡)')
        }
    } else {
        killFeed(server, null, name, null)
    }

    if (m.mode === 'conquest') {
        m.respawnQueue.push({
            name: name,
            at: global.BF6.tick / 20 + CQ.RESPAWN_DELAY
        })
        title(server, name, '§c阵亡', '§7' + CQ.RESPAWN_DELAY + ' 秒后重生', 0, 60, 20)
    }

    if (m.mode === 'br') {
        onBRDeath(server, name)
    }
})

function respawnConquest(server, name) {
    var m = global.BF6.match
    if (!m) return

    var p = P(name)
    p.alive = true
    p.downed = false
    p.reviveTicks = 0

    var sp = m.map.spawns[p.team] || m.map.spawns.bf6_red
    tp(server, name, WORLD, sp.x, sp.y, sp.z, sp.yaw, 0)
    server.runCommandSilent('gamemode survival ' + name)
    server.runCommandSilent('effect clear ' + name)
    giveLoadout(server, name, p.klass)

    title(server, name, '§a部署', '', 0, 20, 10)
}

//#endregion
//#region 载具刷新

function spawnVehicles(server, map) {
    if (!map.vehicles || !map.vehicles.length) return

    map.vehicles.forEach(function (v) {
        server.runCommandSilent(
            'execute in ' + WORLD + ' run summon ' + v.type + ' ' + v.x + ' ' + v.y + ' ' + v.z
        )
    })
    console.info('[BF6] vehicles spawned: ' + map.vehicles.length)
}

//#endregion


// ================================================================
//  SOURCE: 03_battle_royale.js
// ================================================================

// ============================================================
//  BF6-MC  |  03_battle_royale.js
//  大逃杀：缩圈 / 空投 / 单命淘汰
// ============================================================

//#region 常量

var BR = {
    DURATION: 1200,
    ZONE_START_DELAY: 90,
    ZONE_INTERVAL: 120,
    ZONE_STEPS: 5,
    LOOT_PER_ZONE: 3,
    START_LIVES: 1
}

//#endregion
//#region 开局

function startBattleRoyale(server, map) {
    global.BF6.state = S.PLAYING
    global.BF6.timer = BR.DURATION
    global.BF6.bots.bf6_red  = 0
    global.BF6.bots.bf6_blue = 0

    var cfg = map.br || { cx: 0, cz: 0, r0: 200, rEnd: 40 }

    global.BF6.match = {
        mode: 'br',
        map: map,
        zone: {
            cx: cfg.cx, cz: cfg.cz,
            r: cfg.r0,
            r0: cfg.r0,
            rEnd: cfg.rEnd,
            step: 0,
            nextShrinkAt: BR.ZONE_START_DELAY
        },
        alive: {},
        respawnQueue: [],
        startedAt: global.BF6.tick,
        endedAt: null
    }

    var names = onlinePlayers(server)

    names.forEach(function (u, i) {
        var p = P(u)
        p.kills = 0; p.deaths = 0; p.assists = 0; p.score = 0
        p.alive = true; p.downed = false; p.streak = 0
        p.reviveTicks = 0
        p.brLives = BR.START_LIVES
        p.team = null
        server.runCommandSilent('team leave ' + u)

        var ang = (Math.PI * 2 / Math.max(1, names.length)) * i + Math.random() * 0.4
        var dist = cfg.r0 * 0.75
        var x = Math.round(cfg.cx + Math.cos(ang) * dist)
        var z = Math.round(cfg.cz + Math.sin(ang) * dist)
        var y = 120

        tp(server, u, WORLD, x, y, z, 0, 0)
        server.runCommandSilent('gamemode survival ' + u)
        server.runCommandSilent('effect give ' + u + ' minecraft:slow_falling 20 0 true')

        global.BF6.match.alive[u] = true
        giveBRStarter(server, u)
    })

    bc(server, '§8──────── §6大逃杀 §8────────')
    bc(server, '§7跳伞落地，搜集装备，活到最后')
    bc(server, '§7' + Math.floor(BR.ZONE_START_DELAY / 60) + ' 分 ' + (BR.ZONE_START_DELAY % 60) + ' 秒后开始缩圈')
    bc(server, '§8─────────────────────')

    onlinePlayers(server).forEach(function (u) {
        title(server, u, '§6§lBATTLE ROYALE', '§7活到最后', 20, 60, 20)
    })
}

function giveBRStarter(server, username) {
    clearInv(server, username)
    server.runCommandSilent('give ' + username + ' minecraft:stone_sword 1')
    server.runCommandSilent('give ' + username + ' minecraft:bread 4')
    server.runCommandSilent('give ' + username + ' firstaid:bandage 4')
}

//#endregion
//#region 主循环

function tickBattleRoyale(server, m) {
    var elapsed = Math.floor((global.BF6.tick - m.startedAt) / 20)
    var z = m.zone

    // 1. 缩圈
    if (elapsed >= z.nextShrinkAt && z.step < BR.ZONE_STEPS) {
        z.step++
        var t = z.step / BR.ZONE_STEPS
        z.r = z.r0 + (z.rEnd - z.r0) * t
        z.nextShrinkAt = elapsed + BR.ZONE_INTERVAL

        bc(server, '§8[§6缩圈§8] §7安全区缩小至 §f' + Math.round(z.r) + ' §7格 §8(' + z.step + '/' + BR.ZONE_STEPS + ')')
        onlinePlayers(server).forEach(function (u) {
            title(server, u, '§e缩圈', '§7半径 ' + Math.round(z.r), 0, 40, 10)
        })

        for (var i = 0; i < BR.LOOT_PER_ZONE; i++) {
            dropAirdrop(server, m, z)
        }
    }

    // 2. 圈外伤害
    Object.keys(m.alive).forEach(function (u) {
        if (!m.alive[u]) return
        var pl = server.getPlayer(u)
        if (!pl) return

        var d = Math.sqrt(
            Math.pow(pl.x - z.cx, 2) + Math.pow(pl.z - z.cz, 2)
        )
        if (d > z.r) {
            server.runCommandSilent('effect give ' + u + ' minecraft:wither 1 0 true')
            bar(server, u, JSON.stringify({ text: '§c⚠ 你在安全区外' }))
        }
    })

    // 3. HUD
    if (global.BF6.tick % 20 === 0) {
        renderBRHUD(server, m, elapsed)
    }

    // 4. 胜负
    var aliveList = Object.keys(m.alive).filter(function (u) { return m.alive[u] })
    if (aliveList.length <= 1) {
        endMatch(server, aliveList[0] || 'draw')
    }
}

//#endregion
//#region HUD

function renderBRHUD(server, m, elapsed) {
    var z = m.zone
    var aliveCount = Object.keys(m.alive).filter(function (u) { return m.alive[u] }).length
    var t = mmss(global.BF6.timer)
    var nextShrink = Math.max(0, z.nextShrinkAt - elapsed)

    Object.keys(m.alive).forEach(function (u) {
        if (!m.alive[u]) return
        var p = global.BF6.players[u]
        if (!p) return
        bar(server, u, JSON.stringify({
            text: '§6存活 §f' + aliveCount + ' §8| §7圈 §f' + Math.round(z.r) +
                  '§7格 §8| §7缩圈 §f' + nextShrink + 's §8| §7' + t +
                  ' §8| §a' + p.kills + ' §7杀'
        }))
    })
}

//#endregion
//#region 空投

function dropAirdrop(server, m, zone) {
    var ang = Math.random() * Math.PI * 2
    var dist = Math.random() * zone.r * 0.8
    var x = Math.round(zone.cx + Math.cos(ang) * dist)
    var z = Math.round(zone.cz + Math.sin(ang) * dist)
    var y = 140

    var items = [
        '{Slot:0b,id:"tacz:modern_kinetic_gun",Count:1b,tag:{GunId:"tacz:ak47",GunCurrentAmmoCount:30}}',
        '{Slot:1b,id:"tacz:ammo",Count:120b,tag:{Type:"tacz:762x39"}}',
        '{Slot:2b,id:"firstaid:bandage",Count:8b}',
        '{Slot:3b,id:"minecraft:golden_apple",Count:2b}'
    ].join(',')

    server.runCommandSilent(
        'execute in ' + WORLD + ' run setblock ' + x + ' ' + y + ' ' + z +
        ' minecraft:chest{Items:[' + items + ']}'
    )
    server.runCommandSilent(
        'execute in ' + WORLD + ' run setblock ' + x + ' ' + (y + 1) + ' ' + z + ' minecraft:beacon'
    )

    bc(server, '§8[§6空投§8] §7坐标 §f' + x + ' ' + z)
}

//#endregion
//#region 死亡处理

function onBRDeath(server, name) {
    var m = global.BF6.match
    if (!m || m.mode !== 'br') return

    var p = P(name)
    p.brLives--
    m.alive[name] = false

    if (p.brLives <= 0) {
        p.alive = false
        server.runCommandSilent('gamemode spectator ' + name)
        server.runCommandSilent('effect clear ' + name)

        var aliveCount = Object.keys(m.alive).filter(function (u) { return m.alive[u] }).length
        title(server, name, '§c§l淘汰', '§7排名 §f#' + (aliveCount + 1), 10, 60, 20)
        bc(server, '§8[§c淘汰§8] ' + name + ' §7出局 §8(剩余 ' + aliveCount + ')')
    }
}

global.BF6._onEliminated = function (server, name) {
    var m = global.BF6.match
    if (!m) return
    if (m.mode === 'br') onBRDeath(server, name)
}

//#endregion


// ================================================================
//  SOURCE: 04_ai_bots.js
// ================================================================

// ============================================================
//  BF6-MC  |  04_ai_bots.js
//  1-3 人补位：Villager Recruits 批量生成 / 阵营 / 补位
// ============================================================

//#region 常量

var BOT = {
    DEFAULT_PER_TEAM: 4,
    MAX_PER_TEAM: 8,
    RESPAWN_BATCH: 2
}

//#endregion
//#region 生成

function spawnBots(server, n, teamId) {
    var m = global.BF6.match
    if (!m) {
        console.warn('[BF6] 未在对局中，无法生成 AI')
        return
    }

    var map = m.map
    var sp = map.spawns[teamId]
    if (!sp) return

    var teamColor = teamId === 'bf6_red' ? 'red' : 'blue'
    var prefix = teamId === 'bf6_red' ? '§c' : '§9'

    for (var i = 0; i < n; i++) {
        var isRanged = Math.random() < 0.4
        var ox = sp.x + (Math.random() - 0.5) * 12
        var oz = sp.z + (Math.random() - 0.5) * 12

        var handItems = isRanged
            ? '{id:"minecraft:bow",Count:1b},{id:"minecraft:arrow",Count:32b}'
            : '{id:"minecraft:iron_sword",Count:1b},{}'

        var armorItems = [
            '{id:"minecraft:iron_helmet",Count:1b}',
            '{id:"minecraft:iron_chestplate",Count:1b}',
            '{id:"minecraft:iron_leggings",Count:1b}',
            '{id:"minecraft:iron_boots",Count:1b}'
        ].join(',')

        var nbt = [
            'Faction:"' + teamId + '"',
            'TeamColor:"' + teamColor + '"',
            'CustomName:\'{"text":"' + prefix + 'BOT-' + (i + 1) + '","italic":false}\'',
            'CustomNameVisible:1b',
            'PersistenceRequired:1b',
            'Health:20.0f',
            'HandItems:[' + handItems + ']',
            'ArmorItems:[' + armorItems + ']'
        ].join(',')

        server.runCommandSilent(
            'execute in ' + WORLD + ' run summon recruits:recruit ' +
            ox.toFixed(1) + ' ' + sp.y + ' ' + oz.toFixed(1) + ' {' + nbt + '}'
        )
    }

    console.info('[BF6] bots spawned: ' + n + ' for ' + teamId)
}

//#endregion
//#region 补位

/**
 * 每队 AI 计数。
 * 用纯数字而不是数组：AI 会被玩家杀死、被其他 mod 清理、区块卸载后重生成，
 * 数实体太贵（每秒一次 × 两支队伍），所以用"生成数 - 已知死亡数"的近似，
 * 并在每局开始时归零。这个近似对补位目标来说足够。
 */
function countBots(server, teamId) {
    var v = global.BF6.bots[teamId]
    return typeof v === 'number' ? v : 0
}

function maintainBots(server) {
    var m = global.BF6.match
    if (!m) return
    if (m.mode !== 'conquest' && m.mode !== 'br') return

    ;['bf6_red', 'bf6_blue'].forEach(function (teamId) {
        var playerCount = teamPlayers(teamId).filter(function (p) { return !p.isBot }).length
        var target = Math.min(BOT.MAX_PER_TEAM, Math.max(BOT.DEFAULT_PER_TEAM, playerCount + 1))
        var actual = countBots(server, teamId)

        if (actual < target) {
            var batch = Math.min(BOT.RESPAWN_BATCH, target - actual)
            spawnBots(server, batch, teamId)
            global.BF6.bots[teamId] = actual + batch
        }
    })
}

//#endregion
//#region 初始化

global.BF6.bots = {
    bf6_red: 0,
    bf6_blue: 0
}

//#endregion


// ================================================================
//  SOURCE: 05_results.js
// ================================================================

// ============================================================
//  BF6-MC  |  05_results.js
//  结算面板 / 回大厅 / 跨局统计
// ============================================================

//#region 结算

function endMatch(server, winner) {
    var m = global.BF6.match
    if (!m) {
        global.BF6.state = S.LOBBY
        global.BF6.timer = 0
        return
    }

    m.endedAt = global.BF6.tick
    global.BF6.state = S.RESULT
    global.BF6.timer = 15

    var board = buildScoreboard(m, winner)
    global.BF6.lastResult = board

    onlinePlayers(server).forEach(function (u) {
        server.runCommandSilent('gamemode adventure ' + u)
        server.runCommandSilent('effect clear ' + u)
        server.runCommandSilent('clear ' + u)
    })

    clearBots(server, m)
    clearVehicles(server, m)

    renderResultPanel(server, board)
}

function buildScoreboard(m, winner) {
    var rows = Object.keys(global.BF6.players)
        .map(function (k) { return global.BF6.players[k] })
        .filter(function (p) { return !p.isBot })
        .map(function (p) {
            return {
                name: p.name,
                team: p.team,
                kills: p.kills,
                deaths: p.deaths,
                assists: p.assists,
                score: p.score + p.kills * 100,
                kd: p.deaths === 0 ? String(p.kills) : (p.kills / p.deaths).toFixed(2)
            }
        })
        .sort(function (a, b) { return b.score - a.score })

    return {
        mode: m.mode,
        mapName: m.map.name,
        winner: winner,
        duration: Math.floor((global.BF6.tick - m.startedAt) / 20),
        rows: rows,
        tickets: m.tickets || null,
        brAlive: m.alive ? Object.keys(m.alive).filter(function (u) { return m.alive[u] }) : null
    }
}

//#endregion
//#region 结算面板

function renderResultPanel(server, board) {
    var modeName = MODE_INFO[board.mode] ? MODE_INFO[board.mode].name : board.mode
    var headline, subline

    if (board.winner === 'draw') {
        headline = '§7平局'
        subline  = '§7双方同时耗尽'
    } else if (board.winner === 'admin') {
        headline = '§7对局终止'
        subline  = '§7管理员中止'
    } else if (board.winner === 'timeout') {
        headline = '§7时间耗尽'
        subline  = '§7按当前比分判定'
    } else if (board.mode === 'br') {
        headline = '§6' + board.winner + ' §7胜出'
        subline  = '§7最后存活者'
    } else {
        var c = TEAM_COLOR[board.winner] || '§7'
        var label = board.winner === 'bf6_red' ? 'RED' : 'BLUE'
        headline = c + '§l' + label + ' §7胜利'
        subline  = board.tickets
            ? ('§7票数 §c' + board.tickets.bf6_red + ' §8: §9' + board.tickets.bf6_blue)
            : ''
    }

    onlinePlayers(server).forEach(function (u) {
        title(server, u, headline, subline, 10, 100, 20)
    })

    bc(server, '')
    bc(server, '§8──────── §6战报 §8────────')
    bc(server, '§7地图 §f' + board.mapName + ' §8| §7模式 §f' + modeName +
               ' §8| §7时长 §f' + mmss(board.duration))
    bc(server, '§8──────────────────────')
    bc(server, '§7  玩家            击杀  死亡  K/D    分数')

    board.rows.forEach(function (r, i) {
        var c = TEAM_COLOR[r.team] || '§7'
        var rank = String(i + 1)
        while (rank.length < 2) rank = ' ' + rank
        var name = padRight(r.name, 14)
        var k = padLeft(String(r.kills), 4)
        var d = padLeft(String(r.deaths), 4)
        var kd = padLeft(String(r.kd), 6)
        var sc = padLeft(String(r.score), 6)

        bc(server, '§8' + rank + ' ' + c + name + ' §f' + k + ' ' + d + ' ' + kd + ' ' + sc)
    })

    bc(server, '§8──────────────────────')

    onlinePlayers(server).forEach(function (u) {
        var prof = profile(server, u)
        bc(server, '§8' + u + ' §7生涯：§f' + prof.kills + '§7 杀 / §f' +
                   prof.matches + '§7 场 / §f' + prof.wins + '§7 胜')
    })

    bc(server, '')
    bc(server, '§715 秒后返回大厅')
}

function padRight(s, n) {
    s = String(s)
    while (s.length < n) s += ' '
    return s.slice(0, n)
}

function padLeft(s, n) {
    s = String(s)
    while (s.length < n) s = ' ' + s
    return s
}

//#endregion
//#region 结算阶段

global.BF6._resultTick = function (server) {
    global.BF6.timer--

    if (global.BF6.timer % 5 === 0 && global.BF6.timer > 0) {
        onlinePlayers(server).forEach(function (u) {
            bar(server, u, JSON.stringify({ text: '§7返回大厅 §f' + global.BF6.timer + 's' }))
        })
    }

    if (global.BF6.timer <= 0) {
        backToLobby(server)
    }
}

function backToLobby(server) {
    var board = global.BF6.lastResult
    if (board) {
        board.rows.forEach(function (r) {
            var prof = profile(server, r.name)
            prof.kills   += r.kills
            prof.deaths  += r.deaths
            prof.matches += 1
            if (board.winner === r.team) prof.wins += 1
            if (board.mode === 'br' && board.winner === r.name) prof.wins += 1
            saveProfile(server, r.name, prof)
        })
    }

    global.BF6.match = null
    global.BF6.state = S.LOBBY
    global.BF6.timer = 0
    global.BF6.lobbyTimer = 0
    global.BF6.readyCount = 0
    global.BF6.readySet = {}
    global.BF6.vote.votes = {}
    global.BF6.vote.map = null
    global.BF6.vote.mode = null

    ensureTeams(server)

    onlinePlayers(server).forEach(function (u) {
        var p = P(u)
        p.kills = 0; p.deaths = 0; p.assists = 0; p.score = 0
        p.alive = true; p.downed = false; p.streak = 0; p.brLives = 1
        setTeam(server, u, null)
        toLobby(server, u)
        clearInv(server, u)
        title(server, u, '§6§lBF6', '§7返回大厅', 10, 40, 20)
    })

    bc(server, '§a已返回大厅，选择地图与模式开始下一局')
}

//#endregion
//#region 清理

function clearBots(server, m) {
    server.runCommandSilent('execute in ' + WORLD + ' run kill @e[type=recruits:recruit]')
    global.BF6.bots.bf6_red  = 0
    global.BF6.bots.bf6_blue = 0
}

function clearVehicles(server, m) {
    var types = ['iv:mtank', 'iv:car', 'iv:heli', 'iv:truck', 'iv:plane', 'iv:boat']
    types.forEach(function (t) {
        server.runCommandSilent('execute in ' + WORLD + ' run kill @e[type=' + t + ']')
    })
}

//#endregion


// ================================================================
//  SOURCE: 06_feed_damage.js
// ================================================================

// ============================================================
//  BF6-MC  |  06_feed_damage.js
//  击杀播报 / 伤害记账 / 倒地救援整合
// ============================================================

//#region 常量

var DAMAGE_WINDOW = 200

global.BF6.damageLog = {}

//#endregion
//#region 伤害记账

EntityEvents.hurt('minecraft:player', function (event) {
    var victim = event.entity
    var name = nameOf(victim)
    if (!name) return

    var attacker = event.source.player
    if (!attacker) return
    var an = nameOf(attacker)
    if (!an || an === name) return

    if (!global.BF6.damageLog[name]) global.BF6.damageLog[name] = {}
    global.BF6.damageLog[name][an] = global.BF6.tick
})

function assistantsOf(victimName, killerName) {
    var log = global.BF6.damageLog[victimName]
    if (!log) return []
    var now = global.BF6.tick
    var out = []
    Object.keys(log).forEach(function (who) {
        if (who !== killerName && now - log[who] <= DAMAGE_WINDOW) out.push(who)
    })
    return out
}

//#endregion
//#region 击杀播报

function killFeed(server, killerName, victimName, weapon) {
    var vp = P(victimName)
    var vc = TEAM_COLOR[vp.team] || '§7'
    var w = weapon || '§8[枪械]'

    if (!killerName) {
        bc(server, '§8» ' + vc + victimName + ' §7阵亡')
        return
    }

    var kp = P(killerName)
    var kc = TEAM_COLOR[kp.team] || '§7'
    bc(server, '§8» ' + kc + killerName + ' ' + w + ' ' + vc + victimName)
}

//#endregion
//#region 倒地检测

EntityEvents.hurt('minecraft:player', function (event) {
    var victim = event.entity
    var name = nameOf(victim)
    if (!name) return

    var p = global.BF6.players[name]
    if (!p) return

    var hp = healthOf(victim)
    if (!p.downed && hp <= 4 && hp > 0) {
        var m = global.BF6.match
        if (!m) return

        p.downed = true
        p.reviveTicks = 0

        var c = TEAM_COLOR[p.team] || '§7'
        bcTeam(event.server, p.team, '§8[§6倒地§8] ' + c + name + ' §7需要救援 §8(30 秒)')
        title(event.server, name, '§c倒地', '§7等待队友救援', 0, 40, 10)
    }
})

//#endregion
//#region 救援检测
// 不在 EntityEvents.tick 里做（每玩家每 tick 一次，开销大且 server 引用不稳），
// 改为由 00_core 的秒级主循环统一扫描，见 reviveScan()。

function reviveScan(server) {
    var m = global.BF6.match
    if (!m) return

    Object.keys(global.BF6.players).forEach(function (name) {
        var p = global.BF6.players[name]
        if (!p || !p.downed) return

        var pl = server.getPlayer(name)
        if (!pl) return
        if (healthOf(pl) < 12) return

        p.downed = false
        p.reviveTicks = 0
        p.score += 50

        var nearest = null, nd = 64
        teamPlayers(p.team).forEach(function (t) {
            if (t.name === name) return
            var other = server.getPlayer(t.name)
            if (!other) return
            var d = Math.sqrt(
                Math.pow(other.x - pl.x, 2) +
                Math.pow(other.y - pl.y, 2) +
                Math.pow(other.z - pl.z, 2)
            )
            if (d < nd) { nd = d; nearest = t.name }
        })

        if (nearest) {
            P(nearest).score += 75
            bcTeam(server, p.team, '§8[§a救援§8] ' + nearest + ' §7救起了 §f' + name)
        }
        title(server, name, '§a已救起', '', 0, 30, 10)
    })
}

//#endregion
//#region 占点得分

function conquestPointScore(server, m) {
    if (m.mode !== 'conquest') return

    Object.keys(global.BF6.players).forEach(function (u) {
        var p = global.BF6.players[u]
        if (!p.alive || p.downed) return

        var pl = server.getPlayer(u)
        if (!pl) return

        m.flags.forEach(function (f) {
            if (f.owner !== p.team) return
            var d = Math.sqrt(
                Math.pow(pl.x - f.x, 2) + Math.pow(pl.y - f.y, 2) + Math.pow(pl.z - f.z, 2)
            )
            if (d <= f.r) p.score += 2
        })
    })
}

global.BF6._pointScoreHook = function (server) {
    var m = global.BF6.match
    if (!m) return
    conquestPointScore(server, m)
}

//#endregion
//#region 大逃杀即时结算

EntityEvents.death('minecraft:player', function (event) {
    var m = global.BF6.match
    if (!m || m.mode !== 'br') return
    var aliveList = Object.keys(m.alive).filter(function (u) { return m.alive[u] })
    if (aliveList.length <= 1) {
        endMatch(event.server, aliveList[0] || 'draw')
    }
})

//#endregion


// ================================================================
//  SOURCE: 07_hud.js
// ================================================================

// ============================================================
//  BF6-MC  |  07_hud.js
//  Sidebar 计分板 / 队伍状态
// ============================================================

//#region Sidebar

function setupSidebar(server) {
    server.runCommandSilent('scoreboard objectives remove bf6_sidebar')
    server.runCommandSilent('scoreboard objectives add bf6_sidebar dummy {"text":"§6§lBF6"}')
    server.runCommandSilent('scoreboard objectives setdisplay sidebar bf6_sidebar')
}

function updateSidebar(server) {
    var m = global.BF6.match
    var state = global.BF6.state
    var lines = []

    if (state === S.LOBBY) {
        var v = global.BF6.vote
        lines.push('§7状态 §f大厅')
        lines.push('§7地图 §f' + (v.map ? global.BF6.maps[v.map].name : '未选'))
        lines.push('§7模式 §f' + (v.mode ? MODE_INFO[v.mode].name : '未选'))
        lines.push('§7准备 §a' + global.BF6.readyCount + '§7/§f' + onlinePlayers(server).length)
        lines.push('§8─────────')
        lines.push('§7右键终端选图/模式')
        lines.push('§7/bf6 ready 全员准备')
    } else if (m) {
        lines.push('§7' + m.map.name)
        lines.push('§8─────────')

        if (m.mode === 'conquest') {
            lines.push('§cRED  §f' + m.tickets.bf6_red)
            lines.push('§9BLUE §f' + m.tickets.bf6_blue)
            lines.push('§8─────────')
            m.flags.forEach(function (f) {
                var mark = '§8○'
                if (f.owner === 'bf6_red')  mark = '§c●'
                if (f.owner === 'bf6_blue') mark = '§9●'
                if (f.contested)            mark = '§e◐'
                lines.push(mark + ' §f' + f.id + ' §7' + f.name)
            })
        } else {
            var alive = Object.keys(m.alive).filter(function (u) { return m.alive[u] }).length
            lines.push('§6存活 §f' + alive)
            lines.push('§7圈 §f' + Math.round(m.zone.r) + '§7格')
        }

        lines.push('§8─────────')
        lines.push('§7时间 §f' + mmss(global.BF6.timer))
    }

    // 局内追加小队状态
    if (state === S.PLAYING && m) {
        teamLines(server).forEach(function (l) { lines.push(l) })
    }

    // 用假玩家作为行；先清空再写
    server.runCommandSilent('scoreboard players reset * bf6_sidebar')

    lines.forEach(function (text, i) {
        // 行内容唯一化：靠前面的不可见空格区分
        var pad = ''
        for (var k = 0; k < i; k++) pad += ' '
        var key = '§r' + pad + text
        server.runCommandSilent(
            'scoreboard players set ' + JSON.stringify(key) + ' bf6_sidebar ' + (lines.length - i)
        )
    })
}

//#endregion
//#region 队伍状态
// 注意：actionbar 只有一个槽位，模式 HUD 已经在用它。
// 所以队伍状态并入 sidebar，不再单独占 actionbar，避免互相覆盖。

function teamLines(server) {
    var m = global.BF6.match
    if (!m) return []

    var p0 = global.BF6.players[onlinePlayers(server)[0]]
    var teamId = p0 ? p0.team : 'bf6_red'
    var mine = teamPlayers(teamId)
    if (!mine.length) return []

    var out = ['§8── §7小队 §8──']
    mine.forEach(function (p) {
        var state = p.downed ? '§c✚' : (p.alive ? '§a●' : '§8○')
        out.push(state + ' §f' + p.name)
    })
    return out
}

//#endregion
//#region 挂载

global.BF6._hudTick = function (server) {
    updateSidebar(server)
}

ServerEvents.loaded(function (event) {
    setupSidebar(event.server)
})

//#endregion

