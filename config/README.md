# 预配置文件

这些是 1.18.2 + 本包这套 mod 的推荐配置。放到 `.minecraft/config/` 或服务端 `config/`。

⚠️ **首次启动后**再覆盖，否则 mod 会用默认值重建，把你的配置冲掉。

---

## parcool-client.toml（键位 + 手感）

```toml
[controls]
    # 滑铲
    keyCrawl = "key.keyboard.left.control"
    # 翻滚
    keyRoll = "key.keyboard.c"
    # 快速跑
    keyFastRun = "key.keyboard.left.alt"
    # 攀爬杆
    keyClimbPole = "key.keyboard.w"
    # 抓墙
    keyClingToCliff = "key.keyboard.left.shift"

[limitations]
    # 体力上限，BF 里不需要太硬核
    maxStamina = 3000
    # 恢复速度
    staminaRecoverySpeed = 30
    # 允许无限体力（调试用）
    allowInfiniteStamina = false
    # 滑铲消耗
    staminaConsumptionOfSlide = 40

[animation]
    # 开启滑铲动画
    enableSlideAnimation = true
    # 开启翻滚动画
    enableRollAnimation = true
```

---

## tacz-client.toml（枪械手感）

```toml
[general]
    # 关闭双次渲染瞄准镜（1.18.2 有 bug）
    scopeDoubleRender = false
    # 显示弹药百分比
    showAmmoAsPercentage = false
    # 高级提示显示枪械 ID
    showGunIdInTooltip = true

[controls]
    keyReload = "key.keyboard.r"
    keyAim = "key.mouse.right"
    keyFireMode = "key.keyboard.b"
    keyInspect = "key.mouse.middle"
    keyMelee = "key.keyboard.f"

[visual]
    # 第一人称 FOV 随移动速度变化（关掉更稳）
    fovChangeOnMove = false
```

---

## firstaid-common.toml（部位伤害）

```toml
[general]
    # 开启分部位伤害
    enableDebuffs = true
    # 头部伤害倍率（爆头即死）
    headDamageMultiplier = 4.0
    # 躯干
    bodyDamageMultiplier = 1.0
    # 四肢（打断腿会减速）
    limbDamageMultiplier = 0.6
    # 允许自然恢复
    enableNaturalRegeneration = false
    # 流血速度
    bleedSpeed = 1.0
```

---

## recruits-server.toml（AI 补位）

服务端的在 `world/serverconfig/recruits-server.toml`，客户端的在 `config/recruits-client.toml`。

```toml
[general]
    # 每队最大 NPC 数
    maxRecruitsPerTeam = 8
    # 每队最大玩家数
    maxPlayersPerTeam = 4
    # 关闭招募付费（战场模式不需要经济）
    needsPayment = false
    # 关闭维护费
    upkeepEnabled = false
    # 关闭更新检查
    disableUpdateChecker = true

[combat]
    # 友伤
    friendlyFire = false
    # 远程兵种需要箭
    needArrowsToShoot = true
    # 弓箭清理（性能）
    arrowCleaner = true

[performance]
    # 异步寻路线程
    pathfindingThreads = 2
    # 异步目标选择线程
    targetSelectionThreads = 2
```

---

## immersive_vehicles 相关

IV 的配置在 `config/immersive_vehicles/` 下，按内容包分文件。关键项：

```toml
# config/immersive_vehicles/general.toml
[general]
    # 允许外部伤害（枪弹/爆炸能打伤载具）
    allowExternalDamage = true
    # 载具受爆炸伤害
    ignoreExplosiveDamage = false
    # 玩家在载具内是否受伤
    damagePlayersInVehicles = true

[physics]
    # 载具重力
    gravity = 1.0
    # 碰撞伤害
    collisionDamage = true
```

---

## voicechat（Simple Voice Chat）

`config/voicechat/voicechat-server.properties`：

```properties
port=24454
max_voice_distance=48.0
crouch_distance_multiplier=0.5
whisper_distance_multiplier=0.5
codec=VOIP
mtu_size=1024
enable_groups=true
```

- `max_voice_distance=48`：BF 里 48 格差不多是一个街区，能听到队友喊话但听不到对面
- `enable_groups=true`：开启小队频道（`/voicechat group`）

---

## server.properties（服务端）

```properties
online-mode=true
max-players=8
view-distance=8
simulation-distance=6
allow-flight=true
spawn-protection=0
enable-command-block=true
sync-chunk-writes=false
network-compression-threshold=256
```

`allow-flight=true` 是必须的 —— IV 直升机 + ParCool 的滑翔会被反作弊踢。
