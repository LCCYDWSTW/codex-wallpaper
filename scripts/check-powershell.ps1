$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$files=@(Get-ChildItem -LiteralPath $root -Filter '*.ps1' -File)
foreach($folder in @('scripts','tests')){$files+=@(Get-ChildItem -LiteralPath (Join-Path $root $folder) -Filter '*.ps1' -File)}
foreach($file in $files){
  $tokens=$null;$parseErrors=$null
  [void][System.Management.Automation.Language.Parser]::ParseFile($file.FullName,[ref]$tokens,[ref]$parseErrors)
  if($parseErrors.Count){$parseErrors | Format-List;throw "Invalid PowerShell syntax in $($file.Name)"}
}
Write-Output 'PowerShell syntax checks passed'
