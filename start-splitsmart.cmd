@echo off
rem SplitSmart one-click dev launcher (Windows).
rem Double-click this file to start everything: Docker services, database
rem migrations, the auth issuer, the API, and the web app.
title SplitSmart
cd /d "%~dp0"

where pnpm >nul 2>nul
if errorlevel 1 (
  echo pnpm is not installed. Install Node 20+ and run: corepack enable
  pause
  exit /b 1
)

docker info >nul 2>nul
if errorlevel 1 (
  echo Docker Desktop is not running. Start Docker Desktop, then run this again.
  pause
  exit /b 1
)

echo Starting SplitSmart... (Ctrl+C to stop everything)
call pnpm dev:local
if errorlevel 1 (
  echo.
  echo SplitSmart did not start cleanly - see the messages above.
)
pause
