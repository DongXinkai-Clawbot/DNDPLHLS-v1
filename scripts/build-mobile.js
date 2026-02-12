#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 开始构建移动端优化版本...');

// 1. 清理之前的构�?console.log('🧹 清理构建目录...');
try {
  // Windows兼容的删除命�?  if (process.platform === 'win32') {
    execSync('if exist dist rmdir /s /q dist', { stdio: 'inherit' });
  } else {
    execSync('rm -rf dist', { stdio: 'inherit' });
  }
} catch (e) {
  // 忽略错误
}

// 2. 设置移动端环境变�?process.env.VITE_MOBILE_BUILD = 'true';
process.env.VITE_BUILD_TARGET = 'mobile';

// 3. 构建项目
console.log('📦 构建项目...');
execSync('npm run build', { stdio: 'inherit' });

// 4. 优化移动端资�?console.log('�?优化移动端资�?..');

// 读取构建的HTML文件
const htmlPath = path.join(__dirname, '../dist/index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// 添加移动端优化的meta标签
// Inject mobile-specific tags based on built output
const injectionStart = '<!-- mobile-optimizations:start -->';
const injectionEnd = '<!-- mobile-optimizations:end -->';

const hasTag = (needle) => html.toLowerCase().includes(needle.toLowerCase());

const extractLinks = (pattern) => {
  const matches = [];
  let m;
  while ((m = pattern.exec(html)) !== null) {
    if (m[1]) matches.push(m[1]);
  }
  return matches;
};

const cssLinks = extractLinks(/<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi);
const scriptLinks = extractLinks(/<script\s+[^>]*type=["']module["'][^>]*src=["']([^"']+)["'][^>]*>/gi);

const metaTags = [
  { key: 'name="mobile-web-app-capable"', tag: '<meta name="mobile-web-app-capable" content="yes">' },
  { key: 'name="apple-mobile-web-app-capable"', tag: '<meta name="apple-mobile-web-app-capable" content="yes">' },
  { key: 'name="apple-mobile-web-app-status-bar-style"', tag: '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">' },
  { key: 'name="theme-color"', tag: '<meta name="theme-color" content="#000000">' },
  { key: 'name="format-detection"', tag: '<meta name="format-detection" content="telephone=no">' },
  { key: 'name="msapplication-tap-highlight"', tag: '<meta name="msapplication-tap-highlight" content="no">' }
]
  .filter(entry => !hasTag(entry.key))
  .map(entry => entry.tag);

const preloadTags = [];
cssLinks.forEach((href) => {
  if (!hasTag(`rel="preload" href="${href}"`) && !hasTag(`rel='preload' href='${href}'`)) {
    preloadTags.push(`<link rel="preload" href="${href}" as="style">`);
  }
});
scriptLinks.forEach((src) => {
  if (!hasTag(`rel="preload" href="${src}"`) && !hasTag(`rel='preload' href='${src}'`)) {
    preloadTags.push(`<link rel="preload" href="${src}" as="script">`);
  }
});

const mobileCssHref = './mobile-optimizations.css';
const mobileCssTag = hasTag(`href="${mobileCssHref}"`) || hasTag(`href='${mobileCssHref}'`)
  ? null
  : `<link rel="stylesheet" href="${mobileCssHref}" media="(pointer: coarse), (hover: none)">`;

const injectedTags = [
  ...metaTags,
  ...preloadTags,
  ...(mobileCssTag ? [mobileCssTag] : [])
];

const injectionBlock = `\n  ${injectionStart}\n  ${injectedTags.join('\n  ')}\n  ${injectionEnd}\n`;

if (html.includes(injectionStart) && html.includes(injectionEnd)) {
  const blockRegex = new RegExp(`${injectionStart}[\\s\\S]*?${injectionEnd}`, 'm');
  html = html.replace(blockRegex, injectionBlock.trim());
} else {
  html = html.replace('</head>', injectionBlock + '</head>');
}

fs.writeFileSync(htmlPath, html, 'utf8');

// 4b. Stage a minimal release bundle (dist + configs only)
try {
  execSync('node scripts/stage-release.mjs --out release/mobile --include-mobile', { stdio: 'inherit' });
} catch (e) {
  console.warn('[build-mobile] staging skipped (non-fatal).');
}

// 5. 同步到Android项目
console.log('📱 同步到Android项目...');
try {
  execSync('npx cap sync android', { stdio: 'inherit' });
} catch (e) {
  console.warn('⚠️  Capacitor同步失败，请手动运行: npx cap sync android');
}

// 6. 生成构建报告
console.log('📊 生成构建报告...');
const distPath = path.join(__dirname, '../dist');

function getFilesRecursively(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      getFilesRecursively(filePath, fileList);
    } else {
      fileList.push(path.relative(distPath, filePath));
    }
  });
  
  return fileList;
}

const files = getFilesRecursively(distPath);
const jsFiles = files.filter(f => f.endsWith('.js'));
const cssFiles = files.filter(f => f.endsWith('.css'));

console.log('\n📋 构建完成报告:');
console.log(`   JS文件: ${jsFiles.length}个`);
console.log(`   CSS文件: ${cssFiles.length}个`);

// 计算总大�?let totalSize = 0;
files.forEach(file => {
  try {
    const filePath = path.join(distPath, file);
    const stats = fs.statSync(filePath);
    if (stats.isFile()) {
      totalSize += stats.size;
    }
  } catch (e) {
    // 忽略错误
  }
});

console.log(`   总大�? ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

console.log('\n�?移动端构建完成！');
console.log('\n📱 下一�?');
console.log('   1. 在Android Studio中打开 android/ 目录');
console.log('   2. 连接设备或启动模拟器');
console.log('   3. 点击运行按钮进行测试');
console.log('\n🔧 或者使用命令行:');
console.log('   npx cap run android');

