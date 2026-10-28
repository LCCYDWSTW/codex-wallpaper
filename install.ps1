[CmdletBinding()]
param(
  [switch]$EnableStartup,
  [string]$NodePath,
  [string[]]$WorkshopDirectories,
  [string]$WallpaperEngineDirectory,
  [string]$CodexProfile,
  [switch]$PlanOnly
)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'scripts\windows.ps1')
$package=Get-CodexPackage
if(-not $NodePath){$command=Get-Command node.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1;if($command){$NodePath=$command.Source}}
if(-not $NodePath -or -not (Test-Path -LiteralPath $NodePath)){throw 'Install Node.js 22 or newer, or pass -NodePath with the full path to node.exe.'}
$NodePath=[IO.Path]::GetFullPath($NodePath)
$nodeVersion=& $NodePath -p 'process.versions.node'
if($LASTEXITCODE -ne 0 -or [int]($nodeVersion.Split('.')[0]) -lt 22){throw 'Node.js 22 or newer is required.'}
$found=Find-WallpaperLibraries
if(-not $WorkshopDirectories){$WorkshopDirectories=$found.workshopDirs}
if(-not $WorkshopDirectories.Count){throw 'No Wallpaper Engine workshop folder found. Pass -WorkshopDirectories with its absolute path.'}
$WorkshopDirectories=@($WorkshopDirectories | ForEach-Object {if(-not (Test-Path -LiteralPath $_ -PathType Container)){throw "Missing workshop directory: $_"};(Resolve-Path -LiteralPath $_).Path})
$engineConfig=$found.engineConfig
if($WallpaperEngineDirectory){$engineConfig=Join-Path ([IO.Path]::GetFullPath($WallpaperEngineDirectory)) 'config.json';if(-not (Test-Path -LiteralPath $engineConfig)){throw "Missing $engineConfig"}}
if(-not $CodexProfile){$CodexProfile=Join-Path $env:APPDATA 'Codex\web\Codex'}
$CodexProfile=[IO.Path]::GetFullPath($CodexProfile)
$dataRoot=Join-Path $env:LOCALAPPDATA 'CodexWallpaper'
$appRoot=Join-Path $dataRoot 'app'
$statePath=Join-Path $dataRoot 'install-state.json'
$config=@{nodePath=$NodePath;workshopDirs=@($WorkshopDirectories);wallpaperEngineConfig=$engineConfig;codexProfile=$CodexProfile;ffmpegPath='ffmpeg'}
$nativeTasks=@()
if($EnableStartup){
  $manifest=Get-AppxPackageManifest -Package $package.PackageFullName
  foreach($extension in $manifest.Package.Applications.Application.Extensions.Extension){
    if($extension.Category -ne 'windows.startupTask'){continue}
    $taskId=$extension.StartupTask.TaskId
    $key='HKCU:\Software\Classes\Local Settings\Software\Microsoft\Windows\CurrentVersion\AppModel\SystemAppData\'+$package.PackageFamilyName+'\'+$taskId
    if(-not (Test-Path -LiteralPath $key)){throw 'Launch Codex once, fully quit it, then install again so Windows can register its startup task.'}
    $state=[int](Get-ItemPropertyValue -LiteralPath $key -Name State)
    if($state -in 3,4){throw 'Codex startup is controlled by policy. Install without -EnableStartup.'}
    $nativeTasks+=@{Key=$key;State=$state}
  }
  if(-not $nativeTasks.Count){throw 'Cannot locate the native Codex startup task. Install without -EnableStartup.'}
}
if($PlanOnly){@{InstallDirectory=$appRoot;Config=$config;EnableStartup=[bool]$EnableStartup;NativeTasks=$nativeTasks} | ConvertTo-Json -Depth 5;return}
$mutex=Get-InstallMutex
try {
  Assert-HelperStopped $appRoot
  if(Test-Path -LiteralPath $statePath){throw 'Already installed. Run uninstall.ps1 first; settings and backups will be retained.'}
  New-Item -ItemType Directory -Path $dataRoot -Force | Out-Null
  if(Test-Path -LiteralPath $appRoot){
    $previous=Join-Path $dataRoot ('previous-'+[guid]::NewGuid().ToString('N'))
    Assert-OwnedPath $dataRoot $appRoot;Assert-OwnedPath $dataRoot $previous
    Move-Item -LiteralPath $appRoot -Destination $previous
  }
  New-Item -ItemType Directory -Path $appRoot -Force | Out-Null
  foreach($item in @('src','scripts','Start.vbs','uninstall.ps1','README.md','README.en.md','LICENSE')){Copy-Item -LiteralPath (Join-Path $PSScriptRoot $item) -Destination $appRoot -Recurse -Force}
  $configPath=Join-Path $dataRoot 'config.json'
  if(Test-Path -LiteralPath $configPath){Copy-Item -LiteralPath $configPath -Destination (Join-Path $dataRoot ('config-backup-'+[guid]::NewGuid().ToString('N')+'.json'))}
  $config | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $configPath -Encoding UTF8
  $backupRoot=Join-Path $dataRoot ('integration-backup-'+[guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
  $entries=@(@{Path=(Join-Path ([Environment]::GetFolderPath('Desktop')) 'Codex Wallpaper.lnk');Logon=$false},@{Path=(Join-Path ([Environment]::GetFolderPath('Programs')) 'Codex Wallpaper.lnk');Logon=$false})
  if($EnableStartup){$entries+=@{Path=(Join-Path ([Environment]::GetFolderPath('Startup')) 'Codex Wallpaper.lnk');Logon=$true}}
  $records=@();$shell=New-Object -ComObject WScript.Shell
  foreach($entry in $entries){
    $exists=Test-Path -LiteralPath $entry.Path
    $backup=Join-Path $backupRoot ($records.Count.ToString()+'.lnk')
    if($exists){Copy-Item -LiteralPath $entry.Path -Destination $backup}
    $arguments='"'+(Join-Path $appRoot 'Start.vbs')+'"';if($entry.Logon){$arguments+=' --at-logon'}
    $records+=@{Path=$entry.Path;Existed=$exists;Backup=$backup;Arguments=$arguments;Target=(Join-Path $env:SystemRoot 'System32\wscript.exe');WorkingDirectory=$appRoot;Logon=$entry.Logon}
  }
  $state=@{Version=1;Shortcuts=$records;NativeTasks=$nativeTasks}
  $state | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $statePath -Encoding UTF8
  try {
    foreach($task in $nativeTasks){Set-ItemProperty -LiteralPath $task.Key -Name State -Type DWord -Value 1}
    foreach($record in $records){
      $link=$shell.CreateShortcut($record.Path)
      $link.TargetPath=Join-Path $env:SystemRoot 'System32\wscript.exe';$link.Arguments=$record.Arguments
      $link.WorkingDirectory=$appRoot;$link.IconLocation=(Join-Path $package.InstallLocation 'app\ChatGPT.exe')+',0'
      $link.Description='Codex with local video wallpaper';$link.Save()
    }
  } catch {
    $failure=$_
    Restore-Integration $state
    Remove-Item -LiteralPath $statePath
    throw $failure
  }
  Write-Output "Installed in $appRoot. Fully quit Codex once, then open Codex Wallpaper."
} finally {$mutex.ReleaseMutex();$mutex.Dispose()}
