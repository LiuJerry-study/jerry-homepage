#!/usr/bin/env node
/* ==========================================================================
   上线前自检（零依赖）
   --------------------------------------------------------------------------
   用法：node scripts/check.mjs
   它检查（不修改任何文件）：
     1. 必需产物在不在
     2. 所有页面里的站内链接（href/src）能不能落到真实文件
     3. 有没有漏替换的占位符 / 没改的示例域名
     4. 每个页面都有 <title> 和 meta description
     5. 页面里引用的 CSS/JS 版本串是否一致
   退出码非 0 表示有问题，可以直接挂在部署脚本前面。
   ========================================================================== */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const C = { reset: '\x1b[0m', dim: '\x1b[2m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', bold: '\x1b[1m' };
const problems = [];
const warns = [];
let versionMismatch = false;

const REQUIRED = [
  'index.html',
  'assets/styles.css',
  'assets/main.js',
  'assets/pages.js',
  'assets/site-data.js',
  'blog/index.html',
  'projects/index.html',
  'resume.html',
  'about.html',
  '404.html',
  'sitemap.xml',
  'rss.xml',
  'robots.txt',
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    // src/ 与 content/ 是"原料"不是"产物"，它们里的相对路径本来就该是源文件视角
    if (['.git', 'node_modules', 'src', 'content', 'scripts'].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (extname(name) === '.html') out.push(p);
  }
  return out;
}

const htmlFiles = walk(ROOT);
const rel = (p) => relative(ROOT, p).split('\\').join('/');

/* 1. 必需产物 */
for (const f of REQUIRED) {
  if (!existsSync(join(ROOT, f))) problems.push(`缺少产物 ${f}`);
}

/* 2~5. 逐页检查 */
const versionSeen = new Map();

for (const file of htmlFiles) {
  const relPath = rel(file);
  const html = readFileSync(file, 'utf8');
  const dir = dirname(file);
  const isProto = relPath.startsWith('proto/');

  const title = /<title>([^<]*)<\/title>/.exec(html);
  if (!title || !title[1].trim()) problems.push(`${relPath}: 没有 <title>`);
  if (!isProto && !/<meta\s+name="description"/.test(html)) warns.push(`${relPath}: 没有 meta description`);

  // 只查生成产物里的占位符：proto/ 是手工对照页，正文里提到 {{posts}} 这类字样是正常的
  if (!isProto) {
    const leftovers = html.match(/\{\{\w+\}\}/g);
    if (leftovers) problems.push(`${relPath}: 还有没替换的占位符 ${[...new Set(leftovers)].join(' ')}`);
  }
  if (/https?:\/\/example\.com/.test(html)) warns.push(`${relPath}: canonical / OG 里还是示例域名 example.com`);

  // 链接：只查站内相对链接
  for (const m of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
    const raw = m[1];
    if (/^(https?:|mailto:|tel:|data:|javascript:)/i.test(raw)) continue;
    if (raw.startsWith('#')) continue;

    const clean = raw.split('#')[0].split('?')[0];
    if (!clean) continue;

    const target = clean.startsWith('/') ? join(ROOT, clean) : resolve(dir, clean);
    const targetRel = rel(target);

    const missingHint = `${relPath} → ${raw}`;
    if (!existsSync(target)) {
      problems.push(`死链 ${missingHint}（找不到 ${targetRel}）`);
      continue;
    }
    // 目录形式的链接（如 blog/）要求里面有 index.html
    if (statSync(target).isDirectory() && !existsSync(join(target, 'index.html'))) {
      problems.push(`目录链接没有入口 ${missingHint}`);
    }
    // 版本串一致性
    const v = /[?&]v=([\w-]+)/.exec(raw);
    if (v) {
      const prev = versionSeen.get(targetRel);
      if (prev && prev !== v[1]) {
        versionMismatch = true;
        problems.push(`版本串不一致：${targetRel} 出现 ${prev} 和 ${v[1]}`);
      }
      versionSeen.set(targetRel, v[1]);
    }
  }
}

/* 输出 */
const pages = htmlFiles.filter((f) => !rel(f).startsWith('proto/'));
console.log(`${C.bold}上线前自检${C.reset} ${C.dim}${pages.length} 个页面（另有 ${htmlFiles.length - pages.length} 个 proto 对照页）${C.reset}`);
for (const [f, v] of versionSeen) console.log(`  ${C.dim}资源版本${C.reset} ${f} → ${v}`);

if (warns.length) {
  console.log(`\n${C.yellow}提醒${C.reset}`);
  for (const w of [...new Set(warns)]) console.log(`  ! ${w}`);
}
if (problems.length) {
  console.log(`\n${C.red}${C.bold}问题${C.reset}`);
  for (const p of [...new Set(problems)]) console.log(`  ✗ ${p}`);
  console.log(`\n${C.red}自检未通过（${problems.length} 项）${C.reset}`);
  process.exit(1);
}
console.log(`\n${C.green}自检通过${C.reset}`);
