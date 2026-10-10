#!/usr/bin/env node
/* ==========================================================================
   个人门户 · 构建脚本（零依赖，只用 Node 内置模块）
   --------------------------------------------------------------------------
   用法：
     node scripts/build.mjs            完整构建
     node scripts/build.mjs --assets   只拼样式/脚本/配置（改视觉时最快，不生成页面）

   产物（全部提交进仓库，所以不跑构建也能直接双击 index.html 看）：
     index.html                  ← src/pages/index.html + 资源版本串
     assets/styles.css           ← src/styles/*.css   按清单拼接
     assets/main.js              ← src/js/*.js        按清单拼接
     assets/pages.js             ← src/js/pages.js    长页面脚本
     assets/site-data.js         ← content/site.js    （占位符换成真实数量）
     blog/index.html  blog/<slug>.html
     projects/index.html  projects/<slug>.html
     resume.html  404.html
     sitemap.xml  rss.xml  robots.txt

   为什么是"拼接"而不是打包器：
     站点要能在 file:// 下双击打开，所以不能用 ES module、不能有外部依赖。
     源文件拆开只为好读好改；产物仍是几个普通文件，构建过程零依赖、零配置。
   ========================================================================== */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync, rmSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

import { renderMarkdown, extractExcerpt, frontMatter, escapeHtml as h } from './lib/markdown.mjs';
import { pageShell, pageHead, tags as tagList, prettyDate, isoDate } from './lib/templates.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS_ONLY = process.argv.slice(2).includes('--assets');

const C = { reset: '\x1b[0m', dim: '\x1b[2m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', bold: '\x1b[1m' };
const log = (m = '') => console.log(m);
const ok = (m) => console.log(`  ${C.green}✓${C.reset} ${m}`);
const warn = (m) => console.log(`  ${C.yellow}!${C.reset} ${m}`);
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

/* ------------------------------------------------------------ 配置文件 */

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

/** 在 Node 里跑一遍 content/site.js，取出 window.SITE */
function loadSite() {
  const code = read('content/site.js');
  const sandbox = {};
  new Function('window', code)(sandbox);
  const site = sandbox.SITE;
  if (!site || typeof site !== 'object') throw new Error('content/site.js 没有导出 window.SITE');
  return site;
}

/** 读一个内容目录下的 .md，解析 front-matter，按日期倒序 */
function loadMarkdownDir(dir) {
  if (!exists(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md') || f.endsWith('.markdown'))
    .map((file) => {
      const slug = file.replace(/\.(md|markdown)$/, '');
      const { data, content } = frontMatter(read(`${dir}/${file}`));
      return {
        slug,
        file: `${dir}/${file}`,
        title: data.title || slug,
        date: data.date || '',
        tags: data.tags || [],
        excerpt: data.excerpt || extractExcerpt(content, 110),
        draft: data.draft === true,
        featured: data.featured === true,
        order: typeof data.order === 'number' ? data.order : 999,
        description: data.description || '',
        tech: data.tech || [],
        demo: data.demo || '',
        repo: data.repo || '',
        content,
        html: renderMarkdown(content),
      };
    })
    .filter((p) => !p.draft)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
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

const SITE = loadSite();
const POSTS = loadMarkdownDir('content/posts');
const PROJECTS = loadMarkdownDir('content/projects').sort((a, b) => (a.order - b.order) || String(b.date).localeCompare(String(a.date)));
const RESUME = loadResume();

/* --------------------------------------------------- 1. 样式 / 脚本 */

let VERSION = 'dev';

function buildAssets() {
  head('1/5', '样式与脚本');
  const css = concat('src/styles', STYLE_MANIFEST);
  const js = concat('src/js', SCRIPT_MANIFEST);
  const pages = read('src/js/pages.js');
  VERSION = createHash('sha1').update(css + js + pages).digest('hex').slice(0, 8);
  ok(`assets/styles.css   ${kb(write('assets/styles.css', css))}`);
  ok(`assets/main.js      ${kb(write('assets/main.js', js))}`);
  ok(`assets/pages.js     ${kb(write('assets/pages.js', pages))}`);
}

/* ------------------------------------------------------- 2. 站点配置 */

function buildSiteData() {
  head('2/5', '站点配置');
  let out = read('content/site.js');
  const map = {
    '{{posts}}': `${POSTS.length} 篇`,
    '{{projects}}': `${PROJECTS.length} 个`,
    '{{resume}}': RESUME && RESUME.count > 0 ? '已上线' : '筹备中',
  };
  for (const [k, v] of Object.entries(map)) out = out.split(k).join(v);
  write('assets/site-data.js', out);

  if (/^https?:\/\/example\.com\/?$/.test(String(SITE.url || ''))) {
    warn(`content/site.js 里的 url 还是占位符 ${SITE.url} —— sitemap / RSS / canonical 里的地址会不对`);
  }
  const left = out.match(/\{\{\w+\}\}/g);
  if (left) warn(`还有没替换的占位符：${[...new Set(left)].join(' ')}`);
  ok(`assets/site-data.js  （${POSTS.length} 篇文章 / ${PROJECTS.length} 个项目 / 简历 ${RESUME ? RESUME.count : 0} 条）`);
}

/* --------------------------------------------------------- 页面片段 */

function postListItem(p) {
  return `<li class="post-item">
      <a class="post-link" href="${h(p.slug)}.html">
        <time class="post-date mono" datetime="${h(isoDate(p.date))}">${h(isoDate(p.date) || p.date)}</time>
        <div>
          <h2 class="post-title">${h(p.title)}</h2>
          <p class="post-excerpt">${h(p.excerpt)}</p>
          ${p.tags.length ? `<div class="post-tags">${tagList(p.tags)}</div>` : ''}
        </div>
      </a>
    </li>`;
}

function projectCard(p) {
  const links = [
    p.demo ? `<a href="${h(p.demo)}" rel="noopener">Demo ↗</a>` : '',
    p.repo ? `<a href="${h(p.repo)}" rel="noopener">源码 ↗</a>` : '',
    `<a href="${h(p.slug)}.html">详情 →</a>`,
  ].filter(Boolean).join('');
  return `<article class="project-card">
      ${p.featured ? '<span class="featured-flag mono">Featured</span>' : ''}
      <h2 class="post-title">${h(p.title)}</h2>
      <p class="post-excerpt">${h(p.description || p.excerpt)}</p>
      ${p.tech.length ? tagList(p.tech) : ''}
      <div class="project-links">${links}</div>
    </article>`;
}

const emptyHint = (what, file) =>
  `<div class="empty">还没有${what}。在 <code>${file}</code> 里放一个 .md，然后跑 <code>node scripts/build.mjs</code>。</div>`;

function pager(list, i, dir, base) {
  const prev = list[i + 1], next = list[i - 1];
  if (!prev && !next) return '';
  return `<nav class="pager">
    ${prev ? `<a href="${h(prev.slug)}.html">← ${h(prev.title)}</a>` : '<span></span>'}
    ${next ? `<a class="pager-next" href="${h(next.slug)}.html">${h(next.title)} →</a>` : ''}
  </nav>`;
}

/* ------------------------------------------------------------ 3. 内容页 */

function buildPages() {
  head('3/5', '内容页');

  const shell = (o) => {
    const html = pageShell({ site: SITE, asset: VERSION, ...o });
    write(o.out, html);
    return Buffer.byteLength(html);
  };

  /* 博客列表 */
  const blogBody = `${pageHead({ eyebrow: 'Blog', label: '博客', title: '博客', lede: '随笔 · 技术笔记 · 学习记录。按时间倒序。' })}
    ${POSTS.length ? `<ul class="post-list">${POSTS.map(postListItem).join('')}</ul>` : emptyHint('文章', 'content/posts/')}`;
  shell({
    out: 'blog/index.html',
    prefix: '../',
    current: 'blog',
    title: `${SITE.brand || '个人门户'} · 博客`,
    description: `${SITE.brand || ''} 的博客：随笔、技术笔记、学习记录。`,
    canonical: 'blog/',
    body: blogBody,
  });
  ok(`blog/index.html      ${POSTS.length} 篇`);

  /* 博客详情 */
  POSTS.forEach((p, i) => {
    const body = `<article>
      ${pageHead({ eyebrow: 'Post', label: prettyDate(p.date), title: p.title })}
      ${p.tags.length ? tagList(p.tags) : ''}
      <div class="prose">${p.html}</div>
      ${pager(POSTS, i)}
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
      publishedTime: isoDate(p.date),
      body,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: p.title,
        description: p.excerpt,
        datePublished: isoDate(p.date),
        author: { '@type': 'Person', name: SITE.author || SITE.brand || '' },
        url: `${String(SITE.url || '').replace(/\/+$/, '')}/blog/${p.slug}.html`,
      },
    });
  });
  if (POSTS.length) ok(`blog/<slug>.html     ${POSTS.length} 个（含 JSON-LD / 上下篇）`);

  /* 项目列表 */
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

  /* 项目详情 */
  PROJECTS.forEach((p) => {
    const links = [
      p.demo ? `<a href="${h(p.demo)}" rel="noopener">看 Demo ↗</a>` : '',
      p.repo ? `<a href="${h(p.repo)}" rel="noopener">看源码 ↗</a>` : '',
      '<a href="index.html">← 全部作品</a>',
    ].filter(Boolean).join('');
    const body = `<article>
      ${pageHead({ eyebrow: 'Work', label: isoDate(p.date) || '', title: p.title, lede: p.description })}
      ${p.tech.length ? tagList(p.tech) : ''}
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
      body,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'CreativeWork',
        name: p.title,
        description: p.description || p.excerpt,
        dateCreated: isoDate(p.date),
        author: { '@type': 'Person', name: SITE.author || SITE.brand || '' },
        url: `${String(SITE.url || '').replace(/\/+$/, '')}/projects/${p.slug}.html`,
      },
    });
  });
  if (PROJECTS.length) ok(`projects/<slug>.html  ${PROJECTS.length} 个`);

  /* 简历 */
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

  /* 404 */
  const nf = `<div class="page-head">
      <p class="notfound-code">404</p>
      <h1 class="page-title">这一页不在</h1>
      <p class="page-lede">链接可能拼错了，或者它已经被挪走了。回首页看看，那里有全部入口。</p>
    </div>
    <p><a class="btn btn-ghost" href="index.html">← 回到首页</a></p>`;
  shell({
    out: '404.html',
    prefix: '',
    title: '页面不存在 · ' + (SITE.brand || '个人门户'),
    description: '这一页不在。',
    body: nf,
  });
  ok('404.html');
}

/* ------------------------------------------------------------ 4. SEO */

function buildSeo() {
  head('4/5', 'SEO 产物');
  const home = String(SITE.url || 'https://example.com').replace(/\/+$/, '');
  const today = new Date().toISOString().slice(0, 10);

  const urls = [
    { loc: '', last: today, pri: '1.0' },
    { loc: 'resume.html', last: today, pri: '0.8' },
    { loc: 'blog/', last: POSTS[0] ? isoDate(POSTS[0].date) : today, pri: '0.9' },
    { loc: 'projects/', last: PROJECTS[0] ? isoDate(PROJECTS[0].date) : today, pri: '0.9' },
    ...POSTS.map((p) => ({ loc: `blog/${p.slug}.html`, last: isoDate(p.date), pri: '0.7' })),
    ...PROJECTS.map((p) => ({ loc: `projects/${p.slug}.html`, last: isoDate(p.date), pri: '0.7' })),
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
  write('sitemap.xml', sitemap);
  ok(`sitemap.xml          ${urls.length} 条`);

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${h(SITE.brand || '个人门户')}</title>
    <link>${h(home + '/')}</link>
    <description>${h(SITE.description || '')}</description>
    <language>zh-CN</language>
    <atom:link href="${h(home + '/rss.xml')}" rel="self" type="application/rss+xml"/>
${POSTS.map((p) => `    <item>
      <title>${h(p.title)}</title>
      <link>${h(`${home}/blog/${p.slug}.html`)}</link>
      <guid isPermaLink="true">${h(`${home}/blog/${p.slug}.html`)}</guid>
      <pubDate>${new Date(isoDate(p.date) + 'T00:00:00+08:00').toUTCString()}</pubDate>
      <description>${h(p.excerpt)}</description>
    </item>`).join('\n')}
  </channel>
</rss>
`;
  write('rss.xml', rss);
  ok(`rss.xml              ${POSTS.length} 条`);

  write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${home}/sitemap.xml\n`);
  ok('robots.txt');
}

/* ------------------------------------------------------------ 5. 首页 */

function buildHome() {
  head('5/5', '首页');
  let html = read('src/pages/index.html');

  // 资源版本串：改了 CSS/JS 之后，访客不会拿到旧缓存
  for (const asset of ['assets/styles.css', 'assets/site-data.js', 'assets/main.js']) {
    html = html.split(`"${asset}"`).join(`"${asset}?v=${VERSION}"`);
  }

  // 首页的结构化数据（Person + WebSite）
  const home = String(SITE.url || '').replace(/\/+$/, '');
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Person', name: SITE.author || SITE.brand || '', url: home ? home + '/' : undefined },
      { '@type': 'WebSite', name: SITE.brand || '', url: home ? home + '/' : undefined, description: SITE.description || '' },
    ].filter((o) => o.url),
  };
  if (ld['@graph'].length) {
    html = html.replace('</head>', `<script type="application/ld+json">${JSON.stringify(ld)}</script>\n</head>`);
  }

  const left = /assets\/[a-z-]+\.(css|js)"/.test(html) ? '' : '';
  write('index.html', html);
  ok('index.html          （来自 src/pages/index.html）' + left);
}

/* ------------------------------------------------------------ 启动 */

log(`${C.bold}personal-site · build${C.reset} ${C.dim}(${ASSETS_ONLY ? '仅资源' : '完整构建'} · v${VERSION})${C.reset}`);
buildAssets();
buildSiteData();

if (!ASSETS_ONLY) {
  buildPages();
  buildSeo();
  buildHome();
} else {
  log(`\n${C.dim}--assets：跳过页面生成${C.reset}`);
}

log(process.exitCode ? `\n${C.red}构建失败${C.reset}` : `\n${C.green}构建完成${C.reset}  ${C.dim}${POSTS.length} 篇文章 · ${PROJECTS.length} 个项目${C.reset}`);
