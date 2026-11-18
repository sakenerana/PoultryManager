$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

# Deterministic export of the existing logo; preserve the original artwork.
$pwaProjectRoot = Split-Path -Parent $PSScriptRoot
$pwaSourcePath = Join-Path $pwaProjectRoot 'public/icons/balao-logo-512.png'
$pwaSourceImage = [System.Drawing.Image]::FromFile($pwaSourcePath)
try {
  foreach ($pwaIconSize in @(192, 512)) {
    $pwaBitmap = New-Object System.Drawing.Bitmap($pwaIconSize, $pwaIconSize)
    $pwaGraphics = [System.Drawing.Graphics]::FromImage($pwaBitmap)
    try {
      $pwaGraphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $pwaGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $pwaGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $pwaGraphics.DrawImage($pwaSourceImage, 0, 0, $pwaIconSize, $pwaIconSize)
      $pwaOutputPath = Join-Path $pwaProjectRoot "public/icons/balao-pwa-$pwaIconSize.png"
      $pwaBitmap.Save($pwaOutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
      Write-Output "Exported $pwaIconSize x $pwaIconSize PNG: $pwaOutputPath"
    } finally {
      $pwaGraphics.Dispose()
      $pwaBitmap.Dispose()
    }
  }
} finally {
  $pwaSourceImage.Dispose()
}
