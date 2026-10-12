#Requires -Version 7.0
[CmdletBinding()]
param([Parameter(Mandatory)][string]$BackupPath)
$ErrorActionPreference = 'Stop'
$BackupPath = [IO.Path]::GetFullPath($BackupPath)
if ((Get-Item -LiteralPath $BackupPath).Attributes -band [IO.FileAttributes]::ReparsePoint) {
  throw 'Le dossier de sauvegarde ne doit pas etre un lien.'
}
$manifestPath = Join-Path $BackupPath 'manifest.json'
$checksumPath = Join-Path $BackupPath 'manifest.sha256'
foreach ($path in @($manifestPath, $checksumPath, (Join-Path $BackupPath 'objects'))) {
  if ((Get-Item -LiteralPath $path).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Lien inattendu dans la sauvegarde.' }
}
$checksum = [IO.File]::ReadAllText($checksumPath)
if ($checksum -notmatch '^([a-f0-9]{64})  manifest\.json\r?\n?$') { throw 'Empreinte de manifeste invalide.' }
if ((Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $Matches[1]) {
  throw 'Le manifeste a ete modifie ou corrompu.'
}
$manifest = ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($manifestPath))
if ($manifest.version -ne 1 -or $manifest.project -cne 'lptxzfjdluupngqqqfrz') { throw 'Format ou projet de sauvegarde inattendu.' }
$expectedObjects = @($manifest.buckets | ForEach-Object { $_.objects } | Where-Object { $null -ne $_ })
if (@($manifest.files).Count -ne $expectedObjects.Count) { throw 'Inventaire incomplet.' }
$seen = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
foreach ($entry in $manifest.files) {
  if ($entry.file -cnotmatch '^objects/[a-f0-9]{64}\.bin$' -or $entry.sha256 -cnotmatch '^[a-f0-9]{64}$') {
    throw 'Chemin ou empreinte de fichier invalide.'
  }
  $keyBytes = [Text.Encoding]::UTF8.GetBytes("$($entry.bucket)/$($entry.name)")
  $expectedFile = 'objects/' + [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($keyBytes)).ToLowerInvariant() + '.bin'
  if ($entry.file -cne $expectedFile -or -not $seen.Add($entry.file)) { throw 'Objet duplique ou mal associe.' }
  $object = @($manifest.buckets | Where-Object { $_.id -ceq $entry.bucket } | ForEach-Object { $_.objects } | Where-Object { $_.id -ceq $entry.id -and $_.name -ceq $entry.name })
  if ($object.Count -ne 1 -or $object[0].metadata.size -ne $entry.size -or $object[0].updated_at -ne $entry.updated_at) {
    throw 'Objet absent ou different de son inventaire.'
  }
  $path = Join-Path $BackupPath $entry.file
  $file = Get-Item -LiteralPath $path
  if ($file.Attributes -band [IO.FileAttributes]::ReparsePoint -or $file.Length -ne $entry.size) { throw 'Fichier incomplet ou lien inattendu.' }
  if ((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry.sha256) { throw 'Fichier corrompu.' }
}
if (@(Get-ChildItem -LiteralPath (Join-Path $BackupPath 'objects') -Force).Count -ne $seen.Count) { throw 'Fichiers inattendus dans la sauvegarde.' }
Write-Output "Sauvegarde Storage valide: $($seen.Count) fichier(s)."
