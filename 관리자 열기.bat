@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Printelier 관리자를 시작합니다...
start "" http://localhost:3210
node admin-server.js
pause
