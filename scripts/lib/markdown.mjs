/* ==========================================================================
   Markdown 渲染（零依赖，构建期使用）
   --------------------------------------------------------------------------
   支持的语法（够写博客/笔记，不做 CommonMark 全兼容）：
     标题 # ~ ######（带 id 锚点，可采集目录）   粗体 / 斜体 / 删除线 / 行内代码
     段落 / 硬换行（行尾两个空格）               链接 / 图片 / 裸网址自动转链接
     无序列表 / 有序列表 / 嵌套列表               引用 >
     围栏代码块 ```lang（带高亮）                 表格（GFM 管道表）
     分隔线 ---                                   脚注 [^1] + [^1]: 定义
   安全：正文里的 HTML 默认**转义**（跟 react-markdown 的默认行为一致）。
        整篇想直出 HTML，在 front-matter 里写 `html: true` —— 那是你自己的内容，风险自负。
   ========================================================================== */

import { highlight } from './highlight.mjs';

/* ------------------------------------------------------------ 转义 */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/* ------------------------------------------------------------ 行内 */

function inline(text, opts = {}) {
  const raw = opts.html === true;          /* 直出模式：不转义 */
  const codes = [];
  const PUA = 0xe000;
  const footRefs = [];

  // 1) 先摘出行内代码，避免里面的 * _ [ ] 被当成语法
  let s = String(text).replace(/(`+)([\s\S]*?)\1/g, (_, __, code) => {
    codes.push(code.replace(/^ | $/g, ''));
    return String.fromCharCode(PUA + codes.length - 1);
  });

  // 2) 转义（直出模式下跳过）
  s = raw ? s : escapeHtml(s);

  // 3) 脚注引用 [^id] —— 必须在转义**之后**插，否则插进去的 <sup> 会被转义掉。
  //    只认有定义的 id，避免误伤普通的方括号。
  if (!raw) s = s.replace(/\[\^([^\]\s]+)\]/g, (m, id) => {
    if (opts.footnotes && opts.footnotes.defs.has(id)) {
      footRefs.push(id);
      const safe = escapeHtml(id);
      return `<sup class="fn-ref"><a id="fnref-${safe}" href="#fn-${safe}">${safe}</a></sup>`;
    }
    return m;
  });

  // 4) 图片 → 链接 → 粗体 → 斜体 → 删除线
  //    URL 里允许出现一层成对括号（维基百科那种 …/函数_(数学)），所以不能遇到 ')' 就收
  const URL_RE = '((?:[^()\\s]|\\([^()\\s]*\\))+)';
  s = s.replace(new RegExp(`!\\[([^\\]]*)\\]\\(${URL_RE}(?:\\s+"([^"]*)")?\\)`, 'g'),
    (_, alt, src, title) => {
      // 站内图片：content/images/foo.png 写 images/foo.png 即可，这里补上目录和尺寸
      const info = opts.image ? opts.image(src) : null;
      const url = info ? info.url : src;
      const dim = info && info.width ? ` width="${info.width}" height="${info.height}"` : '';
      return `<img src="${url}" alt="${alt}"${dim}${title ? ` title="${title}"` : ''} loading="lazy" decoding="async">`;
    });
  s = s.replace(new RegExp(`\\[([^\\]]+)\\]\\(${URL_RE}\\)`, 'g'), (_, label, href) => `<a href="${href}">${label}</a>`);
  if (!raw) s = s.replace(/&lt;(https?:\/\/[^\s&]+)&gt;/g, (_, url) => `<a href="${url}">${url}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  s = s.replace(/(^|[^_\w])_([^_\n]+)_/g, '$1<em>$2</em>');
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');

  // 4) 裸网址（不吞掉中文标点）
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)）】。，；]+)/g, (_, pre, url) => `${pre}<a href="${url}">${url}</a>`);

  // 5) 硬换行
  s = s.replace(/ {2,}\n/g, '<br>\n');

  // 6) 代码放回去
  s = s.replace(/[\uE000-\uF8FF]/g, (ch) => {
    const code = codes[ch.charCodeAt(0) - PUA];
    return code === undefined ? '' : `<code>${escapeHtml(code)}</code>`;
  });
  return s;
}

/* ------------------------------------------------------ 文件名 / 摘要 */

export function slugify(text) {
  const s = String(text)
    .toLowerCase()
    .trim()
    .replace(/[^\w\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return s || 'section';
}

const isBlank = (l) => /^\s*$/.test(l);
const isFence = (l) => /^\s*(`{3,}|~{3,})\s*([\w+#.-]*)\s*$/.exec(l);
const isHeading = (l) => /^(#{1,6})\s+(.*)$/.exec(l);
const isHr = (l) => /^\s*([-*_])(\s*\1){2,}\s*$/.test(l);
const isQuote = (l) => /^\s*>\s?/.test(l);
const isItem = (l) => /^(\s*)([-*+]|\d{1,9}[.)])\s+/.exec(l);
const isTableSep = (l) => /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(l) && l.includes('-');
const isHtmlBlock = (l) => /^\s*<\/?[a-zA-Z][\w:-]*(\s|\/?>|$)/.test(l);

/* ------------------------------------------------------------ 脚注 */

/** 抽走 [^id]: 定义行，返回正文和定义表 */
function takeFootnotes(src) {
  const defs = new Map();
  const kept = [];
  let current = null;
  for (const line of src.split('\n')) {
    const m = /^\[\^([^\]\s]+)\]:\s*(.*)$/.exec(line);
    if (m) {
      // 定义可以写成多行：后续缩进两格的行算它的续行
      current = { id: m[1], text: m[2] };
      defs.set(m[1], current);
      continue;
    }
    if (current && /^\s{2,}\S/.test(line)) { current.text += '\n' + line.trim(); continue; }
    current = null;
    kept.push(line);
  }
  return { body: kept.join('\n'), defs };
}

function footnoteBlock(defs, opts) {
  if (!defs || !defs.size) return '';
  const used = [...defs.values()];
  return `<section class="footnotes" aria-label="脚注"><ol>` +
    used.map((d) => `<li id="fn-${escapeHtml(d.id)}">${inline(d.text, opts)} <a class="fn-back" href="#fnref-${escapeHtml(d.id)}" aria-label="回到正文">↩</a></li>`).join('') +
    `</ol></section>`;
}

/* ------------------------------------------------------------ 块级 */

/**
 * 把一整块 Markdown 渲染成 HTML。
 * @param {string} src
 * @param {object} [opts]
 * @param {Array}  [opts.headings]  传一个数组进来，会收到 [{level, text, id}]，用来生成目录
 * @param {boolean}[opts.html]      true = 正文 HTML 直出（默认转义）
 * @param {Function}[opts.image]    图片地址改写 + 尺寸注入，签名 (src) => {url, width, height}
 */
export function renderMarkdown(src, opts = {}) {
  const text = String(src == null ? '' : src).replace(/\r\n?/g, '\n');
  const { body, defs } = opts.html === true ? { body: text, defs: new Map() } : takeFootnotes(text);
  const state = opts._state || { ids: Object.create(null) };
  const html = renderBlocks(body, Object.assign({}, opts, {
    _state: state,
    footnotes: { defs },
  }));
  return html + footnoteBlock(defs, { _state: state });
}

function renderBlocks(src, opts) {
  const state = opts._state || (opts._state = { ids: Object.create(null) });
  const lines = String(src == null ? '' : src).split('\n');
  const out = [];
  let i = 0;

  const headingId = (text) => {
    const base = slugify(text.replace(/[`*_~\[\]]/g, ''));
    let id = base;
    let n = 2;
    while (state.ids[id]) id = `${base}-${n++}`;
    state.ids[id] = true;
    return id;
  };

  while (i < lines.length) {
    const line = lines[i];

    if (isBlank(line)) { i++; continue; }

    /* HTML 块（只在 html: true 时直出） */
    if (opts.html === true && isHtmlBlock(line)) {
      const buf = [];
      while (i < lines.length && !isBlank(lines[i])) buf.push(lines[i++]);
      out.push(buf.join('\n'));
      continue;
    }

    /* 围栏代码块 */
    const fence = isFence(line);
    if (fence) {
      const marker = fence[1][0];
      const lang = (fence[2] || '').toLowerCase();
      const buf = [];
      i++;
      while (i < lines.length && !new RegExp(`^\\s*${marker}{3,}\\s*$`).test(lines[i])) buf.push(lines[i++]);
      i++; // 跳过收尾围栏
      const code = buf.join('\n');
      const body = lang ? highlight(code, lang) : escapeHtml(code);
      out.push(
        `<figure class="code-block">` +
        (lang ? `<figcaption class="code-lang mono">${escapeHtml(lang)}</figcaption>` : '') +
        `<pre><code class="language-${escapeHtml(lang || 'text')}">${body}</code></pre></figure>`
      );
      continue;
    }

    /* 标题 */
    const head = isHeading(line);
    if (head) {
      const level = head[1].length;
      const text = head[2].replace(/\s+#+\s*$/, '');
      const id = headingId(text);
      if (opts.headings) opts.headings.push({ level, text: text.replace(/[`*_~]/g, ''), id });
      out.push(`<h${level} id="${id}">${inline(text, opts)}</h${level}>`);
      i++;
      continue;
    }

    /* 分隔线 */
    if (isHr(line)) { out.push('<hr>'); i++; continue; }

    /* 引用 */
    if (isQuote(line)) {
      const buf = [];
      while (i < lines.length && (isQuote(lines[i]) || (!isBlank(lines[i]) && buf.length))) {
        buf.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      out.push(`<blockquote>${renderBlocks(buf.join('\n'), opts)}</blockquote>`);
      continue;
    }

    /* 表格：当前行有 |，下一行是分隔行 */
    if (line.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const cells = (l) => l.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
      const head2 = cells(line);
      const aligns = cells(lines[i + 1]).map((c) => {
        const l = c.startsWith(':'), r = c.endsWith(':');
        return l && r ? 'center' : r ? 'right' : l ? 'left' : '';
      });
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes('|') && !isBlank(lines[i])) rows.push(cells(lines[i++]));
      const th = head2.map((c, n) => `<th${aligns[n] ? ` style="text-align:${aligns[n]}"` : ''}>${inline(c, opts)}</th>`).join('');
      const tb = rows.map((r) => `<tr>${head2.map((_, n) => `<td${aligns[n] ? ` style="text-align:${aligns[n]}"` : ''}>${inline(r[n] || '', opts)}</td>`).join('')}</tr>`).join('');
      out.push(`<div class="table-wrap"><table><thead><tr>${th}</tr></thead><tbody>${tb}</tbody></table></div>`);
      continue;
    }

    /* 列表 */
    const item = isItem(line);
    if (item) {
      const baseIndent = item[1].length;
      const ordered = /\d/.test(item[2]);
      const items = [];
      let current = null;
      while (i < lines.length) {
        const l = lines[i];
        const m = isItem(l);
        if (m && m[1].length <= baseIndent) {
          // 同一层换了列表类型（- ↔ 1.）就收尾，交给外层重新开一个列表
          if (/\d/.test(m[2]) !== ordered) break;
          if (current !== null) items.push(current);
          current = { text: l.slice(m[0].length), lines: [] };
          i++;
        } else if (l.trim() && (/^\s{2,}/.test(l) || isQuote(l) || isFence(l) || isBlank(l)) && current) {
          // 续行 / 子块：缩进去掉 baseIndent + 2
          current.lines.push(l.replace(new RegExp(`^\\s{0,${baseIndent + 2}}`), ''));
          i++;
        } else if (isBlank(l) && current && i + 1 < lines.length && isItem(lines[i + 1])) {
          i++; // 松散列表的空行
        } else if (isBlank(l) && current) {
          i++;
          break;
        } else {
          break;
        }
      }
      if (current !== null) items.push(current);
      const lis = items.map((it) => {
        const inner = it.text + (it.lines.length ? '\n' + it.lines.join('\n') : '');
        let html = renderBlocks(inner, opts);
        // 段落位于开头时把 <p> 拆掉（列表项里的段落不需要外边距）
        html = html.replace(/^<p>([\s\S]*?)<\/p>(\n|$)/, '$1$2');
        return `<li>${html}</li>`;
      }).join('');
      out.push(ordered ? `<ol>${lis}</ol>` : `<ul>${lis}</ul>`);
      continue;
    }

    /* 段落 */
    const buf = [];
    while (i < lines.length && !isBlank(lines[i]) && !isFence(lines[i]) && !isHeading(lines[i])
      && !isHr(lines[i]) && !isQuote(lines[i]) && !isItem(lines[i])
      && !(opts.html === true && isHtmlBlock(lines[i]))) {
      if (lines[i].includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) break;
      buf.push(lines[i++]);
    }
    if (buf.length) out.push(`<p>${inline(buf.join('\n'), opts)}</p>`);
  }

  return out.join('\n');
}

/* ------------------------------------------------------ front-matter */

/**
 * 解析文首的 front-matter（不引入 YAML 依赖，只认够用的子集）：
 *   title: 标题            title: "带: 冒号的标题"
 *   tags: [a, b, c]        draft: true        order: 3        html: true
 * 返回 { data, content }，没有 front-matter 时 data 为空对象。
 */
export function frontMatter(raw) {
  const text = String(raw == null ? '' : raw).replace(/\r\n?/g, '\n');
  const m = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(text);
  if (!m) return { data: {}, content: text };

  const data = {};
  for (const line of m[1].split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const at = line.indexOf(':');
    if (at < 0) continue;
    const key = line.slice(0, at).trim();
    let val = line.slice(at + 1).trim();

    if (/^\[.*\]$/.test(val)) {
      data[key] = val.slice(1, -1).split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    } else if (/^(true|false)$/i.test(val)) {
      data[key] = /^true$/i.test(val);
    } else if (/^-?\d+(\.\d+)?$/.test(val)) {
      data[key] = Number(val);
    } else {
      data[key] = val.replace(/^['"]|['"]$/g, '');
    }
  }
  return { data, content: text.slice(m[0].length) };
}

/** 从 Markdown 抠纯文本摘要（列表页和 meta description 用） */
export function extractExcerpt(content, maxLen = 120) {
  const text = String(content || '')
    .replace(/^---[\s\S]*?---\s*/m, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/\[\^[^\]]+\]/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/[*_`~|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
}
