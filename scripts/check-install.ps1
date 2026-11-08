# 安装自检脚本
#
# 用法（在 .minecraft 目录下运行）：
#   Windows : powershell -ExecutionPolicy Bypass -File check-install.ps1
#   Linux   : pwsh ./check-install.ps1
#
# 检查项：
#   1. Java 版本是否 17
#   2. Forge 版本是否 40.2.21
#   3. 必需的 mod jar 是否都在 mods/
#   4. KubeJS 脚本是否就位
#   5. FancyMenu 素材是否就位
#   6. 关键配置项是否正确
#
# 兼容 Windows PowerShell 5.1 与 PowerShell 7+

$ErrorActionPreference = 'Continue'
$script:ok = 0
$script:warn = 0
$script:fail = 0

function Pass($m) { Write-Host "  [OK]   $m" -ForegroundColor Green;  $script:ok++ }
function Warn($m) { Write-Host "  [WARN] $m" -ForegroundColor Yellow; $script:warn++ }
function Fail($m) { Write-Host "  [FAIL] $m" -ForegroundColor Red;    $script:fail++ }
function Head($m) { Write-Host ""; Write-Host "== $m ==" -ForegroundColor Cyan }

$root = Get-Location
Write-Host "检查目录: $root"

# ---------------------------------------------------------------- Java
Head "Java"
$javaFound = $false
try {
    $jv = & java -version 2>&1 | Select-Object -First 1
    if ("$jv" -match '"(\d+)\.(\d+)') {
        $major = [int]$Matches[1]
        $minor = [int]$Matches[2]
        if ($major -eq 17 -or ($major -eq 1 -and $minor -eq 17)) {
            Pass "Java 17"
        } else {
            Fail "Java 版本是 $major.$minor，Forge 1.18.2 需要 17"
        }
        $javaFound = $true
    }
} catch { }
if (-not $javaFound) {
    Fail "找不到可用的 java，检查 PATH 或 JAVA_HOME"
}

# ---------------------------------------------------------------- Forge
Head "Forge"
$forgeVer = $null
if (Test-Path 'libraries\net\minecraftforge\forge') {
    $d = Get-ChildItem 'libraries\net\minecraftforge\forge' -Directory -ErrorAction SilentlyContinue |
         Select-Object -First 1
    if ($d) { $forgeVer = $d.Name }
}
if ($forgeVer) {
    if ($forgeVer -like '1.18.2-40.2.21*') { Pass "Forge $forgeVer" }
    else { Fail "Forge 版本是 $forgeVer，需要 1.18.2-40.2.21" }
} else {
    $fj = Get-ChildItem 'mods' -Filter 'forge-*.jar' -ErrorAction SilentlyContinue
    if ($fj) { Pass "找到 $($fj[0].Name)" }
    else { Warn "找不到 Forge 安装痕迹（启动器管理的实例可忽略）" }
}

# ---------------------------------------------------------------- Mods
Head "必需 Mod"

$required = @(
    @{ key = 'tacz';           name = 'Timeless and Classics Zero' }
    @{ key = 'geckolib';       name = 'GeckoLib' }
    @{ key = 'Immersive Vehicles'; name = 'Immersive Vehicles' }
    @{ key = 'unu';            name = 'UNU Parts / Military Pack' }
    @{ key = 'PlayerRevive';   name = 'PlayerRevive' }
    @{ key = 'creativecore';   name = 'CreativeCore' }
    @{ key = 'firstaid';       name = 'FirstAid' }
    @{ key = 'ParCool';        name = 'ParCool' }
    @{ key = 'recruits';       name = 'Villager Recruits' }
    @{ key = 'fancymenu';      name = 'FancyMenu' }
    @{ key = 'konkrete';       name = 'Konkrete' }
    @{ key = 'kubejs';         name = 'KubeJS' }
    @{ key = 'architectury';   name = 'Architectury API' }
    @{ key = 'voicechat';      name = 'Simple Voice Chat' }
)

$performance = @(
    @{ key = 'rubidium';      name = 'Rubidium' }
    @{ key = 'ferritecore';   name = 'FerriteCore' }
    @{ key = 'entityculling'; name = 'EntityCulling' }
    @{ key = 'starlight';     name = 'Starlight' }
    @{ key = 'memoryleakfix'; name = 'MemoryLeakFix' }
)

$mods = @()
if (Test-Path 'mods') {
    $mods = @(Get-ChildItem 'mods' -Filter '*.jar' | ForEach-Object { $_.Name })
    Pass "mods/ 目录有 $($mods.Count) 个 jar"
} else {
    Fail "找不到 mods/ 目录"
}

foreach ($r in $required) {
    $hit = @($mods | Where-Object { $_ -like "*$($r.key)*" })
    if ($hit.Count -gt 0) { Pass $r.name }
    else { Fail "缺少 $($r.name)  (文件名应含 `"$($r.key)`")" }
}

Head "性能 Mod（缺失只警告）"
foreach ($r in $performance) {
    $hit = @($mods | Where-Object { $_ -like "*$($r.key)*" })
    if ($hit.Count -gt 0) { Pass $r.name }
    else { Warn "缺少 $($r.name)，帧数会明显下降" }
}

# ---------------------------------------------------------------- KubeJS
Head "KubeJS 脚本"
$kjs = 'kubejs\server_scripts\bf6.js'
if (Test-Path $kjs) {
    $size = (Get-Item $kjs).Length
    Pass "bf6.js 存在 ($([math]::Round($size/1KB)) KB)"
    $content = Get-Content $kjs -Raw
    if ($content -match '\{\{') { Fail "bf6.js 里有未替换的占位符" }
    else { Pass "无占位符残留" }
    $fnCount = ([regex]::Matches($content, '(?m)^function\s+')).Count
    Pass "顶层函数 $fnCount 个"
} else {
    Fail "缺少 kubejs\server_scripts\bf6.js"
}

$shards = @(Get-ChildItem 'kubejs\server_scripts' -Filter '0*.js' -ErrorAction SilentlyContinue)
if ($shards.Count -gt 0) {
    Fail "发现分片文件 $($shards.Name -join ', ') —— 会与 bf6.js 重复注册事件，删掉"
} else {
    Pass "无分片文件残留"
}

# ---------------------------------------------------------------- FancyMenu
Head "FancyMenu 素材"
$assets = @(
    'background.png','lobby_bg.png','logo.png','scanline.png',
    'btn_single.png','btn_multi.png','btn_settings.png','btn_quit.png',
    'card_info.png','card_mode_conquest.png','card_mode_br.png',
    'card_map_urban.png','card_map_desert.png','card_map_alpine.png','card_map_industrial.png',
    'map_urban_tactical.png','map_desert_tactical.png',
    'map_alpine_tactical.png','map_industrial_tactical.png',
    'hud_topbar.png','hud_class.png','hud_ammo.png','hud_sidebar.png',
    'hud_br_panel.png','result_header.png'
)
$assetDir = 'config\fancymenu\assets'
if (Test-Path $assetDir) {
    $missing = @()
    foreach ($a in $assets) {
        if (-not (Test-Path (Join-Path $assetDir $a))) { $missing += $a }
    }
    if ($missing.Count -eq 0) { Pass "$($assets.Count) 张素材齐全" }
    else { Fail "缺少素材: $($missing -join ', ')" }
} else {
    Fail "找不到 $assetDir，把 fancymenu/assets/*.png 复制过去"
}

# ---------------------------------------------------------------- 配置
Head "关键配置"
$sp = 'server.properties'
if (Test-Path $sp) {
    $props = @{}
    Get-Content $sp | ForEach-Object {
        if ($_ -match '^\s*([^#=]+)=(.*)$') { $props[$Matches[1].Trim()] = $Matches[2].Trim() }
    }
    if ($props['allow-flight'] -eq 'true') { Pass "allow-flight=true" }
    else { Fail "allow-flight 必须为 true（IV 直升机会被反作弊踢）" }

    if ($props['view-distance']) {
        if ([int]$props['view-distance'] -le 10) { Pass "view-distance=$($props['view-distance'])" }
        else { Warn "view-distance 建议 <= 10，当前 $($props['view-distance'])" }
    }
} else {
    Warn "找不到 server.properties（客户端实例可忽略）"
}

# ---------------------------------------------------------------- 汇总
Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host (" 通过 {0}  |  警告 {1}  |  失败 {2}" -f $script:ok, $script:warn, $script:fail) -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

if ($script:fail -gt 0) {
    Write-Host ""
    Write-Host "有 $($script:fail) 项失败，先修完再启动。" -ForegroundColor Red
    Write-Host "对照 docs/01-安装.md 的故障表排查。" -ForegroundColor Red
    exit 1
} elseif ($script:warn -gt 0) {
    Write-Host ""
    Write-Host "可以启动，但有 $($script:warn) 项建议改进。" -ForegroundColor Yellow
    exit 0
} else {
    Write-Host ""
    Write-Host "全部通过，可以启动。" -ForegroundColor Green
    exit 0
}
