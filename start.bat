@echo off
chcp 65001 >nul
title Запуск проекта "Карта мира"
cd /d "%~dp0"

echo ========================================
echo 🚀 ЗАПУСК ПРОЕКТА "ИНТЕРАКТИВНАЯ КАРТА"
echo ========================================

echo [1/3] Запуск базы данных (Docker)...
docker compose up -d
if %errorlevel% neq 0 (
    echo ❌ Ошибка запуска Docker. Убедитесь, что Docker Desktop запущен!
    pause
    exit /b
)
echo ✅ База данных запущена.

echo [2/3] Запуск бэкенда (Python/FastAPI)...
:: Открываем новое окно, переходим в backend, активируем venv и запускаем uvicorn
start "Backend - FastAPI" cmd /k "cd backend && call venv\Scripts\activate.bat && uvicorn main:app --reload"

echo [3/3] Запуск фронтенда (React/Vite)...
:: Открываем новое окно, переходим во frontend и запускаем npm
start "Frontend - React" cmd /k "cd frontend && npm run dev"

echo ⏳ Ожидание запуска сервисов (5 секунд)...
timeout /t 5 /nobreak >nul

echo 🌐 Открываем браузер...
start http://localhost:5173

echo ========================================
echo ✅ Всё готово! Приятной работы.
echo ========================================
echo (Это окно можно закрыть)
timeout /t 5