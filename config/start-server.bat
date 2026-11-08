@echo off
REM ============================================================
REM  BF6-MC 服务端启动脚本
REM  Forge 40.2.21 / MC 1.18.2 / Java 17
REM ============================================================

setlocal

REM ── 按你的实际路径改 ──
set JAVA_EXE="C:\Program Files\Java\jdk-17\bin\java.exe"
set SERVER_JAR=forge-1.18.2-40.2.21.jar
set MIN_RAM=4G
set MAX_RAM=6G

REM ── Aikar 的 G1GC 参数（1.18 服务端实测最稳）──
set JVM_ARGS=-XX:+UseG1GC ^
 -XX:+ParallelRefProcEnabled ^
 -XX:MaxGCPauseMillis=200 ^
 -XX:+UnlockExperimentalVMOptions ^
 -XX:+DisableExplicitGC ^
 -XX:+AlwaysPreTouch ^
 -XX:G1NewSizePercent=30 ^
 -XX:G1MaxNewSizePercent=40 ^
 -XX:G1HeapRegionSize=8M ^
 -XX:G1ReservePercent=20 ^
 -XX:G1HeapWastePercent=5 ^
 -XX:G1MixedGCCountTarget=4 ^
 -XX:InitiatingHeapOccupancyPercent=15 ^
 -XX:G1MixedGCLiveThresholdPercent=90 ^
 -XX:G1RSetUpdatingPauseTimePercent=5 ^
 -XX:SurvivorRatio=32 ^
 -XX:+PerfDisableSharedMem ^
 -XX:MaxTenuringThreshold=1 ^
 -Dusing.aikars.flags=https://mcflags.emc.gs ^
 -Daikars.new.flags=true

echo.
echo ============================================
echo   BF6-MC Server  ^|  1.18.2 / Forge 40.2.21
echo   RAM: %MIN_RAM% - %MAX_RAM%
echo ============================================
echo.

REM 自动重启循环（崩了 5 秒后重开）
:start
%JAVA_EXE% -Xms%MIN_RAM% -Xmx%MAX_RAM% %JVM_ARGS% -jar %SERVER_JAR% nogui

echo.
echo 服务器已退出，5 秒后重启...（Ctrl+C 取消）
timeout /t 5 /nobreak >nul
goto start
