#!/usr/bin/env node
/* ==========================================================================
   写作后台 · 服务器（零依赖）
   --------------------------------------------------------------------------
   启动：
     ADMIN_PASSWORD=你的密码 node admin/server.mjs
     （或者 cp admin/admin.env.example .env 之类自己 source 一下）

   它是什么：一个**只给自己用**的小后台，跑在服务器上，用来写 content/ 里的内容。
   它不是什么：它不参与对外站点。公开站在另一个**只读**的进程里渲染
   （site/server.mjs）—— 这个进程挂了、停了，访客那边一点感觉都没有。

   它能做：
     · 密码登录（httpOnly 会话 cookie + 失败限流）
     · 文章 / 作品 的增删改，简历 / 关于页 JSON 编辑
     · 实时预览（服务端渲染，和构建脚本同一套渲染器）
     · 整页草稿预览 /preview/<kind>/<slug>（不用发布就能看真实排版）
     · 开关页 /admin/settings：一页控制全站有哪些板块、哪些功能
     · 保存后敲一下渲染进程，公开站约 20ms 就是新的（不用重新构建）

   环境变量：
     ADMIN_PASSWORD        必填。没有它服务不会启动。
     ADMIN_PORT            默认 8787
     ADMIN_HOST            默认 127.0.0.1（只监听本机，靠 nginx 反代对外）
     ADMIN_SECURE=1        cookie 加 Secure（用 HTTPS 时打开）
     ADMIN_SESSION_HOURS   登录有效期，默认 168（7 天）
   ========================================================================== */

import { createServer } from 'node:http';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve, dirname, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as store from './lib/store.mjs';
import { renderBody, renderDraftPage, decorate, loadSite } from './lib/render.mjs';
import { layout, loginPage, listPage, editorPage, resumePage, aboutPage, settingsPage } from './lib/ui.mjs';
import { FEATURE_GROUPS, FEATURE_ITEMS } from '../scripts/lib/features.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.ADMIN_PORT) || 8787;
const HOST = process.env.ADMIN_HOST || '127.0.0.1';
const PASSWORD = String(process.env.ADMIN_PASSWORD || '');
const SESSION_MS = (Number(process.env.ADMIN_SESSION_HOURS) || 168) * 3600 * 1000;
const SECURE_COOKIE = process.env.ADMIN_SECURE === '1' || process.env.ADMIN_SECURE === 'true';
const COOKIE = 'ps_admin';
const MAX_BODY = 4 * 1024 * 1024;          // 请求体上限：4MB，够写长文了

if (!PASSWORD) {
  console.error(`
✗ 没设置密码，后台不会启动。

  启动方式：
    ADMIN_PASSWORD=你的密码 node admin/server.mjs

  想让它只监听本机（推荐，前面挂 nginx 反代）：
    ADMIN_PASSWORD=... ADMIN_HOST=127.0.0.1 ADMIN_PORT=8787 node admin/server.mjs

  用 HTTPS 时加一个：
    ADMIN_SECURE=1
`);
  process.exit(1);
}
if (PASSWORD === 'changeme123') {
  console.warn('⚠ 密码还是示例里的 changeme123，换成你自己的再上线。\n');
}

/* --------------------------------------------------------------- 会话 */

const sessions = new Map();     // token -> 过期时间戳
const failures = new Map();     // ip -> { n, until }

function newSession() {
  const token = randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + SESSION_MS);
  return token;
}

function sessionValid(token) {
  if (!token) return false;
  const exp = sessions.get(token);
  if (!exp) return false;
  if (exp < Date.now()) { sessions.delete(token); return false; }
  return true;
}

/** 定长比较，避免用时间差猜密码 */
function passwordOk(input) {
  const a = createHash('sha256').update(String(input || '')).digest();
  const b = createHash('sha256').update(PASSWORD).digest();
  return timingSafeEqual(a, b);
}

function rateLimited(ip) {
  const f = failures.get(ip);
  return !!(f && f.until > Date.now());
}

function noteFailure(ip) {
  const f = failures.get(ip) || { n: 0, until: 0 };
  f.n += 1;
  if (f.n >= 8) { f.until = Date.now() + 10 * 60 * 1000; f.n = 0; }   // 8 次失败锁 10 分钟
  failures.set(ip, f);
}

setInterval(() => {
  const now = Date.now();
  for (const [t, exp] of sessions) if (exp < now) sessions.delete(t);
  for (const [ip, f] of failures) if (f.until && f.until < now) failures.delete(ip);
}, 10 * 60 * 1000).unref();

/* --------------------------------------------------------------- 工具 */

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

const parseCookies = (raw) => Object.fromEntries(
  String(raw || '').split(';').map((s) => s.trim().split('=')).filter((p) => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]),
);

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}

const sendHtml = (res, status, html, headers = {}) =>
  send(res, status, html, { 'Content-Type': 'text/html; charset=utf-8', ...headers });

const sendJson = (res, status, obj) =>
  send(res, status, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8' });

const redirect = (res, to, headers = {}) => send(res, 302, '', { Location: to, ...headers });

function readBody(req) {
  return new Promise((ok, no) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { no(new Error('请求体太大')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => ok(Buffer.concat(chunks).toString('utf8')));
    req.on('error', no);
  });
}

async function readJson(req) {
  const text = await readBody(req);
  try { return text ? JSON.parse(text) : {}; } catch (e) { throw new Error('请求不是合法 JSON'); }
}

/** 同源校验：跨站表单/脚本发过来的写操作一律拒绝 */
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;                       // 老浏览器或命令行（curl）不带 Origin
  try {
    return new URL(origin).host === req.headers.host;
  } catch (e) { return false; }
}

/* ------------------------------------------------------------ 构建 */

let lastBuild = null;      // { at, ok, log }

/** 跑一次增量构建，把 content/ 的变化落成静态页 */
function rebuild() {
  const started = Date.now();
  const r = spawnSync(process.execPath, ['scripts/build.mjs'], {
    cwd: ROOT, encoding: 'utf8', timeout: 120000,
  });
  const log = `${r.stdout || ''}${r.stderr || ''}`.trim();
  const ok = r.status === 0;
  lastBuild = { at: new Date().toISOString(), ok, log, ms: Date.now() - started };
  return lastBuild;
}

/* --------------------------------------------------- 通知公开站重渲染 */

/**
 * 内容写完之后敲一下公开站渲染进程，让它立刻重渲染。
 *
 * 其实它自己盯着 content/（fs.watch），改了就会重渲染；这里再敲一下图的是**确定性**——
 * 文件监听在网络盘、容器、某些内核上并不可靠，而"保存了却没生效"是最难查的那种 bug。
 * 敲不通也不算失败：内容已经落盘了，监听那次自发的重渲染会兜住，
 * 只是慢一点点（150ms 的防抖）。
 */
const SITE_RELOAD_PORT = Number(process.env.SITE_RELOAD_PORT) || 8081;

async function pokeSite() {
  try {
    const res = await fetch(`http://127.0.0.1:${SITE_RELOAD_PORT}/__reload`, {
      method: 'POST',
      signal: AbortSignal.timeout(15000),
    });
    const j = await res.json();
    return { ok: !!j.ok, pages: j.pages, ms: j.buildMs };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

/** 写完之后统一走这里：把结果塞进 lastBuild，界面上就是在"上次构建"那一行显示 */
async function publish() {
  const live = await pokeSite();
  const at = new Date().toISOString();
  lastBuild = live.ok
    ? { at, ok: true, ms: live.ms, log: `内容已即时生效：公开站重渲染 ${live.pages} 页（${live.ms}ms）` }
    : { at, ok: false, ms: 0, log: `已写进 content/，但公开站渲染进程没回应：${live.error}\n内容不会丢 —— 它重新发现文件变化时会自己补上。` };
  return lastBuild;
}

/* ------------------------------------------------------------ 静态文件 */

/* 只发"站点该公开的东西"—— 白名单，不是黑名单。
   不这么写的话，后台的静态服务会把整个仓库端出去：
   content/（内容源）、admin/admin.env（里面可能有密码）、.git/、scripts/…… 全是敏感文件。
   注意：这只管后台端口这一层；公网站点那边由 deploy.sh 只同步公开文件来保证。 */
const PUBLIC_FILES = new Set([
  "index.html", "resume.html", "404.html",
  "sitemap.xml", "rss.xml", "robots.txt", "favicon.ico",
]);
const PUBLIC_DIRS = ["assets/", "blog/", "projects/", "tags/", "proto/"];

const isPublicPath = (rel) => PUBLIC_FILES.has(rel)
  || PUBLIC_DIRS.some((d) => rel === d.slice(0, -1) || rel.startsWith(d));


function serveStatic(req, res, pathname) {
  const rel = normalize(decodeURIComponent(pathname)).split(sep).filter(Boolean).join("/") || "index.html";
  if (!isPublicPath(rel)) return send(res, 404, "404");
  const abs = resolve(ROOT, rel);
  if (abs !== ROOT && !abs.startsWith(ROOT + sep)) return send(res, 403, 'Forbidden');

  let file = abs;
  try {
    if (statSync(file).isDirectory()) file = join(file, 'index.html');
  } catch (e) {
    const nf = join(ROOT, '404.html');
    if (existsSync(nf)) return sendHtml(res, 404, readFileSync(nf, 'utf8'));
    return send(res, 404, '404');
  }
  try {
    const body = readFileSync(file);
    const type = MIME[extname(file).toLowerCase()] || 'application/octet-stream';
    const cache = extname(file) === '.html' ? 'no-cache' : 'no-cache';
    return send(res, 200, body, { 'Content-Type': type, 'Cache-Control': cache, 'Content-Length': body.length });
  } catch (e) {
    return send(res, 404, '404');
  }
}

/* ------------------------------------------------------------ 路由 */

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const p = url.pathname;
  const ip = req.socket.remoteAddress || 'unknown';

  try {
    /* ---------- 登录相关（不需要会话） ---------- */
    if (p === '/admin/login') {
      if (req.method === 'GET') return sendHtml(res, 200, loginPage({ error: rateLimited(ip) ? '失败次数太多，等 10 分钟再试' : '' }));
      if (req.method === 'POST') {
        if (!sameOrigin(req)) return send(res, 403, 'Forbidden');
        if (rateLimited(ip)) return sendHtml(res, 429, loginPage({ error: '失败次数太多，等 10 分钟再试' }));
        const form = new URLSearchParams(await readBody(req));
        if (!passwordOk(form.get('password'))) {
          noteFailure(ip);
          return sendHtml(res, 401, loginPage({ error: '密码不对' }));
        }
        const token = newSession();
        const secure = SECURE_COOKIE ? '; Secure' : '';
        return redirect(res, '/admin/posts', {
          'Set-Cookie': `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_MS / 1000)}${secure}`,
        });
      }
      return send(res, 405, 'Method Not Allowed');
    }

    if (p === '/admin/logout' && req.method === 'POST') {
      if (!sameOrigin(req)) return send(res, 403, 'Forbidden');
      const token = parseCookies(req.headers.cookie)[COOKIE];
      if (token) sessions.delete(token);
      return redirect(res, '/admin/login', { 'Set-Cookie': `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0` });
    }

    /* ---------- 从这儿开始都要登录 ---------- */
    const needsAuth = p.startsWith('/admin') || p.startsWith('/api') || p.startsWith('/preview');
    const authed = sessionValid(parseCookies(req.headers.cookie)[COOKIE]);
    if (needsAuth && !authed) {
      if (p.startsWith('/api')) return sendJson(res, 401, { ok: false, error: '未登录或会话已过期' });
      return redirect(res, `/admin/login?from=${encodeURIComponent(p)}`);
    }
    if (needsAuth && req.method === 'POST' && !sameOrigin(req)) return sendJson(res, 403, { ok: false, error: '跨站请求被拒绝' });

    /* ---------- 页面 ---------- */
    if (p === '/admin' || p === '/admin/') return redirect(res, '/admin/posts');

    if (p === '/admin/posts' || p === '/admin/projects') {
      const kind = p.endsWith('projects') ? 'projects' : 'posts';
      const items = store.listContent(kind);
      const site = loadSite(ROOT);
      return sendHtml(res, 200, listPage({
        kind,
        label: kind === 'projects' ? '作品' : '文章',
        items,
        stats: `${items.filter((i) => !i.draft).length} 篇已发布 · ${site.brand || '个人门户'}`,
      }));
    }

    if (p === '/admin/edit') {
      const kind = url.searchParams.get('kind') === 'projects' ? 'projects' : 'posts';
      const slug = url.searchParams.get('slug') || '';
      if (slug) {
        const found = store.readContent(kind, slug);
        if (!found) return sendHtml(res, 400, layout({ title: '文件名不合法', body: '<div class="wrap"><h1>文件名不合法</h1><p><a href="/admin/posts">← 回到列表</a></p></div>' }));
        return sendHtml(res, 200, editorPage({
          kind, slug: found.slug, data: found.data, body: found.body, exists: found.exists,
          lastBuild: lastBuild ? `${lastBuild.at.slice(0, 19).replace('T', ' ')}（${lastBuild.ok ? '成功' : '失败'}）` : '',
        }));
      }
      return sendHtml(res, 200, editorPage({ kind, slug: '', data: {}, body: '', exists: false, lastBuild: null }));
    }

    if (p === '/admin/resume') {
      const text = JSON.stringify(store.readResume(), null, 2);
      return sendHtml(res, 200, resumePage({
        text,
        lastBuild: lastBuild ? `${lastBuild.at.slice(0, 19).replace('T', ' ')}（${lastBuild.ok ? '成功' : '失败'}）` : '',
      }));
    }

    if (p === '/admin/about') {
      const text = JSON.stringify(store.readAbout(), null, 2);
      return sendHtml(res, 200, aboutPage({
        text,
        lastBuild: lastBuild ? `${lastBuild.at.slice(0, 19).replace('T', ' ')}（${lastBuild.ok ? '成功' : '失败'}）` : '',
      }));
    }

    /* ---------- 开关 ---------- */
    if (p === '/admin/settings') {
      return sendHtml(res, 200, settingsPage({
        groups: FEATURE_GROUPS,
        items: FEATURE_ITEMS,
        features: store.readFeatures(),
        lastBuild: lastBuild ? `${lastBuild.at.slice(0, 19).replace('T', ' ')}（${lastBuild.ok ? '成功' : '失败'}）` : '',
      }));
    }

    /* ---------- 整页草稿预览（SSR） ---------- */
    if (p.startsWith('/preview/')) {
      const [, , kindRaw, slugRaw] = p.split('/');
      const kind = kindRaw === 'projects' ? 'projects' : 'posts';
      const found = slugRaw ? store.readContent(kind, decodeURIComponent(slugRaw)) : null;
      if (!found) return sendHtml(res, 400, '<h1>链接不对</h1><p><a href="/admin/posts">回到列表</a></p>');
      if (!found.exists) return sendHtml(res, 404, '<h1>还没保存过这一篇</h1><p>先在编辑器里保存，再预览整页。</p>');
      return sendHtml(res, 200, renderDraftPage({ root: ROOT, kind, slug: found.slug, data: found.data, body: found.body }));
    }

    /* ---------- API ---------- */
    if (p === '/api/preview' && req.method === 'POST') {
      const j = await readJson(req);
      const { html, headings } = renderBody(j.body || '', { html: j.data && j.data.html === true });
      return sendJson(res, 200, { ok: true, html, headings });
    }

    if (p === '/api/save' && req.method === 'POST') {
      const j = await readJson(req);
      const kind = j.kind === 'projects' ? 'projects' : 'posts';
      const slug = String(j.slug || '').trim();
      if (!slug) return sendJson(res, 400, { ok: false, error: '先填文件名（它会变成网址）' });
      const createOnly = j.createOnly === true;
      const out = store.writeContent(kind, slug, j.data || {}, j.body || '', { createOnly });
      const build = await publish();
      return sendJson(res, 200, {
        ok: true,
        slug: out.slug,
        build,
        log: `已写入 ${out.file}（${Buffer.byteLength(j.body || '')} 字节正文）`,
      });
    }

    if (p === '/api/delete' && req.method === 'POST') {
      const j = await readJson(req);
      const kind = j.kind === 'projects' ? 'projects' : 'posts';
      store.deleteContent(kind, String(j.slug || ''));
      const build = await publish();
      return sendJson(res, 200, { ok: true, build });
    }

    if (p === '/api/resume' && req.method === 'POST') {
      const j = await readJson(req);
      store.writeResume(String(j.text || ''));
      const build = await publish();
      return sendJson(res, 200, { ok: true, build });
    }

    if (p === '/api/about' && req.method === 'POST') {
      const j = await readJson(req);
      store.writeAbout(String(j.text || ''));
      const build = await publish();
      return sendJson(res, 200, { ok: true, build });
    }

    if (p === '/api/features' && req.method === 'POST') {
      const j = await readJson(req);
      const saved = store.writeFeatures(j.features || {});
      const build = await publish();
      return sendJson(res, 200, { ok: true, features: saved, build });
    }

    if (p === '/api/rebuild' && req.method === 'POST') {
      return sendJson(res, 200, { ok: true, build: rebuild() });
    }

    if (p.startsWith('/api/') || p.startsWith('/admin/')) {
      return sendJson(res, 404, { ok: false, error: '没有这个接口' });
    }

    /* ---------- 其余都当静态站点文件发 ---------- */
    return serveStatic(req, res, p);
  } catch (e) {
    const msg = String((e && e.message) || e);
    if (p.startsWith('/api')) return sendJson(res, 400, { ok: false, error: msg });
    return sendHtml(res, 400, layout({ title: '出错了', body: `<div class="wrap"><h1>出错了</h1><p class="err">${msg}</p><p><a href="/admin/posts">← 回到列表</a></p></div>` }));
  }
});

server.listen(PORT, HOST, () => {
  const site = (() => { try { return loadSite(ROOT); } catch (e) { return {}; } })();
  console.log(`
  写作后台已启动

    后台    http://${HOST}:${PORT}/admin
    站点    http://${HOST}:${PORT}/
    预览    http://${HOST}:${PORT}/preview/posts/<文件名>

  站点：${site.brand || '个人门户'} · 内容目录 content/{posts,projects}/
  ${HOST === '0.0.0.0' ? '⚠ 监听所有网卡 —— 对外暴露时务必前面挂 nginx 并开 HTTPS' : '只监听本机；要在外网访问就用 nginx 反代 /admin 与 /api'}
  Ctrl+C 停止
`);
});
