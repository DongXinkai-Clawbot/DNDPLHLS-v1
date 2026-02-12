# Fix Android Emulator Performance on AMD Ryzen
# Run this script as Administrator

Write-Host "🔧 Fixing Android Emulator Performance for AMD Ryzen..." -ForegroundColor Green

# 1. Enable Windows Hypervisor Platform (WHPX)
Write-Host "📋 Enabling Windows Hypervisor Platform..." -ForegroundColor Yellow
try {
    Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-Hypervisor -All -NoRestart
    Enable-WindowsOptionalFeature -Online -FeatureName HypervisorPlatform -All -NoRestart
    Write-Host "✅ WHPX enabled successfully" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Please run as Administrator to enable WHPX" -ForegroundColor Red
}

# 2. Check current emulator configuration
Write-Host "📱 Checking Android SDK and emulator..." -ForegroundColor Yellow

# Find Android SDK path
$androidHome = $env:ANDROID_HOME
if (-not $androidHome) {
    $androidHome = $env:ANDROID_SDK_ROOT
}
if (-not $androidHome) {
    # Try common locations
    $commonPaths = @(
        "$env:LOCALAPPDATA\Android\Sdk",
        "$env:USERPROFILE\AppData\Local\Android\Sdk",
        "C:\Android\Sdk"
    )
    foreach ($path in $commonPaths) {
        if (Test-Path $path) {
            $androidHome = $path
            break
        }
    }
}

if ($androidHome) {
    Write-Host "📍 Android SDK found at: $androidHome" -ForegroundColor Green
    
    # List available system images
    $avdManager = Join-Path $androidHome "cmdline-tools\latest\bin\avdmanager.bat"
    if (Test-Path $avdManager) {
        Write-Host "📋 Available system images:" -ForegroundColor Yellow
        & $avdManager list target
    }
} else {
    Write-Host "❌ Android SDK not found. Please install Android Studio first." -ForegroundColor Red
}

Write-Host "`n🎯 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Restart your computer to apply WHPX changes" -ForegroundColor White
Write-Host "2. Create a new AVD with x86_64 system image (not ARM)" -ForegroundColor White
Write-Host "3. Enable hardware acceleration in AVD settings" -ForegroundColor White
Write-Host "4. Use API level 30+ for better performance" -ForegroundColor White

Write-Host "`n📝 Recommended AVD Configuration:" -ForegroundColor Cyan
Write-Host "- System Image: Google APIs Intel x86_64 Atom" -ForegroundColor White
Write-Host "- API Level: 30, 31, 32, or 33" -ForegroundColor White
Write-Host "- RAM: 4GB (not more than 8GB)" -ForegroundColor White
Write-Host "- Graphics: Hardware - GLES 2.0" -ForegroundColor White
Write-Host "- Boot option: Cold boot" -ForegroundColor White