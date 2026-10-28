$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$version=(Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version
if($version -notmatch '^\d+\.\d+\.\d+([-.][a-zA-Z0-9.]+)?$'){throw 'Invalid release version'}
$name='codex-wallpaper-v'+$version
$dist=Join-Path $root 'dist'
New-Item -ItemType Directory -Path $dist -Force | Out-Null
$zip=Join-Path $dist ($name+'.zip')
$allow=@('src','scripts','tests','.github','.gitignore','.gitattributes','package.json','config.example.json','Start.vbs','install.ps1','uninstall.ps1','README.md','README.en.md','LICENSE','CHANGELOG.md','SECURITY.md','CONTRIBUTING.md','VALIDATION.md','STABILITY_TEST.md')
Add-Type -AssemblyName System.IO.Compression
$stream=[IO.File]::Open($zip,[IO.FileMode]::Create)
$archive=New-Object IO.Compression.ZipArchive($stream,[IO.Compression.ZipArchiveMode]::Create)
try {
  foreach($item in $allow){
    $source=Join-Path $root $item
    if(-not (Test-Path -LiteralPath $source)){throw "Missing release file: $item"}
    if((Get-Item -LiteralPath $source).PSIsContainer){$files=@(Get-ChildItem -LiteralPath $source -File -Recurse -Force)}else{$files=@(Get-Item -LiteralPath $source)}
    foreach($file in $files){
      if($file.Attributes -band [IO.FileAttributes]::ReparsePoint){throw "Refusing to package a link: $($file.Name)"}
      $relative=$file.FullName.Substring($root.Length+1).Replace('\','/')
      if($relative -match '\.(log|mp4|webm|png|jpg|bak|tmp)$' -or $file.Name -in @('settings.json','runtime.json','config.json')){throw "Private/runtime file in release: $relative"}
      $entry=$archive.CreateEntry($name+'/'+$relative,[IO.Compression.CompressionLevel]::Optimal)
      $inputStream=[IO.File]::OpenRead($file.FullName);$outputStream=$entry.Open()
      try{$inputStream.CopyTo($outputStream)}finally{$inputStream.Dispose();$outputStream.Dispose()}
    }
  }
} finally {$archive.Dispose();$stream.Dispose()}
$hasher=[Security.Cryptography.SHA256]::Create()
$hashStream=[IO.File]::OpenRead($zip)
try{$hash=([BitConverter]::ToString($hasher.ComputeHash($hashStream))).Replace('-','').ToLowerInvariant()}
finally{$hashStream.Dispose();$hasher.Dispose()}
[IO.File]::WriteAllText($zip+'.sha256',$hash+' *'+[IO.Path]::GetFileName($zip)+[Environment]::NewLine)
Write-Output $zip
Write-Output $hash
