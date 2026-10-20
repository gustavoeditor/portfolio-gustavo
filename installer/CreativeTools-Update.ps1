param(
  [string]$ManifestUrl = 'https://portfolio-gustavo-chi.vercel.app/updates/creative-tools/manifest.json',
  [string]$InstallDir = "$env:APPDATA\\Adobe\\CEP\\extensions\\com.gustavo.creativetools",
  [switch]$CheckOnly
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
function Fail($message) { throw "[Creative Tools] $message" }
try {
  if ([uri]$ManifestUrl -isnot [uri]) { Fail 'URL invalida.' }
  $uri = [uri]$ManifestUrl
  if ($uri.Scheme -ne 'https' -or $uri.Host -ne 'portfolio-gustavo-chi.vercel.app') { Fail 'Manifesto fora do dominio oficial.' }
  $manifest = Invoke-RestMethod -Uri $ManifestUrl -TimeoutSec 20 -MaximumRedirection 0
  if ($manifest.schemaVersion -ne 1 -or $manifest.product -ne 'creative-tools') { Fail 'Manifesto invalido.' }
  if (-not $manifest.latest) { Write-Host 'Nenhuma atualizacao oficial disponivel.'; exit 0 }
  $release = @($manifest.releases | Where-Object { $_.version -eq $manifest.latest }) | Select-Object -First 1
  if (-not $release) { Fail 'Versao anunciada sem release correspondente.' }
  if ($release.sha256 -notmatch '^[a-fA-F0-9]{64}$') { Fail 'Release sem SHA-256 valido.' }
  $download = [uri]$release.downloadUrl
  if ($download.Scheme -ne 'https') { Fail 'Download deve usar HTTPS.' }
  Write-Host "Creative Tools: $($release.version)"
  @($release.changes) | ForEach-Object { Write-Host " - $_" }
  if ($CheckOnly) { exit 0 }
  $answer = Read-Host 'Baixar e instalar esta atualizacao? (S/N)'
  if ($answer -notin @('s','S','sim','SIM')) { Write-Host 'Cancelado.'; exit 0 }
  if (Get-Process -Name AfterFX -ErrorAction SilentlyContinue) { Fail 'Feche o After Effects antes de atualizar.' }
  $tmp = Join-Path ([IO.Path]::GetTempPath()) ('creative-tools-' + [guid]::NewGuid().ToString('N'))
  $archive = Join-Path $tmp 'release.zip'
  $staging = Join-Path $tmp 'staging'
  New-Item -ItemType Directory -Path $staging -Force | Out-Null
  try {
    Invoke-WebRequest -Uri $download.AbsoluteUri -OutFile $archive -TimeoutSec 120 -MaximumRedirection 0
    if ((Get-Item $archive).Length -gt 250MB) { Fail 'Arquivo excede limite de seguranca.' }
    $hash = (Get-FileHash -Path $archive -Algorithm SHA256).Hash
    if ($hash -ine $release.sha256) { Fail 'SHA-256 nao corresponde ao release.' }
    Add-Type -AssemblyName System.IO.Compression
    $zip = [IO.Compression.ZipFile]::OpenRead($archive)
    try {
      foreach ($entry in $zip.Entries) {
        $name = $entry.FullName.Replace('\\','/')
        if ($name.StartsWith('/') -or $name -match '(^|/)\\.\\.(/|$)' -or $name -match '^[a-zA-Z]:' -or (($entry.ExternalAttributes -shr 16) -band 61440) -eq 40960) { Fail 'ZIP contem caminho inseguro.' }
      }
    } finally { $zip.Dispose() }
    Expand-Archive -LiteralPath $archive -DestinationPath $staging
    $manifestFile = Join-Path $staging 'CSXS\\manifest.xml'
    if (-not (Test-Path $manifestFile)) { Fail 'Pacote nao contem CSXS/manifest.xml na raiz.' }
    $parent = Split-Path $InstallDir -Parent
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
    $backup = "$InstallDir.backup"
    if (Test-Path $backup) { Remove-Item -LiteralPath $backup -Recurse -Force }
    $hadPrevious = Test-Path $InstallDir
    if ($hadPrevious) { Move-Item -LiteralPath $InstallDir -Destination $backup }
    try {
      Move-Item -LiteralPath $staging -Destination $InstallDir
      Write-Host "Instalado: $($release.version)"
    } catch {
      if (Test-Path $InstallDir) { Remove-Item -LiteralPath $InstallDir -Recurse -Force }
      if ($hadPrevious -and (Test-Path $backup)) { Move-Item -LiteralPath $backup -Destination $InstallDir }
      throw
    }
  } finally {
    if (Test-Path $tmp) { Remove-Item -LiteralPath $tmp -Recurse -Force }
  }
} catch {
  Write-Error $_.Exception.Message
  exit 1
}
