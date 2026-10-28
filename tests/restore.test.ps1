$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '..\scripts\windows.ps1')
$temporary=Join-Path ([IO.Path]::GetTempPath()) ('cw-restore-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $temporary | Out-Null
$shell=New-Object -ComObject WScript.Shell
$target=Join-Path $env:SystemRoot 'System32\wscript.exe'
$originalLocalAppData=$env:LOCALAPPDATA
function New-TestLink($path,$program,$arguments){
  $shortcut=$shell.CreateShortcut($path);$shortcut.TargetPath=$program;$shortcut.Arguments=$arguments;$shortcut.Save()
}
try {
  $first=Join-Path $temporary 'one.lnk';$second=Join-Path $temporary 'two.lnk'
  $backup1=Join-Path $temporary 'original-one.lnk';$backup2=Join-Path $temporary 'original-two.lnk'
  New-TestLink $backup1 $target 'original-one';New-TestLink $backup2 $target 'original-two'
  New-TestLink $first $target 'wallpaper-one';New-TestLink $second $target 'wallpaper-two'
  $state=@{Shortcuts=@(
    @{Path=$first;Existed=$true;Backup=$backup1;Arguments='wallpaper-one';Target=$target;Logon=$false},
    @{Path=$second;Existed=$true;Backup=$backup2;Arguments='wallpaper-two';Target=$target;Logon=$false}
  );NativeTasks=@()}

  # Missing backup must fail before either shortcut is changed.
  Rename-Item -LiteralPath $backup2 -NewName 'missing.lnk'
  try {Restore-Integration $state;throw 'Expected missing backup failure'} catch {if($_.Exception.Message -notmatch 'backup missing'){throw}}
  if($shell.CreateShortcut($first).Arguments -ne 'wallpaper-one'){throw 'Preflight changed a shortcut'}
  Rename-Item -LiteralPath (Join-Path $temporary 'missing.lnk') -NewName 'original-two.lnk'

  # Inject a failure after the first restore. Retrying must finish safely.
  $script:failOnce=$true
  function Copy-Item {
    param([string]$LiteralPath,[string]$Destination,[switch]$Force)
    if($script:failOnce -and $Destination -eq $second){$script:failOnce=$false;throw 'Synthetic copy failure'}
    Microsoft.PowerShell.Management\Copy-Item @PSBoundParameters
  }
  try {Restore-Integration $state;throw 'Expected copy failure'} catch {if($_.Exception.Message -notmatch 'Synthetic copy failure'){throw}}
  if($shell.CreateShortcut($first).Arguments -ne 'original-one'){throw 'First restore did not complete'}
  Restore-Integration $state
  Restore-Integration $state
  if($shell.CreateShortcut($second).Arguments -ne 'original-two'){throw 'Retry did not finish'}

  # A user-edited target with unchanged arguments must be preserved.
  New-TestLink $first (Join-Path $env:SystemRoot 'System32\cmd.exe') 'wallpaper-one'
  Restore-Integration $state
  if($shell.CreateShortcut($first).TargetPath -notlike '*cmd.exe'){throw 'Edited shortcut was overwritten'}
  # Call the actual uninstaller twice using only a synthetic temporary data root.
  $env:LOCALAPPDATA=$temporary
  $data=Join-Path $temporary 'CodexWallpaper';New-Item -ItemType Directory -Path $data | Out-Null
  New-TestLink $second $target 'wallpaper-two'
  $single=@{Shortcuts=@($state.Shortcuts[1]);NativeTasks=@()}
  $single | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $data 'install-state.json') -Encoding UTF8
  & (Join-Path $PSScriptRoot '..\uninstall.ps1') | Out-Null
  & (Join-Path $PSScriptRoot '..\uninstall.ps1') | Out-Null
  if(Test-Path -LiteralPath (Join-Path $data 'install-state.json')){throw 'Repeated uninstall left active installation state'}
  if($shell.CreateShortcut($second).Arguments -ne 'original-two'){throw 'Uninstall failed to restore shortcut'}
  Write-Output 'PASS: restore preflight, interrupted restore, retry, edited shortcut, repeated uninstall'
} finally {
  $env:LOCALAPPDATA=$originalLocalAppData
  Microsoft.PowerShell.Management\Remove-Item -LiteralPath $temporary -Recurse -Force
}
