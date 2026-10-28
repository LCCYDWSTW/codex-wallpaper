$ErrorActionPreference='Stop'
$temporary=Join-Path ([IO.Path]::GetTempPath()) ('cw-mutex-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $temporary | Out-Null
$name='Local\CodexWallpaper.Test.'+[guid]::NewGuid().ToString('N')
$worker=Join-Path $PSScriptRoot 'mutex-worker.ps1'
$processes=@()
function Launch-Worker([string]$File,[int]$Hold){
  $arguments='-NoProfile -NonInteractive -File "'+$worker+'" -MutexName "'+$name+'" -ResultFile "'+$File+'" -HoldSeconds '+$Hold
  return Start-Process powershell.exe -ArgumentList $arguments -PassThru -WindowStyle Hidden
}
function Wait-Result([string]$File){
  for($i=0;$i -lt 100;$i++){if(Test-Path -LiteralPath $File){return [IO.File]::ReadAllText($File)};Start-Sleep -Milliseconds 100}
  throw "Worker timed out: $File"
}
try {
  $one=Join-Path $temporary 'one';$two=Join-Path $temporary 'two';$three=Join-Path $temporary 'three'
  $first=Launch-Worker $one 30;$processes+=$first
  if((Wait-Result $one) -ne 'True'){throw 'First worker failed to acquire mutex'}
  $second=Launch-Worker $two 0;$processes+=$second
  if((Wait-Result $two) -ne 'False'){throw 'Concurrent worker acquired an owned mutex'}
  # Terminate only the synthetic worker created above, never a Codex process.
  $first.Kill();$first.WaitForExit()
  $third=Launch-Worker $three 0;$processes+=$third
  if((Wait-Result $three) -ne 'True'){throw 'Mutex was not recovered after worker exit'}
  Write-Output 'PASS: concurrent ownership and crash recovery of Windows named mutex'
} finally {
  foreach($child in $processes){if(-not $child.HasExited){$child.Kill();$child.WaitForExit()}}
  $resolved=[IO.Path]::GetFullPath($temporary)
  $expected=[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')+'\cw-mutex-'
  if(-not $resolved.StartsWith($expected,[StringComparison]::OrdinalIgnoreCase)){throw 'Unexpected test cleanup path'}
  Remove-Item -LiteralPath $resolved -Recurse -Force
}
