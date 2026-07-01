# GitChange installer for Windows (PowerShell)
# Official repository: https://github.com/serhii-kucherenko/GitChange
$ErrorActionPreference = "Stop"

$OfficialRepo = "https://github.com/serhii-kucherenko/GitChange.git"
$RepoUrl = if ($env:GITCHANGE_REPO_URL) { $env:GITCHANGE_REPO_URL } else { $OfficialRepo }
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

if (Test-Path (Join-Path $InstallDir ".git")) {
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

Write-Host "Installing dependencies ..."
Push-Location $InstallDir
pnpm install
Write-Host "Building ..."
pnpm build
Pop-Location

$localBin = Join-Path $env:USERPROFILE ".local\bin"
New-Item -ItemType Directory -Force -Path $localBin | Out-Null
$cliBin = Join-Path $InstallDir "packages\cli\dist\bin.js"
$linkPath = Join-Path $localBin "gitchange.cmd"
@"
@echo off
node "$cliBin" %*
"@ | Set-Content -Path $linkPath -Encoding ASCII

Write-Host @"

GitChange is ready at: $InstallDir

Set for the current session:

  `$env:GITCHANGE_ROOT = "$InstallDir"
  `$env:PATH = "$localBin;" + `$env:PATH

Cursor — symlink the plugin into a project:

  cmd /c mklink /J .cursor-plugin "$InstallDir\.cursor-plugin"

Claude Code — copy or symlink .claude-plugin into your Claude plugins folder.

Verify (inside any git repository):

  gitchange --version
  gitchange status

Re-run this script anytime to update and rebuild (idempotent).

"@
