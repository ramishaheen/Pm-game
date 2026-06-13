@echo off
REM ====================================================================
REM  Nur - prototype launcher (Windows)
REM  Double-click this file to serve the prototype and open it in your
REM  browser. It tries Python first, then Node (npx serve).
REM ====================================================================
setlocal
set PORT=8000
set URL=http://localhost:%PORT%/prototype/

cd /d "%~dp0"

echo.
echo   N U R  -  starting local server on port %PORT%
echo   Opening %URL%
echo   (Leave this window open while you play. Press Ctrl+C to stop.)
echo.

REM --- Try Python 3 (python) ---
where python >nul 2>&1
if %errorlevel%==0 (
    start "" "%URL%"
    python -m http.server %PORT%
    goto :eof
)

REM --- Try the Windows 'py' launcher ---
where py >nul 2>&1
if %errorlevel%==0 (
    start "" "%URL%"
    py -m http.server %PORT%
    goto :eof
)

REM --- Fall back to Node (npx serve) ---
where npx >nul 2>&1
if %errorlevel%==0 (
    start "" "%URL%"
    npx --yes serve -l %PORT% .
    goto :eof
)

echo   Could not find Python or Node.js on your PATH.
echo   Install one of these, then run this file again:
echo     - Python:  https://www.python.org/downloads/
echo     - Node.js: https://nodejs.org/
echo.
pause
