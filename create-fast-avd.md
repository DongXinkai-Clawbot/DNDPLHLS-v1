# Create Fast Android Emulator for AMD Ryzen

## Problem
Your current "Medium_Phone_API_36" emulator is using ARM emulation, causing 30+ minute deployment times on AMD processors.

## Solution: Create x86_64 AVD with Hardware Acceleration

### Step 1: Enable WHPX (Windows Hypervisor Platform)
```powershell
# Run as Administrator
Enable-WindowsOptionalFeature -Online -FeatureName HypervisorPlatform -All
```

### Step 2: Create New Fast AVD
1. Open Android Studio
2. Go to Tools → AVD Manager
3. Click "Create Virtual Device"
4. Choose device (e.g., Pixel 4, Pixel 6)
5. **CRITICAL**: Select system image with "x86_64" architecture:
   - ✅ Google APIs Intel x86_64 Atom (API 30, 31, 32, or 33)
   - ❌ Avoid ARM64 or ARM system images

### Step 3: Configure AVD Settings
```
Device: Pixel 4 or similar
System Image: Google APIs Intel x86_64 Atom (API 30+)
RAM: 4096 MB (4GB)
VM Heap: 512 MB
Graphics: Hardware - GLES 2.0
Boot Option: Cold boot
Multi-Core CPU: 4 cores
```

### Step 4: Advanced Configuration
Edit AVD config file to add:
```
hw.cpu.arch=x86_64
hw.gpu.enabled=yes
hw.gpu.mode=host
hw.ramSize=4096
vm.heapSize=512
```

## Performance Comparison
- ARM emulation: 30+ minutes deployment
- x86_64 with WHPX: 30-60 seconds deployment
- Performance improvement: 30-60x faster

## Alternative: Use Physical Device
If emulator is still slow:
1. Enable Developer Options on Android phone
2. Enable USB Debugging
3. Connect via USB
4. Deploy directly to device (fastest option)

## Capacitor-Specific Optimization
For your Capacitor app, also ensure:
```bash
# Use optimized build
npm run build:mobile
npx cap sync android
npx cap run android --target=YOUR_FAST_AVD_NAME
```