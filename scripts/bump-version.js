#!/usr/bin/env node
/**
 * Auto Version Bumper for Khmer AI Book Reader
 * Automatically increments patch version, updates version.json, sw.js, index.html, and app.js
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const PKG_PATH = path.join(ROOT_DIR, 'package.json');
const VERSION_PATH = path.join(ROOT_DIR, 'public', 'version.json');
const SW_PATH = path.join(ROOT_DIR, 'public', 'sw.js');
const HTML_PATH = path.join(ROOT_DIR, 'public', 'index.html');
const APP_PATH = path.join(ROOT_DIR, 'public', 'js', 'app.js');

const rawMsg = process.argv[2] || '';

// 1. Read package.json
const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
const currentVersion = pkg.version || '2.3.0';

// Bump patch version (e.g. 2.3.0 -> 2.3.1)
const parts = currentVersion.split('.').map(Number);
if (parts.length === 3) {
  parts[2] += 1;
} else {
  parts[parts.length - 1] += 1;
}
const newVersion = parts.join('.');

const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const build = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;

// 2. Update package.json & package-lock.json
pkg.version = newVersion;
fs.writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

const PKG_LOCK_PATH = path.join(ROOT_DIR, 'package-lock.json');
if (fs.existsSync(PKG_LOCK_PATH)) {
  try {
    const lock = JSON.parse(fs.readFileSync(PKG_LOCK_PATH, 'utf8'));
    lock.version = newVersion;
    if (lock.packages && lock.packages['']) {
      lock.packages[''].version = newVersion;
    }
    fs.writeFileSync(PKG_LOCK_PATH, JSON.stringify(lock, null, 2) + '\n', 'utf8');
  } catch (e) {}
}

// 3. Update public/version.json
const changelogText = rawMsg.trim() 
  ? `កំណែ v${newVersion}: ${rawMsg.trim()}`
  : `កំណែ v${newVersion}: ធ្វើបច្ចុប្បន្នភាពប្រព័ន្ធ AI, UI និងបង្កើនល្បឿន`;

const versionData = {
  version: newVersion,
  build: build,
  updatedAt: now.toISOString(),
  title: `Khmer AI Book Reader v${newVersion}`,
  changelog: changelogText
};
fs.writeFileSync(VERSION_PATH, JSON.stringify(versionData, null, 2) + '\n', 'utf8');

// 4. Update public/sw.js
if (fs.existsSync(SW_PATH)) {
  let swContent = fs.readFileSync(SW_PATH, 'utf8');
  swContent = swContent.replace(/const CACHE_NAME = 'khmer-ai-reader-v[^']+';/, `const CACHE_NAME = 'khmer-ai-reader-v${newVersion}';`);
  swContent = swContent.replace(/\/\/ Version: v[^\n]+/, `// Version: v${newVersion}`);
  fs.writeFileSync(SW_PATH, swContent, 'utf8');
}

// 5. Update public/index.html
if (fs.existsSync(HTML_PATH)) {
  let htmlContent = fs.readFileSync(HTML_PATH, 'utf8');
  htmlContent = htmlContent.replace(/styles\.css\?v=[a-zA-Z0-9.-]+/g, `styles.css?v=${newVersion}`);
  htmlContent = htmlContent.replace(/(js\/[a-zA-Z0-9_-]+\.js)\?v=[a-zA-Z0-9.-]+/g, `$1?v=${newVersion}`);
  htmlContent = htmlContent.replace(/id="header-version-badge">v[^<]+</g, `id="header-version-badge">v${newVersion}<`);
  htmlContent = htmlContent.replace(/id="settings-current-version">v[^<]+</g, `id="settings-current-version">v${newVersion}<`);
  fs.writeFileSync(HTML_PATH, htmlContent, 'utf8');
}

// 6. Update public/js/app.js
if (fs.existsSync(APP_PATH)) {
  let appContent = fs.readFileSync(APP_PATH, 'utf8');
  appContent = appContent.replace(/const CURRENT_APP_VERSION = '[^']+';/, `const CURRENT_APP_VERSION = '${newVersion}';`);
  fs.writeFileSync(APP_PATH, appContent, 'utf8');
}

console.log(`BUMPED:${newVersion}:${build}`);
