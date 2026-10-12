#Requires -Version 7.0
$ErrorActionPreference = 'Stop'
$tokens = $null
$errors = $null
$source = Join-Path $PSScriptRoot 'backup-storage-to-windows.ps1'
$ast = [Management.Automation.Language.Parser]::ParseFile($source, [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw 'Syntaxe du script de sauvegarde invalide.' }
$function = $ast.Find({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Get-StorageObjectUrl' }, $true)
. ([scriptblock]::Create($function.Extent.Text))
$project = 'lptxzfjdluupngqqqfrz'
$tests = 0
function Assert-Rejected([scriptblock]$Action) {
  $rejected = $false
  try { $null = & $Action } catch { $rejected = $true }
  if (-not $rejected) { throw 'Une entree invalide a ete acceptee.' }
  $script:tests++
}
$url = Get-StorageObjectUrl 'business-logos' 'owner/logo #%.png'
if ($url -cne 'https://lptxzfjdluupngqqqfrz.supabase.co/storage/v1/object/public/business-logos/owner/logo%20%23%25.png') { throw 'Encodage URL invalide.' }
$tests++
foreach ($name in @('', '../secret', 'owner/../secret', '/root', 'owner//logo', 'owner\logo')) {
  Assert-Rejected { Get-StorageObjectUrl 'business-logos' $name }
}
Assert-Rejected { Get-StorageObjectUrl '..' 'logo.png' }

$root = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$testPath = Join-Path $root ('saytu-backup-tests-' + [Guid]::NewGuid().ToString('N'))
$null = New-Item -ItemType Directory -Path (Join-Path $testPath 'objects')
try {
  $key = [Text.Encoding]::UTF8.GetBytes('business-logos/owner/logo.png')
  $relative = 'objects/' + [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($key)).ToLowerInvariant() + '.bin'
  $filePath = Join-Path $testPath $relative
  [IO.File]::WriteAllBytes($filePath, [byte[]]@(1, 2, 3))
  $entry = @{ bucket = 'business-logos'; name = 'owner/logo.png'; id = 'fixture'; updated_at = '2026-10-11T00:00:00Z'
    file = $relative; size = 3; sha256 = (Get-FileHash -LiteralPath $filePath).Hash.ToLowerInvariant() }
  $manifest = @{ version = 1; project = $project; files = @($entry)
    buckets = @(@{ id = 'business-logos'; public = $true; objects = @(@{ id = $entry.id; name = $entry.name; updated_at = $entry.updated_at; metadata = @{ size = 3 } }) }) }
  $manifestPath = Join-Path $testPath 'manifest.json'
  function Save-TestManifest {
    [IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 10))
    $hash = (Get-FileHash -LiteralPath $manifestPath).Hash.ToLowerInvariant()
    [IO.File]::WriteAllText((Join-Path $testPath 'manifest.sha256'), "$hash  manifest.json`n")
  }
  $verify = Join-Path $PSScriptRoot 'verify-storage-backup.ps1'
  Save-TestManifest
  $null = & $verify -BackupPath $testPath
  $tests++
  [IO.File]::WriteAllBytes($filePath, [byte[]]@(1, 2, 4))
  Assert-Rejected { & $verify -BackupPath $testPath }
  [IO.File]::WriteAllBytes($filePath, [byte[]]@(1, 2, 3))
  [IO.File]::AppendAllText($manifestPath, ' ')
  Assert-Rejected { & $verify -BackupPath $testPath }
  Save-TestManifest
  [IO.File]::WriteAllText((Join-Path $testPath 'objects/extra.bin'), 'extra')
  Assert-Rejected { & $verify -BackupPath $testPath }
  Remove-Item -LiteralPath (Join-Path $testPath 'objects/extra.bin')
  $entry.file = '../secret.bin'
  Save-TestManifest
  Assert-Rejected { & $verify -BackupPath $testPath }
  $entry.file = $relative
  $manifest.files = @($entry, $entry)
  Save-TestManifest
  Assert-Rejected { & $verify -BackupPath $testPath }
} finally {
  $resolved = [IO.Path]::GetFullPath($testPath)
  if ($resolved.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -and
    [IO.Path]::GetFileName($resolved) -match '^saytu-backup-tests-[a-f0-9]{32}$') {
    Remove-Item -LiteralPath $resolved -Recurse
  }
}
Write-Output "$tests tests de sauvegarde Windows passes."
