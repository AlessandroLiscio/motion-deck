# Optional manual check of an exported .pptx on a Windows machine that has PowerPoint (contract 13.4, check b).
# Opens the file read-only and without a window through COM, prints one JSON object (slide count, size, per-slide title, picture, alt text, notes, transition)
# and, with -Pdf, exports a PDF so the page count can be compared. PowerPoint repairs some damaged files silently, so the caller compares
# these facts with the ones the export wrote; it does not rely on "no error".
param(
  [Parameter(Mandatory = $true)][string]$Path,
  [string]$Pdf
)
$ErrorActionPreference = 'Stop'
$full = (Resolve-Path -LiteralPath $Path).Path
$app = New-Object -ComObject PowerPoint.Application
$pres = $null
try {
  $pres = $app.Presentations.Open($full, -1, 0, 0) # ReadOnly, not untitled, no window
  $slides = @()
  foreach ($s in $pres.Slides) {
    $title = ''
    if ($s.Shapes.HasTitle) { $title = $s.Shapes.Title.TextFrame.TextRange.Text }
    $alt = ''
    $pictures = 0
    foreach ($sh in $s.Shapes) { if ($sh.Type -eq 13) { $pictures++; $alt = $sh.AlternativeText } }
    $notes = ''
    if ($s.HasNotesPage) {
      foreach ($sh in $s.NotesPage.Shapes) {
        if ($sh.Type -eq 14 -and $sh.PlaceholderFormat.Type -eq 2 -and $sh.HasTextFrame) { $notes = $sh.TextFrame.TextRange.Text }
      }
    }
    $slides += [ordered]@{ index = $s.SlideIndex; title = $title; shapes = $s.Shapes.Count; pictures = $pictures; alt = $alt; notes = $notes; transition = $s.SlideShowTransition.EntryEffect }
  }
  $result = [ordered]@{ version = $app.Version; slideCount = $pres.Slides.Count; width = $pres.PageSetup.SlideWidth; height = $pres.PageSetup.SlideHeight; slides = $slides; pdf = $null }
  if ($Pdf) {
    $pdfFull = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Pdf) # relative to the shell's folder, not the process folder
    $pres.SaveAs($pdfFull, 32) # ppSaveAsPDF
    $result.pdf = $pdfFull
  }
  $result | ConvertTo-Json -Depth 5 -Compress
} finally {
  if ($pres) { $pres.Close() }
  $app.Quit()
}
