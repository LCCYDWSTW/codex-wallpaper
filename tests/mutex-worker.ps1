param([string]$MutexName,[string]$ResultFile,[int]$HoldSeconds=0)
$mutex=New-Object System.Threading.Mutex($false,$MutexName)
$owned=$false
try {
  try {$owned=$mutex.WaitOne(0)} catch [System.Threading.AbandonedMutexException] {$owned=$true}
  [IO.File]::WriteAllText($ResultFile,[string]$owned)
  if($owned -and $HoldSeconds){Start-Sleep -Seconds $HoldSeconds}
} finally {if($owned){$mutex.ReleaseMutex()};$mutex.Dispose()}
