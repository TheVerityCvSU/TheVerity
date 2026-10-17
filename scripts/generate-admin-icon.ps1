Add-Type -AssemblyName System.Drawing

$electronAssets = "d:\The-Verity\electron\assets"

function Render-Admin-V-Vector([int]$size) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.Clear([System.Drawing.Color]::Transparent)
    
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $fontFamily = New-Object System.Drawing.FontFamily "Arial"
    $fontStyle = [int]([System.Drawing.FontStyle]::Bold -bor [System.Drawing.FontStyle]::Italic)
    $fontSize = $size * 0.85
    
    $origin = New-Object System.Drawing.PointF 0, 0
    $format = [System.Drawing.StringFormat]::GenericTypographic
    $path.AddString("V", $fontFamily, $fontStyle, $fontSize, $origin, $format)
    
    # Center V perfectly in canvas
    $bounds = $path.GetBounds()
    $dx = ($size - $bounds.Width) / 2.0 - $bounds.X
    $dy = ($size - $bounds.Height) / 2.0 - $bounds.Y
    
    $matrix = New-Object System.Drawing.Drawing2D.Matrix
    $matrix.Translate($dx, $dy)
    $path.Transform($matrix)
    
    # Draw soft, realistic drop shadow
    for ($step = 3; $step -ge 1; $step--) {
        $shadowMatrix = New-Object System.Drawing.Drawing2D.Matrix
        $sOffY = ($size * 0.012) * $step
        $shadowMatrix.Translate(0, $sOffY)
        $sPatch = $path.Clone()
        $sPatch.Transform($shadowMatrix)
        $alpha = [int](35 / $step)
        $sBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb($alpha, 0, 0, 0))
        $sPen = New-Object System.Drawing.Pen $sBrush, ($size * 0.015 * $step)
        $sPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
        $g.DrawPath($sPen, $sPatch)
        $g.FillPath($sBrush, $sPatch)
        $sPen.Dispose()
        $sBrush.Dispose()
        $sPatch.Dispose()
        $shadowMatrix.Dispose()
    }
    
    # Blue Admin Gradient
    $gradRect = New-Object System.Drawing.RectangleF 0, 0, $size, $size
    $colorTop = [System.Drawing.Color]::FromArgb(255, 96, 165, 250)    # #60a5fa (electric blue)
    $colorMid = [System.Drawing.Color]::FromArgb(255, 37, 99, 235)     # #2563eb (vibrant royal blue)
    $colorBottom = [System.Drawing.Color]::FromArgb(255, 29, 78, 216)  # #1d4ed8 (deep navy blue)
    
    $gradBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $gradRect, $colorTop, $colorBottom, 65.0
    
    $cb = New-Object System.Drawing.Drawing2D.ColorBlend 3
    $cb.Colors = @($colorTop, $colorMid, $colorBottom)
    $cb.Positions = @(0.0, 0.45, 1.0)
    $gradBrush.InterpolationColors = $cb
    
    $g.FillPath($gradBrush, $path)
    $gradBrush.Dispose()
    
    # Top-edge highlight
    $highlightPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(140, 255, 255, 255)), ($size * 0.008)
    $highlightPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $g.DrawPath($highlightPen, $path)
    $highlightPen.Dispose()
    
    $matrix.Dispose()
    $path.Dispose()
    $fontFamily.Dispose()
    $g.Dispose()
    
    return $bmp
}

Write-Output "Rendering clean vector Blue Admin V icons..."
$bmp512 = Render-Admin-V-Vector 512
$bmp512.Save("$electronAssets\icon-admin.png", [System.Drawing.Imaging.ImageFormat]::Png)

$bmp256 = Render-Admin-V-Vector 256
$bmp256.Save("$electronAssets\icon-admin-256.png", [System.Drawing.Imaging.ImageFormat]::Png)

$bmp128 = Render-Admin-V-Vector 128
$bmp128.Save("$electronAssets\icon-admin-128.png", [System.Drawing.Imaging.ImageFormat]::Png)

$bmp64 = Render-Admin-V-Vector 64
$bmp64.Save("$electronAssets\icon-admin-64.png", [System.Drawing.Imaging.ImageFormat]::Png)

$bmp48 = Render-Admin-V-Vector 48
$bmp48.Save("$electronAssets\icon-admin-48.png", [System.Drawing.Imaging.ImageFormat]::Png)

$bmp32 = Render-Admin-V-Vector 32
$bmp32.Save("$electronAssets\icon-admin-32.png", [System.Drawing.Imaging.ImageFormat]::Png)

$bmp16 = Render-Admin-V-Vector 16
$bmp16.Save("$electronAssets\icon-admin-16.png", [System.Drawing.Imaging.ImageFormat]::Png)

Write-Output "All Blue Admin PNG sizes rendered successfully."
