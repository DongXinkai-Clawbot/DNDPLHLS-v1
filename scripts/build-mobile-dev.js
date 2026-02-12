#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 开始构建移动端开发版本（未压缩）...');

// 1. 清理之前的构建
console.log('🧹 清理构建目录...');
try {
  if (process.platform === 'win32') {
    execSync('if exist dist rmdir /s /q dist', { stdio: 'inherit' });
  } else {
    execSync('rm -rf dist', { stdio: 'inherit' });
  }
} catch (e) {
  // 忽略错误
}

// 2. 设置开发环境变量
process.env.VITE_MOBILE_BUILD = 'true';
process.env.VITE_BUILD_TARGET = 'mobile';
process.env.NODE_ENV = 'development'; // 关键：设置为开发模式

// 3. 构建项目（开发模式，不压缩）
console.log('📦 构建项目（开发模式）...');
execSync('npm run build -- --mode development', { stdio: 'inherit' });

// 3b. Stage a minimal release bundle (dist + configs only)
try {
  execSync('node scripts/stage-release.mjs --out release/mobile-dev --include-mobile', { stdio: 'inherit' });
} catch (e) {
  console.warn('[build-mobile-dev] staging skipped (non-fatal).');
}

// 4. 同步到Android项目
console.log('📱 同步到Android项目...');
try {
  execSync('npx cap sync android', { stdio: 'inherit' });
} catch (e) {
  console.warn('⚠️  Capacitor同步失败，请手动运行: npx cap sync android');
}

console.log('\n✅ 移动端开发版本构建完成！');
console.log('📝 此版本包含完整的错误信息，便于调试');
console.log('\n🔧 使用方法:');
console.log('   npx cap run android');
