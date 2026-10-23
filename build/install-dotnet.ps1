# ==============================================================================
# The Verity - Microsoft .NET SDK Setup Helper for NSIS Installer
# ==============================================================================
param (
    [string]$ExeDir = ""
)

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

Write-Host "=========================================================="
Write-Host "       The Verity - Microsoft .NET SDK Setup Helper       "
Write-Host "=========================================================="

# 1. Check if dotnet is already functioning
$isInstalled = $false
try {
    $existing = & dotnet --version 2>$null
    if ($existing) {
        Write-Host "[OK] Microsoft .NET SDK $existing is already active on system PATH."
        $isInstalled = $true
    }
} catch {}

if (-not $isInstalled) {
    $programFilesDotnet = "$env:ProgramFiles\dotnet\dotnet.exe"
    $programFilesX86Dotnet = "${env:ProgramFiles(x86)}\dotnet\dotnet.exe"
    if ((Test-Path $programFilesDotnet) -or (Test-Path $programFilesX86Dotnet)) {
        Write-Host "[OK] Microsoft .NET SDK detected in Program Files."
        $isInstalled = $true
    }
}

if ($isInstalled) {
    Write-Host "[Info] .NET SDK is already installed. Skipping redundant installation."
    exit 0
}

# 2. Check for an offline installer next to the setup executable
$installerPath = $null
$candidates = @()
if ($ExeDir -and (Test-Path $ExeDir)) {
    $candidates += (Join-Path $ExeDir "dotnet-sdk-win-x64.exe")
    $candidates += (Join-Path $ExeDir "dotnet-sdk.exe")
    $candidates += (Join-Path $ExeDir "dotnet-sdk-8.0-win-x64.exe")
}
$candidates += (Join-Path $env:TEMP "dotnet-sdk-win-x64.exe")

foreach ($c in $candidates) {
    if ($c -and (Test-Path $c)) {
        $installerPath = $c
        Write-Host "[Installer] Found local installer package at: $installerPath"
        break
    }
}

# 3. If no local package exists, download official Microsoft .NET 8.0 SDK installer
$downloadedTempFile = $false
if (-not $installerPath) {
    $url = "https://aka.ms/dotnet/8.0/dotnet-sdk-win-x64.exe"
    $targetFile = Join-Path $env:TEMP "verity_dotnet_sdk_installer.exe"
    
    Write-Host "[Download] Connecting to Microsoft official CDN for .NET 8.0 SDK..."
    Write-Host "[Download] URL: $url"
    Write-Host "[Download] Downloading installer... (this may take a few minutes depending on your internet speed)"
    
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
        $webClient = New-Object System.Net.WebClient
        $webClient.DownloadFile($url, $targetFile)

        if (Test-Path $targetFile) {
            $sizeMB = [math]::Round(((Get-Item $targetFile).Length / 1MB), 1)
            Write-Host "[Download] Download complete! Package size: $sizeMB MB"
            $installerPath = $targetFile
            $downloadedTempFile = $true
        } else {
            Write-Warning "[Download] Download finished but target executable was not found."
        }
    } catch {
        Write-Warning "[Download] Download failed: $($_.Exception.Message)"
    }
}

# 4. Execute installer silently
if ($installerPath -and (Test-Path $installerPath)) {
    Write-Host "[Install] Launching Microsoft .NET SDK installation quietly..."
    Write-Host "[Install] Note: If Windows UAC prompts for administrator approval, please accept it."
    
    try {
        $proc = Start-Process -FilePath $installerPath -ArgumentList "/install", "/quiet", "/norestart" -Verb RunAs -Wait -PassThru
        Write-Host "[Install] Installer process completed with exit code: $($proc.ExitCode)"
        
        if ($proc.ExitCode -eq 0 -or $proc.ExitCode -eq 3010) {
            Write-Host "[Success] Microsoft .NET SDK was successfully installed!"
        } else {
            Write-Warning "[Warning] Installer exited with code $($proc.ExitCode). A system reboot may be required."
        }
    } catch {
        Write-Warning "[Install Error] Could not start installer: $($_.Exception.Message)"
    }

    # Clean up temporary downloaded file
    if ($downloadedTempFile -and (Test-Path $installerPath)) {
        try {
            Remove-Item -Path $installerPath -Force -ErrorAction SilentlyContinue
        } catch {}
    }
} else {
    Write-Warning "[Notice] .NET SDK installer could not be obtained. Proceeding with Verity setup."
}

# 5. Final check
if ((Test-Path "$env:ProgramFiles\dotnet\dotnet.exe") -or (Get-Command "dotnet" -ErrorAction SilentlyContinue)) {
    Write-Host "[Ready] Microsoft .NET SDK is ready for The Verity C# Compiler."
}
exit 0
