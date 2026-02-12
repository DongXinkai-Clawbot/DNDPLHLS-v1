# Use Physical Android Device (Fastest Solution)

## Why This is Better
- No emulator overhead
- Real hardware performance
- Instant deployment (5-10 seconds)
- Test real-world conditions

## Setup Steps

### 1. Enable Developer Options
1. Go to Settings → About Phone
2. Tap "Build Number" 7 times
3. Developer Options will appear in Settings

### 2. Enable USB Debugging
1. Go to Settings → Developer Options
2. Enable "USB Debugging"
3. Enable "Install via USB" (if available)

### 3. Connect Device
1. Connect phone to computer via USB
2. Allow USB debugging when prompted
3. Select "File Transfer" mode

### 4. Verify Connection
```bash
# Check if device is detected
npx cap run android --list

# Should show your device name
```

### 5. Deploy to Device
```bash
# Build and deploy
npm run build:mobile
npx cap run android --target=YOUR_DEVICE_NAME
```

## Troubleshooting
- If device not detected: Install device-specific USB drivers
- If deployment fails: Check USB cable (use data cable, not charging-only)
- If app crashes: Check logcat for errors

## Performance Benefits
- Deployment: 5-10 seconds (vs 30+ minutes)
- App performance: Native speed
- Real touch/gesture testing
- Actual device sensors