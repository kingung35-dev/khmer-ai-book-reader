@echo off
chcp 65001 > nul
title Khmer AI Book Reader - Auto Updater (Windows)
cd /d "%~dp0"
cls

echo ==========================================================
echo   📖 Khmer AI Book Reader — កម្មវិធី Update ស្វ័យប្រវត្តិ
echo   ប្រព័ន្ធប្រតិបត្តិការ Windows (Windows Edition)
echo ==========================================================
echo.

:: 1. ពិនិត្យមើលវត្តមានរបស់ Git និង Node.js
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [កំហុស] មិនទាន់មាន Git លើកុំព្យូទ័រនេះទេ!
    echo សូមទាញយក និងដំឡើង Git ពី៖ https://git-scm.com/
    pause
    exit /b 1
)

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [កំហុស] មិនទាន់មាន Node.js លើកុំព្យូទ័រនេះទេ!
    echo សូមទាញយក និងដំឡើង Node.js ពី៖ https://nodejs.org/
    pause
    exit /b 1
)

:: 2. បង្ហាញឯកសារដែលបានកែប្រែ
echo 🔍 កំពុងពិនិត្យឯកសារដែលបានកែប្រែ...
git status -s
echo.

:: 3. ទទួលយកសារចំណាំ Update ពីអ្នកប្រើប្រាស់
set "msg="
set /p "msg=📝 សូមបញ្ចូលចំណាំ Update (ឬចុច Enter យកទូទៅ): "
if "%msg%"=="" (
    for /f "tokens=1-4 delims=/ " %%a in ("%date%") do set "currdate=%%c-%%a-%%b"
    for /f "tokens=1-2 delims=: " %%a in ("%time%") do set "currtime=%%a:%%b"
    set "msg=Update: Windows Edition"
)

echo.
echo ⚙️ កំពុងដំណើរការ Auto-Bump Version...

:: 4. ដំណើរការ Bump Version
for /f "tokens=2,3 delims=:" %%a in ('node scripts/bump-version.js "%msg%"') do (
    set "NEW_VERSION=%%a"
    set "BUILD_TAG=%%b"
)

if "%NEW_VERSION%"=="" (
    set "NEW_VERSION=new"
    echo 🚀 បានកែសម្រួលកំណែកម្មវិធីរួចរាល់!
) else (
    echo 🚀 កំណែថ្មីដែលបានបង្កើត៖ v%NEW_VERSION% (Build %BUILD_TAG%)
)

echo.
echo 📤 កំពុង Upload កំណែ v%NEW_VERSION% ទៅកាន់ GitHub & Render.com...
git add .
git commit -m "Update v%NEW_VERSION%: %msg%"
git push origin main

:: 5. ពិនិត្យ និងបញ្ជា Render.com Deploy Hook ប្រសិនបើមានកំណត់ក្នុង .env
set "RENDER_HOOK="
if exist .env (
    for /f "tokens=1,* delims==" %%a in (.env) do (
        if "%%a"=="RENDER_DEPLOY_HOOK" set "RENDER_HOOK=%%b"
    )
)

if not "%RENDER_HOOK%"=="" (
    echo.
    echo 📡 កំពុងផ្ញើសញ្ញា Deploy ទៅកាន់ Render.com...
    curl -s -X POST "%RENDER_HOOK%" >nul 2>nul
    echo ✅ បានបញ្ជា Render.com ឱ្យចាប់ផ្តើម Build & Deploy កំណែថ្មីដោយស្វ័យប្រវត្តិ!
)

echo.
echo ==========================================================
echo   ✅ UPDATE & DEPLOY ជោគជ័យ ១០០%!
echo ==========================================================
echo   📌 កំណែផ្លូវការថ្មី៖ v%NEW_VERSION%
if not "%RENDER_HOOK%"=="" (
    echo   🌐 Cloud (Render.com)៖ កំពុង Deploy ស្វ័យប្រវត្តិ (~១-២ នាទី)
) else (
    echo   🌐 Cloud (Render.com)៖ Render នឹង Auto-Deploy ដោយស្វ័យប្រវត្តិពី GitHub
)
echo.
echo   📱 លើទូរស័ព្ទដៃ៖
echo      1. បើក Browser ឬ Web App ឡើងវិញ
echo      2. អ្នកនឹងឃើញផ្ទាំងលោត៖ '🎉 មានកំណែថ្មី v%NEW_VERSION% [Update ឥឡូវនេះ]'
echo      3. ស្លាក Version Badge (v%NEW_VERSION%) នឹងបង្ហាញនៅជាប់ឈ្មោះកម្មវិធីភ្លាមៗ!
echo.
echo   💻 លើ Windows៖ ដំណើរការតាម start.bat ដូចធម្មតា
echo ==========================================================
echo.
pause
