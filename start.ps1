# Nūr — prototype launcher (PowerShell)
# Right-click → "Run with PowerShell", or run:  ./start.ps1
# Serves the prototype and opens it in your default browser.

$ErrorActionPreference = "Stop"
$port = 8000
$url  = "http://localhost:$port/prototype/"
Set-Location -Path $PSScriptRoot

Write-Host ""
Write-Host "  N U R  -  starting local server on port $port" -ForegroundColor Yellow
Write-Host "  Opening $url"
Write-Host "  (Leave this window open while you play. Press Ctrl+C to stop.)"
Write-Host ""

function Have($cmd) { $null -ne (Get-Command $cmd -ErrorAction SilentlyContinue) }

if (Have "python") {
    Start-Process $url
    python -m http.server $port
} elseif (Have "py") {
    Start-Process $url
    py -m http.server $port
} elseif (Have "npx") {
    Start-Process $url
    npx --yes serve -l $port .
} else {
    Write-Host "  Could not find Python or Node.js on your PATH." -ForegroundColor Red
    Write-Host "  Install one of these, then run this script again:"
    Write-Host "    - Python:  https://www.python.org/downloads/"
    Write-Host "    - Node.js: https://nodejs.org/"
    Read-Host "  Press Enter to exit"
}
