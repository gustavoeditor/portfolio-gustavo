#Requires -Version 5.1
<#
.SYNOPSIS
  Gate de publicacao do Creative Tools Windows.
.DESCRIPTION
  Rejeita EXEs sem assinatura Authenticode valida, autoassinados,
  sem timestamp ou cujo publicador nao corresponde ao titular informado.
  Execute no Windows com Windows SDK / SignTool para verificacao adicional.
.EXAMPLE
  .\\scripts\\verify-creative-tools-authenticode.ps1 -InstallerPath .\\Creative_Tools_Installer.exe -ExpectedPublisher "NOME LEGAL DO PUBLICADOR"
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$InstallerPath,
  [Parameter(Mandatory=$true)][string]$ExpectedPublisher,
  [string]$ExpectedSha256,
  [string]$ReportPath
)
$ErrorActionPreference='Stop'
try {
  $item = Get-Item -LiteralPath $InstallerPath -ErrorAction Stop
  if ($item.Extension.ToLowerInvariant() -ne '.exe') { throw 'A entrada deve ser um EXE.' }
  if ($item.Length -lt 1024) { throw 'Arquivo inesperadamente pequeno.' }
  $hash = (Get-FileHash -LiteralPath $item.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($ExpectedSha256) {
    if ($ExpectedSha256 -notmatch '^[a-fA-F0-9]{64}$' -or $hash -ne $ExpectedSha256.ToLowerInvariant()) {
      throw 'Falha na comparacao SHA-256 com o release esperado.'
    }
  }
  $sig = Get-AuthenticodeSignature -LiteralPath $item.FullName
  if ($sig.Status -ne [System.Management.Automation.SignatureStatus]::Valid) {
    throw ('Assinatura Authenticode invalida ou ausente: ' + $sig.Status + ' ' + $sig.StatusMessage)
  }
  if (-not $sig.SignerCertificate) { throw 'Certificado do signatario ausente.' }
  $subject = [string]$sig.SignerCertificate.Subject
  if ($subject.IndexOf($ExpectedPublisher,[System.StringComparison]::OrdinalIgnoreCase) -lt 0) {
    throw ('Publicador diferente do esperado. Encontrado: ' + $subject)
  }
  if (-not $sig.TimeStamperCertificate) { throw 'Assinatura sem carimbo do tempo confiavel.' }
  if ($sig.SignerCertificate.Thumbprint -eq $sig.SignerCertificate.Issuer) {
    throw 'Certificado autoassinado nao pode ser utilizado para distribuicao.'
  }
  $chain = New-Object System.Security.Cryptography.X509Certificates.X509Chain
  $chain.ChainPolicy.RevocationMode = [System.Security.Cryptography.X509Certificates.X509RevocationMode]::Online
  $chain.ChainPolicy.RevocationFlag = [System.Security.Cryptography.X509Certificates.X509RevocationFlag]::ExcludeRoot
  if (-not $chain.Build($sig.SignerCertificate)) {
    $issues = ($chain.ChainStatus | ForEach-Object { $_.StatusInformation.Trim() }) -join '; '
    throw ('Cadeia de confianca nao validada: ' + $issues)
  }
  if ($sig.SignerCertificate.Subject -eq $sig.SignerCertificate.Issuer) {
    throw 'Certificado autoassinado bloqueado.'
  }
  $signtool = Get-Command signtool.exe -ErrorAction SilentlyContinue
  if ($signtool) {
    & $signtool.Source verify /pa /v $item.FullName | Out-Null
    if ($LASTEXITCODE -ne 0) { throw ('SignTool rejeitou a assinatura, codigo ' + $LASTEXITCODE) }
  }
  $report = [ordered]@{
    product='creative-tools'
    file=$item.Name
    sha256=$hash
    signatureStatus='valid'
    signerSubject=$subject
    signerThumbprint=$sig.SignerCertificate.Thumbprint
    timestampSubject=$sig.TimeStamperCertificate.Subject
    checkedAtUtc=[DateTime]::UtcNow.ToString('o')
    signToolChecked=[bool]$signtool
  }
  if ($ReportPath) {
    $report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $ReportPath -Encoding UTF8
  }
  $report | ConvertTo-Json -Depth 5
  Write-Host 'PASSOU: assinatura Windows e publicador verificados.'
  exit 0
} catch {
  Write-Error ('BLOQUEADO: ' + $_.Exception.Message)
  exit 1
}
