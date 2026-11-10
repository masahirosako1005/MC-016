# ひとめぐり 起動スクリプト: 画面のビルド → uv sync → 起動（1 プロセス 127.0.0.1:8000）
# 使い方:  .\scripts\start.ps1            通常モード
#          .\scripts\start.ps1 -Demo      デモ層を有効にする（DEMO_MODE=1）
#          .\scripts\start.ps1 -SkipBuild 画面のビルドを飛ばす
param(
  [switch]$Demo,
  [switch]$SkipBuild
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# winget で入れた uv / Python を PATH に足す（シェル再起動前でも動くように）
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User") + ";" + $env:Path

if (-not $SkipBuild) {
  Write-Host "== 画面をビルド (npm ci && npm run build)"
  Push-Location "$root\frontend"
  npm ci --no-fund --no-audit
  if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }
  Pop-Location
}

Write-Host "== uv sync"
uv sync --python 3.12
if ($LASTEXITCODE -ne 0) { throw "uv sync failed" }

if ($Demo) { $env:DEMO_MODE = "1" } else { $env:DEMO_MODE = "0" }
$port = 8000
if ($env:PORT -and ($env:PORT -match '^\d+$')) { $port = [int]$env:PORT }
Write-Host "== 起動 http://127.0.0.1:$port  (DEMO_MODE=$env:DEMO_MODE)"
uv run uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port $port
