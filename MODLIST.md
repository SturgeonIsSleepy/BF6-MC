# BF6-MC 整合包 · 精简模组清单（1.18.2 / Forge 40.2.21）

> 目标：1–3 人 + AI 补位，跑完整 BF6 流程（主菜单 → 大厅 → 选图选模式 → 征服 / 大逃杀 → 结算）。
> 原则：**只留必要**。每个模组都要么承担一个不可替代的功能，要么是硬依赖。可选项全部单独标注。

---

## 0. 前置

| 项 | 值 |
|---|---|
| Minecraft | 1.18.2 |
| Forge | **40.2.21**（1.18.2 末版，别用 40.1.x） |
| Java | **17**（Forge 1.18.2 强制） |
| 内存 | 客户端 6G / 服务端 6G（1–3 人 + 载具 + AI，4G 会 OOM） |

---

## 1. 必须装（核心 17 个）

### 1.1 枪械

| 模组 | 文件 | 端 | 说明 |
|---|---|---|---|
| **[TaCZ] Timeless and Classics Zero** | `tacz-1.18.2-1.1.4-hotfix2.jar` | 双 | 现代枪械框架：后坐力、弹道下坠、开镜、配件、趴射、枪托近战 |
| GeckoLib | `geckolib-forge-1.18-3.0.57.jar` | 双 | TaCZ 硬依赖（动画） |

> 键位：TaCZ 的「开火 / 瞄准 / 换弹 / 检视 / 切换射击模式 / 枪托攻击」全部在 `选项 → 控制 → 按键绑定 → TaCZ` 独立分类里，**不与原版冲突**。

### 1.2 载具

| 模组 | 文件 | 端 | 说明 |
|---|---|---|---|
| **Immersive Vehicles (IV/MTS)** | `Immersive Vehicles-1.18.2-24.0.0.jar` | 双 | 载具物理内核：轮式/履带/飞行/浮力、分部件损伤、燃料、多人同乘 |
| IV Official Content Pack | 1.18.2 对应版 | 双 | 官方飞机/汽车/坦克/直升机/卡车 |
| UNU Parts Pack | 1.18.2 对应版 | 双 | 零件库（引擎/履带/炮塔/座椅），UNU Military 的硬依赖 |
| UNU Military Pack | `UNU Military Pack [MTS] 1.18.2-22.18.0-6.0.3.jar` | 双 | 军用载具：装甲车、坦克、两栖车 |

> 键位：IV 的载具控制是**载具内动态绑定**（进入载具后 WASD 直接生效，其余在 `IV 载具设置` 里改），不占用原版键位。

### 1.3 战斗规则

| 模组 | 文件 | 端 | 说明 |
|---|---|---|---|
| **PlayerRevive** | `PlayerRevive_FORGE_v2.0.14_mc1.18.2.jar` | 双 | 倒地/流血/队友救援 —— BF 的 revive 循环 |
| CreativeCore | 1.18.2 对应版 | 双 | PlayerRevive 硬依赖 |
| **FirstAid** | `firstaid-1.11.2.jar` | 双 | 分部位伤害（头/胸/四肢），爆头即死；1.11.1 起原生兼容 PlayerRevive |
| **ParCool** | `ParCool-1.18.2-3.4.3.3.jar` | 双 | 滑铲、翻越、蹬墙、攀爬、翻滚、体力条 |

> ParCool 键位最多（默认占用左 Alt / 左 Ctrl / R 等），进游戏第一件事就是去 `控制 → 按键绑定 → ParCool` 全部重绑到鼠标侧键或小键盘。

### 1.4 AI 补位

| 模组 | 文件 | 端 | 说明 |
|---|---|---|---|
| **Villager Recruits** | `recruits-1.18.2-1.13.2.jar` | 双 | 1–3 人局的人数补位。支持 faction/敌我关系、编队、巡逻、远程兵种、AI 寻路异步化（作者实测 1000v1000 不掉 TPS） |

> 选它而不是 Easy NPC：Easy NPC 是「站桩对话 NPC」，不会打仗；Recruits 有真正的战斗 AI、阵营、友伤规则，能被 KubeJS 用命令批量召唤和编队。

### 1.5 主菜单 / 脚本

| 模组 | 文件 | 端 | 说明 |
|---|---|---|---|
| **FancyMenu** | `fancymenu_forge_3.7.0_MC_1.18.2.jar` | 客户端 | 把主菜单换成 BF6 风格 |
| Konkrete | `konkrete_forge_1.8.0_MC_1.18-1.18.2.jar` | 客户端 | FancyMenu 硬依赖 |
| **KubeJS** | `kubejs-forge-1802.5.5-build.569.jar` | 双 | 全部玩法逻辑（大厅/征服/大逃杀/AI/HUD） |
| Rhino | KubeJS 依赖，随包 | 双 | KubeJS 的 JS 引擎 |
| Architectury API | 1.18.2 Forge 版 | 双 | KubeJS 硬依赖 |

### 1.6 语音

| 模组 | 文件 | 端 | 说明 |
|---|---|---|---|
| **Simple Voice Chat** | `voicechat-forge-1.18.2-2.6.22.jar` | 双 | 3D 空间语音 + 小队频道。**UDP 24454** 必须放行 |

---

## 2. 强烈建议装（性能，5 个）

没有这 5 个，IV 载具 + TaCZ 弹道 + AI 会让 1.18.2 掉到 30 帧以下。

| 模组 | 文件 | 说明 |
|---|---|---|
| Rubidium | 1.18.2 | Sodium 的 Forge 移植，帧数翻倍 |
| FerriteCore | 1.18.2 | 内存占用降 30%+ |
| EntityCulling | 1.18.2 | 载具/AI 多时救命 |
| Starlight | 1.18.2 | 光照引擎重写，区块加载快 |
| MemoryLeakFix | 1.18.2 | 长局不爆内存 |

---

## 3. 可选（按需加，默认不装）

| 模组 | 为什么可选 | 加了会怎样 |
|---|---|---|
| Oculus + 光影包 | 帧数换画质 | 4G 显存以下别开 |
| JEI | 1–3 人玩固定装备，不需要查配方 | 只是方便 |
| First-person Model | 第一人称看到自己身体，趴下/滑铲视觉正确 | 和 ParCool 一起用体验明显更好 |
| Not Enough Animations | 第三人称动作自然化 | 纯观感 |
| Shoulder Surfing Reloaded | 越肩视角 | 与 ParCool 的翻越动画有轻微冲突，需在配置里关掉 ParCool 的相机修正 |

---

## 4. 明确排除（以及为什么）

| 排除项 | 原因 |
|---|---|
| **Superb Warfare** | 只有 1.20.1/1.21.1，NeoForge→Forge 40 API 断层，等于重做 |
| **Valkyrien Skies 2 + Eureka** | 1.18.2 只有 2023 年的 2.1.1-beta.5，与 IV 同装必炸。做 BF 玩法选 IV（成品载具），不选 VS（自己造船） |
| **Create + Create Big Cannons** | 引入整套 Create 科技线，1–3 人用不上，且与 IV 有方块交互冲突 |
| **Small Ships** | 海战图在 1–3 人规模下不成立 |
| **Immersive Aircraft** | 功能被 IV 官方包覆盖，多一个飞行模型 = 多一份冲突面 |
| **Timeless and Classics Guns 0.3.10.2（旧 TaC）** | 要 Framework + Obfuscate，枪包格式与 TaCZ 1.1.4 不兼容 |
| **Vell's Modern Warfare / IAV Parts** | 与 UNU 内容重复，载具零件 ID 会打架 |
| **squadtp / classroadout / squadtp-conquest** | 只有 1.20.1+，本包用 KubeJS 重写同等逻辑 |
| **Sound Physics Remastered** | 只从 1.19 起支持，1.18.2 无正式版 |
| **FTB Teams / FTB Quests** | 用原版 `scoreboard teams` + KubeJS 就够，少一个依赖少一份风险 |

---

## 5. 一键核对表

装完启动，`模组列表` 里应该正好看到这些（共 17 个必须 + 5 个性能 = 22）：

```
必须：tacz / geckolib / immersive_vehicles / iv_content_pack / unu_parts / unu_military
      playerrevive / creativecore / firstaid / parcool / recruits
      fancymenu / konkrete / kubejs / rhino / architectury
      voicechat
性能：rubidium / ferritecore / entityculling / starlight / memoryleakfix
```

少任何一个，`docs/01-安装.md` 里有对应症状对照表。
