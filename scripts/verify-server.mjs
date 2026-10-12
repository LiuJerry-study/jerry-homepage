#!/usr/bin/env node
/* ==========================================================================
   个人门户 · "服务器渲染 == 构建产物" 校验
   --------------------------------------------------------------------------
   改成动态之后最容易出的问题：服务器那一路渲染和 `node scripts/build.mjs` 的产物
   悄悄走偏（比如某个分支只在一侧生效、某次改完忘了同步）。这个脚本把两边
   **逐字节**比一遍，比不出来就退出码非零。

   用法：
     node scripts/build.mjs > /dev/null     ① 先保证磁盘上的产物是最新的
     node site/server.mjs &                 ② 起服务器
     node scripts/verify-server.mjs         ③ 逐页比对

   它比的是"内存渲染 vs 磁盘产物"，所以一条命令同时守着两件事：
   服务器渲染是对的，而且构建产物和它是同一份东西。
   ========================================================================== */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARGS = process.argv.slice(2);
const i = ARGS.indexOf('--port');
const PORT = i >= 0 && ARGS[i + 1] ? Number(ARGS[i + 1]) : 8080;
const BASE = `http://127.0.0.1:${PORT}`;

const C = { reset: '\x1b[0m', dim: '\x1b[2m', green: '\x1b[32m', red: '\x1b[31m', bold: '\x1b[1m' };

/** 构建产物里"由渲染器产出"的那部分（样式/脚本/图片不在此列，它们是 nginx 直发） */
function expectedFiles() {
  const out = ['index.html', '404.html', 'resume.html', 'sitemap.xml', 'rss.xml', 'robots.txt',
    'assets/site-data.js', 'assets/site-index.js'];
  for (const dir of ['blog', 'projects', 'tags']) {
    const abs = join(ROOT, dir);
    let names = [];
    try { names = readdirSync(abs); } catch (e) { continue; }
    for (const n of names) {
      if (n.endsWith('.html') && statSync(join(abs, n)).isFile()) out.push(`${dir}/${n}`);
    }
  }
  return out;
}

/** 产物路径 → 请求路径。index.html 映射到它所在目录，这样才走真实路由。 */
const urlOf = (rel) => {
  const p = rel.split(sep).join('/');
  if (p === 'index.html') return '/';
  if (p.endsWith('/index.html')) return '/' + p.slice(0, -'index.html'.length);
  return '/' + p;
};

const fail = [];
const problems = [];

function check(ok, msg) {
  if (ok) console.log(`  ${C.green}✓${C.reset} ${msg}`);
  else { fail.push(msg); console.log(`  ${C.red}✗${C.reset} ${msg}`); }
}

console.log(`${C.bold}服务器 vs 构建产物${C.reset} ${C.dim}${BASE}${C.reset}`);

/* ① 逐页比对 */
const files = expectedFiles();
let bytes = 0;
for (const rel of files) {
  const url = urlOf(rel);
  const want = readFileSync(join(ROOT, rel));
  let got;
  try {
    const res = await fetch(BASE + url);
    if (!res.ok) { check(false, `${url} → HTTP ${res.status}（期望 200）`); continue; }
    got = Buffer.from(await res.arrayBuffer());
  } catch (e) {
    check(false, `${url} → 连不上：${e.message}`);
    continue;
  }
  bytes += got.length;
  const same = got.length === want.length && got.equals(want);
  check(same, `${url}${same ? '' : `  ← 不一致（磁盘 ${want.length} 字节 / 服务器 ${got.length} 字节）`}`);
}

/* ② 目录少了斜杠要 301（页面里的相对链接靠它） */
try {
  const res = await fetch(BASE + '/blog', { redirect: 'manual' });
  check(res.status === 301 && (res.headers.get('location') || '').endsWith('/blog/'),
    `/blog → 301 /blog/   （实际 ${res.status} ${res.headers.get('location') || ''}）`);
} catch (e) { check(false, '/blog 301 检查失败：' + e.message); }

/* ③ 不存在的地址要走 404.html，并且是 404 状态码 */
try {
  const res = await fetch(BASE + '/this-page-does-not-exist');
  const body = await res.text();
  const disk = readFileSync(join(ROOT, '404.html'), 'utf8');
  check(res.status === 404 && body === disk, `不存在的地址 → 404 + 404.html（实际 ${res.status}）`);
} catch (e) { check(false, '404 检查失败：' + e.message); }

/* ④ 静态文件也要能发（直连 / 本地预览时的兜底；线上由 nginx 先接走） */
try {
  const res = await fetch(BASE + '/assets/styles.css');
  const got = Buffer.from(await res.arrayBuffer());
  const want = readFileSync(join(ROOT, 'assets/styles.css'));
  check(res.ok && got.equals(want), 'assets/styles.css 能直发且内容一致');
} catch (e) { check(false, '静态文件检查失败：' + e.message); }

/* ⑤ 公开口不许出现管理接口（本地口才该有） */
try {
  const res = await fetch(BASE + '/__reload', { method: 'POST' });
  check(res.status === 404, `公开口 /__reload 必须是 404（实际 ${res.status}）`);
} catch (e) { check(false, '公开口 /__reload 检查失败：' + e.message); }

/* ⑥ 本地口：状态可读、reload 可用 */
try {
  const s = await (await fetch(`http://127.0.0.1:${PORT + 1}/__status`)).json();
  check(s.ok === true && s.pages === files.length, `本地口 /__status：${s.pages} 页 · v${s.version} · ${s.buildMs}ms`);

  const r = await (await fetch(`http://127.0.0.1:${PORT + 1}/__reload`, { method: 'POST' })).json();
  check(r.ok === true && r.pages === files.length, `本地口 /__reload：重渲染后仍是 ${r.pages} 页`);
} catch (e) { check(false, '本地口检查失败：' + e.message); }

console.log(fail.length
  ? `\n${C.red}有 ${fail.length} 项没过${C.reset}`
  : `\n${C.green}全部通过${C.reset}  ${C.dim}${files.length} 个页面 · 共 ${(bytes / 1024).toFixed(0)} KB · 逐字节一致${C.reset}`);
process.exit(fail.length ? 1 : 0);
