function Get-CodexPackage {
  $package=Get-AppxPackage -Name OpenAI.Codex | Select-Object -First 1
  if(-not $package){throw 'Install the Windows MSIX version of Codex before continuing.'}
  if(-not (Test-Path -LiteralPath (Join-Path $package.InstallLocation 'app\ChatGPT.exe'))){throw 'Unsupported Codex package layout.'}
  return $package
}

function Find-WallpaperLibraries {
  $roots=@()
  foreach($entry in @(@('HKCU:\Software\Valve\Steam','SteamPath'),@('HKLM:\SOFTWARE\WOW6432Node\Valve\Steam','InstallPath'))){
    $value=Get-ItemPropertyValue -LiteralPath $entry[0] -Name $entry[1] -ErrorAction SilentlyContinue
    if($value){$roots+=$value}
  }
  if(${env:ProgramFiles(x86)}){$roots+=Join-Path ${env:ProgramFiles(x86)} 'Steam'}
  foreach($root in @($roots)){
    $vdf=Join-Path $root 'steamapps\libraryfolders.vdf'
    if(Test-Path -LiteralPath $vdf){
      $text=Get-Content -LiteralPath $vdf -Raw
      foreach($match in [regex]::Matches($text,'"path"\s+"([^"]+)"')){$roots+=$match.Groups[1].Value.Replace('\\','\')}
    }
  }
  $workshops=@();$engine=$null
  foreach($root in @($roots | Select-Object -Unique)){
    $workshop=Join-Path $root 'steamapps\workshop\content\431960'
    if(Test-Path -LiteralPath $workshop){$workshops+=[IO.Path]::GetFullPath($workshop)}
    $candidate=Join-Path $root 'steamapps\common\wallpaper_engine\config.json'
    if(-not $engine -and (Test-Path -LiteralPath $candidate)){$engine=$candidate}
  }
  # Prefer the running Wallpaper Engine installation when several Steam roots exist.
  $players=@(Get-CimInstance Win32_Process -Filter "Name='wallpaper32.exe' OR Name='wallpaper64.exe'" -ErrorAction SilentlyContinue)
  foreach($player in $players){
    if($player.ExecutablePath){
      $candidate=Join-Path (Split-Path -Parent $player.ExecutablePath) 'config.json'
      if(Test-Path -LiteralPath $candidate){$engine=$candidate;break}
    }
  }
  return @{workshopDirs=@($workshops | Select-Object -Unique);engineConfig=$engine}
}

function Assert-OwnedPath([string]$Root,[string]$Candidate){
  $prefix=[IO.Path]::GetFullPath($Root).TrimEnd('\')+'\'
  $full=[IO.Path]::GetFullPath($Candidate)
  if(-not $full.StartsWith($prefix,[StringComparison]::OrdinalIgnoreCase)){throw "Path is outside the installation directory: $full"}
}

function Get-InstallMutex {
  $sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $mutex=New-Object System.Threading.Mutex($false,('Local\CodexWallpaper.Launch.'+$sid))
  try {$owned=$mutex.WaitOne(0)} catch [System.Threading.AbandonedMutexException] {$owned=$true}
  if(-not $owned){$mutex.Dispose();throw 'A wallpaper launch is in progress. Try again shortly.'}
  return $mutex
}

function Assert-HelperStopped([string]$AppRoot){
  $hostFile=Join-Path $AppRoot 'src\wallpaper-host.mjs'
  $running=@(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {$_.CommandLine -and $_.CommandLine.IndexOf($hostFile,[StringComparison]::OrdinalIgnoreCase) -ge 0})
  if($running.Count){throw 'Fully quit Codex and wait for the wallpaper helper to exit (up to a few minutes), then retry.'}
}

function Restore-Integration($State){
  $shell=New-Object -ComObject WScript.Shell
  $actions=@()
  # Preflight all backups before changing any shortcut or native startup task.
  foreach($task in @($State.NativeTasks)){
    if(-not (Test-Path -LiteralPath $task.Key)){throw "Native Codex startup task missing: $($task.Key). No shortcut was changed."}
    [void](Get-ItemPropertyValue -LiteralPath $task.Key -Name State)
  }
  foreach($link in @($State.Shortcuts)){
    $restored=$false
    if($link.Existed -and -not (Test-Path -LiteralPath $link.Backup)){throw "Shortcut backup missing: $($link.Backup). No startup state was changed."}
    if(Test-Path -LiteralPath $link.Path){
      if($link.Existed -and (Get-FileHash -LiteralPath $link.Path).Hash -eq (Get-FileHash -LiteralPath $link.Backup).Hash){$restored=$true}
      $current=$shell.CreateShortcut($link.Path)
      $target=if($link.Target){$link.Target}else{Join-Path $env:SystemRoot 'System32\wscript.exe'}
      $owned=($current.Arguments -eq $link.Arguments -and $current.TargetPath -eq $target)
      if($link.WorkingDirectory){$owned=$owned -and $current.WorkingDirectory -eq $link.WorkingDirectory}
      if(-not $restored -and -not $owned){
        if($link.Logon){throw "Startup shortcut changed since installation: $($link.Path). Resolve it before restoring the native Codex startup task."}
        Write-Warning "Shortcut changed since installation; preserving $($link.Path)"
        continue
      }
    }
    if(-not $restored){$actions+=,$link}
  }
  foreach($link in $actions){
    if($link.Existed){Copy-Item -LiteralPath $link.Backup -Destination $link.Path -Force}
    elseif(Test-Path -LiteralPath $link.Path){Remove-Item -LiteralPath $link.Path}
  }
  # Restore the native task last, after the wallpaper login shortcut is gone.
  # Only replace our disabled state, not a later user choice.
  foreach($task in @($State.NativeTasks)){
    if((Get-ItemPropertyValue -LiteralPath $task.Key -Name State) -eq 1){
      Set-ItemProperty -LiteralPath $task.Key -Name State -Type DWord -Value ([int]$task.State)
    }
  }
}
