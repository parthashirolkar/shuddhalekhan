@echo off
REM Check for Python 3.12.0 or higher

echo Checking for Python 3.12.0 or higher...
python --version 2>nul
if errorlevel 1 (
    echo Python not found or version is less than 3.12.0
    echo Please install Python 3.12.0 or higher from https://www.python.org/downloads/
    pause
    exit /b 1
)

REM Extract version number
for /f "tokens=2 delims=." %%i in ('python --version 2^&1') do set MAJOR=%%i
for /f "tokens=2 delims=." %%i in ('python --version 2^&1') do set MINOR=%%i
for /f "tokens=2 delims=." %%i in ('python --version 2^&1') do set PATCH=%%i

REM Compare versions (need  check for 3.12.0 or higher)
if %MAJOR% LSS 3 (
    REM Major version is less than 3, Python is too old
    exit /b 1
)
if %MAJOR% GTR 3 (
    if %MINOR% LSS 12 (
        exit /b 1
    )
)

REM Python 3.12.0 or higher found
echo Python 3.12.0 or higher detected successfully
exit /b 0
