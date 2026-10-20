@echo off
chcp 65001 >nul
title Остановка проекта
cd /d "%~dp0"

echo 🛑 Остановка базы данных...
docker compose down

echo ✅ База данных остановлена. 
echo (Окна с бэкендом и фронтендом закройте вручную)
timeout /t 3