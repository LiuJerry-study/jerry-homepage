#!/usr/bin/env node
/* ==========================================================================
   个人门户 · 公开站渲染进程（零依赖，只用 Node 内置模块）
   --------------------------------------------------------------------------
   它是"公开站"那一半：**只读**，只渲染，从不写任何文件。
   另一半是后台（admin/server.mjs），负责写。两个进程分开是有意的 ——
   给陌生人服务的进程碰不到数据，权限可以卡死在文件系统那一层。

   nginx 的接法（见 deploy/nginx.conf）：
     /assets/  /proto/   → nginx 自己发（纯静态，最快）
     /                   → 反代到本进程

   渲染用的就是构建脚本那一份 renderSite()（scripts/build.mjs）——
   所以这里吐出来的 HTML 和 `node scripts/build.mjs` 的产物出自同一段代码，
   不会出现"服务器一套模板、构建另一套"。

   用法：
     node site/server.mjs                 公开口 127.0.0.1:8080（nginx 反代过来）
     node site/server.mjs --port 9000
     node site/server.mjs --drafts        连草稿一起渲染（本地预览）
     node site/server.mjs --public        监听 0.0.0.0（本机直连调试才用）

   两个口：
     8080  公开口：只发页面和静态文件，没有任何管理接口
     8081  本地口：只监听 127.0.0.1，POST /__reload 催重渲染、GET /__status 看状态
            nginx **不**代理它，所以外网够不着 —— 比在公开口上加 token 干净。

   内容变了自己会重渲染：fs.watch 盯着 content/。后台保存后也可以直接
   打一下本地口的 /__reload，两条路都走同一个 reload()。
   ========================================================================== */

import { createServer } from 'node:http';
import { readFileSync, watch } from 'node:fs';
import { join, resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

import { renderSite, computeVersion } from '../scripts/build.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARGS = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = ARGS.indexOf(name);
  return i >= 0 && ARGS[i + 1] ? ARGS[i + 1] : fallback;
};

const PORT = Number(argOf('--port', process.env.PORT || 8080));
const LOCAL_PORT = PORT + 1;                 // 只有本机能连的管理口
const HOST = ARGS.includes('--public') ? '0.0.0.0' : '127.0.0.1';
const DRAFTS = ARGS.includes('--drafts');

/* ------------------------------------------------------------ 内存整站 */

/** key（相对路径）→ { body: Buffer, etag, type } */
let site = new Map();
let version = 'dev';
let buildMs = 0;
let builtAt = 0;

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
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const typeOf = (p) => MIME[extname(p).toLowerCase()] || 'application/octet-stream';

/** 渲染一次，整站进内存。失败时**保留上一版**，站点不会因为一次渲染错误就下线。 */
function reload(reason) {
  const t0 = Date.now();
  try {
    /* 必须复制一份：renderSite() 每次返回的是**同一个** Map 对象（它开头会 clear），
       不复制的话"上一版"会被下一次渲染就地清空，回退就没了。 */
    const next = new Map(renderSite({ drafts: DRAFTS, quiet: true }));
    const entries = new Map();
    for (const [key, text] of next) {
      const body = Buffer.from(text, 'utf8');
      entries.set(key, {
        body,
        etag: '"' + createHash('sha1').update(body).digest('hex').slice(0, 16) + '"',
        type: typeOf(key),
      });
    }
    site = entries;
    version = computeVersion();
    buildMs = Date.now() - t0;
    builtAt = Date.now();
    const bytes = [...entries.values()].reduce((n, e) => n + e.body.length, 0);
    console.log(`[site] 重渲染 ${entries.size} 页 / ${(bytes / 1024).toFixed(0)} KB · ${buildMs}ms · v${version} · ${reason}`);
    return true;
  } catch (e) {
    console.error('[site] 渲染失败，继续用上一版：' + (e && e.message));
    return false;
  }
}

/* --------------------------------------------------------- 请求 → 文件 */

/**
 * 请求路径 → 安全的相对路径；越界或非法编码一律 null。
 *
 * 这里**只用字符串切**，不碰 path.normalize —— 它在 Windows 上会把 / 换成 \\
 * （这个 bug 真踩过一次：整站 404，而本地口一切正常，因为那边不解析路径）。
 * 顺带这一版也不再依赖当前平台的路径分隔符。
 */
function safeRel(pathname) {
  let p;
  try { p = decodeURIComponent(pathname); } catch (e) { return null; }
  const parts = p.replace(/\\/g, '/').split('/').filter((s) => s && s !== '.');
  if (parts.includes('..')) return null;
  return parts.join('/');
}

/**
 * 允许直接发的静态目录 —— 白名单，不是黑名单。
 * 正文图片放 content/images/，产物里叫 assets/images/；这里把两者接起来，
 * 所以新加的图不用等下一次构建。
 */
function staticFile(rel) {
  const mapped = rel.startsWith('assets/images/')
    ? 'content/images/' + rel.slice('assets/images/'.length)
    : rel;
  if (!/^(assets|proto)\//.test(mapped)) return null;
  const abs = join(ROOT, mapped);
  const rootAbs = ROOT.endsWith(sep) ? ROOT : ROOT + sep;
  if (!abs.startsWith(rootAbs)) return null;
  return abs;
}

const readStatic = (abs) => {
  try {
    return readFileSync(abs);
  } catch (e) {
    return null;
  }
};

/* ------------------------------------------------------------ 响应 */

function respond(req, res, status, type, body, extra = {}) {
  const headers = { 'Content-Type': type, ...extra };
  headers['Content-Length'] = body ? body.length : 0;
  res.writeHead(status, headers);
  if (req.method === 'HEAD' || !body) res.end();
  else res.end(body);
}

const notFound = (req, res) => {
  const e = site.get('404.html');
  if (e) respond(req, res, 404, e.type, e.body, { 'Cache-Control': 'no-cache' });
  else respond(req, res, 404, 'text/plain; charset=utf-8', Buffer.from('这一页不在\n'));
};

/** 公开口：没有 /__ 接口 */
function handlePublic(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  /* 公开口没有 /__ 接口：显式 404，不给任何"这里有个入口"的暗示。
     这一条要在方法检查**之前** —— 否则 POST /__reload 会先撞上 405，
     虽然也没漏东西，但"这个地址存在、只是方法不对"本身就是多余的暗示。
     管理口在另一个只有本机能连的端口上（见 LOCAL_PORT）。 */
  if (pathname.startsWith('/__')) return notFound(req, res);

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return respond(req, res, 405, 'text/plain; charset=utf-8', Buffer.from('只支持 GET / HEAD\n'), { Allow: 'GET, HEAD' });
  }

  const rel = safeRel(pathname);
  if (rel === null) return respond(req, res, 400, 'text/plain; charset=utf-8', Buffer.from('坏的请求路径\n'));

  /* ① 内存里的页面 */
  let key = null;
  if (rel === '') key = 'index.html';
  else if (site.has(rel)) key = rel;
  else if (site.has(rel + '/index.html')) {
    /* 目录要带斜杠：页面里的相对链接（../assets/…）按 URL 目录解析，
       少了这个 301，/blog 打开会找不到样式。 */
    if (!pathname.endsWith('/')) {
      return respond(req, res, 301, 'text/plain; charset=utf-8', Buffer.from(''), { Location: pathname + '/' + (url.search || '') });
    }
    key = rel + '/index.html';
  }

  if (key) {
    const e = site.get(key);
    if (!e) return notFound(req, res);
    if (req.headers['if-none-match'] === e.etag) {
      res.writeHead(304, { ETag: e.etag, 'Cache-Control': 'no-cache' });
      return res.end();
    }
    /* HTML 每次都要回源校验：内容说变就变，缓存的旧页面比慢一点难受得多。
       ?v= 串只挂在 assets 上，那些可以放心长缓存。 */
    return respond(req, res, 200, e.type, e.body, { ETag: e.etag, 'Cache-Control': 'no-cache' });
  }

  /* ② 磁盘上的静态文件（nginx 正常情况下先接走了，这里是直连或本地预览时的兜底） */
  const abs = staticFile(rel);
  if (abs) {
    const buf = readStatic(abs);
    if (buf) return respond(req, res, 200, typeOf(rel), buf, { 'Cache-Control': 'public, max-age=3600' });
  }

  return notFound(req, res);
}

/** 本地口：只有 __reload / __status，只监听 127.0.0.1 */
function handleLocal(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const json = (obj, status = 200) => {
    const body = Buffer.from(JSON.stringify(obj, null, 2) + '\n');
    respond(req, res, status, 'application/json; charset=utf-8', body, { 'Cache-Control': 'no-store' });
  };

  if (url.pathname === '/__status') {
    return json({
      ok: true, pages: site.size, version, drafts: DRAFTS,
      buildMs, builtAt: builtAt ? new Date(builtAt).toISOString() : null, uptime: Math.round(process.uptime()),
    });
  }
  if (url.pathname === '/__reload') {
    if (req.method !== 'POST') return json({ ok: false, error: '用 POST' }, 405);
    const ok = reload('本地口要求');
    return json({ ok, pages: site.size, version, buildMs }, ok ? 200 : 500);
  }
  return json({ ok: false, error: '本地口只有 /__status 和 /__reload' }, 404);
}

/* ------------------------------------------------------------ 启动 */

reload('启动');

createServer(handlePublic).listen(PORT, HOST, () => {
  console.log(`[site] 公开口   http://${HOST}:${PORT}${DRAFTS ? '   （含草稿）' : ''}`);
});

createServer(handleLocal).listen(LOCAL_PORT, '127.0.0.1', () => {
  console.log(`[site] 本地口   http://127.0.0.1:${LOCAL_PORT}/__status   （nginx 不代理它）`);
});

/* 内容一变就重渲染。watcher 只是"更快"，丢了也不致命 ——
   后台保存之后还会打一次 /__reload。 */
let watchTimer = 0;
try {
  watch(join(ROOT, 'content'), { recursive: true }, () => {
    clearTimeout(watchTimer);
    watchTimer = setTimeout(() => reload('content/ 有改动'), 150);
  });
} catch (e) {
  console.warn('[site] 监听 content/ 失败（改完内容用 /__reload 催）：' + (e && e.message));
}
