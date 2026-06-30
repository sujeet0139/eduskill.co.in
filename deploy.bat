@echo off
REM ===== EduSkill: deploy to production (double-click) =====
cd /d "%~dp0"
echo ============================================================
echo   EduSkill - Deploy to Production
echo ------------------------------------------------------------
echo   IMPORTANT: run this on HOME Wi-Fi / mobile hotspot.
echo   It will FAIL on office Wi-Fi (Zscaler blocks Vercel).
echo ============================================================
echo.

echo Getting the latest code from GitHub...
call git pull origin main

echo.
node deploy.js
echo.
pause
