@echo off
cd /d "%~dp0"
if not exist .env (
  echo Missing .env file. Copy .env.example to .env and add your OpenRouter key.
  pause
  exit /b 1
)
node --version >nul 2>&1
if errorlevel 1 (
  echo Node.js is not installed. Install Node.js 20 LTS or newer first.
  pause
  exit /b 1
)
node --env-file=.env server.js
pause
