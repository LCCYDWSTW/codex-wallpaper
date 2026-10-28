param([switch]$AtLogon)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$dataRoot=if($env:CODEX_WALLPAPER_HOME){$env:CODEX_WALLPAPER_HOME}else{Join-Path $env:LOCALAPPDATA 'CodexWallpaper'}
$owned=$false
$mutex=$null
try {
  $config=Get-Content -LiteralPath (Join-Path $dataRoot 'config.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  $node=$config.nodePath
  if(-not $node -or -not (Test-Path -LiteralPath $node)){throw 'Node.js was moved or removed. Run install.ps1 again.'}
  # The kernel releases this mutex even if the launcher crashes. No stale lock files.
  $sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $mutex=New-Object System.Threading.Mutex($false,('Local\CodexWallpaper.Launch.'+$sid))
  try {$owned=$mutex.WaitOne(0)} catch [System.Threading.AbandonedMutexException] {$owned=$true}
  $env:CODEX_WALLPAPER_WRAPPED='1'
  $arguments=@((Join-Path $root 'src\launch.mjs'))
  if(-not $owned){$arguments+='--focus-only'}
  elseif($AtLogon){$arguments+='--at-logon'}
  & $node @arguments 2>> (Join-Path $dataRoot 'launcher-error.log')
  if($LASTEXITCODE -ne 0){throw "Wallpaper startup failed. See $dataRoot\launch.log"}
} catch {
  $message=$_.Exception.Message
  try {New-Item -ItemType Directory -Path $dataRoot -Force | Out-Null; Add-Content -LiteralPath (Join-Path $dataRoot 'launcher-error.log') -Value ((Get-Date -Format o)+' '+$message)} catch {}
  $shell=New-Object -ComObject WScript.Shell
  [void]$shell.Popup($message,30,'Codex Wallpaper',48)
} finally {
  if($owned){$mutex.ReleaseMutex()}
  if($mutex){$mutex.Dispose()}
}
