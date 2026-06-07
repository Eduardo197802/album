param(
  [Parameter(Mandatory = $false)]
  [string]$OutputPath = 'D:\Eduardo\OneDrive\Diego\faltantes_app.txt'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$text = Get-Clipboard -Raw
if ([string]::IsNullOrWhiteSpace($text)) {
  throw 'Area de transferencia vazia. Copie a lista de faltantes no app e rode novamente.'
}

$normalized = ($text -replace "`r", '')
$match = [regex]::Match($normalized, '(?s)Faltantes:\s*(.+)$')
if (-not $match.Success) {
  throw 'Nao encontrei a secao "Faltantes:". No app, copie uma lista que inclua faltantes.'
}

$missingBlock = $match.Groups[1].Value
$codes = [regex]::Matches($missingBlock, '(00|FWC\d{2}|CC\d{2}|[A-Z]{3}\d{2})') | ForEach-Object { $_.Value.ToUpperInvariant() }
$uniqueCodes = $codes | Sort-Object -Unique

if ($uniqueCodes.Count -eq 0) {
  throw 'Nenhum codigo valido encontrado na secao de faltantes.'
}

$dir = Split-Path $OutputPath -Parent
if (-not (Test-Path $dir)) {
  New-Item -ItemType Directory -Path $dir | Out-Null
}

$header = @(
  '# Atualizado pelo script atualizar-faltantes-local.ps1',
  "# Data: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
  '# Mantenha este arquivo na mesma pasta da planilha para auto-marcacao no Excel.'
)

($header + $uniqueCodes) | Set-Content -Path $OutputPath -Encoding UTF8

Write-Output "Arquivo de faltantes atualizado em: $OutputPath"
Write-Output "Total de codigos faltantes: $($uniqueCodes.Count)"
