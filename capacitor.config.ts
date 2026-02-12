import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // 這是安卓系統識別您 App 的唯一身分證，格式通常是 com.公司名.軟體名
  appId: 'com.adou.harmoniclattice',
  
  // App 在手機桌面上顯示的名稱
  appName: 'Harmonic Lattice',
  
  // 您的網頁代碼所在的資料夾 (Vite 預設是 dist)
  webDir: 'dist',
  
  server: {
    // 開啟這個可以避免手機上的 file:// 跨域問題
    androidScheme: 'https'
  }
};

export default config;
