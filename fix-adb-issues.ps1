# Fix ADB Issues - Complete Reset
# Run this script as Administrator if ADB is stuck

Write-Host "🔧 Fixing ADB Issues..." -ForegroundColor Green

# Step 1: Kill all ADB processes
Write-Host "`n1️⃣ Killing all ADB processes..." -ForegroundColor Yellow
try {
    Get-Process adb -ErrorAction SilentlyContinue | Stop-Process -Force
    Write-Host "✅ ADB processes killed" -ForegroundColor Green
} catch {
    Write-Host "⚠️  No ADB processes found or already stopped" -ForegroundColor Yellow
}

# Step 2: Kill ADB server
Write-Host "`n2️⃣ Killing ADB server..." -ForegroundColor Yellow
try {
    & "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" kill-server 2>$null
    Start-Sleep -Seconds 2
    Write-Host "✅ ADB server killed" -ForegroundColor Green
} catch {
    Write-Host "⚠️  ADB server kill failed (may already be stopped)" -ForegroundColor Yellow
}

# Step 3: Start ADB server
Write-Host "`n3️⃣ Starting ADB server..." -ForegroundColor Yellow
try {
    & "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" start-server
    Start-Sleep -Seconds 3
    Write-Host "✅ ADB server started" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to start ADB server" -ForegroundColor Red
    exit 1
}

# Step 4: Check devices
Write-Host "`n4️⃣ Checking connected devices..." -ForegroundColor Yellow
try {
    $devices = & "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" devices
    Write-Host $devices
    
    if ($devices -match "emulator-\d+") {
        Write-Host "✅ Emulator detected" -ForegroundColor Green
    } else {
        Write-Host "⚠️  No emulator detected - make sure emulator is running" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Failed to check devices" -ForegroundColor Red
}

# Step 5: Check emulator status
Write-Host "`n5️⃣ Checking emulator status..." -ForegroundColor Yellow
try {
    $emulatorProcess = Get-Process qemu-system-x86_64 -ErrorAction SilentlyContinue
    if ($emulatorProcess) {
        Write-Host "✅ Emulator process is running (PID: $($emulatorProcess.Id))" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Emulator process not found - emulator may not be running" -ForegroundColor Yellow
        Write-Host "   Start emulator from Android Studio or run: emulator -avd YOUR_AVD_NAME" -ForegroundColor Cyan
    }
} catch {
    Write-Host "⚠️  Could not check emulator status" -ForegroundColor Yellow
}

Write-Host "`n✅ ADB fix complete!" -ForegroundColor Green
Write-Host "`n📝 Next steps:" -ForegroundColor Cyan
Write-Host "   1. If emulator is not running, start it from Android Studio" -ForegroundColor White
Write-Host "   2. Wait for emulator to fully boot (see home screen)" -ForegroundColor White
Write-Host "   3. Run: npm run mobile:run" -ForegroundColor White
Write-Host "`n💡 If issues persist:" -ForegroundColor Cyan
Write-Host "   - Restart the emulator" -ForegroundColor White
Write-Host "   - Restart Android Studio" -ForegroundColor White
Write-Host "   - Restart your computer" -ForegroundColor White
