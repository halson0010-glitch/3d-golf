@echo off
cd /d "%~dp0"
where node >nul 2>nul
if %errorlevel%==0 (
  node local-server.mjs
) else (
  "%LOCALAPPDATA%\OpenAI\Codex\bin\node.exe" local-server.mjs
)
pause
