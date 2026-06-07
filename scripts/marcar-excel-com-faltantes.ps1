param(
  [Parameter(Mandatory = $false)]
  [string]$ExcelPath = 'D:\Eduardo\OneDrive\Diego\controle_figurinhas_copa_2026_completo.xlsm',

  [Parameter(Mandatory = $false)]
  [string]$WorksheetName = 'Impressão PB'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not (Test-Path $ExcelPath)) {
  throw "Arquivo não encontrado: $ExcelPath"
}

$clipboardText = Get-Clipboard -Raw
if ([string]::IsNullOrWhiteSpace($clipboardText)) {
  throw 'A área de transferência está vazia. No app, copie a lista de Faltantes e execute novamente.'
}

$normalized = ($clipboardText -replace "`r", '')

# Espera o texto no formato compartilhado do app com seção "Faltantes:".
$missingBlock = $null
$faltantesMatch = [regex]::Match($normalized, '(?s)Faltantes:\s*(.+)$')
if ($faltantesMatch.Success) {
  $missingBlock = $faltantesMatch.Groups[1].Value
}

if ([string]::IsNullOrWhiteSpace($missingBlock)) {
  throw 'Não encontrei a seção "Faltantes:" no texto copiado. No app, copie a opção que contém faltantes.'
}

$codePattern = '(?:00|FWC\d{2}|CC\d{2}|[A-Z]{3}\d{2})'
$missingMatches = [regex]::Matches($missingBlock, $codePattern)
if ($missingMatches.Count -eq 0) {
  throw 'Nenhum código de figurinha foi encontrado na seção de faltantes.'
}

$missingSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
foreach ($m in $missingMatches) {
  [void]$missingSet.Add($m.Value)
}

$excel = $null
$workbook = $null
$worksheet = $null
$usedRange = $null

try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false

  $workbook = $excel.Workbooks.Open($ExcelPath)
  $worksheet = $workbook.Worksheets.Item($WorksheetName)
  $usedRange = $worksheet.UsedRange

  $rows = $usedRange.Rows.Count
  $cols = $usedRange.Columns.Count

  $totalCodes = 0
  $collectedMarked = 0
  $missingCleared = 0

  for ($r = 1; $r -le $rows; $r++) {
    for ($c = 1; $c -le $cols; $c++) {
      $cell = $usedRange.Cells.Item($r, $c)
      $value = [string]$cell.Text

      if ($value -notmatch "^$codePattern$") {
        continue
      }

      $totalCodes++
      $isMissing = $missingSet.Contains($value)

      if ($isMissing) {
        # Remove marca visual para faltantes.
        $cell.Interior.Pattern = -4142
        $cell.Font.Bold = $false
        $missingCleared++
      } else {
        # Marca visual de figurinha já coletada no app.
        $cell.Interior.Color = 13434828
        $cell.Font.Bold = $true
        $collectedMarked++
      }
    }
  }

  $workbook.Save()

  Write-Output "Planilha atualizada: $ExcelPath"
  Write-Output "Aba: $WorksheetName"
  Write-Output "Códigos encontrados: $totalCodes"
  Write-Output "Marcados como já tenho: $collectedMarked"
  Write-Output "Limpos como faltantes: $missingCleared"
}
finally {
  if ($usedRange) { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($usedRange) }
  if ($worksheet) { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($worksheet) }
  if ($workbook) {
    $workbook.Close($true)
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($workbook)
  }
  if ($excel) {
    $excel.Quit()
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel)
  }

  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
