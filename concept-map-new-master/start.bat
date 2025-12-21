@echo off
chcp 65001 >nul
echo ========================================
echo Concept Map Auto-Generation System
echo ========================================
echo.

REM Check Python installation
echo [1/5] Checking Python environment...
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found, please install Python 3.7+
    echo.
    echo Solution:
    echo 1. Visit https://www.python.org/downloads/ to download Python
    echo 2. Check "Add Python to PATH" during installation
    echo 3. Restart command prompt and try again
    echo.
    pause
    exit /b 1
) else (
    echo SUCCESS: Python environment check passed
    python --version
)

REM Check pip availability
echo.
echo [2/5] Checking pip package manager...
pip --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: pip not available, please check Python installation
    pause
    exit /b 1
) else (
    echo SUCCESS: pip check passed
)

REM Check dependencies
echo.
echo [3/5] Checking Python dependencies...
pip show flask >nul 2>&1
if errorlevel 1 (
    echo WARNING: Dependencies not installed, installing now...
    echo Installing dependency packages, please wait...
    pip install -r requirements.txt
    if errorlevel 1 (
        echo ERROR: Dependency installation failed
        echo.
        echo Possible causes:
        echo 1. Network connection issue
        echo 2. Python version incompatibility
        echo 3. Insufficient permissions
        echo.
        echo Solutions:
        echo 1. Check network connection
        echo 2. Run as administrator
        echo 3. Manual installation: pip install -r requirements.txt
        echo.
        pause
        exit /b 1
    ) else (
        echo SUCCESS: Dependencies installed successfully
    )
) else (
    echo SUCCESS: Dependencies check passed
)

REM Check project files
echo.
echo [4/5] Checking project files...
if not exist "llm\app.py" (
    echo ERROR: llm\app.py file not found
    echo Please ensure you are running this script in the correct project directory
    pause
    exit /b 1
)

if not exist "web\index.html" (
    echo ERROR: web\index.html file not found
    echo Please ensure you are running this script in the correct project directory
    pause
    exit /b 1
)

echo SUCCESS: Project files check passed

REM Clean up old Flask processes on ports 5000-5010
echo.
echo [5/6] Cleaning up old Flask processes...
set FOUND_PROCESS=0
for /L %%P in (5000,1,5010) do (
    REM Check if port is in LISTENING state
    netstat -ano | findstr "%%P.*LISTENING" >nul 2>&1
    if not errorlevel 1 (
        REM Get PID of process using this port
        for /f "tokens=5" %%A in ('netstat -ano ^| findstr "%%P.*LISTENING"') do (
            REM Check if it's a Python process
            tasklist /FI "PID eq %%A" 2>nul | findstr /I "python.exe" >nul 2>&1
            if not errorlevel 1 (
                echo Found Flask process on port %%P ^(PID: %%A^), closing...
                taskkill /F /PID %%A >nul 2>&1
                if not errorlevel 1 (
                    set FOUND_PROCESS=1
                    ping 127.0.0.1 -n 2 >nul
                )
            )
        )
    )
)
if "%FOUND_PROCESS%"=="1" (
    echo Cleaned up old Flask process^(es^), waiting for ports to release...
    ping 127.0.0.1 -n 3 >nul
) else (
    echo No old Flask processes found
)

REM Smart port detection with improved method
echo.
echo [6/6] Finding available port...
set PORT=5000
set MAX_ATTEMPTS=22
set ATTEMPT=0
set START_PORT=5000
set END_PORT=5010

:port_loop
set /a ATTEMPT+=1
if %ATTEMPT% gtr %MAX_ATTEMPTS% (
    echo.
    echo ERROR: Cannot find available port after checking ports %START_PORT%-%END_PORT%
    echo.
    echo Possible solutions:
    echo 1. Close other programs using ports %START_PORT%-%END_PORT%
    echo 2. Restart your computer to release all ports
    echo 3. Manually kill processes: taskkill /F /IM python.exe
    echo.
    pause
    exit /b 1
)

echo Checking port %PORT% (attempt %ATTEMPT%/%MAX_ATTEMPTS%)...

REM Use more accurate port check: only check LISTENING state (active server)
REM This is more reliable than checking all states
netstat -ano | findstr ":%PORT%.*LISTENING" >nul 2>&1
if errorlevel 1 (
    REM Port is not in LISTENING state, it's available
    echo SUCCESS: Port %PORT% is available
    goto port_found
)

    echo Port %PORT% is occupied, trying next port...
    set /a PORT+=1

REM Reset to START_PORT if we exceed END_PORT (one full cycle)
if %PORT% GTR %END_PORT% (
    echo Completed one full scan cycle, restarting from port %START_PORT%...
    set PORT=%START_PORT%
    )

    goto port_loop

:port_found
echo.
echo ========================================
echo Environment check completed!
echo ========================================
echo Port: %PORT%
echo Service URL: http://localhost:%PORT%
echo API Endpoint: http://localhost:%PORT%/api/chat
echo ========================================
echo.

REM Switch to llm directory
cd llm
if errorlevel 1 (
    echo ERROR: Cannot switch to llm directory
    pause
    exit /b 1
)

REM Set environment variables
set FLASK_PORT=%PORT%
set FLASK_ENV=development

echo Starting Flask service...
echo Browser will open automatically after service starts
echo.
echo Tips: 
echo - Closing this window will stop Flask service
echo - If browser doesn't open, manually visit: http://localhost:%PORT%
echo - Press Ctrl+C to stop service
echo.

REM Start Flask service
echo Start command: python app.py
echo Port: %PORT%
echo.
python app.py

REM If Flask service exits abnormally, show error info
if errorlevel 1 (
    echo.
    echo ERROR: Flask service exited abnormally (Error code: %errorlevel%)
    echo.
    echo Possible causes:
    echo 1. Python script syntax error
    echo 2. Dependency package version incompatibility
    echo 3. Port occupied by other programs
    echo 4. Insufficient permissions
    echo.
    echo Please check the above issues and try again
    echo.
)

echo.
echo Flask service stopped
echo Press any key to close window...
pause >nul
