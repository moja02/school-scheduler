@echo off
chcp 65001 >nul
echo ========================================================
echo       نظام الجدولة الذكي - تشغيل الخادم
echo ========================================================
echo.

set PYTHON_CMD=python
if exist "C:\Users\HP\AppData\Local\Programs\Python\Python312\python.exe" (
    set PYTHON_CMD="C:\Users\HP\AppData\Local\Programs\Python\Python312\python.exe"
)

echo Starting AI Scheduling Web System...
start http://127.0.0.1:8000
%PYTHON_CMD% app.py
pause
