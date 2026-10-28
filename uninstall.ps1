[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'scripts\windows.ps1')
$dataRoot=Join-Path $env:LOCALAPPDATA 'CodexWallpaper'
$statePath=Join-Path $dataRoot 'install-state.json'
$mutex=Get-InstallMutex
try {
  if(-not (Test-Path -LiteralPath $statePath)){Write-Output 'No registered installation found.';return}
  Assert-HelperStopped (Join-Path $dataRoot 'app')
  $state=Get-Content -LiteralPath $statePath -Raw -Encoding UTF8 | ConvertFrom-Json
  try {Restore-Integration $state}
  catch {throw "Uninstall is incomplete; install-state.json was kept for a safe retry. $($_.Exception.Message)"}
  Move-Item -LiteralPath $statePath -Destination (Join-Path $dataRoot ('uninstalled-'+[guid]::NewGuid().ToString('N')+'.json'))
  Write-Output "Shortcuts and native startup state restored. Local files retained in $dataRoot; delete that folder manually if no longer needed."
} finally {$mutex.ReleaseMutex();$mutex.Dispose()}
