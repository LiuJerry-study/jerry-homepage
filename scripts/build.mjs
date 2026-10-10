#!/usr/bin/env node
/* ==========================================================================
   个人门户 · 构建脚本（零依赖，只用 Node 内置模块）
   --------------------------------------------------------------------------
   用法：
     node scripts/build.mjs              完整构建
     node scripts/build.mjs --no-pages   只拼样式/脚本（改视觉时最快）

   它做什么：
     1. src/styles/*.css  →  assets/styles.css      （按 MANIFEST 顺序原样拼接）
     2. src/js/*.js       →  assets/main.js         （拼接，00 开 IIFE、zz 收尾）
     3. content/site.js   →  assets/site-data.js    （原样拷贝）
     4. content/**        →  blog/ projects/ resume.html 404.html
     5. SEO 产物          →  sitemap.xml robots.txt rss.xml

   为什么是"拼接"而不是打包器：
     站点要能在 file:// 下双击打开，所以不能用 ES module、不能有外部依赖。
     源文件拆开只为好读好改；产物仍是几个普通文件，构建过程零依赖、零配置。
   ========================================================================== */

import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const NO_PAGES = args.includes('--no-pages');

const C = {
  reset: '\x1b[0m', dim: '\x1b[2m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', bold: '\x1b[1m',
};
const log = (msg) => console.log(msg);
const ok = (msg) => console.log(`  ${C.green}✓${C.reset} ${msg}`);
const warn = (msg) => console.log(`  ${C.yellow}!${C.reset} ${msg}`);
const fail = (msg) => { console.error(`  ${C.red}✗${C.reset} ${msg}`); process.exitCode = 1; };

/* ---------------------------------------------------------------- 工具 */

const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const write = (p, text) => {
  const abs = join(ROOT, p);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, text);
  return Buffer.byteLength(text);
};

/** 按 MANIFEST 顺序拼接文件；缺文件会直接报错（不静默跳过） */
function concat(dir, manifest) {
  const parts = [];
  for (const name of manifest) {
    const p = join(dir, name);
    if (!existsSync(join(ROOT, p))) {
      fail(`缺少源文件 ${p}`);
      continue;
    }
    parts.push(read(p));
  }
  return parts.join('');
}

/* ------------------------------------------------- 1/2. 样式与脚本 */

const STYLE_MANIFEST = [
  '00-header.css',
  '01-design-tokens.css',
  '02-base.css',
  '03-background.css',
  '04-halo.css',
  '05-ripple.css',
  '06-topbar.css',
  '07-stage.css',
  '08-transitions.css',
  '09-hero.css',
  '10-buttons.css',
  '11-cards.css',
  '12-footer.css',
  '13-dots-item.css',
  '14-cmdk.css',
  '15-keys.css',
  '16-toast.css',
  '17-reveal.css',
  '18-theme-reveal.css',
  '19-responsive.css',
  '20-reduced-motion.css',
  '21-pages.css',        // 长页面（博客 / 项目 / 简历）—— 只作用于 html[data-layout="page"]
];

const SCRIPT_MANIFEST = [
  '00-prologue.js',
  '01-core.js',
  '02-toast.js',
  '03-theme.js',
  '04-fx.js',
  '05-pointer.js',
  '06-burst.js',
  '07-title.js',
  '08-cards.js',
  '09-stage.js',
  '10-palette.js',
  '11-keys.js',
  '12-clock.js',
  '13-boot.js',
  'zz-epilogue.js',
];

function buildAssets() {
  log(`\n${C.bold}[1/5] 样式与脚本${C.reset}`);
  const css = concat('src/styles', STYLE_MANIFEST);
  const js = concat('src/js', SCRIPT_MANIFEST);
  ok(`assets/styles.css  ${(write('assets/styles.css', css) / 1024).toFixed(1)} KB`);
  ok(`assets/main.js     ${(write('assets/main.js', js) / 1024).toFixed(1)} KB`);
}

function buildSiteData() {
  log(`\n${C.bold}[2/5] 站点配置${C.reset}`);
  const src = 'content/site.js';
  if (!existsSync(join(ROOT, src))) { fail(`缺少 ${src}`); return; }
  ok(`assets/site-data.js  (由 ${src} 拷贝)`);
  copyFileSync(join(ROOT, src), join(ROOT, 'assets/site-data.js'));
}

/* ------------------------------------------------------------ 启动 */

log(`${C.bold}personal-site · build${C.reset} ${C.dim}(${NO_PAGES ? '仅样式与脚本' : '完整构建'})${C.reset}`);
buildAssets();
buildSiteData();
if (!NO_PAGES) {
  log(`\n${C.bold}[3/5] 内容页${C.reset}`);
  log(`  ${C.dim}（待实现）${C.reset}`);
}
log(process.exitCode ? `\n${C.red}构建失败${C.reset}` : `\n${C.green}构建完成${C.reset}`);
