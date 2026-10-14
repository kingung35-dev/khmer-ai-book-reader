@echo off
chcp 65001 > nul
title Khmer AI Book Reader
cd /d "%~dp0"
cls

echo ====================================================
echo   🇰🇭 Khmer AI Book Reader — កម្មវិធីអានសៀវភៅ PDF
echo   ប្រព័ន្ធប្រតិបត្តិការ Windows (Windows Edition)
echo ====================================================
echo.

:: 1. ពិនិត្យមើលវត្តមានរបស់ Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [កំហុស] មិនទាន់មាន Node.js លើកុំព្យូទ័រនេះទេ!
    echo សូមទាញយក និងដំឡើង Node.js LTS ពី៖ https://nodejs.org/
    echo បន្ទាប់ពីដំឡើងរួច សូមបើកឯកសារ start.bat នេះម្តងទៀត។
    echo.
    pause
    exit /b 1
)

:: 2. ពិនិត្យមើលវត្តមានរបស់ node_modules (បើមិនទាន់មាន នឹងដំឡើងស្វ័យប្រវត្តិ)
if not exist "node_modules\" (
    echo 📦 កំពុងដំឡើងបណ្ណាល័យ Dependencies (npm install)...
    call npm install
    echo.
)

:: 3. បើក Browser ស្វ័យប្រវត្តទៅកាន់ Localhost
echo 🌐 កំពុងបើកដំណើរការ Server លើ Windows...
echo 🔗 អាសយដ្ឋាន៖ http://localhost:3000
echo.

start "" "http://localhost:3000"

:: 4. ចាប់ផ្តើម Node Server
node server.js

pause
