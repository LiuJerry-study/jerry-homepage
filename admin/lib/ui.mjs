/* ==========================================================================
   写作后台 · 界面
   --------------------------------------------------------------------------
   纯字符串拼 HTML，没有模板引擎、没有前端框架 —— 和站点一样零依赖。
   配色沿用站点那套绿，但布局是"工具"的样子：左边编辑、右边预览。
   ========================================================================== */

import { escapeHtml as h } from '../../scripts/lib/markdown.mjs';

const CSS = `
:root{
  --bg:#F4F9F5; --surface:#fff; --surface-2:#EDF5EF; --border:rgba(16,46,32,.12);
  --ink:#0D1F17; --ink-2:#2B4438; --muted:#6B8478;
  --accent:#12B886; --accent-2:#0E9F79; --accent-soft:rgba(18,184,134,.10);
  --danger:#B4453B; --r:12px;
  --mono:ui-monospace,SFMono-Regular,"Cascadia Mono",Consolas,monospace;
}
@media (prefers-color-scheme: dark){
  :root{ --bg:#07130F; --surface:#0C1D16; --surface-2:#102A20; --border:rgba(255,255,255,.10);
    --ink:#E9F6EF; --ink-2:#C2D8CC; --muted:#87A497; --accent:#3DDC97; --accent-2:#14B884;
    --accent-soft:rgba(61,220,151,.12); --danger:#F08A80; }
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
  font:15px/1.7 system-ui,-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;}
a{color:var(--accent-2)}
.mono{font-family:var(--mono);font-variant-numeric:tabular-nums}
header.bar{position:sticky;top:0;z-index:9;display:flex;align-items:center;gap:16px;
  padding:12px 20px;border-bottom:1px solid var(--border);background:var(--surface);}
header.bar .brand{display:flex;align-items:center;gap:8px;font-weight:600;text-decoration:none;color:var(--ink)}
header.bar .dot{width:9px;height:9px;border-radius:50%;background:linear-gradient(140deg,#4ED8A8,#0E9F79)}
header.bar nav{display:flex;gap:4px;margin-left:8px}
header.bar nav a{padding:6px 12px;border-radius:999px;text-decoration:none;color:var(--muted);font-size:14px}
header.bar nav a:hover{background:var(--accent-soft);color:var(--accent-2)}
header.bar nav a.on{background:var(--accent-soft);color:var(--accent-2);font-weight:600}
header.bar .spacer{flex:1}
.wrap{max-width:1400px;margin:0 auto;padding:24px 20px 60px}
.wrap.narrow{max-width:860px}
h1{font-size:1.5rem;margin:0 0 4px;letter-spacing:-.01em}
.sub{color:var(--muted);font-size:13.5px;margin:0 0 22px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:18px}
.btn{display:inline-flex;align-items:center;gap:7px;padding:8px 15px;border:1px solid var(--border);
  border-radius:999px;background:var(--surface);color:var(--ink);font:inherit;font-size:14px;
  text-decoration:none;cursor:pointer;transition:.2s}
.btn:hover{border-color:var(--accent);color:var(--accent-2)}
.btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}
.btn.primary:hover{filter:brightness(.95);color:#fff}
.btn.danger:hover{border-color:var(--danger);color:var(--danger)}
.btn:disabled{opacity:.5;cursor:default}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{padding:10px 12px;border-bottom:1px solid var(--border);text-align:left;vertical-align:top}
th{color:var(--muted);font-weight:600;font-size:12.5px;letter-spacing:.04em}
tr:last-child td{border-bottom:0}
.pill{display:inline-block;padding:2px 9px;border-radius:999px;font-size:11.5px;
  border:1px solid var(--border);color:var(--muted)}
.pill.draft{border-style:dashed;border-color:var(--accent);color:var(--accent-2)}
.pill.live{border-color:var(--accent);background:var(--accent-soft);color:var(--accent-2)}
input[type=text],input[type=password],input[type=date],textarea{
  width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:10px;
  background:var(--bg);color:var(--ink);font:inherit;outline:none}
input:focus,textarea:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
label{display:block;font-size:12.5px;color:var(--muted);margin:14px 0 5px}
.row{display:flex;gap:14px;flex-wrap:wrap}
.row>*{flex:1;min-width:160px}
.editor{display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start}
.editor textarea{min-height:60vh;resize:vertical;font-family:var(--mono);font-size:13.5px;line-height:1.75}
.preview{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);
  padding:22px 26px;min-height:60vh;overflow:auto}
.preview .prose{max-width:none}
.preview h1,.preview h2,.preview h3{margin:1.2em 0 .5em;line-height:1.3}
.preview h1{font-size:1.5rem}.preview h2{font-size:1.2rem;border-bottom:1px solid var(--border);padding-bottom:.3em}
.preview h3{font-size:1.05rem}
.preview p{margin:.7em 0}
.preview code{background:var(--surface-2);padding:.1em .35em;border-radius:5px;font-family:var(--mono);font-size:.88em}
.preview pre{background:var(--surface-2);padding:12px 14px;border-radius:10px;overflow:auto}
.preview pre code{background:none;padding:0}
.preview blockquote{margin:1em 0;padding-left:14px;border-left:3px solid var(--border);color:var(--muted)}
.preview img{max-width:100%;border-radius:10px}
.preview table{width:100%;border-collapse:collapse}
.preview th,.preview td{border:1px solid var(--border);padding:6px 9px}
.toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:18px 0}
.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:20;
  padding:10px 18px;border-radius:999px;background:var(--ink);color:var(--bg);font-size:13.5px;
  opacity:0;pointer-events:none;transition:.25s}
.toast.on{opacity:1}
.log{margin-top:16px;padding:14px 16px;border-radius:10px;background:var(--surface-2);
  font-family:var(--mono);font-size:12.5px;white-space:pre-wrap;max-height:260px;overflow:auto;display:none}
.log.on{display:block}
.log.err{color:var(--danger)}
.login{max-width:380px;margin:12vh auto}
.login h1{margin-bottom:18px}
.err{color:var(--danger);font-size:13.5px;margin:10px 0 0}
.empty{padding:40px;text-align:center;color:var(--muted)}
.meta{font-size:12.5px;color:var(--muted)}
@media (max-width:900px){ .editor{grid-template-columns:1fr} .preview{min-height:40vh} }
`;

/** 后台整体骨架 */
export function layout({ title, body, active = '', user = true }) {
  const nav = [['posts', '文章'], ['projects', '作品'], ['resume', '简历'], ['settings', '开关']]
    .map(([k, label]) => `<a href="/admin/${k}" class="${active === k ? 'on' : ''}">${label}</a>`).join('');
  return `<!DOCTYPE html>
<html lang="zh-CN"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${h(title)} · 写作后台</title>
<style>${CSS}</style>
</head><body>
<header class="bar">
  <a class="brand" href="/admin/posts"><span class="dot"></span>写作后台</a>
  ${user ? `<nav>${nav}</nav>` : ''}
  <span class="spacer"></span>
  ${user
    ? `<a class="btn" href="/" target="_blank" rel="noopener">看站点 ↗</a>
       <form method="post" action="/admin/logout" style="margin:0"><button class="btn" type="submit">退出</button></form>`
    : `<a class="btn" href="/" target="_blank" rel="noopener">看站点 ↗</a>`}
</header>
${body}
<script>
  window.toast = function (msg) {
    let el = document.querySelector('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
    el.textContent = msg; el.classList.add('on');
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), 2600);
  };
</script>
</body></html>`;
}

export function loginPage({ error = '' } = {}) {
  return layout({
    title: '登录',
    user: false,
    body: `<form class="login card" method="post" action="/admin/login">
      <h1>写作后台</h1>
      <p class="sub">输入密码继续。这个后台只用来写内容，站点本身是静态的。</p>
      <label for="pw">密码</label>
      <input id="pw" name="password" type="password" autocomplete="current-password" autofocus required>
      ${error ? `<p class="err">${h(error)}</p>` : ''}
      <div class="toolbar"><button class="btn primary" type="submit">进入</button></div>
    </form>`,
  });
}

export function listPage({ kind, label, items, stats = null }) {
  const newHref = `/admin/edit?kind=${encodeURIComponent(kind)}`;
  const rows = items.length
    ? items.map((it) => `<tr>
        <td>
          <a href="/admin/edit?kind=${encodeURIComponent(kind)}&slug=${encodeURIComponent(it.slug)}"><strong>${h(it.title)}</strong></a>
          <div class="meta mono">${h(it.slug)}.md · ${h(it.mtime.slice(0, 10))}</div>
        </td>
        <td class="mono">${h(it.date || '—')}</td>
        <td>${it.draft ? '<span class="pill draft">草稿</span>' : '<span class="pill live">已发布</span>'}</td>
        <td class="meta">${it.tags.map((t) => h(t)).join('、') || '—'}</td>
        <td style="text-align:right;white-space:nowrap">
          <a class="btn" href="/preview/${encodeURIComponent(kind)}/${encodeURIComponent(it.slug)}" target="_blank" rel="noopener">预览</a>
          <a class="btn" href="/admin/edit?kind=${encodeURIComponent(kind)}&slug=${encodeURIComponent(it.slug)}">编辑</a>
        </td>
      </tr>`).join('')
    : `<tr><td colspan="5"><div class="empty">还没有${h(label)}。<code>content/${kind}/</code> 里放一个 .md 就会出现。</div></td></tr>`;

  return layout({
    title: label,
    active: kind,
    body: `<div class="wrap">
      <h1>${h(label)}</h1>
      <p class="sub">共 ${items.length} 条${stats ? ` · ${h(stats)}` : ''}。改完点保存，会自动重新构建站点。</p>
      <div class="toolbar"><a class="btn primary" href="${newHref}">+ 写新${h(label === '文章' ? '文章' : '作品')}</a></div>
      <div class="card" style="padding:0">
        <table><thead><tr><th>标题</th><th>日期</th><th>状态</th><th>标签</th><th></th></tr></thead>
        <tbody>${rows}</tbody></table>
      </div>
    </div>`,
  });
}

export function editorPage({ kind, slug, data, body, exists, lastBuild }) {
  const isProject = kind === 'projects';
  const tags = Array.isArray(data.tags) ? data.tags : (Array.isArray(data.tech) ? data.tech : []);
  const title = exists ? data.title || slug : '';

  return layout({
    title: exists ? `编辑 ${title}` : '写新内容',
    active: kind,
    body: `<div class="wrap">
      <h1>${exists ? '编辑' : '新建'}${isProject ? '作品' : '文章'}</h1>
      <p class="sub">
        文件名就是网址（<span class="mono">${h(kind)}/${h(slug || '文件名')}.html</span>）。
        正文用 Markdown，右侧实时预览就是发布后的样子。
        ${lastBuild ? `上次构建：${h(lastBuild)}` : ''}
      </p>

      <div class="card">
        <div class="row">
          <div style="flex:2"><label>标题</label><input id="f-title" type="text" value="${h(title)}" placeholder="文章标题"></div>
          <div><label>日期</label><input id="f-date" type="date" value="${h(String(data.date || '').slice(0, 10))}"></div>
          <div><label>文件名（网址）</label><input id="f-slug" type="text" value="${h(slug || '')}" ${exists ? 'readonly' : ''} placeholder="英文或拼音更好看"></div>
        </div>
        <div class="row">
          <div><label>标签（逗号分隔）</label><input id="f-tags" type="text" value="${h((isProject ? [] : tags).join(', '))}" placeholder="前端, 笔记"></div>
          ${isProject
            ? `<div><label>技术栈（逗号分隔）</label><input id="f-tech" type="text" value="${h((data.tech || []).join(', '))}" placeholder="Node.js, Markdown"></div>`
            : `<div><label>摘要（留空自动从正文提取）</label><input id="f-excerpt" type="text" value="${h(data.excerpt || '')}"></div>`}
        </div>
        <div class="row">
          <div><label>封面（可选，如 images/xxx.png）</label><input id="f-cover" type="text" value="${h(data.cover || '')}"></div>
          ${isProject
            ? `<div><label>Demo 链接</label><input id="f-demo" type="text" value="${h(data.demo || '')}"></div>
               <div><label>源码链接</label><input id="f-repo" type="text" value="${h(data.repo || '')}"></div>`
            : `<div><label>描述（可选，给 meta description）</label><input id="f-description" type="text" value="${h(data.description || '')}"></div>`}
        </div>
        <div class="toolbar" style="margin-bottom:0">
          <label style="margin:0;display:flex;align-items:center;gap:7px;color:var(--ink)">
            <input id="f-draft" type="checkbox" ${data.draft === true ? 'checked' : ''} style="width:auto"> 草稿（不发布）
          </label>
          <label style="margin:0;display:flex;align-items:center;gap:7px;color:var(--ink)">
            <input id="f-toc" type="checkbox" ${data.toc === false ? '' : 'checked'} style="width:auto"> 生成目录
          </label>
          ${isProject ? `<label style="margin:0;display:flex;align-items:center;gap:7px;color:var(--ink)">
            <input id="f-featured" type="checkbox" ${data.featured === true ? 'checked' : ''} style="width:auto"> 精选
          </label>` : ''}
        </div>
      </div>

      <div class="toolbar">
        <button class="btn primary" id="save">保存并重新构建</button>
        <a class="btn" id="preview-link" href="/preview/${encodeURIComponent(kind)}/${encodeURIComponent(slug || '')}" target="_blank" rel="noopener">整页预览 ↗</a>
        <span class="meta" id="state">未修改</span>
        <span style="flex:1"></span>
        ${exists ? `<button class="btn danger" id="del">删除</button>` : ''}
      </div>

      <div class="editor">
        <textarea id="f-body" spellcheck="false" placeholder="在这里写正文…">${h(body || '')}</textarea>
        <div class="preview"><div class="prose" id="pv"></div></div>
      </div>

      <pre class="log" id="log"></pre>
    </div>

<script>
(function () {
  const $ = (id) => document.getElementById(id);
  const kind = ${JSON.stringify(kind)};
  const slugInput = $('f-slug');
  let dirty = false, timer = 0, lastHtml = '';

  function data() {
    const out = {
      title: $('f-title').value.trim(),
      date: $('f-date').value,
      draft: $('f-draft').checked,
      toc: $('f-toc').checked,
      cover: $('f-cover').value.trim(),
    };
    if (kind === 'projects') {
      out.tech = $('f-tech').value.split(',').map((s) => s.trim()).filter(Boolean);
      out.demo = $('f-demo').value.trim();
      out.repo = $('f-repo').value.trim();
      out.featured = $('f-featured').checked;
    } else {
      out.tags = $('f-tags').value.split(',').map((s) => s.trim()).filter(Boolean);
      out.excerpt = $('f-excerpt').value.trim();
      out.description = $('f-description').value.trim();
    }
    return out;
  }

  function mark() { dirty = true; $('state').textContent = '有未保存的改动'; }

  async function preview() {
    const body = $('f-body').value;
    if (body === lastHtml) return;
    lastHtml = body;
    try {
      const r = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, data: data() }),
      });
      const j = await r.json();
      if (j.ok) $('pv').innerHTML = j.html || '<p class="meta">（正文还是空的）</p>';
      else $('pv').innerHTML = '<p class="err">' + (j.error || '预览失败') + '</p>';
    } catch (e) { /* 预览失败不打断写东西 */ }
  }

  function schedule() { mark(); clearTimeout(timer); timer = setTimeout(preview, 260); }

  ['f-body', 'f-title', 'f-date', 'f-tags', 'f-tech', 'f-excerpt', 'f-description', 'f-cover', 'f-demo', 'f-repo']
    .forEach((id) => { const el = $(id); if (el) el.addEventListener('input', schedule); });
  ['f-draft', 'f-toc', 'f-featured'].forEach((id) => { const el = $(id); if (el) el.addEventListener('change', schedule); });
  window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  slugInput.addEventListener('input', () => {
    const s = slugInput.value.trim();
    $('preview-link').href = '/preview/' + encodeURIComponent(kind) + '/' + encodeURIComponent(s || '');
  });

  async function save(forceNew) {
    const btn = $('save');
    btn.disabled = true;
    const log = $('log');
    log.classList.add('on'); log.classList.remove('err');
    log.textContent = '保存中…';
    try {
      const r = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, slug: slugInput.value.trim(), data: data(), body: $('f-body').value, createOnly: forceNew }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || '保存失败');
      dirty = false;
      $('state').textContent = '已保存 ' + new Date().toLocaleTimeString();
      log.textContent = (j.log || '') + (j.build && j.build.log ? '\\n\\n--- 重新构建 ---\\n' + j.build.log : '');
      if (j.build && j.build.ok === false) { log.classList.add('err'); toast('内容存了，但构建失败，看下面日志'); }
      else toast('已保存并重新构建');
      if (forceNew && j.slug) location.href = '/admin/edit?kind=' + kind + '&slug=' + encodeURIComponent(j.slug);
    } catch (e) {
      log.classList.add('err');
      log.textContent = String(e.message || e);
      toast('保存失败：' + (e.message || e));
    } finally { btn.disabled = false; }
  }

  $('save').addEventListener('click', () => save(!${exists}));
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(!${exists}); }
  });
  schedule();

  const del = $('del');
  if (del) del.addEventListener('click', async () => {
    if (!confirm('确定删除？会先把文件改名再删，但这一步之后就不能撤了。')) return;
    const r = await fetch('/api/delete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, slug: slugInput.value.trim() }),
    });
    const j = await r.json();
    if (j.ok) { dirty = false; location.href = '/admin/' + kind; }
    else toast('删除失败：' + (j.error || ''));
  });
})();
</script>`,
  });
}

export function resumePage({ text, lastBuild }) {
  return layout({
    title: '简历',
    active: 'resume',
    body: `<div class="wrap">
      <h1>简历</h1>
      <p class="sub">直接改 <span class="mono">content/resume.json</span>。保存后前台 <span class="mono">resume.html</span> 会重新生成。${lastBuild ? `上次构建：${h(lastBuild)}` : ''}</p>
      <div class="toolbar">
        <button class="btn primary" id="save">保存并重新构建</button>
        <a class="btn" href="/resume.html" target="_blank" rel="noopener">看效果 ↗</a>
        <span class="meta" id="state">未修改</span>
      </div>
      <div class="card" style="padding:0">
        <textarea id="f-json" spellcheck="false" style="min-height:60vh;border:0;border-radius:12px;font-family:var(--mono);font-size:13px">${h(text)}</textarea>
      </div>
      <pre class="log" id="log"></pre>
    </div>
<script>
(function () {
  const $ = (id) => document.getElementById(id);
  let dirty = false;
  $('f-json').addEventListener('input', () => { dirty = true; $('state').textContent = '有未保存的改动'; });
  window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  $('save').addEventListener('click', async () => {
    const log = $('log'); log.classList.add('on'); log.classList.remove('err'); log.textContent = '保存中…';
    const r = await fetch('/api/resume', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: $('f-json').value }),
    });
    const j = await r.json();
    if (!j.ok) { log.classList.add('err'); log.textContent = j.error || '保存失败'; toast('保存失败'); return; }
    dirty = false; $('state').textContent = '已保存 ' + new Date().toLocaleTimeString();
    log.textContent = (j.build && j.build.log) || '';
    toast('已保存并重新构建');
  });
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); $('save').click(); }
  });
})();
</script>`,
  });
}

/* ==========================================================================
   开关页
   --------------------------------------------------------------------------
   「板块」是渲染期的：关掉之后页面根本不生成，导航里那张卡、sitemap、RSS、
   搜索索引一起消失，磁盘上的旧页面也会被清掉。
   「首页 / 装饰 / 工具」是运行时的：写进 assets/site-data.js，main.js 读它。
   两边都是**保存即生效**（后台会敲一下渲染进程），不用等什么构建。
   ========================================================================== */
export function settingsPage({ groups, items, features, lastBuild = '' }) {
  const pill = (t, on) => `<span style="display:inline-block;margin-left:8px;padding:1px 7px;border-radius:999px;font-size:11px;font-weight:600;background:${on ? 'var(--ok-bg)' : 'var(--warn-bg)'};color:${on ? 'var(--ok)' : 'var(--warn)'}">${h(t)}</span>`;

  const body = groups.map((g) => {
    const rows = items.filter((it) => it.group === g.key).map((it) => {
      const on = features[it.key] !== false;
      return `<label style="display:grid;grid-template-columns:auto 1fr;gap:4px 12px;align-items:baseline;padding:12px 0;border-top:1px solid var(--line);cursor:pointer">
        <input type="checkbox" data-key="${h(it.key)}" ${on ? 'checked' : ''} style="width:17px;height:17px;margin-top:3px;accent-color:var(--accent)">
        <span>
          <strong>${h(it.label)}</strong>${it.level === 'site' ? '<span class="pill" style="margin-left:8px">板块</span>' : ''}
          <span class="meta" style="display:block;margin-top:3px">${h(it.note || '')}</span>
          <span class="meta mono" style="display:block;margin-top:2px;opacity:.55">${h(it.key)}</span>
        </span>
      </label>`;
    }).join('');
    return `<section class="card" style="padding:16px 20px 6px">
      <h2 style="margin:0 0 4px">${h(g.label)}</h2>
      <p class="sub" style="margin:0 0 8px">${h(g.note || '')}</p>
      ${rows}
    </section>`;
  }).join('');

  return layout({
    title: '开关',
    active: 'settings',
    body: `<div class="wrap">
      <h1>开关</h1>
      <p class="sub">
        关掉的板块会**连同入口一起消失** —— 导航卡片、sitemap、RSS、搜索索引，
        以及磁盘上已经生成的那些页面。保存后立刻生效，不用重新构建。
        ${lastBuild ? `上次操作：${h(lastBuild)}` : ''}
      </p>
      <div class="toolbar">
        <button class="btn primary" id="save">保存并生效</button>
        <button class="btn" id="all-on">全部打开</button>
        <a class="btn" href="/" target="_blank" rel="noopener">看效果 ↗</a>
        <span class="meta" id="state">未修改</span>
      </div>
      <pre class="log" id="log"></pre>
      ${body}
    </div>
<script>
(function () {
  const $ = (id) => document.getElementById(id);
  let dirty = false;
  const boxes = [...document.querySelectorAll('input[data-key]')];
  boxes.forEach((b) => b.addEventListener('change', () => { dirty = true; $('state').textContent = '有未保存的改动'; }));
  window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  function collect() {
    const f = {};
    boxes.forEach((b) => { f[b.dataset.key] = b.checked; });
    return f;
  }
  $('all-on').addEventListener('click', () => {
    boxes.forEach((b) => { b.checked = true; });
    dirty = true; $('state').textContent = '有未保存的改动（全部打开）';
  });
  $('save').addEventListener('click', async () => {
    const log = $('log'); log.classList.add('on'); log.classList.remove('err'); log.textContent = '保存中…';
    const r = await fetch('/api/features', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ features: collect() }),
    });
    const j = await r.json();
    if (!j.ok) { log.classList.add('err'); log.textContent = j.error || '保存失败'; toast('保存失败'); return; }
    dirty = false; $('state').textContent = '已保存 ' + new Date().toLocaleTimeString();
    log.textContent = (j.build && j.build.log) || '';
    toast('开关已生效');
  });
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); $('save').click(); }
  });
})();
</script>`,
  });
}
