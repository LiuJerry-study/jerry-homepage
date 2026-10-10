#!/usr/bin/env node
/* ==========================================================================
   本地预览服务器（零依赖）
   --------------------------------------------------------------------------
   用法：node scripts/serve.mjs [端口]     默认 8000

   为什么不直接用 python -m http.server：
     - 它不会把 /blog/ 映射到 blog/index.html，也不认 404.html，
       和线上 nginx 的行为不一样，容易"本地好好的、上线就 404"。
     - 这里按线上规则来：目录 → index.html、找不到 → 404.html（状态码 404）。
   ========================================================================== */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2]) || 8000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
};

async function exists(p) {
  try { return await stat(p); } catch { return null; }
}

const server = createServer(async (req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0].split('#')[0]);
  let filePath = join(ROOT, urlPath.replace(/^\/+/, ''));

  // 防目录穿越
  if (!resolve(filePath).startsWith(ROOT + sep) && resolve(filePath) !== ROOT) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  let info = await exists(filePath);
  if (info && info.isDirectory()) {
    filePath = join(filePath, 'index.html');
    info = await exists(filePath);
  }

  let status = 200;
  if (!info) {
    status = 404;
    filePath = join(ROOT, '404.html');
    info = await exists(filePath);
    if (!info) { res.writeHead(404).end('404'); return; }
  }

  const body = await readFile(filePath);
  res.writeHead(status, {
    'Content-Type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
    'Content-Length': body.length,
  });
  res.end(body);
});

server.listen(PORT, () => {
  console.log(`\n  本地预览（行为对齐线上 nginx）\n`);
  console.log(`    http://127.0.0.1:${PORT}/            门户首页`);
  console.log(`    http://127.0.0.1:${PORT}/blog/       博客`);
  console.log(`    http://127.0.0.1:${PORT}/projects/   作品集`);
  console.log(`    http://127.0.0.1:${PORT}/resume.html 简历\n`);
  console.log('  Ctrl+C 停止\n');
});
