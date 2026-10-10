/* ==========================================================================
   模板（零依赖，构建期使用）
   --------------------------------------------------------------------------
   长页面（博客 / 项目 / 简历 / 404）的外壳：顶栏 + 内容 + 页脚 + SEO 标签。
   刻意不引入任何新视觉语言 —— 顶栏、按钮、字体、配色全部复用舞台页那套 CSS 变量。

   路径：长页面可能在根目录（404.html），也可能在子目录（blog/xxx.html）。
   所以模板里一切资源都走 prefix：根目录传 ''，子目录传 '../'。
   这样 http 和 file:// 双击两种打开方式都对。
   ========================================================================== */

import { escapeHtml as h } from './markdown.mjs';

export { h };

/** 和舞台页 <meta name="theme-color"> 保持一致 */
const THEME_COLOR = { light: '#F4F9F5', dark: '#07130F' };

/**
 * 首绘前定主题，避免闪白。
 * 首页（src/pages/index.html）和所有长页面用的是**同一份**，由构建脚本注入，
 * 所以整站的优先级和结果一定是统一的。
 *
 * 优先级：?theme= ＞ localStorage（手动选过）＞ sessionStorage（本标签页掷出的随机结果）
 *         ＞ 随机（randomTheme）＞ 系统偏好
 *
 * 关于 sessionStorage：随机主题只在「从没手动选过」时掷一次，
 * 掷完把结果记进当前标签页 —— 否则从首页点进博客会突然变成另一个主题。
 * 换个标签页/新窗口才会重新掷，这符合「首次打开随机」的本意。
 *
 * ⚠ 这个 key 在 src/js/03-theme.js 和 src/js/pages.js 里也出现（手动切换时要写进去），
 *   三处必须一致。
 */
export const THEME_KEY = 'portal-theme';
export const THEME_SESSION_KEY = 'portal-theme-session';

export function themeBootScript(randomTheme = true) {
  return `<script>
  /* 主题要在首次绘制前定下来，否则会闪一下白。逻辑由构建脚本注入，和长页面完全一致。 */
  (function () {
    var t = 'light';
    try {
      var q = new URLSearchParams(location.search).get('theme');
      var saved = null, picked = null;
      try { saved = localStorage.getItem('${THEME_KEY}'); } catch (e) { /* 隐私模式 */ }
      try { picked = sessionStorage.getItem('${THEME_SESSION_KEY}'); } catch (e) { /* 隐私模式 */ }

      if (q === 'light' || q === 'dark') {
        t = q;
      } else if (saved === 'light' || saved === 'dark') {
        t = saved;
      } else if (picked === 'light' || picked === 'dark') {
        t = picked;
      } else if (${randomTheme ? 'true' : 'false'}) {
        t = Math.random() < 0.5 ? 'light' : 'dark';
        try { sessionStorage.setItem('${THEME_SESSION_KEY}', t); } catch (e) { /* 忽略 */ }
      } else if (matchMedia('(prefers-color-scheme: dark)').matches) {
        t = 'dark';
      }
    } catch (e) { /* 老浏览器：用默认浅色 */ }
    document.documentElement.dataset.theme = t;
    /* 地址栏配色跟着主题走（<meta name="theme-color"> 就在上面，这里能直接改到） */
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', t === 'dark' ? '#07130F' : '#F4F9F5');
  })();
</script>`;
}

/* --------------------------------------------------------------- 顶栏 */

function topbar(site, current, prefix) {
  const links = [
    [`${prefix}blog/index.html`, '博客', 'blog'],
    [`${prefix}projects/index.html`, '项目', 'projects'],
    [`${prefix}resume.html`, '简历', 'resume'],
  ];
  const nav = links.map(([href, label, key]) =>
    `<a class="page-nav-a${current === key ? ' is-here' : ''}" href="${h(href)}"${current === key ? ' aria-current="page"' : ''}>${h(label)}</a>`
  ).join('');

  return `<header class="topbar">
    <a class="brand" href="${prefix}index.html" title="回到首页">
      <span class="brand-dot" aria-hidden="true"></span>
      <span class="brand-txt">${h(site.brand || '个人门户')}</span>
    </a>
    <div class="top-actions">
      <nav class="page-nav" aria-label="站点导航">${nav}</nav>
      <button class="icon-btn" id="theme-toggle" type="button" aria-label="切换深浅色主题" aria-pressed="false" title="切换主题（T）">
        <svg class="ico-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2"/>
          <path d="M12 2v2.4M12 19.6V22M2 12h2.4M19.6 12H22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7"/>
        </svg>
        <svg class="ico-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M20.5 14.1A8.6 8.6 0 1 1 9.9 3.5a7 7 0 0 0 10.6 10.6z"/>
        </svg>
      </button>
    </div>
  </header>`;
}

/**
 * @param {number} [year] 页脚年份。构建时传入"最新内容的年份"，让产物与运行时间无关
 *   （否则 CI 里"产物与提交一致"这条检查跨年就会误报）。访客看到的真实年份由
 *   assets/pages.js 在运行时覆盖，这里只是禁用 JS 时的兜底。
 */
function pageFooter(site, prefix, year) {
  return `<footer class="page-foot">
    <span>© <span id="year">${year || new Date().getFullYear()}</span> · ${h(site.author || site.brand || '')}</span>
    <span class="dot" aria-hidden="true"></span>
    <a href="${prefix}index.html">返回首页</a>
    <span class="dot" aria-hidden="true"></span>
    <a href="${prefix}rss.xml">RSS</a>
  </footer>`;
}

/* ------------------------------------------------------------ 页面外壳 */

/**
 * og:image 必须是绝对地址才有效。
 * 支持三种写法：完整 https://、以 / 开头的站内绝对路径、普通相对路径（会被拼到站点根上）。
 */
function absoluteImage(src, home) {
  const s = String(src || '');
  if (/^https?:\/\//i.test(s)) return s;
  return home + s.replace(/^\/+/, '');
}

/**
 * @param {object} o
 * @param {object} o.site       站点配置（content/site.js 里那份）
 * @param {string} o.title      完整 <title>
 * @param {string} o.description
 * @param {string} o.body       正文 HTML
 * @param {string} [o.current]  blog | projects | resume | ''（高亮导航）
 * @param {string} [o.prefix]   '' 或 '../'
 * @param {string} [o.canonical] 绝对地址
 * @param {object} [o.jsonLd]   结构化数据
 * @param {string} [o.bodyClass]
 * @param {string} [o.asset]    资源版本串（?v=…）
 * @param {string} [o.ogType]
 * @param {string} [o.publishedTime]
 */
export function pageShell(o) {
  const site = o.site || {};
  const prefix = o.prefix || '';
  const asset = o.asset ? `?v=${encodeURIComponent(o.asset)}` : '';
  const home = site.url ? String(site.url).replace(/\/+$/, '') + '/' : '';
  const canonical = o.canonical ? `${home}${String(o.canonical).replace(/^\/+/, '')}` : '';
  const ogImage = o.ogImage || site.ogImage || '';

  const meta = [
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`,
    `<title>${h(o.title)}</title>`,
    `<meta name="description" content="${h(o.description || '')}">`,
    o.noindex ? `<meta name="robots" content="noindex,nofollow">` : '',
    `<meta name="theme-color" content="${THEME_COLOR.light}">`,
    `<meta name="color-scheme" content="light dark">`,
    canonical ? `<link rel="canonical" href="${h(canonical)}">` : '',
    `<meta property="og:type" content="${o.ogType || 'website'}">`,
    `<meta property="og:title" content="${h(o.title)}">`,
    `<meta property="og:description" content="${h(o.description || '')}">`,
    canonical ? `<meta property="og:url" content="${h(canonical)}">` : '',
    o.publishedTime ? `<meta property="article:published_time" content="${h(o.publishedTime)}">` : '',
    site.brand ? `<meta property="og:site_name" content="${h(site.brand)}">` : '',
    ogImage ? `<meta property="og:image" content="${h(absoluteImage(ogImage, home))}">` : '',
    `<meta name="twitter:card" content="${ogImage ? 'summary_large_image' : 'summary'}">`,
    site.favicon ? `<link rel="icon" href="${h(site.favicon)}">` : '',
    o.jsonLd ? `<script type="application/ld+json">${JSON.stringify(o.jsonLd)}</script>` : '',
  ].filter(Boolean).join('\n');

  return `<!DOCTYPE html>
<html lang="zh-CN" data-theme="light" data-layout="page">
<head>
${meta}
${themeBootScript(site.randomTheme !== false)}
<link rel="stylesheet" href="${prefix}assets/styles.css${asset}">
</head>

<body class="page${o.bodyClass ? ' ' + o.bodyClass : ''}">
  <a class="skip" href="#main">跳到正文</a>
  ${topbar(site, o.current, prefix)}
  <main class="page-main${o.narrow ? ' page-main--narrow' : ''}" id="main">
${o.body}
  </main>
  ${pageFooter(site, prefix, o.year)}
  <script src="${prefix}assets/pages.js${asset}"></script>
</body>
</html>
`;
}

/** 列表页 / 详情页共用的页头 */
export function pageHead(o) {
  return `<header class="page-head">
    <p class="eyebrow"><span class="mono">${h(o.eyebrow || '')}</span><span class="sep" aria-hidden="true"></span><span>${h(o.label || '')}</span></p>
    <h1 class="page-title">${h(o.title)}</h1>
    ${o.lede ? `<p class="page-lede">${h(o.lede)}</p>` : ''}
  </header>`;
}

/** 标签胶囊 */
export function tags(list = []) {
  if (!list || !list.length) return '';
  return `<ul class="tag-list">${list.map((t) => `<li>${h(t)}</li>`).join('')}</ul>`;
}

/** 2026-08-01 → 2026 年 8 月 1 日 */
export function prettyDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return String(iso || '');
  return `${m[1]} 年 ${Number(m[2])} 月 ${Number(m[3])} 日`;
}

/** 取 ISO 日期部分（<time datetime> 用） */
export function isoDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}
