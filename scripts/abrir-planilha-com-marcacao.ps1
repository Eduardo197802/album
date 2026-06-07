param(
  [Parameter(Mandatory = $false)]
  [string]$ExcelPath = 'D:\Eduardo\OneDrive\Diego\controle_figurinhas_copa_2026_completo.xlsm',

  [Parameter(Mandatory = $false)]
  [string]$MissingPath = 'D:\Eduardo\OneDrive\Diego\faltantes_app.txt',

  [Parameter(Mandatory = $false)]
  [string]$WorksheetName = 'Impressão PB'
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $ExcelPath)) {
  throw "Arquivo nao encontrado: $ExcelPath"
}

if (-not (Test-Path $MissingPath)) {
  throw "Arquivo de faltantes nao encontrado: $MissingPath. Rode antes o script atualizar-faltantes-local.ps1"
}

$text = Get-Content -Path $MissingPath -Raw -Encoding UTF8
$codes = [regex]::Matches($text, '(00|FWC\d{2}|CC\d{2}|[A-Z]{3}\d{2})') | ForEach-Object { $_.Value.ToUpperInvariant() }
$missingSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
foreach ($code in ($codes | Sort-Object -Unique)) {
  [void]$missingSet.Add($code)
}

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

$workbook = $excel.Workbooks.Open($ExcelPath)
$worksheet = $workbook.Worksheets.Item($WorksheetName)
$used = $worksheet.UsedRange

$pattern = '^(00|FWC\d{2}|CC\d{2}|[A-Z]{3}\d{2})$'
$totalCodes = 0
$markedOwned = 0
$clearedMissing = 0

for ($r = 1; $r -le $used.Rows.Count; $r++) {
  for ($c = 1; $c -le $used.Columns.Count; $c++) {
    $cell = $used.Cells.Item($r, $c)
    $value = [string]$cell.Text

    if ($value -notmatch $pattern) {
      continue
    }

    $totalCodes++
    $code = $value.ToUpperInvariant()

    if ($missingSet.Contains($code)) {
      $cell.Interior.Pattern = -4142
      $cell.Font.Bold = $false
      $clearedMissing++
    } else {
      $cell.Interior.Color = 13434828
      $cell.Font.Bold = $true
      $markedOwned++
    }
  }
}

$workbook.Save()

Write-Output "Planilha atualizada e aberta: $ExcelPath"
Write-Output "Aba: $WorksheetName"
Write-Output "Codigos lidos: $totalCodes"
Write-Output "Marcadas como tenho: $markedOwned"
Write-Output "Mantidas faltantes: $clearedMissing"

$excel.DisplayAlerts = $true
$excel.Visible = $true
$excel.UserControl = $true

[void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($used)
[void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($worksheet)
[void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($workbook)
[void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel)

[GC]::Collect()
[GC]::WaitForPendingFinalizers()
