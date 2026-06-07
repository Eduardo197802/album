param(
  [Parameter(Mandatory = $false)]
  [string]$ExcelPath = 'D:\Eduardo\OneDrive\Diego\controle_figurinhas_copa_2026_completo.xlsm'
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $ExcelPath)) {
  throw "Arquivo nao encontrado: $ExcelPath"
}

$moduleCode = @'
Option Explicit

Private Function IsStickerCode(ByVal rawValue As Variant) As Boolean
    Dim txt As String
    txt = UCase$(Trim$(CStr(rawValue)))

    If txt = "00" Then
        IsStickerCode = True
        Exit Function
    End If

    If txt Like "FWC##" Or txt Like "CC##" Or txt Like "???##" Then
        IsStickerCode = True
    Else
        IsStickerCode = False
    End If
End Function

Private Function LoadMissingSet(ByVal filePath As String) As Object
    Dim dict As Object
    Set dict = CreateObject("Scripting.Dictionary")
    dict.CompareMode = 1

    If Dir$(filePath) = "" Then
        Set LoadMissingSet = dict
        Exit Function
    End If

    Dim fso As Object
    Dim stream As Object
    Set fso = CreateObject("Scripting.FileSystemObject")
    Set stream = fso.OpenTextFile(filePath, 1, False)

    Dim text As String
    text = stream.ReadAll
    stream.Close

    Dim regex As Object
    Set regex = CreateObject("VBScript.RegExp")
    regex.Global = True
    regex.IgnoreCase = True
    regex.Pattern = "(00|FWC\d{2}|CC\d{2}|[A-Z]{3}\d{2})"

    Dim matches As Object
    Set matches = regex.Execute(UCase$(text))

    Dim m As Object
    For Each m In matches
        If Not dict.Exists(CStr(m.Value)) Then
            dict.Add CStr(m.Value), True
        End If
    Next m

    Set LoadMissingSet = dict
End Function

Public Sub AutoMarcarFigurinhas()
    On Error GoTo fail

    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets("Impressao PB")

    Dim missingFile As String
    missingFile = ThisWorkbook.Path & "\\faltantes_app.txt"

    Dim missingSet As Object
    Set missingSet = LoadMissingSet(missingFile)

    Dim used As Range
    Set used = ws.UsedRange

    Dim c As Range
    Application.ScreenUpdating = False

    For Each c In used.Cells
        If IsStickerCode(c.Value2) Then
            Dim code As String
            code = UCase$(Trim$(CStr(c.Value2)))

            If missingSet.Exists(code) Then
                c.Interior.Pattern = xlPatternNone
                c.Font.Bold = False
            Else
                c.Interior.Color = RGB(204, 255, 204)
                c.Font.Bold = True
            End If
        End If
    Next c

    Application.ScreenUpdating = True
    Exit Sub

fail:
    Application.ScreenUpdating = True
End Sub
'@

$thisWorkbookCode = @'
Option Explicit

Private Sub Workbook_Open()
    On Error Resume Next
    AutoMarcarFigurinhas
End Sub
'@

$excel = $null
$workbook = $null

try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false

  $workbook = $excel.Workbooks.Open($ExcelPath)
  $project = $workbook.VBProject

  $targetModuleName = 'AlbumAutoMark'
  $moduleComponent = $null

  foreach ($component in $project.VBComponents) {
    if ($component.Name -eq $targetModuleName) {
      $moduleComponent = $component
      break
    }
  }

  if ($null -eq $moduleComponent) {
    $moduleComponent = $project.VBComponents.Add(1)
    $moduleComponent.Name = $targetModuleName
  }

  $module = $moduleComponent.CodeModule
  $module.DeleteLines(1, $module.CountOfLines)
  $module.AddFromString($moduleCode)

  $wbComponent = $project.VBComponents.Item('ThisWorkbook')
  $wbModule = $wbComponent.CodeModule
  $wbModule.DeleteLines(1, $wbModule.CountOfLines)
  $wbModule.AddFromString($thisWorkbookCode)

  $workbook.Save()
  Write-Output "Macro configurada com sucesso em: $ExcelPath"
  Write-Output "Leitura automatica de: $(Split-Path $ExcelPath -Parent)\\faltantes_app.txt"
}
finally {
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
