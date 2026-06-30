@echo off
REM ===== EduSkill: one-time setup on a new (home) laptop =====
cd /d "%~dp0"
echo ============================================================
echo   EduSkill - First Time Setup
echo ============================================================
echo.
echo This installs dependencies and logs you into Vercel.
echo Make sure you have copied your .env file into this folder.
echo.
pause

echo.
echo [1/2] Installing dependencies (this can take a few minutes)...
call npm install
if errorlevel 1 ( echo. & echo npm install FAILED. Install Node.js from https://nodejs.org first. & pause & exit /b 1 )

echo.
echo [2/2] Logging in to Vercel (a browser window will open)...
call npx vercel login

echo.
echo ============================================================
echo   Setup done. To deploy, double-click  deploy.bat
echo ============================================================
pause
