/* ==========================================================================
   写作后台 · 内容库
   --------------------------------------------------------------------------
   直接操作仓库里的 content/ 目录：
     content/posts/*.md      博客文章（front-matter + 正文）
     content/projects/*.md   作品
     content/resume.json     简历
   不引入数据库 —— 内容就是文件，跟构建脚本看到的是同一份，没有"同步"这回事。

   所有写入都是原子的（先写 .tmp 再 rename），编辑器崩了也不会留下半截文件。
   ========================================================================== */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, renameSync, unlinkSync, statSync } from 'node:fs';
import { join, dirname, resolve, extname, sep, normalize } from 'node:path';
import { imageSizeOfFile } from '../../scripts/lib/images.mjs';
import { fileURLToPath } from 'node:url';
import { frontMatter } from '../../scripts/lib/markdown.mjs';
import { ITEM_BY_KEY, loadSettings, normalizeValue, seedFromSite } from '../../scripts/lib/features.mjs';
import { loadSiteObject } from '../../scripts/lib/site-config.mjs';

/* 仓库根。下面老的那些相对路径靠"进程的工作目录正好是仓库根"，
   新加的这几个文件**不赌这个** —— 定时器 / systemd / 别的启动方式都可能换工作目录，
   找不到文件时报的错会非常难查。 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export const KINDS = {
  posts: { dir: 'content/posts', label: '文章', type: 'post' },
  projects: { dir: 'content/projects', label: '作品', type: 'project' },
};

/* ------------------------------------------------------------ 图片库 */

const IMAGES_DIR = join(ROOT, 'content/images');
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;   // 8MB，够正文插图

/** 图片文件名白名单：去掉路径与怪字符，保留中文/字母/数字/点/横线/下划线 */
export function safeImageName(raw) {
  const s = String(raw == null ? '' : raw).trim().replace(/\\/g, '/').split('/').pop() || '';
  if (!s || s.length > 120) return null;
  if (/[\\/:*?"<>|\u0000-\u001f]/.test(s)) return null;
  if (s === '.' || s === '..' || s.startsWith('.')) return null;
  return s;
}

/** 列出 content/images 下所有图片（递归，支持子目录） */
export function listImages() {
  if (!existsSync(IMAGES_DIR)) return [];
  const out = [];
  const walk = (dir, rel) => {
    for (const name of readdirSync(dir)) {
      const abs = join(dir, name);
      let st;
      try { st = statSync(abs); } catch (e) { continue; }
      const relPath = rel ? rel + '/' + name : name;
      if (st.isDirectory()) walk(abs, relPath);
      else if (IMAGE_EXTS.has(extname(name).toLowerCase())) {
        out.push({
          name: relPath,
          url: '/assets/images/' + relPath.split('/').map(encodeURIComponent).join('/'),
          bytes: st.size,
          mtime: st.mtime.toISOString(),
          dim: imageSizeOfFile(abs) || null,
        });
      }
    }
  };
  walk(IMAGES_DIR, '');
  return out.sort((a, b) => String(b.mtime).localeCompare(String(a.mtime)) || a.name.localeCompare(b.name, 'zh'));
}

/** 保存一张图片；重名自动加 -1 -2 */
export function saveImage(rawName, buf) {
  const name = safeImageName(rawName);
  if (!name) throw new Error('文件名不合法（不能含路径或特殊字符）');
  const ext = extname(name).toLowerCase();
  if (!IMAGE_EXTS.has(ext)) throw new Error(`不支持的图片格式：${ext}（支持 png/jpg/jpeg/gif/webp/svg）`);
  if (!buf || buf.length === 0) throw new Error('空文件');
  if (buf.length > MAX_IMAGE_BYTES) throw new Error('图片超过 8MB 上限');

  let final = name;
  let i = 1;
  while (existsSync(join(IMAGES_DIR, final))) {
    final = name.replace(/\.\w+$/, '') + '-' + i + ext;
    i += 1;
    if (i > 50) throw new Error('重名太多了，换个名字试试');
  }
  mkdirSync(IMAGES_DIR, { recursive: true });
  const abs = join(IMAGES_DIR, final);
  const tmp = abs + '.tmp-' + process.pid;
  writeFileSync(tmp, buf);
  renameSync(tmp, abs);
  return {
    name: final,
    url: '/assets/images/' + encodeURIComponent(final),
    bytes: buf.length,
    mtime: new Date().toISOString(),
    dim: imageSizeOfFile(abs) || null,
  };
}

/** 删除一张图片；只允许删 content/images 里的文件（逐段校验防路径穿越） */
export function deleteImage(rawName) {
  const rel = String(rawName == null ? '' : rawName).trim();
  if (!rel) throw new Error('图片名不合法');
  /* 逐段校验：每段都必须是合法文件名（含中文），不允许 ..、空段、绝对路径 */
  const parts = rel.split('/');
  if (parts.some((p) => !safeImageName(p))) throw new Error('图片名不合法');
  const abs = resolve(IMAGES_DIR, rel);
  if (abs !== IMAGES_DIR && !abs.startsWith(IMAGES_DIR + sep)) throw new Error('路径越界，拒绝');
  if (!existsSync(abs) || !statSync(abs).isFile()) throw new Error('图片不存在');
  unlinkSync(abs);
  return { name: rel };
}

/* ------------------------------------------------------------ 历史快照 */

const HISTORY_ROOT = join(ROOT, '.history');
const HISTORY_KEEP = 40;   // 每个内容保留最近 40 个版本

function tsNow() {
  const d = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}-${String(d.getMilliseconds()).padStart(3, '0')}`;
}

/** 把当前文件复制一份进 .history/<kind>/<id>/ 作为快照 */
export function snapshot(kind, id, absFile) {
  if (!existsSync(absFile)) return null;
  const dir = join(HISTORY_ROOT, kind, id);
  mkdirSync(dir, { recursive: true });
  const ext = extname(absFile) || '.md';
  const dst = join(dir, tsNow() + ext);
  writeAtomic(dst, readFileSync(absFile, 'utf8'));
  /* 只留最近的 HISTORY_KEEP 份 */
  const files = readdirSync(dir).filter((f) => f.endsWith(ext)).sort();
  while (files.length > HISTORY_KEEP) {
    const old = files.shift();
    try { unlinkSync(join(dir, old)); } catch (e) { /* 忽略 */ }
  }
  return dst;
}

/** 某个内容的历史版本列表（新的在前）。id 必须过 safeSlug ——
 *  这里曾直接拿调用方传进来的字符串拼路径，`slug=../..` 能把仓库根目录
 *  的文件名都列出来（readdirSync 不设防）。 */
export function listHistory(kind, id) {
  const safeId = safeSlug(id);
  if (!safeId) return [];
  const dir = join(HISTORY_ROOT, kind, safeId);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /\.(md|json)$/.test(f))
    .map((f) => {
      const st = statSync(join(dir, f));
      return { file: f, ts: f.replace(/\.(md|json)$/, ''), bytes: st.size, mtime: st.mtime.toISOString() };
    })
    .sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
}

/** 读某个历史版本的内容 */
export function readHistory(kind, id, ts) {
  const safeId = safeSlug(id);
  if (!safeId) throw new Error('文件名不合法');
  if (!isValidTs(ts)) throw new Error('版本号不合法');
  const file = join(HISTORY_ROOT, kind, safeId, ts + '.md');
  if (!existsSync(file)) throw new Error('找不到这个版本');
  return readFileSync(file, 'utf8');
}

/** 恢复某个历史版本：先把当前版留档，再写回 */
export function restoreHistory(kind, id, ts) {
  const safeId = safeSlug(id);
  if (!safeId) throw new Error('文件名不合法');
  if (!isValidTs(ts)) throw new Error('版本号不合法');
  const file = join(HISTORY_ROOT, kind, safeId, ts + '.md');
  if (!existsSync(file)) throw new Error('找不到这个版本');
  const { dir } = kindOf(kind);
  const target = join(dir, safeId + '.md');
  if (!existsSync(target)) throw new Error(`「${safeId}」当前文件不存在，无法恢复`);
  snapshot(kind, safeId, target);
  writeAtomic(target, readFileSync(file, 'utf8'));
  return { slug: safeId };
}

/** 历史版本时间戳白名单：只允许形如 2026-10-14T10-00-00-000 的串 */
function isValidTs(ts) {
  return typeof ts === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}$/.test(ts);
}

/** 文件名白名单：挡掉路径穿越和各种奇怪字符；允许中文 */
export function safeSlug(raw) {
  const s = String(raw == null ? '' : raw).trim();
  if (!s) return null;
  if (s.length > 80) return null;
  if (/[\\/:*?"<>|\u0000-\u001f]/.test(s)) return null;   // 路径分隔符 + Windows 非法字符 + 控制字符
  if (s === '.' || s === '..' || s.startsWith('.')) return null;
  return s;
}

function kindOf(kind) {
  const k = KINDS[kind];
  if (!k) throw new Error(`未知的内容类型：${kind}`);
  return k;
}

/* ------------------------------------------------------------ front-matter */

/** 写回文件时的字段顺序（其余字段按原顺序跟在后面） */
const FIELD_ORDER = [
  'title', 'date', 'draft', 'tags', 'excerpt', 'description', 'cover',
  'tech', 'demo', 'repo', 'featured', 'order', 'toc', 'html',
];

function yamlValue(v) {
  if (Array.isArray(v)) return `[${v.map((x) => String(x)).join(', ')}]`;
  if (typeof v === 'boolean' || typeof v === 'number') return String(v);
  const s = String(v == null ? '' : v);
  // 含冒号、井号、引号、或以特殊字符开头时加引号，避免被自己的解析器读错。
  // 纯数字 / true / false 的字符串也得加引号 —— 不引的话存成 title: 2026，
  // 再读回来就变成 number，标题 "0" 还会因为 0 是 falsy 被丢成文件名。
  if (s === '' || /[:#'"]/.test(s) || /^[\s\-[{]/.test(s) || /\s$/.test(s)
    || /^(true|false)$/i.test(s) || /^-?\d+(\.\d+)?$/.test(s)) {
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return s;
}

/** 把 {data, body} 拼回一个 .md 文件 */
export function serializeMarkdown(data, body) {
  const keys = [
    ...FIELD_ORDER.filter((k) => data[k] !== undefined && data[k] !== '' && !(Array.isArray(data[k]) && !data[k].length)),
    ...Object.keys(data).filter((k) => !FIELD_ORDER.includes(k) && data[k] !== undefined && data[k] !== ''),
  ];
  const head = keys.map((k) => `${k}: ${yamlValue(data[k])}`).join('\n');
  return `---\n${head}\n---\n\n${String(body || '').replace(/^\n+/, '')}`;
}

/* ---------------------------------------------------------------- 读取 */

function readDir(kind) {
  const { dir } = kindOf(kind);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.md'));
}

/** 列表：不含正文，只给列表页要用的字段 */
export function listContent(kind) {
  return readDir(kind).map((file) => {
    const slug = file.replace(/\.md$/, '');
    const raw = readFileSync(join(kindOf(kind).dir, file), 'utf8');
    const { data } = frontMatter(raw);
    const st = statSync(join(kindOf(kind).dir, file));
    return {
      slug,
      title: data.title || slug,
      date: typeof data.date === 'string' ? data.date : (data.date ? String(data.date) : ''),
      tags: Array.isArray(data.tags) ? data.tags : (Array.isArray(data.tech) ? data.tech : []),
      draft: data.draft === true,
      mtime: st.mtime.toISOString(),
      bytes: st.size,
    };
  }).sort((a, b) => String(b.date).localeCompare(String(a.date)) || a.slug.localeCompare(b.slug));
}

/** 读单篇：返回 {slug, data, body, exists} */
export function readContent(kind, rawSlug) {
  const slug = safeSlug(rawSlug);
  if (!slug) return null;
  const { dir } = kindOf(kind);
  const file = join(dir, `${slug}.md`);
  if (!existsSync(file)) return { slug, data: {}, body: '', exists: false };
  const { data, content } = frontMatter(readFileSync(file, 'utf8'));
  return { slug, data, body: content.replace(/^\n+/, ''), exists: true };
}

/* ---------------------------------------------------------------- 写入 */

function writeAtomic(absPath, text) {
  mkdirSync(dirname(absPath), { recursive: true });
  const tmp = `${absPath}.tmp-${process.pid}`;
  writeFileSync(tmp, text);
  renameSync(tmp, absPath);          // 同目录 rename 是原子操作
}

/** 写单篇；createOnly 时若已存在则拒绝（防手滑覆盖） */
export function writeContent(kind, rawSlug, data, body, opts = {}) {
  const slug = safeSlug(rawSlug);
  if (!slug) throw new Error('文件名不合法（不能含 / \\ : * ? " < > |，也不能以点开头）');
  const { dir } = kindOf(kind);
  const file = join(dir, `${slug}.md`);
  if (opts.createOnly && existsSync(file)) throw new Error(`已经有一篇叫「${slug}」的了`);

  const clean = Object.assign({}, data);
  if (!clean.title) clean.title = slug;
  if (!clean.date) clean.date = new Date().toISOString().slice(0, 10);
  if (existsSync(file)) snapshot(kind, slug, file);   /* 覆盖前留旧版 */
  writeAtomic(file, serializeMarkdown(clean, body));
  return { slug, file };
}

export function deleteContent(kind, rawSlug) {
  const slug = safeSlug(rawSlug);
  if (!slug) throw new Error('文件名不合法');
  const file = join(kindOf(kind).dir, `${slug}.md`);
  if (!existsSync(file)) throw new Error('要删的文件不存在');
  snapshot(kind, slug, file);              /* 删除前留档 */
  const backup = `${file}.deleted-${Date.now()}`;
  renameSync(file, backup);          // 先改名再删：留一次后悔的机会
  unlinkSync(backup);
  return { slug };
}

/* ---------------------------------------------------------------- 简历 */

const RESUME_FILE = 'content/resume.json';

export function readResume() {
  if (!existsSync(RESUME_FILE)) return { intro: '', sections: [] };
  return JSON.parse(readFileSync(RESUME_FILE, 'utf8'));
}

export function writeResume(text) {
  let obj;
  try { obj = JSON.parse(text); } catch (e) { throw new Error(`JSON 格式不对：${e.message}`); }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('根节点必须是一个对象');
  if (!Array.isArray(obj.sections)) throw new Error('缺少 sections 数组');
  if (existsSync(RESUME_FILE)) snapshot('meta', 'resume', RESUME_FILE);
  writeAtomic(RESUME_FILE, JSON.stringify(obj, null, 2) + '\n');
  return obj;
}

/* -------------------------------------------------------------- 关于页 */

const ABOUT_FILE = 'content/about.json';

export function readAbout() {
  if (!existsSync(ABOUT_FILE)) return {};
  return JSON.parse(readFileSync(ABOUT_FILE, 'utf8'));
}

export function writeAbout(text) {
  let obj;
  try { obj = JSON.parse(text); } catch (e) { throw new Error(`JSON 格式不对：${e.message}`); }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('根节点必须是一个对象');
  if (existsSync(ABOUT_FILE)) snapshot('meta', 'about', ABOUT_FILE);
  writeAtomic(ABOUT_FILE, JSON.stringify(obj, null, 2) + '\n');
  return obj;
}

/* ==========================================================================
   设置（content/settings.json）
   --------------------------------------------------------------------------
   后台「设置」页写这个文件。每个键和值都要过一遍注册表（scripts/lib/features.mjs）——
   注册表是唯一真相：后台按它渲染控件，这里按它校验，构建按它决定默认值。
   ========================================================================== */

const SETTINGS_FILE = join(ROOT, 'content/settings.json');
const LEGACY_FILE = join(ROOT, 'content/features.json');
const NAV_FILE = join(ROOT, 'content/nav.json');

const SETTINGS_HEAD = {
  _说明: '这个文件是后台「设置」页写的。每一项的类型和说明见 scripts/lib/features.mjs 的 FEATURE_ITEMS。',
  _改法: '手改也行：删掉某一项 = 恢复默认值；删掉整个文件 = 全部恢复默认。保存后前台立刻生效。',
};

/** 读一份"当前生效"的设置 + 一些给界面看的元信息 */
export function readSettings() {
  /* 种子必须和构建脚本用的是同一份（seedFromSite）：后台输入框里显示的
     应该是 site.js 里的当前值，而不是注册表里的硬编码默认值 ——
     否则「站点地址」会是空的，一点保存就把真地址覆盖成空字符串。 */
  const r = loadSettings(ROOT, readFileSync, existsSync, readSiteSeed());
  return {
    settings: r.settings,
    notes: r.notes,
    hasLegacy: existsSync(LEGACY_FILE),      // 老文件还在？界面上提示一句可以并进来
    legacyKeys: r.legacyUsed || [],
    hasFile: existsSync(SETTINGS_FILE),
  };
}

/** 写设置。脏值直接报错，不悄悄吞掉 —— 用户点了保存就该知道为什么没存上。 */
export function writeSettings(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('设置必须是一个对象');
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith('_')) continue;
    const item = ITEM_BY_KEY.get(k);
    if (!item) continue;                                   // 不认识的键：丢掉，不报错（前端的锅）
    const val = normalizeValue(item, v);
    if (val === undefined) throw new Error(`「${item.label}」的值不合法：${JSON.stringify(v)}`);
    out[k] = val;
  }
  if (!Object.keys(out).length) throw new Error('没有可保存的项');
  /* 安全阀：板块全关掉，站点就只剩 404 了。这种事不该靠"用户想清楚"来避免。 */
  const pageKeys = Object.keys(out).filter((k) => k.startsWith('pages.'));
  if (pageKeys.length && pageKeys.every((k) => out[k] === false)) {
    throw new Error('至少留一个板块开着 —— 全关掉之后站点就只剩一个 404 了');
  }
  if (existsSync(SETTINGS_FILE)) snapshot('meta', 'settings', SETTINGS_FILE);
  writeAtomic(SETTINGS_FILE, JSON.stringify({ ...SETTINGS_HEAD, ...out }, null, 2) + '\n');
  return out;
}

/**
 * 把老文件 content/features.json 并进 settings.json，然后把老文件改名留档。
 * 改名而不是删除 —— 和删文章一样，留一次后悔的机会。
 */
export function importLegacy() {
  if (!existsSync(LEGACY_FILE)) throw new Error('没有 content/features.json 可以并');
  const cur = loadSettings(ROOT, readFileSync, existsSync, readSiteSeed());
  const saved = writeSettings(cur.settings);              // 当前生效的全量 = 老文件 + 新文件的结果
  const bak = `${LEGACY_FILE}.imported-${new Date().toISOString().slice(0, 10)}`;
  renameSync(LEGACY_FILE, bak);
  return { saved, movedTo: bak.replace(ROOT + '/', '') };
}

/* ==========================================================================
   卡片墙（content/nav.json）
   --------------------------------------------------------------------------
   没有 nav.json 的时候，后台会把 content/site.js 里的 nav 读出来当草稿 ——
   这样老用户第一次打开「卡片」页看到的是自己那几张卡，而不是一张白纸。
   nav.json 一旦存在，构建立刻改用它（content/site.js 里的那份就只是备份了）。
   ========================================================================== */

const CARD_FIELDS = ['title', 'desc', 'icon', 'href', 'badge', 'tags', 'details', 'hidden'];

/** 把一张卡片洗成固定字段 + 固定类型，免得手写的怪东西混进去 */
export function cleanCard(raw) {
  const it = raw && typeof raw === 'object' ? raw : {};
  return {
    title: String(it.title || '').slice(0, 120),
    desc: String(it.desc || '').slice(0, 300),
    icon: String(it.icon || 'grid').slice(0, 24),
    href: String(it.href || '').slice(0, 400),
    badge: String(it.badge || '').slice(0, 40),
    tags: (Array.isArray(it.tags) ? it.tags : []).map((s) => String(s).trim()).filter(Boolean).slice(0, 40),
    details: (Array.isArray(it.details) ? it.details : []).map((s) => String(s).trim()).filter(Boolean).slice(0, 40),
    hidden: it.hidden === true,
  };
}

/** 读卡片：返回 { items, saved }。saved=false 表示这是从 site.js 借来的草稿 */
export function readNav() {
  if (existsSync(NAV_FILE)) {
    let d;
    try { d = JSON.parse(readFileSync(NAV_FILE, 'utf8')); }
    catch (e) { throw new Error(`content/nav.json 解析失败：${e.message}`); }
    const items = Array.isArray(d) ? d : (d && Array.isArray(d.items) ? d.items : null);
    if (!items) throw new Error('content/nav.json 里应该有 items 数组');
    return { items: items.map(cleanCard), saved: true };
  }
  let site = {};
  try { site = loadSiteObject(join(ROOT, 'content/site.js')); } catch (e) { /* site.js 坏了就空着 */ }
  return { items: (Array.isArray(site.nav) ? site.nav : []).map(cleanCard), saved: false };
}

export function writeNav(items) {
  if (!Array.isArray(items)) throw new Error('items 必须是数组');
  if (items.length > 40) throw new Error('卡片最多 40 张 —— 再多就不「简约」了');
  const out = items.map(cleanCard);
  out.forEach((c, i) => {
    if (!c.title) throw new Error(`第 ${i + 1} 张卡片没有标题`);
  });
  if (existsSync(NAV_FILE)) snapshot('meta', 'nav', NAV_FILE);
  writeAtomic(NAV_FILE, JSON.stringify({
    _说明: '这个文件是后台「卡片」页写的。删掉它 = 回到 content/site.js 里那份 nav。',
    _字段: 'title 标题 / desc 一句话说明 / icon 图标 / href 链接（留空=筹备中，点开详情）/ badge 角标 / tags 搜索关键词 / details 详情条目',
    items: out,
  }, null, 2) + '\n');
  return out;
}

/**
 * 卡片角标里能用三个占位符。构建脚本会把它们换成真实数量 ——
 * 后台的预览也得换，不然输入框旁边写着「构建时替换」，预览里却原样显示 {{posts}}。
 */
export function cardPlaceholders() {
  const pub = (kind) => listContent(kind).filter((x) => !x.draft).length;
  let n = 0;
  try { n = (readResume().sections || []).reduce((a, s) => a + ((s.items && s.items.length) || 0), 0); } catch (e) { n = 0; }
  return {
    '{{posts}}': pub('posts') + ' 篇',
    '{{projects}}': pub('projects') + ' 个',
    '{{resume}}': n > 0 ? '已上线' : '筹备中',
  };
}

/** site.js 里的值，给「设置」页当输入框的初始值 */
export function readSiteSeed() {
  try { return seedFromSite(loadSiteObject(join(ROOT, 'content/site.js'))); }
  catch (e) { return {}; }
}

/* ------------------------------------------------------------ 批量操作 */

/** 批量切草稿状态：true = 标记草稿（下线），false = 发布 */
export function setDraft(kind, rawSlug, draft) {
  const found = readContent(kind, rawSlug);
  if (!found || !found.exists) throw new Error(`「${rawSlug}」不存在`);
  return writeContent(kind, found.slug, Object.assign({}, found.data, { draft: !!draft }), found.body);
}
