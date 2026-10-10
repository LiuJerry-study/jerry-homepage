/* ==========================================================================
   写作后台 · 服务端渲染
   --------------------------------------------------------------------------
   用的是**构建脚本那同一套**渲染器（scripts/lib/markdown.mjs、templates.mjs），
   所以后台里看到的预览，和发布后的页面是同一个东西 —— 不存在"预览挺好、发布变形"。

   两种预览：
     renderBody()      只渲染正文 HTML，给编辑器右侧的实时预览用（每次敲键盘后请求）
     renderDraftPage() 渲染一整页（含顶栏/页脚/样式），给「草稿预览」用，能直接看真实排版
   ========================================================================== */

import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { renderMarkdown, extractExcerpt, escapeHtml as h } from '../../scripts/lib/markdown.mjs';
import { pageShell, pageHead, tags as tagList, prettyDate, isoDate } from '../../scripts/lib/templates.mjs';
import { imageSizeOfFile } from '../../scripts/lib/images.mjs';
import { loadSiteObject } from '../../scripts/lib/site-config.mjs';

/**
 * 读站点配置。带 mtime 缓存：改完 content/site.js 不用重启后台。
 * @param {string} root 仓库根目录
 */
let siteCache = { mtime: 0, site: null, path: '' };
export function loadSite(root) {
  const path = join(root, 'content/site.js');
  const mtime = statSync(path).mtimeMs;
  if (siteCache.path !== path || siteCache.mtime !== mtime) {
    siteCache = { mtime, path, site: loadSiteObject(path) };
  }
  return siteCache.site;
}

/**
 * 后台里的图片解析：正文写 images/xxx.png，
 * 预览页从站点根提供服务，所以补成 /assets/images/xxx.png（绝对路径，带不带前缀都对）。
 */
function previewImage(src) {
  const m = /^\.?\/?images\/(.+)$/.exec(src);
  if (!m) return null;
  const size = imageSizeOfFile(join(process.cwd(), 'content/images', m[1]));
  return { url: `/assets/images/${m[1]}`, width: size ? size.width : 0, height: size ? size.height : 0 };
}

/** 渲染正文（编辑器右侧的实时预览） */
export function renderBody(markdownText, opts = {}) {
  const headings = [];
  const html = renderMarkdown(String(markdownText || ''), {
    headings,
    html: opts.html === true,
    image: previewImage,
  });
  return { html, headings };
}

/** 一篇文章/作品在构建脚本眼里的样子（预览和保存都用得上） */
export function decorate(data, body) {
  const { html, headings } = renderBody(body, { html: data.html === true });
  const tags = Array.isArray(data.tags) ? data.tags
    : Array.isArray(data.tech) ? data.tech : [];
  return {
    title: data.title || '(未命名)',
    date: isoDate(data.date) || String(data.date || ''),
    tags,
    excerpt: data.excerpt || extractExcerpt(body, 110),
    description: data.description || '',
    cover: data.cover || '',
    tech: Array.isArray(data.tech) ? data.tech : [],
    draft: data.draft === true,
    html,
    headings,
  };
}

const coverUrl = (cover) => `/assets/images/${String(cover).replace(/^\.?\/?images\//, '')}`;

/** 目录（和构建脚本里那份逻辑一致） */
function tocHtml(headings) {
  const use = (headings || []).filter((x) => x.level === 2 || x.level === 3);
  if (use.length < 3) return '';
  return `<nav class="toc" aria-label="本页目录">
    <p class="toc-title mono">On this page</p>
    <ol>${use.map((x) => `<li class="toc-l${x.level}"><a href="#${h(x.id)}">${h(x.text)}</a></li>`).join('')}</ol>
  </nav>`;
}

/**
 * 整页草稿预览。
 * @param {object} o
 * @param {string} o.root
 * @param {'posts'|'projects'} o.kind
 * @param {string} o.slug
 * @param {object} o.data  front-matter
 * @param {string} o.body  正文 Markdown
 */
export function renderDraftPage(o) {
  const site = loadSite(o.root);
  const p = decorate(o.data, o.body);
  const isProject = o.kind === 'projects';

  const banner = `<div class="draft-banner">
    <span class="mono">草稿预览</span>
    <span>${h(o.slug)}${p.draft ? ' · 标记为草稿，发布时会跳过' : ' · 未标记草稿，保存后会正常发布'}</span>
    <a href="/admin/edit?kind=${encodeURIComponent(o.kind)}&slug=${encodeURIComponent(o.slug)}">← 回到编辑器</a>
  </div>`;

  const body = `${banner}
    <article>
      ${pageHead({
        eyebrow: isProject ? 'Work' : 'Post',
        label: isProject ? p.date : prettyDate(p.date),
        title: p.title,
        lede: isProject ? p.description : '',
      })}
      ${p.cover ? `<img class="post-cover" src="${h(coverUrl(p.cover))}" alt="" decoding="async">` : ''}
      ${p.tags.length ? tagList(p.tags) : ''}
      ${tocHtml(p.headings)}
      <div class="prose">${p.html}</div>
      <nav class="pager"><span></span><span class="pager-next"><a href="/admin/edit?kind=${encodeURIComponent(o.kind)}&slug=${encodeURIComponent(o.slug)}">继续编辑 →</a></span></nav>
    </article>`;

  return pageShell({
    site,
    prefix: '/',
    noindex: true,
    title: `草稿预览 · ${p.title}`,
    description: '写作后台的草稿预览页，不会被搜索引擎收录。',
    body,
    bodyClass: 'is-preview',
  });
}
