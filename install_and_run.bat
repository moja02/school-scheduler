@echo off
chcp 65001 >nul
color 0B
echo ========================================================
echo       نظام الجدولة الذكي - مدير التثبيت والتشغيل
echo ========================================================
echo.

set PYTHON_CMD=python
if exist "C:\Users\HP\AppData\Local\Programs\Python\Python312\python.exe" (
    set PYTHON_CMD="C:\Users\HP\AppData\Local\Programs\Python\Python312\python.exe"
)

echo جاري فحص وتثبيت المكتبات المطلوبة (يرجى الانتظار)...
%PYTHON_CMD% -m pip install --upgrade pip >nul 2>&1
%PYTHON_CMD% -m pip install flask ortools PyQt6

echo.
echo ========================================================
echo     تم التثبيت بنجاح! جاري تشغيل الخادم الذكي...
echo ========================================================
echo.

start http://127.0.0.1:8000
%PYTHON_CMD% app.py
pause
