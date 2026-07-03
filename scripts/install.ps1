# GitChange Cursor installer (PowerShell) — links /gitchange commands
# Claude Code: use the marketplace plugin (see README).
param(
  [switch]$Local,
  [switch]$WithCli
)

$ErrorActionPreference = "Stop"

$OfficialRepo = "https://github.com/serhii-kucherenko/GitChange.git"
$RepoUrl = if ($env:GITCHANGE_REPO_URL) { $env:GITCHANGE_REPO_URL } else { $OfficialRepo }
$ScriptRepo = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$InstallDir = if ($env:GITCHANGE_INSTALL_DIR) { $env:GITCHANGE_INSTALL_DIR } else { Join-Path $env:USERPROFILE ".gitchange-plugin" }

function Write-InstallError([string]$Message) {
  Write-Error "install.ps1: $Message"
  exit 1
}

function Test-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    Write-InstallError "$Name not found on PATH"
  }
}

function Test-NodeVersion {
  $version = (node -p "process.versions.node").Trim('"')
  $major = [int]($version.Split(".")[0])
  if ($major -lt 22) {
    Write-InstallError "Node.js 22+ required (found $version)"
  }
}

if ($RepoUrl -ne $OfficialRepo) {
  Write-Warning "install.ps1: non-official clone URL — verify the source: $RepoUrl"
}

Test-Command git
Test-Command pnpm
Test-Command node
Test-NodeVersion

if ($Local) {
  if (-not (Test-Path (Join-Path $ScriptRepo ".cursor-plugin\plugin.json"))) {
    Write-InstallError "--Local must be run from the GitChange repository"
  }
  $InstallDir = $ScriptRepo
  Write-Host "Using local GitChange checkout: $InstallDir"
} elseif (Test-Path (Join-Path $ScriptRepo ".cursor-plugin\plugin.json")) {
  Write-Host "Linking $InstallDir -> $ScriptRepo"
  if (Test-Path $InstallDir) {
    Remove-Item -Force -Recurse $InstallDir -ErrorAction SilentlyContinue
  }
  New-Item -ItemType Junction -Path $InstallDir -Target $ScriptRepo | Out-Null
  $InstallDir = $ScriptRepo
} elseif (Test-Path (Join-Path $InstallDir ".git")) {
  Write-Host "Updating GitChange in $InstallDir ..."
  Push-Location $InstallDir
  git pull --ff-only
  Pop-Location
} elseif (Test-Path $InstallDir) {
  Write-InstallError "$InstallDir exists but is not a git repository"
} else {
  Write-Host "Cloning GitChange to $InstallDir ..."
  git clone --depth 1 $RepoUrl $InstallDir
}

Write-Host "Installing dependencies (first /gitchange run builds the CLI if needed) ..."
Push-Location $InstallDir
pnpm install
Pop-Location

$commandsSrc = $null
if (Test-Path (Join-Path $ScriptRepo ".cursor\commands")) {
  $commandsSrc = Join-Path $ScriptRepo ".cursor\commands"
} elseif (Test-Path (Join-Path $InstallDir ".cursor\commands")) {
  $commandsSrc = Join-Path $InstallDir ".cursor\commands"
} else {
  Write-InstallError "no .cursor\commands found"
}

$commandsDst = Join-Path $env:USERPROFILE ".cursor\commands"
New-Item -ItemType Directory -Force -Path $commandsDst | Out-Null
Get-ChildItem -Path $commandsSrc -Filter "*.md" | ForEach-Object {
  Copy-Item -Path $_.FullName -Destination (Join-Path $commandsDst $_.Name) -Force
}
Write-Host "Copied Cursor commands to $commandsDst"

if ($WithCli) {
  $localBin = Join-Path $env:USERPROFILE ".local\bin"
  New-Item -ItemType Directory -Force -Path $localBin | Out-Null
  $cliBin = Join-Path $InstallDir "packages\cli\dist\bin.js"
  $linkPath = Join-Path $localBin "gitchange.cmd"
  @"
@echo off
node "$cliBin" %*
"@ | Set-Content -Path $linkPath -Encoding ASCII
  Write-Host "Linked optional terminal CLI -> $linkPath"
}

Write-Host @"

GitChange is ready for Cursor.

  Open any git repository -> type /gitchange in chat
  (indexes, summarizes, opens the dashboard automatically)

Install root: $InstallDir
Commands:     $commandsDst

Re-run this script anytime to refresh command links (idempotent).

"@
