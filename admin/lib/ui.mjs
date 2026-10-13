/* ==========================================================================
   写作后台 · 界面
   --------------------------------------------------------------------------
   纯字符串拼 HTML，没有模板引擎、没有前端框架 —— 和站点一样零依赖。
   配色沿用站点那套绿，但布局是"工具"的样子：左边编辑、右边预览。
   ========================================================================== */

import { escapeHtml as h } from '../../scripts/lib/markdown.mjs';
import { CARD_ICONS } from '../../scripts/lib/features.mjs';

const CSS = `
:root{
  --bg:#F4F9F5; --surface:#fff; --surface-2:#EDF5EF; --border:rgba(16,46,32,.12);
  --ink:#0D1F17; --ink-2:#2B4438; --muted:#6B8478;
  --accent:#12B886; --accent-2:#0E9F79; --accent-soft:rgba(18,184,134,.10);
  --danger:#B4453B; --r:12px;
  --ok:#0E9F79; --ok-bg:rgba(18,184,134,.12); --warn:#9A6B10; --warn-bg:rgba(214,158,46,.16);
  --line:rgba(16,46,32,.12);
  --mono:ui-monospace,SFMono-Regular,"Cascadia Mono",Consolas,monospace;
}
@media (prefers-color-scheme: dark){
  :root{ --bg:#07130F; --surface:#0C1D16; --surface-2:#102A20; --border:rgba(255,255,255,.10);
    --ink:#E9F6EF; --ink-2:#C2D8CC; --muted:#87A497; --accent:#3DDC97; --accent-2:#14B884;
    --accent-soft:rgba(61,220,151,.12); --danger:#F08A80;
    --ok:#3DDC97; --ok-bg:rgba(61,220,151,.14); --warn:#E0B15A; --warn-bg:rgba(224,177,90,.14);
    --line:rgba(255,255,255,.10); }
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
.banner{display:flex;gap:12px;align-items:flex-start;padding:12px 16px;border-radius:10px;
  background:var(--warn-bg);color:var(--warn);font-size:13.5px;margin:0 0 16px}
.banner .btn{margin-left:auto;flex:none}

/* ---------- 设置页：一行一个控件 ---------- */
.setrow{display:grid;grid-template-columns:minmax(0,1fr) minmax(180px,300px);gap:10px 20px;
  align-items:center;padding:14px 0;border-top:1px solid var(--line)}
.setrow:first-of-type{border-top:0}
.setrow .lab strong{display:block}
.setrow .lab .meta{display:block;margin-top:3px;line-height:1.55}
.setrow .key{display:block;margin-top:3px;opacity:.45;font-size:11px}
.setrow .ctl{justify-self:end;width:100%;text-align:right}
select,input[type=number]{width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:10px;
  background:var(--bg);color:var(--ink);font:inherit;outline:none}
select:focus,input[type=number]:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.setrow textarea{min-height:74px;resize:vertical;font-size:13.5px}
.setrow.is-off .ctl{opacity:.55}
@media (max-width:760px){ .setrow{grid-template-columns:1fr} .setrow .ctl{justify-self:stretch;text-align:left} }

/* 开关：真 checkbox，只是画成滑块 */
.sw{position:relative;display:inline-flex;align-items:center;gap:9px;cursor:pointer;user-select:none}
.sw input{position:absolute;opacity:0;width:100%;height:100%;margin:0;cursor:pointer;z-index:1}
.sw-track{width:42px;height:24px;border-radius:999px;background:var(--surface-2);
  border:1px solid var(--border);position:relative;transition:.18s;flex:none}
.sw-dot{position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;
  background:var(--muted);transition:.18s}
.sw input:checked+.sw-track{background:var(--accent-soft);border-color:var(--accent)}
.sw input:checked+.sw-track .sw-dot{left:20px;background:var(--accent)}
.sw-txt{font-size:12.5px;color:var(--muted);min-width:2.2em;text-align:left}
.sw input:checked~.sw-txt{color:var(--accent-2)}

/* ---------- 卡片页 ---------- */
.cardrow{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:20px;
  padding:18px;border:1px solid var(--border);border-radius:var(--r);background:var(--surface);margin-bottom:14px}
@media (max-width:1000px){ .cardrow{grid-template-columns:1fr} }
.cardrow .tools{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:6px}
.cardrow .tools .num{font-family:var(--mono);font-size:12px;color:var(--muted);margin-right:auto}
.mini{display:flex;flex-direction:column;gap:10px}
.mini .half{display:flex;gap:10px;flex-wrap:wrap}
.mini .half>*{flex:1;min-width:130px}
.mini label{margin:10px 0 4px}
.mini label:first-child{margin-top:0}
.pv-wrap{position:sticky;top:78px;align-self:start}
.pv{background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:16px;min-height:150px}
.pv-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;
  box-shadow:0 10px 30px -22px rgba(0,0,0,.4)}
.pv-top{display:flex;align-items:flex-start;justify-content:space-between}
.pv-ico{width:34px;height:34px;border-radius:10px;background:var(--accent-soft);color:var(--accent-2);
  display:grid;place-items:center}
.pv-ico svg{width:17px;height:17px}
.pv-num{font-family:var(--mono);font-size:11.5px;color:var(--muted)}
.pv-t{margin:12px 0 5px;font-size:15.5px;font-weight:600}
.pv-d{color:var(--muted);font-size:13px;line-height:1.55;display:block}
.pv-f{display:flex;align-items:center;justify-content:space-between;margin-top:14px;font-size:12.5px}
.pv-b{padding:3px 10px;border-radius:999px;background:var(--surface-2);color:var(--muted);border:1px solid var(--border)}
.pv-b.live{background:var(--accent-soft);color:var(--accent-2);border-color:var(--accent)}
.pv-go{color:var(--muted)}
.pv-note{font-size:11.5px;color:var(--muted);text-align:center;margin:10px 0 0}
.sticky-bar{position:sticky;top:0;z-index:8;background:var(--bg);padding:14px 0 12px;
  border-bottom:1px solid var(--border);margin-bottom:6px}
`;

/** 后台整体骨架 */
export function layout({ title, body, active = '', user = true }) {
  const nav = [['posts', '文章'], ['projects', '作品'], ['resume', '简历'], ['about', '关于'], ['cards', '卡片'], ['settings', '设置']]
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
      <p class="sub">输入密码继续。这个后台只用来写内容；公开站是另一个只读进程在渲染，这里存的东西约 20ms 就是线上的。</p>
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

/* ==========================================================================
   JSON 文件编辑页（简历 / 关于共用）
   --------------------------------------------------------------------------
   只做一件事：把一个 JSON 文件原样放进 textarea，存回去。
   两个页面的差别只有文案和接口，所以是同一段代码 —— 不然改了一边另一边迟早走样。
   ========================================================================== */
export function jsonPage({ title, active, file, preview, api, hint, text, lastBuild }) {
  return layout({
    title,
    active,
    body: `<div class="wrap">
      <h1>${h(title)}</h1>
      <p class="sub">直接改 <span class="mono">${h(file)}</span>。${h(hint)}保存后前台立刻生效，不用重新构建。${lastBuild ? ` 上次操作：${h(lastBuild)}` : ''}</p>
      <div class="toolbar">
        <button class="btn primary" id="save">保存并生效</button>
        <a class="btn" href="${h(preview)}" target="_blank" rel="noopener">看效果 ↗</a>
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
    const r = await fetch(${JSON.stringify(api)}, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: $('f-json').value }),
    });
    const j = await r.json();
    if (!j.ok) { log.classList.add('err'); log.textContent = j.error || '保存失败'; toast('保存失败'); return; }
    dirty = false; $('state').textContent = '已保存 ' + new Date().toLocaleTimeString();
    log.textContent = (j.build && j.build.log) || '';
    toast('已保存并生效');
  });
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); $('save').click(); }
  });
})();
</script>`,
  });
}

/** 简历：content/resume.json → /resume.html */
export function resumePage({ text, lastBuild }) {
  return jsonPage({
    title: '简历',
    active: 'resume',
    file: 'content/resume.json',
    preview: '/resume.html',
    api: '/api/resume',
    hint: '结构是 <code>intro</code> + <code>sections</code>（type 为 skill 出胶囊，其余出时间线）。',
    text,
    lastBuild,
  });
}

/** 关于：content/about.json → /about.html */
export function aboutPage({ text, lastBuild }) {
  return jsonPage({
    title: '关于',
    active: 'about',
    file: 'content/about.json',
    preview: '/about.html',
    api: '/api/about',
    hint: '技能胶囊默认沿用简历里那份；想给这一页单独写就加 <code>sections</code>。',
    text,
    lastBuild,
  });
}

/* ==========================================================================
   卡片页：不用写代码也能加卡片
   --------------------------------------------------------------------------
   写的是 content/nav.json。这个文件不存在的时候，内容从 content/site.js 的
   nav 借一份当草稿 —— 所以第一次打开看到的是自己原来那几张卡，而不是一张白纸。
   一保存，nav.json 就取代 site.js 里那份（site.js 留着当备份，不会被动）。
   ========================================================================== */
export function cardsPage({ items, saved, placeholders = {}, lastBuild = '' }) {
  const svg = (name) => {
    const icon = CARD_ICONS.find(([n]) => n === name) || CARD_ICONS[2];
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"'
      + ' stroke-linecap="round" stroke-linejoin="round">' + icon[2] + '</svg>';
  };
  const iconOpts = (cur) => CARD_ICONS
    .map(([n, label]) => '<option value="' + h(n) + '"' + (cur === n || (!cur && n === 'grid') ? ' selected' : '') + '>' + h(label) + '</option>')
    .join('');

  const blank = { title: '', desc: '', icon: 'grid', href: '', badge: '', tags: [], details: [] };
  const row = (c, i) => `<div class="cardrow" data-i="${i}">
    <div class="mini">
      <div class="tools">
        <span class="num mono">第 ${String(i + 1).padStart(2, '0')} 张</span>
        <button class="btn" type="button" data-act="up" title="上移">↑</button>
        <button class="btn" type="button" data-act="down" title="下移">↓</button>
        <button class="btn" type="button" data-act="dup" title="复制一张">复制</button>
        <button class="btn danger" type="button" data-act="del">删除</button>
      </div>
      <label>标题</label>
      <input type="text" data-f="title" value="${h(c.title)}" placeholder="比如：个人简历">
      <label>一句话说明</label>
      <input type="text" data-f="desc" value="${h(c.desc)}" placeholder="比如：教育经历 · 技能栈 · 项目经验">
      <div class="half">
        <div><label>图标</label><select data-f="icon">${iconOpts(c.icon)}</select></div>
        <div><label>角标（留空自动）</label><input type="text" data-f="badge" value="${h(c.badge)}" placeholder="已上线 / 3 篇 / 筹备中">
          <div class="meta" style="margin-top:5px;line-height:1.5">可以写占位符，构建时换成真数：<b>{{posts}}</b> <b>{{projects}}</b> <b>{{resume}}</b></div></div>
      </div>
      <label>链接（留空 = 显示「筹备中」，点开是站内详情）</label>
      <input type="text" data-f="href" value="${h(c.href)}" placeholder="resume.html 或 https://…">
      <label>搜索关键词（逗号分隔，命令面板里搜得到）</label>
      <input type="text" data-f="tags" value="${h(c.tags.join(', '))}" placeholder="简历, resume, cv">
      <label>详情条目（一行一条，点开卡片后显示）</label>
      <textarea data-f="details" placeholder="教育经历：学校 / 专业 / 时间线">${h(c.details.join('\n'))}</textarea>
    </div>
    <div class="pv-wrap">
      <div class="pv" data-pv></div>
      <p class="pv-note">预览 ≈ 首页上长这样</p>
    </div>
  </div>`;

  return layout({
    title: '卡片',
    active: 'cards',
    body: `<div class="wrap">
      <h1>卡片</h1>
      <p class="sub">
        首页首屏那一墙入口。加一张就往下面点「＋ 添加一张卡片」，填标题和说明就行 ——
        其余留空也合法。<b>链接留空 = 显示「筹备中」</b>，点开是站内详情页（详情内容就是下面那几行）。
        ${saved
          ? '改完点保存，首页立刻就是新的。'
          : '现在读的是 <span class="mono">content/site.js</span> 里的那份，第一次保存会写出一份 <span class="mono">content/nav.json</span> 接手 —— site.js 留着当备份，不会被动。'}
        ${lastBuild ? ' 上次操作：' + h(lastBuild) : ''}
      </p>
      <div class="toolbar">
        <button class="btn primary" id="save">保存并生效</button>
        <button class="btn" id="add">＋ 添加一张卡片</button>
        <a class="btn" href="/" target="_blank" rel="noopener">看首页 ↗</a>
        <span class="meta" id="state">未修改</span>
      </div>
      <pre class="log" id="log"></pre>
      <div id="list">${items.map(row).join('') || '<div class="empty">一张卡片都没有。点上面「＋ 添加一张卡片」开始。</div>'}</div>
      <template id="tpl">${row(blank, 0)}</template>
      <div class="toolbar"><button class="btn primary" id="save2">保存并生效</button></div>
    </div>
<script>
(function () {
  const $ = (id) => document.getElementById(id);
  const ICONS = ${JSON.stringify(CARD_ICONS)};
  const BLANK = ${JSON.stringify(blank)};
  const PH = ${JSON.stringify(placeholders)};
  const fill = (s) => String(s).replace(/\{\{\w+\}\}/g, (m) => PH[m] || m);
  const list = $('list');
  let dirty = false;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const icon = (name) => {
    const it = ICONS.find(([n]) => n === name) || ICONS[2];
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + it[2] + '</svg>';
  };

  function readRow(el) {
    const g = (f) => { const n = el.querySelector('[data-f="' + f + '"]'); return n ? n.value : ''; };
    /* 换行符用 fromCharCode(10) 拼，不写转义 —— 这段是外层模板字符串的内容，
       \n 会在生成页面时被解析成真的换行，把内联脚本拆断。 */
    const lines = (s) => String(s).split(String.fromCharCode(10)).map((x) => x.trim()).filter(Boolean);
    const tags = (s) => String(s).split(/[,，]/).map((x) => x.trim()).filter(Boolean);
    return {
      title: g('title').trim(),
      desc: g('desc').trim(),
      icon: g('icon') || 'grid',
      href: g('href').trim(),
      badge: g('badge').trim(),
      tags: tags(g('tags')),
      details: lines(g('details')),
    };
  }

  function paint(el) {
    const c = readRow(el);
    const live = !!(c.href && c.href !== '#');
    const badge = fill(c.badge || (live ? '已上线' : '筹备中'));
    el.querySelector('[data-pv]').innerHTML =
      '<div class="pv-card">'
      + '<div class="pv-top"><span class="pv-ico">' + icon(c.icon) + '</span>'
      + '<span class="pv-num">' + String([...list.children].indexOf(el) + 1).padStart(2, '0') + '</span></div>'
      + '<div class="pv-t">' + (esc(c.title) || '<span style="color:var(--muted)">（还没写标题）</span>') + '</div>'
      + '<span class="pv-d">' + esc(c.desc) + '</span>'
      + '<div class="pv-f"><span class="pv-b' + (live ? ' live' : '') + '">' + esc(badge) + '</span>'
      + '<span class="pv-go">' + (live ? '前往' : '查看详情') + ' ↗</span></div></div>';
    el.classList.toggle('is-off', !live);
  }

  function paintAll() { [...list.querySelectorAll('.cardrow')].forEach(paint); }
  function mark() { dirty = true; $('state').textContent = '有未保存的改动'; }

  list.addEventListener('input', (e) => { const r = e.target.closest('.cardrow'); if (r) { paint(r); mark(); } });
  list.addEventListener('change', (e) => { const r = e.target.closest('.cardrow'); if (r) { paint(r); mark(); } });
  list.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const r = b.closest('.cardrow');
    const i = [...list.children].indexOf(r);
    const act = b.dataset.act;
    if (act === 'del') {
      if (!confirm('删掉第 ' + (i + 1) + ' 张卡片？保存之后首页上就没它了。')) return;
      r.remove();
    } else if (act === 'up' && i > 0) { list.insertBefore(r, list.children[i - 1]); }
    else if (act === 'down') { list.insertBefore(r, list.children[i + 2] || null); }
    else if (act === 'dup') {
      const clone = r.cloneNode(true);
      list.insertBefore(clone, r.nextSibling);
      const t = clone.querySelector('[data-f="title"]');
      if (t) t.value = (t.value || '') + ' 副本';
    }
    paintAll(); mark();
  });

  /* 「＋ 添加一张卡片」= 克隆服务端渲染好的那张空卡片（<template> 里）。
     不在 JS 里再拼一遍 HTML —— 拼两遍迟早两边长得不一样。 */
  $('add').addEventListener('click', () => {
    const tpl = $('tpl');
    if (!tpl) return;
    const node = tpl.content.firstElementChild.cloneNode(true);
    list.appendChild(node);
    paintAll(); mark();
    const t = node.querySelector('[data-f="title"]');
    if (t) t.focus();
  });

  window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  async function save() {
    const items = [...list.querySelectorAll('.cardrow')].map(readRow);
    const bad = items.findIndex((c) => !c.title);
    if (bad >= 0) { toast('第 ' + (bad + 1) + ' 张卡片还没有标题'); return; }
    const log = $('log'); log.classList.add('on'); log.classList.remove('err'); log.textContent = '保存中…';
    const r = await fetch('/api/cards', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    const j = await r.json();
    if (!j.ok) { log.classList.add('err'); log.textContent = j.error || '保存失败'; toast('保存失败'); return; }
    dirty = false; $('state').textContent = '已保存 ' + new Date().toLocaleTimeString();
    log.textContent = (j.build && j.build.log) || '';
    toast('卡片已生效');
  }
  $('save').addEventListener('click', save);
  $('save2').addEventListener('click', save);
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
  });
  paintAll();
})();
</script>`,
  });
}

/* ==========================================================================
   设置页
   --------------------------------------------------------------------------
   一张表管到底。每一项的类型（开关 / 文字 / 数字 / 下拉）由注册表决定，
   页面只负责按类型画控件 —— 所以以后加一项只要动 scripts/lib/features.mjs。

   「站点」和「板块」是渲染期的：改完页面真的重新渲染，sitemap / RSS / 导航
   跟着变；「首页 / 装饰 / 工具」是运行时的：写进 assets/site-data.js 给 main.js。
   两边都是**保存即生效**（后台会敲一下渲染进程），不用等构建。
   ========================================================================== */
export function settingsPage({ groups, items, settings, notes = [], hasLegacy = false, lastBuild = '' }) {
  const attr = (k, kind) => `data-key="${h(k)}" data-kind="${kind}"`;

  function control(it, v) {
    const k = it.key;
    switch (it.kind || 'bool') {
      case 'bool':
        return `<label class="sw"><input type="checkbox" ${attr(k, 'bool')} ${v !== false ? 'checked' : ''}>
          <span class="sw-track"><span class="sw-dot"></span></span>
          <span class="sw-txt">${v !== false ? '开' : '关'}</span></label>`;
      case 'number':
        return `<input type="number" ${attr(k, 'number')} value="${h(String(v))}"
          ${it.min !== undefined ? 'min=' + it.min : ''} ${it.max !== undefined ? 'max=' + it.max : ''}>`;
      case 'select':
        return `<select ${attr(k, 'select')}>${it.options.map(([val, label]) =>
          `<option value="${h(val)}"${String(v) === String(val) ? ' selected' : ''}>${h(label)}</option>`).join('')}</select>`;
      case 'textarea':
        return `<textarea ${attr(k, 'text')} rows="3" placeholder="${h(it.note || '')}">${h(String(v))}</textarea>`;
      default:
        return `<input type="text" ${attr(k, 'text')} value="${h(String(v))}">`;
    }
  }

  const body = groups.map((g) => {
    const rows = items.filter((it) => it.group === g.key).map((it) => {
      const v = settings[it.key];
      return `<div class="setrow${v === false ? ' is-off' : ''}" data-row="${h(it.key)}">
        <div class="lab">
          <strong>${h(it.label)}${it.group === 'pages' ? '<span class="pill" style="margin-left:8px">板块</span>' : ''}</strong>
          <span class="meta">${h(it.note || '')}</span>
          <span class="key mono">${h(it.key)}</span>
        </div>
        <div class="ctl">${control(it, v)}</div>
      </div>`;
    }).join('');
    return `<section class="card" style="padding:6px 20px 16px;margin-bottom:16px">
      <h2 style="margin:16px 0 4px">${h(g.label)}</h2>
      <p class="sub" style="margin:0 0 6px">${h(g.note || '')}</p>
      ${rows}
    </section>`;
  }).join('');

  const banner = (hasLegacy || notes.length)
    ? `<div class="banner"><div>
        ${hasLegacy ? '<b>检测到旧文件 content/features.json</b> —— 里面的开关还在生效，但只在这个页面没写到的项上。<br>' : ''}
        ${notes.slice(0, 4).map((n) => h(n)).join('<br>')}
      </div>${hasLegacy ? '<button class="btn" id="import-legacy">并进来并归档旧文件</button>' : ''}</div>`
    : '';

  return layout({
    title: '设置',
    active: 'settings',
    body: `<div class="wrap">
      <h1>设置</h1>
      <p class="sub">
        左边说这项是什么，右边就是控件 —— 开关是开关，文字是输入框，能选的都给成下拉。
        「板块」和「站点」改完会重新渲染整站（导航、sitemap、RSS 一起变）；
        其余写进首页的配置文件，刷新就是新的。存到 <span class="mono">content/settings.json</span>。
        ${lastBuild ? ' 上次操作：' + h(lastBuild) : ''}
      </p>
      ${banner}
      <div class="sticky-bar">
        <div class="toolbar" style="margin:0">
          <button class="btn primary" id="save">保存并生效</button>
          <button class="btn" id="all-on">开关全开</button>
          <button class="btn" id="reset">恢复默认</button>
          <a class="btn" href="/" target="_blank" rel="noopener">看首页 ↗</a>
          <span class="meta" id="state">未修改</span>
        </div>
      </div>
      <pre class="log" id="log"></pre>
      ${body}
      <div class="toolbar"><button class="btn primary" id="save2">保存并生效</button></div>
    </div>
<script>
(function () {
  const $ = (id) => document.getElementById(id);
  const DEFAULTS = ${JSON.stringify(Object.fromEntries(items.map((it) => [it.key, 'def' in it ? it.def : true])))};
  const boxes = [...document.querySelectorAll('[data-key]')];
  let dirty = false;
  const note = () => { dirty = true; $('state').textContent = '有未保存的改动'; };

  /* 开关的"开/关"两个字跟着勾选框走，不然后台看起来跟没反应一样 */
  function syncLabels() {
    boxes.forEach((b) => {
      if (b.dataset.kind !== 'bool') return;
      const row = b.closest('.setrow');
      const txt = row && row.querySelector('.sw-txt');
      if (txt) txt.textContent = b.checked ? '开' : '关';
      if (row) row.classList.toggle('is-off', !b.checked);
    });
  }

  function collect() {
    const out = {};
    boxes.forEach((b) => {
      const k = b.dataset.key, kind = b.dataset.kind;
      if (kind === 'bool') out[k] = b.checked;
      else if (kind === 'number') out[k] = Number(b.value);
      else out[k] = b.value;
    });
    return out;
  }

  function apply(vals) {
    boxes.forEach((b) => {
      const k = b.dataset.key, v = vals[k];
      if (v === undefined) return;
      if (b.dataset.kind === 'bool') b.checked = v !== false;
      else b.value = String(v);
    });
    syncLabels();
  }

  boxes.forEach((b) => {
    b.addEventListener('change', () => { syncLabels(); note(); });
    b.addEventListener('input', note);
  });
  window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  $('all-on').addEventListener('click', () => { boxes.forEach((b) => { if (b.dataset.kind === 'bool') b.checked = true; }); syncLabels(); note(); });
  $('reset').addEventListener('click', () => {
    if (!confirm('把所有项恢复成默认值？（还没保存，反悔就刷新页面）')) return;
    apply(DEFAULTS); note();
  });

  const legacy = $('import-legacy');
  if (legacy) legacy.addEventListener('click', async () => {
    if (!confirm('把 content/features.json 里的开关并进 settings.json，然后把旧文件改名归档？')) return;
    const r = await fetch('/api/settings/import-legacy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const j = await r.json();
    if (!j.ok) { toast('合并失败：' + (j.error || '')); return; }
    toast('已并入，旧文件改名为 ' + j.movedTo);
    setTimeout(() => location.reload(), 900);
  });

  async function save() {
    const log = $('log'); log.classList.add('on'); log.classList.remove('err'); log.textContent = '保存中…';
    const r = await fetch('/api/settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: collect() }),
    });
    const j = await r.json();
    if (!j.ok) { log.classList.add('err'); log.textContent = j.error || '保存失败'; toast('保存失败'); return; }
    dirty = false; $('state').textContent = '已保存 ' + new Date().toLocaleTimeString();
    log.textContent = (j.build && j.build.log) || '';
    toast('设置已生效');
  }
  $('save').addEventListener('click', save);
  $('save2').addEventListener('click', save);
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
  });
  syncLabels();
})();
</script>`,
  });
}
