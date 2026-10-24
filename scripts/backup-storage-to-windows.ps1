#Requires -Version 7.0
[CmdletBinding()]
param(
  [string]$Destination = (Join-Path $env:USERPROFILE 'Documents\Saytu-Yef-Backups'),
  [string]$IdentityFile = (Join-Path $env:USERPROFILE '.ssh\id_ed25519_saytu_yef')
)
$ErrorActionPreference = 'Stop'
$Destination = [IO.Path]::GetFullPath($Destination)
$IdentityFile = [IO.Path]::GetFullPath($IdentityFile)
$project = 'lptxzfjdluupngqqqfrz'
if (-not (Test-Path -LiteralPath $IdentityFile -PathType Leaf)) { throw 'Cle SSH absente.' }
$null = New-Item -ItemType Directory -Path $Destination -Force
$acl = [Security.AccessControl.DirectorySecurity]::new()
$acl.SetAccessRuleProtection($true, $false)
foreach ($sid in @([Security.Principal.WindowsIdentity]::GetCurrent().User,
  [Security.Principal.SecurityIdentifier]::new('S-1-5-18'), [Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))) {
  $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'))
}
[IO.FileSystemAclExtensions]::SetAccessControl([IO.DirectoryInfo]::new($Destination), $acl)

function Get-StorageInventory {
  # Read-only metadata. The database credential stays inside the protected VPS environment.
  $script = @'
set -Eeuo pipefail
source /etc/saytu-yef-ops.env
export PGCONNECT_TIMEOUT=15
PGOPTIONS='-c statement_timeout=30000' psql "$SUPABASE_DB_URL" -X -A -t -v ON_ERROR_STOP=1 <<'SQL'
select coalesce(jsonb_agg(jsonb_build_object(
  'id', b.id, 'public', b.public, 'objects', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', o.id, 'name', o.name, 'updated_at', o.updated_at, 'metadata', o.metadata
    ) order by o.name, o.id), '[]'::jsonb)
    from storage.objects o where o.bucket_id = b.id
  )
) order by b.id), '[]'::jsonb) from storage.buckets b;
SQL
'@
  $info = [Diagnostics.ProcessStartInfo]::new((Get-Command ssh.exe -ErrorAction Stop).Source)
  $info.UseShellExecute = $false
  $info.CreateNoWindow = $true
  $info.RedirectStandardInput = $true
  $info.RedirectStandardOutput = $true
  $info.RedirectStandardError = $true
  foreach ($argument in @('-i', $IdentityFile, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
    '-o', 'ConnectTimeout=15', 'ubuntu@179.237.84.35', 'sudo -n bash -s')) { $info.ArgumentList.Add($argument) }
  $process = [Diagnostics.Process]::new()
  $process.StartInfo = $info
  $null = $process.Start()
  $errors = $process.StandardError.ReadToEndAsync()
  $process.StandardInput.Write($script.Replace("`r`n", "`n") + "`n")
  $process.StandardInput.Close()
  try {
    $result = $process.StandardOutput.ReadToEnd()
    $process.WaitForExit()
    if ($process.ExitCode -ne 0) { throw 'Lecture de Storage impossible sur le VPS. Verifier sa connexion et sa configuration.' }
    $null = $errors.GetAwaiter().GetResult()
    # Parse before accepting a snapshot; never interpret object names as local paths or shell commands.
    $null = ConvertFrom-Json -InputObject $result -ErrorAction Stop
    return $result.Trim()
  } finally { $process.Dispose() }
}

function Get-StorageObjectUrl([string]$Bucket, [string]$Name) {
  if (-not $Bucket -or $Bucket.Contains('/') -or $Bucket.Contains('\') -or $Bucket -in @('.', '..')) {
    throw 'Identifiant de bucket invalide.'
  }
  $segments = $Name.Split('/')
  if (-not $Name -or @($segments | Where-Object { $_ -in @('', '.', '..') -or $_.Contains('\') }).Count -gt 0) {
    throw 'Chemin Storage invalide.'
  }
  $encoded = @($segments | ForEach-Object { [Uri]::EscapeDataString($_) }) -join '/'
  return "https://$project.supabase.co/storage/v1/object/public/$([Uri]::EscapeDataString($Bucket))/$encoded"
}

function Save-PrivateStorageObject($Bucket, $Object, [string]$Path) {
  if ($Bucket.id -cne 'expense-receipts' -or $Object.name -cnotmatch '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$' -or
    $null -eq $Object.metadata.size -or [long]$Object.metadata.size -lt 1 -or [long]$Object.metadata.size -gt 5242880) {
    throw 'Objet prive non pris en charge; aucune sauvegarde complete ne sera declaree.'
  }
  $request = @{ bucket=$Bucket.id; name=$Object.name; size=[long]$Object.metadata.size; etag=$Object.metadata.eTag } | ConvertTo-Json -Compress
  $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($request))
  $info = [Diagnostics.ProcessStartInfo]::new((Get-Command ssh.exe -ErrorAction Stop).Source)
  $info.UseShellExecute = $false
  $info.CreateNoWindow = $true
  $info.RedirectStandardOutput = $true
  $info.RedirectStandardError = $true
  foreach ($argument in @('-i',$IdentityFile,'-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=15',
    '-o','ServerAliveInterval=15','-o','ServerAliveCountMax=2','ubuntu@179.237.84.35',
    "sudo -n node /usr/local/lib/saytu-yef/backup-private-storage.mjs $encoded")) { $info.ArgumentList.Add($argument) }
  $process = [Diagnostics.Process]::new()
  $process.StartInfo = $info
  $null = $process.Start()
  $errors = $process.StandardError.ReadToEndAsync()
  try {
    $file = [IO.FileStream]::new($Path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write)
    try {
      $buffer = [byte[]]::new(65536)
      $size = 0L
      while (($read = $process.StandardOutput.BaseStream.Read($buffer,0,$buffer.Length)) -gt 0) {
        $size += $read
        if ($size -gt [long]$Object.metadata.size) { throw 'Justificatif prive trop volumineux.' }
        $file.Write($buffer,0,$read)
      }
    } finally { $file.Dispose() }
    $process.WaitForExit()
    $null = $errors.GetAwaiter().GetResult()
    if ($process.ExitCode -ne 0 -or $size -ne [long]$Object.metadata.size) { throw 'Copie privee incomplete. Verifier la cle de sauvegarde sur le VPS.' }
  } finally { if (-not $process.HasExited) { $process.Kill() }; $process.Dispose() }
}

$inventory = Get-StorageInventory
$buckets = @(ConvertFrom-Json -InputObject $inventory)
foreach ($bucket in $buckets) {
  if (-not $bucket.public -and $bucket.objects.Count -gt 0 -and $bucket.id -cne 'expense-receipts') {
    throw 'Un bucket prive contient des fichiers. Configurer un acces Storage protege avant de declarer la sauvegarde complete.'
  }
}
$stamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffffffZ')
$target = Join-Path $Destination "storage-$stamp"
$partial = "$target.partial"
$null = New-Item -ItemType Directory -Path (Join-Path $partial 'objects')
$handler = [Net.Http.HttpClientHandler]::new()
$handler.AllowAutoRedirect = $false
$client = [Net.Http.HttpClient]::new($handler)
$client.Timeout = [TimeSpan]::FromSeconds(60)
$entries = [Collections.Generic.List[object]]::new()
try {
  foreach ($bucket in $buckets) {
    foreach ($object in $bucket.objects) {
      $url = Get-StorageObjectUrl $bucket.id $object.name
      $keyBytes = [Text.Encoding]::UTF8.GetBytes("$($bucket.id)/$($object.name)")
      $filename = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($keyBytes)).ToLowerInvariant() + '.bin'
      $path = Join-Path (Join-Path $partial 'objects') $filename
      if (-not $bucket.public) {
        Save-PrivateStorageObject $bucket $object $path
        $entries.Add([ordered]@{
          bucket=$bucket.id; name=$object.name; id=$object.id; updated_at=$object.updated_at; metadata=$object.metadata
          file="objects/$filename"; size=(Get-Item -LiteralPath $path).Length
          sha256=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
        })
        continue
      }
      $deadline = [Threading.CancellationTokenSource]::new([TimeSpan]::FromSeconds(60))
      $response = $null
      try {
        $response = $client.GetAsync($url, [Net.Http.HttpCompletionOption]::ResponseHeadersRead, $deadline.Token).GetAwaiter().GetResult()
        $null = $response.EnsureSuccessStatusCode()
        if ($object.metadata.eTag -and $response.Headers.ETag.ToString() -cne $object.metadata.eTag) {
          throw 'La version du fichier ne correspond pas aux metadonnees Storage.'
        }
        $source = $response.Content.ReadAsStreamAsync($deadline.Token).GetAwaiter().GetResult()
        $file = [IO.FileStream]::new($path, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
        try {
          $buffer = [byte[]]::new(65536)
          $size = 0L
          while (($read = $source.ReadAsync($buffer, 0, $buffer.Length, $deadline.Token).GetAwaiter().GetResult()) -gt 0) {
            $size += $read
            if ($size -gt 104857600) { throw 'Fichier Storage superieur a la limite de sauvegarde de 100 Mo.' }
            $file.Write($buffer, 0, $read)
          }
        } finally { $file.Dispose(); $source.Dispose() }
        if ($null -eq $object.metadata.size -or $size -ne [long]$object.metadata.size) {
          throw 'La taille du fichier ne correspond pas aux metadonnees Storage.'
        }
        $entries.Add([ordered]@{
          bucket = $bucket.id; name = $object.name; id = $object.id
          updated_at = $object.updated_at; metadata = $object.metadata
          file = "objects/$filename"; size = $size
          sha256 = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
        })
      } finally { if ($response) { $response.Dispose() }; $deadline.Dispose() }
    }
  }
  if ((Get-StorageInventory) -cne $inventory) { throw 'Storage a change pendant la copie. Recommencer pour obtenir un inventaire stable.' }
  $manifest = [ordered]@{ version = 1; project = $project; captured_at = [DateTime]::UtcNow.ToString('o'); buckets = $buckets; files = $entries.ToArray() }
  $manifestPath = Join-Path $partial 'manifest.json'
  [IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 30))
  $hash = (Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash.ToLowerInvariant()
  [IO.File]::WriteAllText((Join-Path $partial 'manifest.sha256'), "$hash  manifest.json`n")
  & (Join-Path $PSScriptRoot 'verify-storage-backup.ps1') -BackupPath $partial
  Move-Item -LiteralPath $partial -Destination $target
  Write-Output "Storage verifie: $($entries.Count) fichier(s), $target"
} finally { $client.Dispose(); $handler.Dispose() }
# Incomplete snapshots remain explicitly marked .partial; no automatic deletion.
