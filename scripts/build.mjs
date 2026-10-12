#!/usr/bin/env node
/* ==========================================================================
   个人门户 · 构建脚本（零依赖，只用 Node 内置模块）
   --------------------------------------------------------------------------
   用法：
     node scripts/build.mjs            完整构建
     node scripts/build.mjs --assets   只拼样式/脚本/配置（改视觉时最快）
     node scripts/build.mjs --drafts   连草稿一起生成（本地预览用；不进 RSS/sitemap/搜索）

   产物（全部提交进仓库，所以不跑构建也能直接双击 index.html 看）：
     index.html                  ← src/pages/index.html + 资源版本串
     assets/styles.css | main.js | pages.js | site-data.js | site-index.js
     assets/images/**            ← content/images/** 原样拷贝
     blog/index.html  blog/page2.html …  blog/<slug>.html
     projects/index.html  projects/<slug>.html
     tags/index.html  tags/<tag>.html
     resume.html  404.html
     sitemap.xml  rss.xml  robots.txt

   为什么是"拼接"而不是打包器：
     站点要能在 file:// 下双击打开，所以不能用 ES module、不能有外部依赖。
     源文件拆开只为好读好改；产物仍是几个普通文件，构建过程零依赖、零配置。
   ========================================================================== */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

import { renderMarkdown, extractExcerpt, frontMatter, slugify, escapeHtml as h } from './lib/markdown.mjs';
import { pageShell, pageHead, tags as tagList, prettyDate, isoDate, themeBootScript } from './lib/templates.mjs';
import { imageSizeOfFile } from './lib/images.mjs';
import { loadSiteObject } from './lib/site-config.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* 这三个是**变量**不是常量：本模块有两个使用者 ——
     ① 直接跑：node scripts/build.mjs（参数在 main() 里解析）
     ② 被导入：site/server.mjs 用 renderSite() 在内存里渲染整站
   服务器不能吃命令行的 argv，所以参数只在 main() 里读。 */
let ASSETS_ONLY = false;   // 只重拼样式 / 脚本
let WITH_DRAFTS = false;   // 连草稿一起生成
let FORCE = false;         // 忽略增量缓存，全部重算重写
let QUIET = false;         // 服务器渲染整站时不刷屏（bad() 仍然照报）

const C = { reset: '\x1b[0m', dim: '\x1b[2m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', bold: '\x1b[1m' };
const log = (m = '') => { if (!QUIET) console.log(m); };
const ok = (m) => { if (!QUIET) console.log(`  ${C.green}✓${C.reset} ${m}`); };
const warn = (m) => { if (!QUIET) console.log(`  ${C.yellow}!${C.reset} ${m}`); };
const bad = (m) => { console.error(`  ${C.red}✗${C.reset} ${m}`); process.exitCode = 1; };
const head = (n, m) => log(`\n${C.bold}[${n}] ${m}${C.reset}`);

/* ---------------------------------------------------------------- 工具 */

const abs = (p) => join(ROOT, p);
const read = (p) => readFileSync(abs(p), 'utf8');
const exists = (p) => existsSync(abs(p));

function write(p, text) {
  mkdirSync(dirname(abs(p)), { recursive: true });
  writeFileSync(abs(p), text);
  return Buffer.byteLength(text);
}

const STATS = { written: 0, skipped: 0 };

/**
 * 内容一样就不落盘 —— 这是"增量"的关键：
 *   · mtime 不变，rsync 就不会传它（部署时只同步真正改过的文件）
 *   · 也不会因为重写触发编辑器的"文件已变化"提示
 */
function writeIfChanged(p, text) {
  PRODUCED.add(p);
  const file = abs(p);
  if (!FORCE) {
    try {
      if (readFileSync(file, 'utf8') === text) { STATS.skipped++; return Buffer.byteLength(text); }
    } catch (e) { /* 文件不存在：照常写 */ }
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
  STATS.written++;
  return Buffer.byteLength(text);
}

/* 生成阶段的产物收集处：相对路径 → 内容。
   构建脚本随后把它们逐个落盘；服务器直接把它当"内存里的整站"（见 site/server.mjs）。
   之所以让两边共用同一个出口，是为了保证动态渲染出来的 HTML 与构建产物逐字节一致。 */
const FILES = new Map();
function emit(p, text) {
  PRODUCED.add(p);
  FILES.set(p, text);
  return Buffer.byteLength(text);
}

/** 按清单拼接；缺文件直接报错，不静默跳过 */
function concat(dir, manifest) {
  const out = [];
  for (const name of manifest) {
    const p = `${dir}/${name}`;
    if (!exists(p)) { bad(`缺少源文件 ${p}`); continue; }
    out.push(read(p));
  }
  return out.join('');
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

/** 按代码点比较（确定性排序）。
    这里**不能**用 localeCompare：它的结果取决于运行环境的 locale / ICU 版本 ——
    中文标签在本机（zh-CN）和 CI（en/C）上会排出完全不同的顺序，
    而构建产物必须逐字节可复现（CI 会拿 git diff 比对）。 */
const byCode = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/* ------------------------------------------------------------ 配置清单 */

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
  '21-pages.css',        // 长页面（博客 / 项目 / 简历 / 标签）—— 只作用于 html[data-layout="page"]
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
  '14-perf.js',
  'zz-epilogue.js',
];

/* ------------------------------------------------------------ 站点配置 */

/* 站点配置和下面所有内容都是**模块级变量**，由 loadContent() 一次装好。
   每次内容变动重装一遍，渲染函数直接引用这些名字 —— 重装后它们看到的就是新内容，
   所以一行渲染代码都不用为了"动态"改写。 */
let SITE, PER_PAGE;

/* ------------------------------------------------------- 内容读取 */

/** 站内图片：content/images/foo.png ← 正文里写 images/foo.png */
function makeImageResolver(prefix) {
  return (src) => {
    const m = /^\.?\/?images\/(.+)$/.exec(src);
    if (!m) return null;
    const rel = `assets/images/${m[1]}`;
    const size = imageSizeOfFile(abs(`content/images/${m[1]}`));
    if (!size) warn(`正文引用了不存在的图片 content/images/${m[1]}`);
    return { url: `${prefix}${rel}`, width: size ? size.width : 0, height: size ? size.height : 0 };
  };
}

/** 读一个内容目录下的 .md，解析 front-matter，渲染 HTML，按日期倒序 */
function loadMarkdownDir(dir, { prefix }) {
  if (!exists(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md') || f.endsWith('.markdown'))
    .map((file) => {
      const slug = file.replace(/\.(md|markdown)$/, '');
      const raw = read(`${dir}/${file}`);
      const { data, content } = frontMatter(raw);
      const cached = renderCached(raw, `${dir}/${file}`, null, () => {
        const headings = [];
        const html = renderMarkdown(content, {
          headings,
          html: data.html === true,
          image: makeImageResolver(prefix),
        });
        return { h: html, g: headings };
      });
      const html = cached.h;
      const headings = cached.g;
      const cover = typeof data.cover === 'string' && data.cover ? data.cover : '';
      return {
        slug,
        file: `${dir}/${file}`,
        kind: 'post',
        title: data.title || slug,
        date: isoDate(data.date) || String(data.date || ''),
        tags: Array.isArray(data.tags) ? data.tags : [],
        excerpt: data.excerpt || extractExcerpt(content, 110),
        draft: data.draft === true,
        featured: data.featured === true,
        order: typeof data.order === 'number' ? data.order : 999,
        description: data.description || '',
        tech: Array.isArray(data.tech) ? data.tech : [],
        demo: data.demo || '',
        repo: data.repo || '',
        cover,
        toc: data.toc !== false,
        content,
        html,
        headings,
      };
    })
    .sort((a, b) => byCode(String(b.date), String(a.date)) || byCode(a.slug, b.slug));
}

function loadResume() {
  if (!exists('content/resume.json')) return null;
  try {
    const data = JSON.parse(read('content/resume.json'));
    const sections = Array.isArray(data.sections) ? data.sections : [];
    return { intro: data.intro || '', sections, count: sections.reduce((n, s) => n + (s.items ? s.items.length : 0), 0) };
  } catch (e) {
    bad(`content/resume.json 解析失败：${e.message}`);
    return null;
  }
}

/* --------------------------------------------------- 增量：渲染缓存 */

const CACHE_FILE = '.build-cache/render.json';

/** 渲染器一改，缓存全部失效 —— 用 lib 下几个文件的哈希当版本号 */
const RENDERER_VERSION = createHash('sha1')
  .update(['markdown.mjs', 'highlight.mjs', 'templates.mjs', 'images.mjs'].map((f) => read(`scripts/lib/${f}`)).join('\n'))
  .digest('hex').slice(0, 12);

let renderCache = {};        // 由 main() 装载；服务器不装（每次都要重渲染）
function loadRenderCache() {
  renderCache = {};
  if (FORCE || !exists(CACHE_FILE)) return;
  try { renderCache = JSON.parse(read(CACHE_FILE)).entries || {}; } catch (e) { renderCache = {}; }
}
const cacheHits = { used: new Set(), hit: 0, miss: 0 };

function saveRenderCache() {
  const entries = {};
  for (const k of cacheHits.used) if (renderCache[k]) entries[k] = renderCache[k];
  write(CACHE_FILE, JSON.stringify({ renderer: RENDERER_VERSION, entries }));
}

/** 这一篇要不要重新渲染？key 里带渲染器版本和输出位置，改了任何一样都会失效 */
function renderCached(raw, file, opts, renderFn) {
  const key = createHash('sha1').update(RENDERER_VERSION + '\n' + file + '\n' + raw).digest('hex');
  cacheHits.used.add(key);
  const hit = renderCache[key];
  if (hit && typeof hit.h === 'string' && Array.isArray(hit.g)) { cacheHits.hit++; return hit; }
  cacheHits.miss++;
  const val = renderFn();
  renderCache[key] = val;
  return val;
}

let ALL_POSTS, ALL_PROJECTS, RESUME, POSTS, PROJECTS;
let CONTENT_DATES, LATEST_DATE, SITE_YEAR, TAG_MAP, TAGS;

/** slug -> {name, posts:[], projects:[]}；每次 loadContent() 重建 */
function collectTag(raw, item) {
  const name = String(raw || '').trim();
  if (!name) return;
  const slug = slugify(name);
  if (!TAG_MAP.has(slug)) TAG_MAP.set(slug, { slug, name, posts: [], projects: [] });
  const bucket = TAG_MAP.get(slug);
  (item.kind === 'post' ? bucket.posts : bucket.projects).push(item);
}

/** 把 content/ 下的东西全部读进上面那组变量。可以反复调用 —— 服务器每次内容变动都调一遍。 */
function loadContent() {
  SITE = loadSiteObject(abs('content/site.js'));
  PER_PAGE = Math.max(1, Number(SITE.postsPerPage) || 10);

  ALL_POSTS = loadMarkdownDir('content/posts', { prefix: '../' });
  ALL_PROJECTS = loadMarkdownDir('content/projects', { prefix: '../' })
    .map((p) => Object.assign(p, { kind: 'project' }))
    .sort((a, b) => (a.order - b.order) || byCode(String(b.date), String(a.date)) || byCode(a.slug, b.slug));
  RESUME = loadResume();

  /* 站点上真正会发布的条目（草稿在 --drafts 时才出现） */
  POSTS = ALL_POSTS.filter((p) => WITH_DRAFTS || !p.draft);
  PROJECTS = ALL_PROJECTS.filter((p) => WITH_DRAFTS || !p.draft);

/* ------------------------------------------------------------ 标签 */

/* 最新内容日期。
   sitemap 的 lastmod 与页脚年份都用它，**不用"今天"** ——
   构建产物必须只由内容决定，否则 CI 里"产物与提交一致"这条检查隔一天就会误报。 */
  CONTENT_DATES = [...POSTS, ...PROJECTS]
    .map((p) => p.date)
    .filter((d) => /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(String(d)))
    .sort();
  LATEST_DATE = CONTENT_DATES.length ? CONTENT_DATES[CONTENT_DATES.length - 1] : "1970-01-01";
  SITE_YEAR = LATEST_DATE.slice(0, 4);


  TAG_MAP = new Map();   // slug -> {name, posts:[], projects:[]}
  POSTS.forEach((p) => p.tags.forEach((t) => collectTag(t, p)));
  PROJECTS.forEach((p) => p.tech.forEach((t) => collectTag(t, p)));
  TAGS = [...TAG_MAP.values()].filter((t) => t.posts.length + t.projects.length > 0)
    .sort((a, b) => (b.posts.length + b.projects.length) - (a.posts.length + a.projects.length) || byCode(a.slug, b.slug));
}

/* --------------------------------------------------- 1. 样式 / 脚本 */

let VERSION = 'dev';

/* 本次构建实际产出的文件（相对仓库根）。
   收尾时拿它跟目录里的实际内容比：不在名单里的就是上一轮留下的旧产物，删掉。
   这样既不会出现「删了文章还留着孤儿页」「--drafts 残留草稿页」，
   也不会像"先整目录删光再重建"那样把没变的文件 mtime 全冲掉（增量就白做了）。 */
const PRODUCED = new Set();

/** 删掉不再需要的旧产物；构建中有报错就跳过，免得把站搞残 */
function pruneGenerated() {
  if (process.exitCode) { warn('构建有错误，跳过清理旧产物'); return; }
  const dirs = ['blog', 'projects', 'tags', 'assets/images'];
  let removed = 0;
  const walk = (rel) => {
    for (const name of readdirSync(abs(rel))) {
      const p = `${rel}/${name}`;
      if (statSync(abs(p)).isDirectory()) {
        walk(p);
        if (!readdirSync(abs(p)).length) { rmSync(abs(p)); }
      } else if (!PRODUCED.has(p)) {
        rmSync(abs(p));
        removed++;
      }
    }
  };
  for (const d of dirs) if (exists(d)) walk(d);
  if (removed) ok(`清掉 ${removed} 个上一轮留下的旧产物`);
  else log(`  ${C.dim}没有多余产物要清${C.reset}`);
}

/** 资源版本串：只由样式 / 脚本源码决定。构建和服务器都调它，两边必然一致 */
const hashOf = (css, js, pages) => createHash('sha1').update(css + js + pages).digest('hex').slice(0, 8);
export function computeVersion() {
  return hashOf(concat('src/styles', STYLE_MANIFEST), concat('src/js', SCRIPT_MANIFEST), read('src/js/pages.js'));
}

function buildAssets() {
  head('1/7', '样式与脚本');
  const css = concat('src/styles', STYLE_MANIFEST);
  const js = concat('src/js', SCRIPT_MANIFEST);
  const pages = read('src/js/pages.js');
  VERSION = hashOf(css, js, pages);
  ok(`assets/styles.css   ${kb(writeIfChanged('assets/styles.css', css))}`);
  ok(`assets/main.js      ${kb(writeIfChanged('assets/main.js', js))}`);
  ok(`assets/pages.js     ${kb(writeIfChanged('assets/pages.js', pages))}`);
  ok(`资源版本 v${VERSION}（页面里的 ?v= 就是它）`);
}

/* ------------------------------------------------------------ 2. 图片 */

function buildImages() {
  head('2/7', '图片');
  const srcDir = 'content/images';
  if (!exists(srcDir)) {
    log(`  ${C.dim}content/images/ 不存在，跳过（正文图片放这里，写 images/xxx.png 即可）${C.reset}`);
    return;
  }
  let n = 0, skipped = 0;
  const walk = (rel) => {
    for (const name of readdirSync(abs(rel))) {
      const from = `${rel}/${name}`;
      if (statSync(abs(from)).isDirectory()) { walk(from); continue; }
      const to = `assets/images/${from.slice(srcDir.length + 1)}`;
      PRODUCED.add(to);
      const buf = readFileSync(abs(from));
      let same = false;
      try { same = readFileSync(abs(to)).equals(buf); } catch (e) { /* 目标不存在 */ }
      if (same && !FORCE) { STATS.skipped++; skipped++; }
      else { mkdirSync(dirname(abs(to)), { recursive: true }); writeFileSync(abs(to), buf); STATS.written++; n++; }
    }
  };
  walk(srcDir);
  ok(`assets/images/**    拷入 ${n} 个${skipped ? `，跳过 ${skipped} 个没变的` : ''}（来自 content/images/）`);
}

/* ------------------------------------------------------- 3. 站点配置 */

function buildSiteData() {
  head('3/7', '站点配置与搜索索引');

  let out = read('content/site.js');
  const map = {
    '{{posts}}': `${POSTS.length} 篇`,
    '{{projects}}': `${PROJECTS.length} 个`,
    '{{resume}}': RESUME && RESUME.count > 0 ? '已上线' : '筹备中',
  };
  for (const [k, v] of Object.entries(map)) out = out.split(k).join(v);

  // 资源版本串：命令面板要按需加载搜索索引，得知道该带哪个 ?v=
  out += `\n/* ↓ 由构建脚本追加：资源版本 + 搜索索引地址（不要手改这一段） */\n`
    + `window.SITE.assetVersion = ${JSON.stringify(VERSION)};\n`
    + `window.SITE.searchIndex = 'assets/site-index.js';\n`;

  emit('assets/site-data.js', out);

  if (/^https?:\/\/example\.com\/?$/.test(String(SITE.url || ''))) {
    warn(`content/site.js 里的 url 还是占位符 ${SITE.url} —— sitemap / RSS / canonical 里的地址会不对`);
  }
  const left = out.match(/\{\{\w+\}\}/g);
  if (left) warn(`还有没替换的占位符：${[...new Set(left)].join(' ')}`);
  ok(`assets/site-data.js  （${POSTS.length} 篇文章 / ${PROJECTS.length} 个项目 / ${TAGS.length} 个标签）`);

  // 搜索索引单独成文件：不拖慢首屏，命令面板第一次打开时才按需加载
  const brief = (p, url) => ({
    t: p.title, s: p.excerpt, u: url, d: p.date,
    k: [...(p.tags || []), ...(p.tech || [])].join(' '),
  });
  const index = {
    v: VERSION,
    posts: POSTS.map((p) => brief(p, `blog/${p.slug}.html`)),
    projects: PROJECTS.map((p) => brief(p, `projects/${p.slug}.html`)),
    tags: TAGS.map((t) => ({ t: t.name, u: `tags/${t.slug}.html`, n: t.posts.length + t.projects.length })),
  };
  ok(`assets/site-index.js ${kb(emit('assets/site-index.js', `window.SITE_INDEX=${JSON.stringify(index)};\n`))}（${index.posts.length + index.projects.length} 条）`);
}

/* --------------------------------------------------------- 页面片段 */

const draftFlag = (p) => (p.draft ? '<span class="draft-flag mono">草稿</span>' : '');

function postListItem(p) {
  return `<li class="post-item">
      <a class="post-link" href="${h(p.slug)}.html">
        <time class="post-date mono" datetime="${h(p.date)}">${h(p.date || '')}</time>
        <div>
          <h2 class="post-title">${h(p.title)}${draftFlag(p)}</h2>
          <p class="post-excerpt">${h(p.excerpt)}</p>
          ${p.tags.length ? `<div class="post-tags">${tagList(p.tags)}</div>` : ''}
        </div>
      </a>
    </li>`;
}

/** 页码导航；urlFor(n) 返回相对链接 */
function pagination(page, totalPages, urlFor) {
  if (totalPages <= 1) return '';
  const items = [];
  for (let n = 1; n <= totalPages; n++) {
    items.push(n === page
      ? `<span class="page-no is-here mono" aria-current="page">${n}</span>`
      : `<a class="page-no mono" href="${h(urlFor(n))}">${n}</a>`);
  }
  return `<nav class="pagination" aria-label="分页">
    ${page > 1 ? `<a class="page-prev" href="${h(urlFor(page - 1))}">← 上一页</a>` : '<span></span>'}
    <span class="page-nums">${items.join('')}</span>
    ${page < totalPages ? `<a class="page-next" href="${h(urlFor(page + 1))}">下一页 →</a>` : '<span></span>'}
  </nav>`;
}

function projectCard(p) {
  const links = [
    p.demo ? `<a href="${h(p.demo)}" rel="noopener">Demo ↗</a>` : '',
    p.repo ? `<a href="${h(p.repo)}" rel="noopener">源码 ↗</a>` : '',
    `<a href="${h(p.slug)}.html">详情 →</a>`,
  ].filter(Boolean).join('');
  return `<article class="project-card">
      ${p.featured ? '<span class="featured-flag mono">Featured</span>' : ''}
      <h2 class="post-title">${h(p.title)}${draftFlag(p)}</h2>
      <p class="post-excerpt">${h(p.description || p.excerpt)}</p>
      ${p.tech.length ? tagList(p.tech) : ''}
      <div class="project-links">${links}</div>
    </article>`;
}

const emptyHint = (what, file) =>
  `<div class="empty">还没有${what}。在 <code>${file}</code> 里放一个 .md，然后跑 <code>node scripts/build.mjs</code>。</div>`;

/** 标签胶囊 → 可点链接（指向 tags/<slug>.html） */
function linkedTags(list, prefix) {
  if (!list || !list.length) return '';
  return `<ul class="tag-list">${list.map((t) => {
    const slug = slugify(String(t).trim());
    return `<li><a href="${prefix}tags/${h(slug)}.html">${h(t)}</a></li>`;
  }).join('')}</ul>`;
}

/** 从 h2/h3 生成目录 */
function tocHtml(headings) {
  const use = (headings || []).filter((x) => x.level === 2 || x.level === 3);
  if (use.length < 3) return '';
  return `<nav class="toc" aria-label="本页目录">
    <p class="toc-title mono">On this page</p>
    <ol>${use.map((x) => `<li class="toc-l${x.level}"><a href="#${h(x.id)}">${h(x.text)}</a></li>`).join('')}</ol>
  </nav>`;
}

/** 上一篇 / 下一篇 */
function pager(prev, next) {
  if (!prev && !next) return '';
  return `<nav class="pager">
    ${prev ? `<a href="${h(prev.slug)}.html">← ${h(prev.title)}</a>` : '<span></span>'}
    ${next ? `<a class="pager-next" href="${h(next.slug)}.html">${h(next.title)} →</a>` : ''}
  </nav>`;
}

/* ------------------------------------------------------------ 4. 内容页 */

function buildPages() {
  head('4/7', '内容页');

  const shell = (o) => {
    const html = pageShell({ site: SITE, asset: VERSION, year: SITE_YEAR, ...o });
    emit(o.out, html);
    return Buffer.byteLength(html);
  };

  /* ---------- 博客列表（分页） ---------- */
  const totalPages = Math.max(1, Math.ceil(POSTS.length / PER_PAGE));
  const blogUrlFor = (n) => (n === 1 ? 'index.html' : `page${n}.html`);
  for (let page = 1; page <= totalPages; page++) {
    const slice = POSTS.slice((page - 1) * PER_PAGE, page * PER_PAGE);
    const body = `${pageHead({
      eyebrow: 'Blog', label: '博客',
      title: '博客',
      lede: '随笔 · 技术笔记 · 学习记录。按时间倒序。'
        + (totalPages > 1 ? `（第 ${page} / ${totalPages} 页）` : ''),
    })}
    ${slice.length ? `<ul class="post-list">${slice.map(postListItem).join('')}</ul>` : emptyHint('文章', 'content/posts/')}
    ${pagination(page, totalPages, blogUrlFor)}`;
    shell({
      out: page === 1 ? 'blog/index.html' : `blog/page${page}.html`,
      prefix: '../',
      current: 'blog',
      title: page === 1 ? `${SITE.brand || '个人门户'} · 博客` : `${SITE.brand || '个人门户'} · 博客（第 ${page} 页）`,
      description: `${SITE.brand || ''} 的博客：随笔、技术笔记、学习记录。`,
      canonical: page === 1 ? 'blog/' : `blog/page${page}.html`,
      noindex: page > 1,
      body,
    });
  }
  ok(`blog/index.html      ${POSTS.length} 篇${totalPages > 1 ? ` · 共 ${totalPages} 页` : ''}`);

  /* ---------- 博客详情 ---------- */
  POSTS.forEach((p, i) => {
    const body = `<article>
      ${pageHead({ eyebrow: 'Post', label: prettyDate(p.date), title: p.title })}
      ${p.cover ? `<img class="post-cover" src="${h(coverUrl(p.cover))}" alt="" decoding="async">` : ''}
      ${linkedTags(p.tags, '../')}
      ${tocHtml(p.toc ? p.headings : [])}
      <div class="prose">${p.html}</div>
      ${pager(POSTS[i + 1], POSTS[i - 1])}
    </article>`;
    shell({
      out: `blog/${p.slug}.html`,
      prefix: '../',
      current: 'blog',
      narrow: true,
      title: `${p.title} · ${SITE.brand || '博客'}`,
      description: p.excerpt,
      canonical: `blog/${p.slug}.html`,
      ogType: 'article',
      ogImage: p.cover,
      publishedTime: p.date,
      noindex: p.draft,
      body,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: p.title,
        description: p.excerpt,
        datePublished: p.date,
        keywords: p.tags.join(','),
        author: { '@type': 'Person', name: SITE.author || SITE.brand || '' },
        url: `${siteOrigin()}/blog/${p.slug}.html`,
      },
    });
  });
  if (POSTS.length) ok(`blog/<slug>.html     ${POSTS.length} 个（TOC / 封面 / 脚注 / JSON-LD / 上下篇）`);

  /* ---------- 项目列表 ---------- */
  const projBody = `${pageHead({ eyebrow: 'Work', label: '作品集', title: '作品集', lede: '做过的东西，都放在这里。点开有更长的说明。' })}
    ${PROJECTS.length ? `<div class="project-grid">${PROJECTS.map(projectCard).join('')}</div>` : emptyHint('项目', 'content/projects/')}`;
  shell({
    out: 'projects/index.html',
    prefix: '../',
    current: 'projects',
    title: `${SITE.brand || '个人门户'} · 作品集`,
    description: `${SITE.brand || ''} 的作品集：做过的项目与技术栈。`,
    canonical: 'projects/',
    body: projBody,
  });
  ok(`projects/index.html ${PROJECTS.length} 个`);

  /* ---------- 项目详情 ---------- */
  PROJECTS.forEach((p) => {
    const links = [
      p.demo ? `<a href="${h(p.demo)}" rel="noopener">看 Demo ↗</a>` : '',
      p.repo ? `<a href="${h(p.repo)}" rel="noopener">看源码 ↗</a>` : '',
      '<a href="index.html">← 全部作品</a>',
    ].filter(Boolean).join('');
    const body = `<article>
      ${pageHead({ eyebrow: 'Work', label: p.date || '', title: p.title, lede: p.description })}
      ${p.cover ? `<img class="post-cover" src="${h(coverUrl(p.cover))}" alt="" decoding="async">` : ''}
      ${linkedTags(p.tech, '../')}
      ${tocHtml(p.toc ? p.headings : [])}
      <div class="prose">${p.html}</div>
      <nav class="pager"><span></span><span class="pager-next">${links}</span></nav>
    </article>`;
    shell({
      out: `projects/${p.slug}.html`,
      prefix: '../',
      current: 'projects',
      narrow: true,
      title: `${p.title} · ${SITE.brand || '作品集'}`,
      description: p.description || p.excerpt,
      canonical: `projects/${p.slug}.html`,
      ogType: 'article',
      ogImage: p.cover,
      noindex: p.draft,
      body,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'CreativeWork',
        name: p.title,
        description: p.description || p.excerpt,
        dateCreated: p.date,
        keywords: p.tech.join(','),
        author: { '@type': 'Person', name: SITE.author || SITE.brand || '' },
        url: `${siteOrigin()}/projects/${p.slug}.html`,
      },
    });
  });
  if (PROJECTS.length) ok(`projects/<slug>.html  ${PROJECTS.length} 个`);

  /* ---------- 标签页 ---------- */
  if (TAGS.length) {
    const cloud = `${pageHead({ eyebrow: 'Tags', label: '标签', title: '标签', lede: '按主题翻，比按时间翻更容易找到同一条线的东西。' })}
      <ul class="tag-cloud">${TAGS.map((t) =>
        `<li><a href="${h(t.slug)}.html">${h(t.name)}<span class="tag-n mono">${t.posts.length + t.projects.length}</span></a></li>`).join('')}</ul>`;
    shell({
      out: 'tags/index.html',
      prefix: '../',
      title: `标签 · ${SITE.brand || '个人门户'}`,
      description: '按标签浏览全部文章与作品。',
      canonical: 'tags/',
      body: cloud,
    });

    TAGS.forEach((t) => {
      const postsHtml = t.posts.length
        ? `<section class="tag-section"><h2>文章 <span class="mono">${t.posts.length}</span></h2>
             <ul class="post-list">${t.posts.map((p) => `<li class="post-item"><a class="post-link" href="../blog/${h(p.slug)}.html">
               <time class="post-date mono" datetime="${h(p.date)}">${h(p.date)}</time>
               <div><h3 class="post-title">${h(p.title)}${draftFlag(p)}</h3><p class="post-excerpt">${h(p.excerpt)}</p></div>
             </a></li>`).join('')}</ul></section>`
        : '';
      const projHtml = t.projects.length
        ? `<section class="tag-section"><h2>作品 <span class="mono">${t.projects.length}</span></h2>
             <div class="project-grid">${t.projects.map((p) => `<article class="project-card">
               <h3 class="post-title"><a href="../projects/${h(p.slug)}.html">${h(p.title)}</a></h3>
               <p class="post-excerpt">${h(p.description || p.excerpt)}</p></article>`).join('')}</div></section>`
        : '';
      shell({
        out: `tags/${t.slug}.html`,
        prefix: '../',
        title: `${t.name} · 标签 · ${SITE.brand || '个人门户'}`,
        description: `标签「${t.name}」下的文章与作品。`,
        canonical: `tags/${t.slug}.html`,
        body: `${pageHead({ eyebrow: 'Tag', label: `${t.posts.length + t.projects.length} 条`, title: t.name })}
          ${postsHtml}${projHtml}
          <nav class="pager"><span></span><span class="pager-next"><a href="index.html">← 全部标签</a></span></nav>`,
      });
    });
    ok(`tags/                ${TAGS.length} 个标签 + 索引页`);
  } else {
    warn('一个标签都没有（给文章写 tags、给项目写 tech，这里会自动长出标签页）');
  }

  /* ---------- 简历 ---------- */
  const sectionHtml = (RESUME ? RESUME.sections : []).map((s) => {
    const en = s.en ? `<span class="mono">${h(s.en)}</span>` : '';
    const title = `<h2>${en}${h(s.title || '')}</h2>`;
    const items = Array.isArray(s.items) ? s.items : [];
    if (s.type === 'skill') {
      return `<section class="resume-section">${title}
        <ul class="chip-list">${items.map((it) => `<li>${h(it.name || it)}${it.level ? `<span class="lv">${h(it.level)}</span>` : ''}</li>`).join('')}</ul>
      </section>`;
    }
    return `<section class="resume-section">${title}
      <ul class="resume-list">${items.map((it) => `<li class="resume-line">
          <span class="resume-period mono">${h(it.period || '')}</span>
          <div>
            <p class="resume-role">${h(it.role || it.school || '')}${it.company ? ` · <span class="resume-sub">${h(it.company)}</span>` : ''}</p>
            ${it.major || it.degree ? `<p class="resume-sub">${h([it.major, it.degree].filter(Boolean).join(' · '))}</p>` : ''}
            ${it.description ? `<p class="resume-desc">${h(it.description)}</p>` : ''}
          </div>
        </li>`).join('')}</ul>
    </section>`;
  }).join('');
  const resumeBody = `${pageHead({ eyebrow: 'Resume', label: '简历', title: '简历', lede: '' })}
    ${RESUME ? `<p class="resume-intro">${h(RESUME.intro)}</p>${sectionHtml}` : emptyHint('简历内容', 'content/resume.json')}`;
  shell({
    out: 'resume.html',
    prefix: '',
    current: 'resume',
    narrow: true,
    title: `简历 · ${SITE.brand || '个人门户'}`,
    description: RESUME ? RESUME.intro.slice(0, 120) : '简历',
    canonical: 'resume.html',
    body: resumeBody,
  });
  ok(`resume.html          ${RESUME ? RESUME.count : 0} 条`);

  /* ---------- 404 ---------- */
  const nf = `<div class="page-head">
      <p class="notfound-code">404</p>
      <h1 class="page-title">这一页不在</h1>
      <p class="page-lede">链接可能拼错了，或者它已经被挪走了。回首页看看，那里有全部入口。</p>
    </div>
    <p><a class="btn btn-ghost" href="index.html">← 回到首页</a></p>`;
  shell({ out: '404.html', prefix: '', title: '页面不存在 · ' + (SITE.brand || '个人门户'), description: '这一页不在。', body: nf });
  ok('404.html');
}

const siteOrigin = () => String(SITE.url || 'https://example.com').replace(/\/+$/, '');
/** 封面：front-matter 里写 images/xxx.png，产物在 assets/images/xxx.png */
const coverUrl = (cover) => `../assets/images/${String(cover).replace(/^\.?\/?images\//, '')}`;

/* ------------------------------------------------------------ 5. SEO */

function buildSeo() {
  head('5/7', 'SEO 产物');
  const home = siteOrigin();
  const latest = LATEST_DATE;          /* 不用今天，见 CONTENT_DATES 的说明 */

  const urls = [
    { loc: '', last: latest, pri: '1.0' },
    { loc: 'resume.html', last: latest, pri: '0.8' },
    { loc: 'blog/', last: POSTS[0] ? POSTS[0].date : latest, pri: '0.9' },
    { loc: 'projects/', last: PROJECTS[0] ? PROJECTS[0].date : latest, pri: '0.9' },
    ...(TAGS.length ? [{ loc: 'tags/', last: latest, pri: '0.5' }] : []),
    ...POSTS.filter((p) => !p.draft).map((p) => ({ loc: `blog/${p.slug}.html`, last: p.date, pri: '0.7' })),
    ...PROJECTS.filter((p) => !p.draft).map((p) => ({ loc: `projects/${p.slug}.html`, last: p.date, pri: '0.7' })),
    ...TAGS.map((t) => ({ loc: `tags/${t.slug}.html`, last: latest, pri: '0.4' })),
  ];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.filter((u) => u.last).map((u) => `  <url>
    <loc>${h(home + '/' + u.loc)}</loc>
    <lastmod>${h(u.last)}</lastmod>
    <priority>${u.pri}</priority>
  </url>`).join('\n')}
</urlset>
`;
  emit('sitemap.xml', sitemap);
  ok(`sitemap.xml          ${urls.length} 条`);

  const feed = POSTS.filter((p) => !p.draft);
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${h(SITE.brand || '个人门户')}</title>
    <link>${h(home + '/')}</link>
    <description>${h(SITE.description || '')}</description>
    <language>zh-CN</language>
    <atom:link href="${h(home + '/rss.xml')}" rel="self" type="application/rss+xml"/>
${feed.map((p) => `    <item>
      <title>${h(p.title)}</title>
      <link>${h(`${home}/blog/${p.slug}.html`)}</link>
      <guid isPermaLink="true">${h(`${home}/blog/${p.slug}.html`)}</guid>
      <pubDate>${new Date((p.date || '1970-01-01') + 'T00:00:00+08:00').toUTCString()}</pubDate>
      <description>${h(p.excerpt)}</description>
    </item>`).join('\n')}
  </channel>
</rss>
`;
  emit('rss.xml', rss);
  ok(`rss.xml              ${feed.length} 条`);

  emit('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${home}/sitemap.xml\n`);
  ok('robots.txt');
}

/* ------------------------------------------------------------ 6. 首页 */

function buildHome() {
  head('6/7', '首页');
  let html = read('src/pages/index.html');

  // 主题解析：注入和长页面完全同一份脚本（原来首页是手写的一份，两边容易走偏）
  if (!html.includes('<!--THEME_BOOT-->')) {
    bad('src/pages/index.html 里找不到 <!--THEME_BOOT--> 标记');
  } else {
    html = html.replace('<!--THEME_BOOT-->', themeBootScript(SITE.randomTheme !== false).trim());
  }

  // 资源版本串：改了 CSS/JS 之后，访客不会拿到旧缓存
  for (const asset of ['assets/styles.css', 'assets/site-data.js', 'assets/main.js']) {
    html = html.split(`"${asset}"`).join(`"${asset}?v=${VERSION}"`);
  }

  const home = String(SITE.url || '').replace(/\/+$/, '');
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Person', name: SITE.author || SITE.brand || '', url: home ? home + '/' : undefined },
      { '@type': 'Website', name: SITE.brand || '', url: home ? home + '/' : undefined, description: SITE.description || '' },
    ].filter((o) => o.url),
  };
  if (ld['@graph'].length) {
    html = html.replace('</head>', `<script type="application/ld+json">${JSON.stringify(ld)}</script>\n</head>`);
  }

  emit('index.html', html);
  ok('index.html          （来自 src/pages/index.html）');
}

/* ------------------------------------------------------- 整站渲染 */

/**
 * 把整站渲染进内存，返回 Map<相对路径, 内容>。**不落盘。**
 *
 * 两个使用者共用这一份渲染代码，所以服务器动态渲染出来的页面
 * 和 `node scripts/build.mjs` 的产物出自同一段代码，不会两套模板走偏：
 *   · main()：拿到 Map 后逐个 writeIfChanged（带增量与旧产物清理）
 *   · site/server.mjs：拿到 Map 后按路由直接吐出去
 */
export function renderSite({ drafts = false, quiet = false } = {}) {
  WITH_DRAFTS = !!drafts;
  QUIET = !!quiet;
  try {
    loadContent();
    VERSION = computeVersion();
    FILES.clear();
    buildSiteData();
    buildPages();
    buildSeo();
    buildHome();
    return FILES;
  } finally {
    QUIET = false;      /* 出错也要还原，否则后面的报错会被吞掉 */
  }
}

/** 只重算站点配置与搜索索引（--assets 用；页面留给下一次完整构建） */
export function renderSiteData({ drafts = false, quiet = false } = {}) {
  WITH_DRAFTS = !!drafts;
  QUIET = !!quiet;
  try {
    loadContent();
    VERSION = computeVersion();
    FILES.clear();
    buildSiteData();
    return FILES;
  } finally {
    QUIET = false;
  }
}

/* ------------------------------------------------------------ 启动 */

/** 命令行入口。参数只在这里读 —— 服务器 import 本模块时不会被它的 argv 影响 */
function main() {
  const ARGS = process.argv.slice(2);
  ASSETS_ONLY = ARGS.includes('--assets');
  WITH_DRAFTS = ARGS.includes('--drafts');
  FORCE = ARGS.includes('--force');       // 忽略增量缓存，全部重算重写

  log(`${C.bold}personal-site · build${C.reset} ${C.dim}(${ASSETS_ONLY ? '仅资源' : '完整构建'}${WITH_DRAFTS ? ' · 含草稿' : ''})${C.reset}`);
  buildAssets();
  loadRenderCache();

  if (ASSETS_ONLY) {
    for (const [p, text] of renderSiteData({ drafts: WITH_DRAFTS })) writeIfChanged(p, text);
    log(`\n${C.dim}--assets：跳过图片与页面生成${C.reset}`);
  } else {
    buildImages();
    for (const [p, text] of renderSite({ drafts: WITH_DRAFTS })) writeIfChanged(p, text);
    head('7/7', '收尾');
    pruneGenerated();
    saveRenderCache();
    ok(`渲染缓存：命中 ${cacheHits.hit} / 未命中 ${cacheHits.miss}`);
    ok(`落盘 ${STATS.written} 个文件，跳过 ${STATS.skipped} 个没变的`);
  }

  log(process.exitCode
    ? `\n${C.red}构建失败${C.reset}`
    : `\n${C.green}构建完成${C.reset}  ${C.dim}${POSTS.length} 篇文章 · ${PROJECTS.length} 个项目 · ${TAGS.length} 个标签${WITH_DRAFTS ? ' · 含草稿' : ''}${C.reset}`);
}

/* 只有直接 `node scripts/build.mjs` 才跑构建。
   import 本模块（site/server.mjs 就是这么用的）什么都不执行 —— 服务器要的是上面的 renderSite()。 */
const IS_MAIN = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (IS_MAIN) main();
