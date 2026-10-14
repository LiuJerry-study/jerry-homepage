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
header.bar nav .nav-group{display:inline-flex;align-items:center;padding:0 6px;font-size:11px;font-weight:600;letter-spacing:.08em;color:var(--muted);opacity:.55;user-select:none}
header.bar nav .nav-sep{width:1px;align-self:stretch;margin:6px 6px;background:var(--border)}
header.bar nav a{padding:6px 12px;border-radius:999px;text-decoration:none;color:var(--muted);font-size:14px}
header.bar nav a:hover{background:var(--accent-soft);color:var(--accent-2)}
header.bar nav a.on{background:var(--accent-soft);color:var(--accent-2);font-weight:600}
header.bar .spacer{flex:1}
.title-row{display:flex;align-items:center;gap:12px;margin-bottom:6px}
.title-row h1{margin:0}
.title-row .sub{margin:0}
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
.editor{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,360px);gap:14px;align-items:stretch;height:min(680px,calc(100vh - 230px));min-height:480px}
.editor-compact textarea{height:100%;min-height:0;resize:none;font-family:var(--mono);font-size:13.5px;line-height:1.75}
.preview{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);
  padding:22px 26px;min-height:0;overflow:auto}
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
.preview-toggle{display:none}.preview-close{display:none}
@media(max-width:900px){.editor{grid-template-columns:1fr;height:min(680px,calc(100vh - 230px))}.preview-toggle{display:inline-flex}.editor .preview{display:none}.editor .preview.is-open{display:block;position:fixed;z-index:20;inset:72px 14px 14px;background:var(--surface);box-shadow:0 14px 40px rgba(0,0,0,.22)}.editor .preview-close{display:inline-flex}}
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
.cardrow{display:block;border:1px solid var(--border);border-radius:var(--r);background:var(--surface);margin-bottom:12px;overflow:hidden;transition:border-color .2s,box-shadow .2s}
.cardrow:hover{border-color:rgba(18,184,134,.4)}
.cardrow.open{border-color:var(--accent);box-shadow:0 8px 28px -20px rgba(18,184,134,.55)}
.card-head{display:flex;align-items:center;gap:12px;padding:12px 14px;cursor:pointer;user-select:none}
.card-head:hover{background:var(--accent-soft)}
.card-ico{width:36px;height:36px;border-radius:10px;background:var(--accent-soft);color:var(--accent-2);display:grid;place-items:center;flex:none}
.card-ico svg{width:18px;height:18px}
.card-main{flex:1;min-width:0}
.card-title{font-weight:600;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.card-desc{font-size:12px;color:var(--muted);display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.card-badge{flex:none;font-size:11px;padding:2px 9px;border-radius:999px;background:var(--surface-2);color:var(--muted);border:1px solid var(--border)}
.card-badge.live{background:var(--accent-soft);color:var(--accent-2);border-color:var(--accent)}
.card-badge.hidden{background:var(--surface-2);color:var(--muted);opacity:.6}
.card-switch{position:relative;display:inline-flex;align-items:center;gap:7px;margin:0;font-size:12px;color:var(--muted);flex:none;cursor:pointer}
.card-switch input{position:absolute;opacity:0;width:100%;height:100%;margin:0;cursor:pointer;z-index:1}
.card-switch .sw-track{width:34px;height:19px;border-radius:999px;background:var(--surface-2);border:1px solid var(--border);position:relative;display:inline-block;flex:none;transition:.18s}
.card-switch .sw-dot{position:absolute;top:2px;left:2px;width:13px;height:13px;border-radius:50%;background:var(--muted);transition:.18s}
.card-switch input:checked+.sw-track{background:var(--accent-soft);border-color:var(--accent)}
.card-switch input:checked+.sw-track .sw-dot{left:17px;background:var(--accent)}
.card-ops{display:flex;gap:2px;flex:none}
.card-ops .btn{padding:6px 9px;font-size:12px;background:transparent;border-color:transparent}
.card-ops .btn:hover{border-color:var(--accent);color:var(--accent-2);background:var(--surface)}
.card-ops .btn.danger:hover{border-color:var(--danger);color:var(--danger)}
.card-body{display:none;border-top:1px solid var(--line);padding:16px;gap:20px}
.cardrow.open .card-body{display:grid;grid-template-columns:minmax(0,1fr) 300px}
@media (max-width:1000px){ .cardrow.open .card-body{grid-template-columns:1fr} }
@media (max-width:760px){ .card-head{flex-wrap:wrap} .card-ops{width:100%;justify-content:flex-end;border-top:1px solid var(--line);padding-top:8px;margin-top:2px} }
.mini{display:flex;flex-direction:column;gap:10px}
.mini .half{display:flex;gap:10px;flex-wrap:wrap}
.mini .half>*{flex:1;min-width:130px}
.mini label{margin:10px 0 4px}
.mini label:first-child{margin-top:0}
.pv-wrap{align-self:start}
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

/* ===== 后台通用增强：折叠 / 登录氛围 / 列表工具 / 图库 / 历史 / 表单行 ===== */
.fold-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:14px;align-items:start}
@media (max-width:760px){ .fold-grid{grid-template-columns:1fr} }
details.fold{border:1px solid var(--border);border-radius:var(--r);background:var(--surface);margin:0 0 14px;overflow:hidden}
details.fold>summary{cursor:pointer;list-style:none;display:flex;align-items:center;gap:10px;padding:12px 16px;font-weight:600;border:0;user-select:none}
details.fold>summary::-webkit-details-marker{display:none}
details.fold>summary::after{content:'▾';margin-left:auto;opacity:.5;transition:transform .2s}
details.fold[open]>summary::after{transform:rotate(180deg)}
details.fold>summary:hover{background:var(--accent-soft)}
details.fold>summary .cnt{font-size:11.5px;color:var(--muted);font-weight:400;margin-left:6px}
details.fold>.fold-body{padding:16px 18px;border-top:1px solid var(--line)}
details.fold .card{border:0;border-radius:0;background:transparent;padding:0}

/* 登录页：站点同款氛围光斑 */
.login-wrap{position:relative;min-height:100vh;display:grid;place-items:center;overflow:hidden;
  background:radial-gradient(120% 78% at 50% -12%, rgba(18,184,134,.16), transparent 62%),
  radial-gradient(86% 58% at 102% -4%, rgba(78,216,168,.10), transparent 58%),
  linear-gradient(180deg,var(--bg),var(--bg-2))}
.login-wrap::before,.login-wrap::after{content:'';position:absolute;border-radius:50%;filter:blur(70px);opacity:.5;pointer-events:none}
.login-wrap::before{width:420px;height:420px;left:-8%;top:-12%;background:rgba(18,184,134,.30)}
.login-wrap::after{width:520px;height:520px;right:-10%;bottom:-16%;background:rgba(78,216,168,.22)}
.login-wrap form{z-index:1;position:relative;max-width:400px;width:92%;box-shadow:0 30px 60px -30px rgba(13,31,23,.35)}

/* 列表：搜索 + 状态 tab + 批量 */
.list-tools{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:0 0 14px}
.list-tools .grow{flex:1;min-width:180px}
.search{position:relative}
.search svg{position:absolute;left:11px;top:50%;transform:translateY(-50%);width:14px;height:14px;color:var(--muted);pointer-events:none}
.search input{padding-left:32px}
.tabbar{display:inline-flex;gap:2px;padding:3px;border:1px solid var(--border);border-radius:999px;background:var(--surface-2)}
.tabbar button{border:0;background:transparent;padding:6px 13px;border-radius:999px;color:var(--muted);font:inherit;font-size:13px;cursor:pointer}
.tabbar button.on{background:var(--surface);color:var(--accent-2);box-shadow:0 2px 8px -6px rgba(0,0,0,.4);font-weight:600}
td.chk,th.chk{width:36px}
tr.sel td{background:var(--accent-soft)}
.batchbar{display:none;align-items:center;gap:10px;margin:0 0 12px;padding:10px 14px;border:1px dashed var(--accent);border-radius:var(--r);background:var(--accent-soft)}
.batchbar.on{display:flex}

/* 图库 / 上传 */
.drop{border:2px dashed var(--border);border-radius:var(--r);padding:28px 18px;text-align:center;color:var(--muted);cursor:pointer;transition:.2s;background:var(--surface)}
.drop:hover,.drop.drag{border-color:var(--accent);background:var(--accent-soft);color:var(--accent-2)}
.drop input{display:none}
.img-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px;margin-top:16px}
.img-cell{border:1px solid var(--border);border-radius:var(--r);overflow:hidden;background:var(--surface);position:relative}
.img-cell img{width:100%;height:110px;object-fit:cover;display:block;background:var(--surface-2)}
.img-cell .meta{padding:8px 10px;font-size:11.5px;color:var(--muted);word-break:break-all}
.img-cell .acts{position:absolute;inset:auto 0 0 0;display:flex;gap:6px;padding:6px;background:linear-gradient(transparent,rgba(0,0,0,.55));opacity:0;transition:.2s}
.img-cell:hover .acts{opacity:1}
.img-cell .acts .btn{padding:3px 8px;font-size:11.5px;background:rgba(255,255,255,.92);border-color:transparent;color:#0D1F17}

/* 编辑器插图的选择浮层 */
.pick{position:fixed;inset:0;z-index:50;display:grid;place-items:center;background:rgba(0,0,0,.35)}
.pick-box{width:min(720px,92vw);max-height:78vh;overflow:auto;background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:18px}
.pick-head{display:flex;align-items:center;gap:12px;margin-bottom:12px}
.pick-head h3{margin:0;font-size:1.1rem}
.pick-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px}
.pick-grid button{border:1px solid var(--border);border-radius:10px;background:var(--bg);padding:8px;cursor:pointer;text-align:center}
.pick-grid button:hover{border-color:var(--accent)}
.pick-grid img{width:100%;height:76px;object-fit:cover;border-radius:6px;display:block}
.pick-grid span{display:block;margin-top:6px;font-size:11px;color:var(--muted);word-break:break-all}

/* 历史版本 */
.hist-list{list-style:none;margin:0;padding:0}
.hist-list li{display:flex;align-items:center;gap:12px;padding:10px 4px;border-bottom:1px solid var(--line);font-size:13.5px}
.hist-list li:last-child{border-bottom:0}
.hist-list .mono{font-size:12px;color:var(--muted)}

/* 编辑器 Markdown 工具栏 + 状态行 */
.mdbar{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}
.mdbar button{min-width:34px;height:32px;padding:0 9px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--ink-2);font:inherit;font-size:12.5px;cursor:pointer}
.mdbar button:hover{border-color:var(--accent);color:var(--accent-2)}
.editor-status{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;margin:8px 0 0;font-size:12px;color:var(--muted)}

/* 可视化表单行（简历 / 关于） */
.form-rows{display:flex;flex-direction:column;gap:12px}
.frow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:12px;border:1px solid var(--line);border-radius:10px;background:var(--surface)}
.frow .fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}
.frow input,.frow textarea{font-size:13px}
.frow .ops{display:flex;flex-direction:column;gap:4px}
.frow .ops .btn{padding:4px 8px;font-size:12px}
.mini-add{margin-top:10px}
.saved-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--ok);margin-right:6px}
/* ---------- 总览工作台 ---------- */
.workspace-grid{display:grid;gap:16px}
.stat-grid{grid-template-columns:repeat(4,minmax(0,1fr));margin:8px 0 16px}
.stat-card{display:flex;flex-direction:column;gap:4px}
.stat-card strong{font-size:1.8rem;line-height:1.2;letter-spacing:-.03em}
.stat-card small,.recent-row small,.health-row small{display:block;color:var(--muted);font-size:12px}
.dashboard-grid{grid-template-columns:minmax(0,1.2fr) minmax(280px,.8fr)}
.section-head{display:flex;align-items:center;gap:12px;margin-bottom:12px}
.section-head h2{font-size:1rem;margin:0}
.section-head a{margin-left:auto;font-size:12px}
.recent-list{display:grid}
.recent-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--line);text-decoration:none;color:var(--ink)}
.recent-icon{width:28px;height:28px;display:grid;place-items:center;border-radius:8px;background:var(--accent-soft);color:var(--accent-2)}
.recent-main{flex:1;min-width:0}.recent-main strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.health-list{display:grid;gap:12px}.health-row{display:flex;align-items:center;gap:9px}.health-row span:nth-child(2){flex:1;min-width:0}.health-row em{font-style:normal;font-size:11px;color:var(--muted)}
.list-footer{display:flex;align-items:center;gap:12px;padding:12px 2px}.pager{display:flex;gap:6px;margin-left:auto}.list-footer .btn{padding:5px 10px;font-size:12px}
.status-dot{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:12px;flex:none}.status-dot.ok{background:var(--ok-bg);color:var(--ok)}.status-dot.warn{background:var(--warn-bg);color:var(--warn)}.status-dot.error{background:rgba(180,69,59,.14);color:var(--danger)}
@media(max-width:900px){.stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.dashboard-grid{grid-template-columns:1fr}}
@media(max-width:600px){.stat-grid{grid-template-columns:1fr 1fr}.stat-card strong{font-size:1.45rem}}
`;

/** 后台整体骨架 */
export function layout({ title, body, active = '', user = true }) {
  const items = [
    ['dashboard', '总览', '/admin'],
    ['posts', '内容管理', '/admin/posts'],
    ['cards', '首页卡片', '/admin/cards'],
    ['images', '素材库', '/admin/images'],
    ['settings', '站点设置', '/admin/settings'],
  ];
  const nav = items.map(([k, label, href]) =>
    `<a href="${href}" class="${active === k ? 'on' : ''}">${label}</a>`
  ).join('');
  return `<!DOCTYPE html>
<html lang="zh-CN"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${h(title)} · 写作后台</title>
<style>${CSS}</style>
</head><body>
<header class="bar">
  <a class="brand" href="/admin"><span class="dot"></span>写作后台</a>
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

export function dashboardPage({ data }) {
  const counts = data?.counts || {};
  const recent = Array.isArray(data?.recent) ? data.recent : [];
  const health = Array.isArray(data?.health) ? data.health : [];
  const statusText = { ok: '正常', warn: '提醒', error: '异常' };
  return layout({
    title: '总览',
    active: 'dashboard',
    body: `<div class="wrap">
      <div class="title-row">
        <div><h1>总览</h1><p class="sub">${h(data?.site?.brand || '个人门户')} 的内容工作台</p></div>
        <span style="flex:1"></span>
        <a class="btn" href="/" target="_blank" rel="noopener">预览网站 ↗</a>
        <a class="btn primary" href="/admin/edit?kind=posts">+ 新建文章</a>
      </div>
      <div class="workspace-grid stat-grid">
        <div class="card stat-card"><span class="meta">已发布</span><strong>${h(counts.published ?? 0)}</strong><small>文章与作品</small></div>
        <div class="card stat-card"><span class="meta">草稿</span><strong>${h(counts.drafts ?? 0)}</strong><small>待完善内容</small></div>
        <div class="card stat-card"><span class="meta">首页入口</span><strong>${h(counts.cards ?? 0)}</strong><small>当前卡片数量</small></div>
        <div class="card stat-card"><span class="meta">最近构建</span><strong>${h(counts.build || '尚未构建')}</strong><small>保存后即时生效</small></div>
      </div>
      <div class="workspace-grid dashboard-grid">
        <section class="card"><div class="section-head"><h2>最近内容</h2><a href="/admin/posts">查看全部 →</a></div>
          ${recent.length ? `<div class="recent-list">${recent.map((item) => `<a class="recent-row" href="/admin/edit?kind=${encodeURIComponent(item.kind)}&slug=${encodeURIComponent(item.slug)}"><span class="recent-icon">${item.kind === 'projects' ? '◆' : '✎'}</span><span class="recent-main"><strong>${h(item.title || item.slug)}</strong><small>${item.kind === 'projects' ? '作品' : '文章'} · ${h(String(item.mtime || '').slice(0, 10))}</small></span><span class="pill ${item.draft ? 'draft' : 'live'}">${item.draft ? '草稿' : '已发布'}</span></a>`).join('')}</div>` : '<div class="empty">还没有内容。</div>'}
        </section>
        <section class="card"><div class="section-head"><h2>发布健康度</h2><a href="/admin/settings">设置 →</a></div>
          <div class="health-list">${health.map((item) => `<div class="health-row"><span class="status-dot ${h(item.status)}">${item.status === 'ok' ? '✓' : item.status === 'warn' ? '!' : '×'}</span><span><strong>${h(item.label)}</strong><small>${h(item.detail)}</small></span><em>${h(statusText[item.status] || item.status)}</em></div>`).join('')}</div>
        </section>
      </div>
    </div>`,
  });
}

export function loginPage({ error = '' } = {}) {
  return layout({
    title: '登录',
    user: false,
    body: `<div class="login-wrap">
    <form class="login card" method="post" action="/admin/login">
      <h1>写作后台</h1>
      <p class="sub">管理你的个人门户。公开站是一个只读进程在渲染 —— 这里存下的内容约 20ms 就会上线。</p>
      <label for="pw">密码</label>
      <input id="pw" name="password" type="password" autocomplete="current-password" autofocus required>
      ${error ? `<p class="err">${h(error)}</p>` : ''}
      <div class="toolbar"><button class="btn primary" type="submit">进入</button></div>
    </form>
    </div>`,
  });
}

export function listPage({ kind, label, items, stats = null }) {
  const newHref = `/admin/edit?kind=${encodeURIComponent(kind)}`;
  const colSpan = 6;
  const rows = items.length
    ? items.map((it) => `<tr data-slug="${h(it.slug)}" data-draft="${it.draft ? 1 : 0}" data-search="${h((it.title + ' ' + it.slug + ' ' + (it.tags || []).join(' ')).toLowerCase())}">
        <td class="chk"><input type="checkbox" class="row-chk" data-slug="${h(it.slug)}" aria-label="选择 ${h(it.title)}"></td>
        <td>
          <a href="/admin/edit?kind=${encodeURIComponent(kind)}&slug=${encodeURIComponent(it.slug)}"><strong>${h(it.title)}</strong></a>
          <div class="meta mono">${h(it.slug)}.md · ${h(it.mtime.slice(0, 10))}</div>
        </td>
        <td class="mono">${h(it.date || '—')}</td>
        <td>${it.draft ? '<span class="pill draft">草稿</span>' : '<span class="pill live">已发布</span>'}</td>
        <td class="meta">${(it.tags || []).map((t) => h(t)).join('、') || '—'}</td>
        <td style="text-align:right;white-space:nowrap">
          <a class="btn" href="/preview/${encodeURIComponent(kind)}/${encodeURIComponent(it.slug)}" target="_blank" rel="noopener">预览</a>
          <a class="btn" href="/admin/edit?kind=${encodeURIComponent(kind)}&slug=${encodeURIComponent(it.slug)}">编辑</a>
          <a class="btn" href="/admin/history?kind=${encodeURIComponent(kind)}&slug=${encodeURIComponent(it.slug)}">历史</a>
        </td>
      </tr>`).join('')
    : `<tr><td colspan="${colSpan}"><div class="empty">还没有${h(label)}。<code>content/${kind}/</code> 里放一个 .md 就会出现。</div></td></tr>`;

  return layout({
    title: label,
    active: kind,
    body: `<div class="wrap">
      <div class="title-row">
        <h1>${h(label)}</h1>
        <span style="flex:1"></span>
        <a class="btn primary" href="${newHref}">+ 写新${h(label === '文章' ? '文章' : '作品')}</a>
      </div>
      <p class="sub">共 ${items.length} 条${stats ? ` · ${h(stats)}` : ''}。改完点保存，会自动重新构建站点。</p>

      <div class="list-tools">
        <div class="search grow">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.6"/><path d="M20.2 20.2 15.8 15.8"/></svg>
          <input id="q" type="text" placeholder="搜标题 / 文件名 / 标签…">
        </div>
        <div class="tabbar" id="tabbar">
          <button type="button" data-tab="all" class="on">全部</button>
          <button type="button" data-tab="live">已发布</button>
          <button type="button" data-tab="draft">草稿</button>
        </div>
        <label class="compact-select">排序 <select id="sort"><option value="mtime">最近更新</option><option value="date">发布日期</option><option value="title">标题</option></select></label>
        <label class="compact-select">每页 <select id="page-size"><option>10</option><option>20</option><option>50</option></select></label>
        <a class="btn" href="/admin/${encodeURIComponent(kind)}?view=trash">回收站</a>
      </div>

      <div class="batchbar" id="batchbar">
        <span class="meta" id="batch-count">已选 0 项</span>
        <span style="flex:1"></span>
        <button class="btn" id="batch-publish" type="button">发布</button>
        <button class="btn" id="batch-unpublish" type="button">转草稿</button>
        <button class="btn danger" id="batch-delete" type="button">删除</button>
      </div>

      <div class="card" style="padding:0">
        <table id="tbl"><thead><tr>
          <th class="chk"><input type="checkbox" id="chk-all" aria-label="全选"></th>
          <th>标题</th><th>日期</th><th>状态</th><th>标签</th><th></th>
        </tr></thead>
        <tbody>${rows}</tbody></table>
       <div class="list-footer"><span class="meta" id="page-status"></span><span class="pager"><button class="btn" id="prev-page" type="button">上一页</button><button class="btn" id="next-page" type="button">下一页</button></span></div>
      </div>
    </div>
<script>
(function () {
  const kind = ${JSON.stringify(kind)};
  const q = document.getElementById('q');
  const tabbar = document.getElementById('tabbar');
  const sort = document.getElementById('sort');
  const pageSize = document.getElementById('page-size');
  const pageStatus = document.getElementById('page-status');
  const prevPage = document.getElementById('prev-page');
  const nextPage = document.getElementById('next-page');
  const tbl = document.getElementById('tbl');
  const batchbar = document.getElementById('batchbar');
  const countEl = document.getElementById('batch-count');
  const rows = () => [...tbl.querySelectorAll('tbody tr[data-slug]')];
  let page = 1;

  function apply() {
    const kw = q.value.trim().toLowerCase();
    const tab = (tabbar.querySelector('.on') || {}).dataset && tabbar.querySelector('.on').dataset.tab;
    const filtered = rows().filter((tr) => {
      const hitKw = !kw || (tr.dataset.search || '').includes(kw);
      return hitKw && (!tab || tab === 'all' || (tab === 'draft' ? tr.dataset.draft === '1' : tr.dataset.draft === '0'));
    });
    const mode = sort.value;
    filtered.sort((a, b) => {
      const av = mode === 'title' ? a.dataset.search : mode === 'date' ? (a.querySelector('td:nth-child(3)')?.textContent || '') : (a.querySelector('.meta')?.textContent || '');
      const bv = mode === 'title' ? b.dataset.search : mode === 'date' ? (b.querySelector('td:nth-child(3)')?.textContent || '') : (b.querySelector('.meta')?.textContent || '');
      return String(bv).localeCompare(String(av), 'zh');
    });
    const size = Number(pageSize.value) || 10;
    const pages = Math.max(1, Math.ceil(filtered.length / size));
    page = Math.min(page, pages);
    const start = (page - 1) * size;
    const visible = new Set(filtered.slice(start, start + size));
    rows().forEach((tr) => { tr.hidden = !visible.has(tr); });
    pageStatus.textContent = filtered.length ? '显示 ' + (start + 1) + '-' + Math.min(start + size, filtered.length) + ' / ' + filtered.length : '没有匹配内容';
    prevPage.disabled = page <= 1;
    nextPage.disabled = page >= pages;
    sync();
  }
  q.addEventListener('input', () => { page = 1; apply(); });
  sort.addEventListener('change', () => { page = 1; apply(); });
  pageSize.addEventListener('change', () => { page = 1; apply(); });
  prevPage.addEventListener('click', () => { page -= 1; apply(); });
  nextPage.addEventListener('click', () => { page += 1; apply(); });
  tabbar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    tabbar.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    apply();
  });

  page = 1;
  apply();

  function selected() {
    return rows().filter((tr) => !tr.hidden && tr.querySelector('.row-chk').checked).map((tr) => tr.dataset.slug);
  }
  function sync() {
    const sel = selected();
    const n = sel.length;
    batchbar.classList.toggle('on', n > 0);
    countEl.textContent = '已选 ' + n + ' 项';
    rows().forEach((tr) => tr.classList.toggle('sel', !tr.hidden && tr.querySelector('.row-chk').checked));
  }
  tbl.addEventListener('change', (e) => {
    if (e.target.classList.contains('row-chk')) {
      if (!e.target.checked) { const all = document.getElementById('chk-all'); if (all) all.checked = false; }
      sync();
    }
    if (e.target.id === 'chk-all') {
      rows().forEach((tr) => { if (!tr.hidden) tr.querySelector('.row-chk').checked = e.target.checked; });
      sync();
    }
  });

  async function batch(action) {
    const slugs = selected();
    if (!slugs.length) { toast('先勾选要处理的内容'); return; }
    const verb = action === 'publish' ? '发布' : action === 'unpublish' ? '转为草稿' : '删除';
    if (action === 'delete' && !confirm('确定将选中的 ' + slugs.length + ' 项移入回收站？系统会先创建快照。')) return;
    const r = await fetch('/api/batch', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, action, slugs }),
    });
    const j = await r.json();
    if (!j.ok) { toast('批量' + verb + '失败：' + (j.error || '')); return; }
    toast('已' + verb + ' ' + (j.done || []).length + ' 项');
    setTimeout(() => location.reload(), 500);
  }
  document.getElementById('batch-publish').addEventListener('click', () => batch('publish'));
  document.getElementById('batch-unpublish').addEventListener('click', () => batch('unpublish'));
  document.getElementById('batch-delete').addEventListener('click', () => batch('delete'));
})();
</script>`,
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
      <div class="title-row">
        <h1>${exists ? '编辑' : '新建'}${isProject ? '作品' : '文章'}</h1>
        <span style="flex:1"></span>
        ${exists ? `<a class="btn" href="/admin/history?kind=${encodeURIComponent(kind)}&slug=${encodeURIComponent(slug)}">历史版本</a>` : ''}
      </div>
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

      <div class="mdbar" id="mdbar" aria-label="Markdown 快捷插入">
        <button type="button" data-md="h2" title="二级标题">H2</button>
        <button type="button" data-md="h3" title="三级标题">H3</button>
        <span class="sp"></span>
        <button type="button" data-md="bold" title="粗体">B</button>
        <button type="button" data-md="italic" title="斜体">I</button>
        <button type="button" data-md="code" title="行内代码">code</button>
        <button type="button" data-md="pre" title="代码块">pre</button>
        <span class="sp"></span>
        <button type="button" data-md="link" title="链接">链接</button>
        <button type="button" data-md="img" title="插图（弹图库）">图片</button>
        <button type="button" data-md="quote" title="引用">引用</button>
        <button type="button" data-md="ul" title="无序列表">• 列表</button>
        <button type="button" data-md="ol" title="有序列表">1. 列表</button>
        <button type="button" data-md="hr" title="分隔线">—</button>
        <span style="flex:1"></span>
        <button class="btn" type="button" id="open-pick" title="从图库选图插入">图库 ↗</button>
      </div>
      <div class="editor-status">
        <span id="wc">0 字 · 约 0 分钟</span>
        <span id="draft-state">未启用本地草稿</span>
      </div>

      <div class="toolbar editor-actions"><button class="btn preview-toggle" type="button" data-preview-toggle>打开实时预览</button></div>
       <div class="editor editor-compact">
        <textarea id="f-body" spellcheck="false" placeholder="在这里写正文…">${h(body || '')}</textarea>
        <div class="preview" data-preview-panel><button class="btn preview-close" type="button" data-preview-close>关闭预览</button><div class="prose" id="pv"></div></div>
      </div>

      <pre class="log" id="log"></pre>

      <div class="pick" id="pick" hidden>
        <div class="pick-box">
          <div class="pick-head"><h3>从图库插入图片</h3><span style="flex:1"></span><button class="btn" id="pick-close" type="button">关闭</button></div>
          <p class="meta">点一张图，以 <span class="mono">![alt](images/文件名)</span> 插入到光标处；也可以 <a href="/admin/images" target="_blank" rel="noopener">去图片库上传 ↗</a></p>
          <div class="pick-grid" id="pick-grid"></div>
        </div>
      </div>
    </div>

<script>
(function () {
  const $ = (id) => document.getElementById(id);
  const kind = ${JSON.stringify(kind)};
  const slugInput = $('f-slug');
  let dirty = false, timer = 0, lastHtml = '';
  const bodyEl = $('f-body');
  const previewPanel = document.querySelector('[data-preview-panel]');
  const previewToggle = document.querySelector('[data-preview-toggle]');
  const previewClose = document.querySelector('[data-preview-close]');
  if (previewToggle && previewPanel) previewToggle.addEventListener('click', () => previewPanel.classList.add('is-open'));
  if (previewClose && previewPanel) previewClose.addEventListener('click', () => previewPanel.classList.remove('is-open'));

  /* ---------- Markdown 快捷插入 ---------- */
  const MD = {
    h2: ['## ', ''],
    h3: ['### ', ''],
    bold: ['**', '**'],
    italic: ['*', '*'],
    code: ['\`', '\`'],
    pre: ['\\n\`\`\`\\n', '\\n\`\`\`\\n'],
    link: ['[', '](https://)'],
    quote: ['\\n> ', ''],
    ul: ['\\n- ', ''],
    ol: ['\\n1. ', ''],
    hr: ['\\n\\n---\\n\\n', ''],
    img: ['![', '](images/)'],
  };
  function insertMd(name) {
    const el = bodyEl;
    const s = el.selectionStart, e = el.selectionEnd;
    const sel = el.value.slice(s, e);
    const wrap = MD[name] || ['', ''];
    const wrapped = wrap[0] + sel + wrap[1];
    el.value = el.value.slice(0, s) + wrapped + el.value.slice(e);
    el.selectionStart = s + wrap[0].length;
    el.selectionEnd = s + wrap[0].length + sel.length;
    el.focus();
    schedule();
  }
  function insertText(txt) {
    const el = bodyEl;
    const s = el.selectionStart, e = el.selectionEnd;
    el.value = el.value.slice(0, s) + txt + el.value.slice(e);
    el.selectionStart = el.selectionEnd = s + txt.length;
    el.focus();
    schedule();
  }
  const escHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function initMdbar() {
    const bar = $('mdbar');
    if (!bar) return;
    bar.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-md]');
      if (!b) return;
      if (b.dataset.md === 'img') { openPick(); return; }
      insertMd(b.dataset.md);
    });
    const op = $('open-pick');
    if (op) op.addEventListener('click', openPick);
  }

  /* ---------- 字数 / 阅读时长 ---------- */
  function wc() {
    const t = bodyEl.value || '';
    const zh = (t.match(/[\u4e00-\u9fff]/g) || []).length;
    const words = (t.match(/[A-Za-z0-9]+/g) || []).length;
    const total = zh + words;
    const min = Math.max(1, Math.round(total / 350));
    $('wc').textContent = total + ' 字 · 约 ' + min + ' 分钟';
  }
  function initWc() { bodyEl.addEventListener('input', wc); wc(); }

  /* ---------- 本地草稿（sessionStorage，意外关页可恢复） ---------- */
  const DRAFT_KEY = 'ps-draft-' + kind + '-' + (slugInput.value || 'new');
  function collectDraft() {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
        body: bodyEl.value,
        title: $('f-title').value,
        date: $('f-date').value,
        at: Date.now(),
      }));
      $('draft-state').textContent = '草稿已自动保存 ' + new Date().toLocaleTimeString();
    } catch (e) { /* 隐私模式 */ }
  }
  function clearDraft() {
    try { sessionStorage.removeItem(DRAFT_KEY); } catch (e) { /* 忽略 */ }
    $('draft-state').textContent = '草稿已清除';
  }
  function initDraft() {
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null'); } catch (e) { saved = null; }
    if (saved && saved.body && saved.body !== bodyEl.value && !dirty && !lastHtml) {
      if (confirm('发现一份未发布的本地草稿（' + new Date(saved.at).toLocaleString() + '），要恢复吗？')) {
        bodyEl.value = saved.body;
        $('f-title').value = saved.title || '';
        $('f-date').value = saved.date || '';
        schedule();
      } else {
        try { sessionStorage.removeItem(DRAFT_KEY); } catch (e) { /* 忽略 */ }
      }
    }
    setInterval(() => { if (dirty) collectDraft(); }, 60000);
    window.addEventListener('beforeunload', () => { if (dirty) collectDraft(); });
  }

  /* ---------- 图库选择浮层 ---------- */
  async function openPick() {
    const pick = $('pick');
    if (!pick) return;
    pick.hidden = false;
    const grid = $('pick-grid');
    grid.innerHTML = '<p class="meta">加载中…</p>';
    try {
      const r = await fetch('/api/images');
      const j = await r.json();
      const items = (j.items || []).slice(0, 60);
      if (!items.length) { grid.innerHTML = '<p class="empty">图库还是空的。<a href="/admin/images" target="_blank" rel="noopener">去上传第一张 ↗</a></p>'; return; }
      grid.innerHTML = items.map((im) =>
        '<button type="button" data-name="' + escHtml(im.name) + '" title="' + escHtml(im.name) + '">'
        + '<img src="' + escHtml(im.url) + '" alt="" loading="lazy">'
        + '<span>' + escHtml(im.name) + '</span></button>'
      ).join('');
    } catch (e) { grid.innerHTML = '<p class="err">图库加载失败：' + escHtml(String(e.message || e)) + '</p>'; }
  }
  function initPick() {
    const pick = $('pick');
    if (!pick) return;
    $('pick-close').addEventListener('click', () => { pick.hidden = true; });
    pick.addEventListener('click', (ev) => {
      if (ev.target === pick) { pick.hidden = true; return; }
      const b = ev.target.closest('[data-name]');
      if (!b) return;
      const name = b.dataset.name;
      const alt = String(name).replace(/\.[^.]+$/, '');
      insertText('![' + alt + '](images/' + name + ')');
      pick.hidden = true;
    });
  }

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
      clearDraft();
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
  initMdbar(); initWc(); initDraft(); initPick();

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

/** 可视化表单用的行模板（skill / timeline 共用） */
function itemFields(it, sec, idx, tag) {
  if (sec.type === 'skill') {
    return `<div class="fields">
        <input type="text" data-f="name" value="${h(it.name || '')}" placeholder="技能名">
        <input type="text" data-f="level" value="${h(it.level || '')}" placeholder="熟练度，如：熟练">
      </div>`;
  }
  return `<div class="fields">
      <input type="text" data-f="role" value="${h(it.role || '')}" placeholder="角色 / 职位">
      <input type="text" data-f="company" value="${h(it.company || '')}" placeholder="公司 / 学校">
      <input type="text" data-f="period" value="${h(it.period || '')}" placeholder="2024 — 至今">
    </div>
    <textarea data-f="description" placeholder="做了什么（可选）">${h(it.description || '')}</textarea>`;
}

/** 一个分区（技能栈 / 经历 / 教育背景 …）的可视化表单卡 */
function sectionCard(sec, idx) {
  const items = Array.isArray(sec.items) ? sec.items : [];
  const rows = items.length
    ? items.map((it, i) => `<div class="frow item" data-idx="${i}">
        ${itemFields(it, sec, i, 'item')}
        <div class="ops"><button class="btn" type="button" data-act="up" title="上移">↑</button>
        <button class="btn" type="button" data-act="down" title="下移">↓</button>
        <button class="btn danger" type="button" data-act="del" title="删除这一条">×</button></div>
      </div>`).join('')
    : '<p class="meta" style="grid-column:1/-1">还没有条目，点下面「+ 添加一条」。</p>';
  return `<div class="frow sec" data-idx="${idx}">
    <div class="fields">
      <select data-f="type">
        <option value="skill"${sec.type === 'skill' ? ' selected' : ''}>技能胶囊</option>
        <option value="timeline"${sec.type !== 'skill' ? ' selected' : ''}>经历 / 时间线</option>
      </select>
      <input type="text" data-f="title" value="${h(sec.title || '')}" placeholder="分区标题，如：技能栈">
      <input type="text" data-f="en" value="${h(sec.en || '')}" placeholder="英文标题，如：Skills">
    </div>
    <div class="ops">
      <button class="btn" type="button" data-act="up" title="分区上移">↑</button>
      <button class="btn" type="button" data-act="down" title="分区下移">↓</button>
      <button class="btn" type="button" data-act="add-item" title="加一条">＋条目</button>
      <button class="btn danger" type="button" data-act="del-sec" title="删除整个分区">×</button>
    </div>
    <div class="form-rows items" style="grid-column:1/-1;margin-top:6px">${rows}</div>
  </div>`;
}

/** 简历：可视化表单（高级模式：折叠原始 JSON） */
export function resumePage({ data = {}, raw = '', lastBuild }) {
  const sections = Array.isArray(data.sections) ? data.sections : [];
  return layout({
    title: '简历',
    active: 'resume',
    body: `<div class="wrap">
      <h1>简历</h1>
      <p class="sub">内容来自 <span class="mono">content/resume.json</span>。在下面填表，保存后 <span class="mono">resume.html</span> 立刻生效。${lastBuild ? ` 上次操作：${h(lastBuild)}` : ''}</p>
      <div class="toolbar">
        <button class="btn primary" id="save">保存并生效</button>
        <a class="btn" href="/resume.html" target="_blank" rel="noopener">看效果 ↗</a>
        <span class="meta" id="state">未修改</span>
      </div>

      <details class="fold" open>
        <summary>自我介绍 <span class="cnt">intro</span></summary>
        <div class="fold-body">
          <label for="f-intro">介绍（一段话）</label>
          <textarea id="f-intro" spellcheck="false" style="min-height:120px">${h(data.intro || '')}</textarea>
        </div>
      </details>

      <details class="fold" open>
        <summary>分区（技能栈 / 经历 / 教育背景） <span class="cnt">sections · ${sections.length}</span></summary>
        <div class="fold-body">
          <div class="form-rows" id="secs">${sections.map((s, i) => sectionCard(s, i)).join('') || '<p class="empty">还没有分区。点下面「+ 添加分区」开始。</p>'}</div>
          <div class="toolbar mini-add"><button class="btn" id="add-sec" type="button">+ 添加分区</button></div>
        </div>
      </details>

      <details class="fold">
        <summary>原始 JSON（高级） <span class="cnt">可直接粘贴，保存时以表单为准</span></summary>
        <div class="fold-body">
          <textarea id="f-raw" spellcheck="false" style="min-height:40vh;font-family:var(--mono);font-size:13px">${h(raw || '')}</textarea>
          <p class="meta">这个框只用来查看 / 复制 / 对照。保存按钮提交的是上面表单的内容。</p>
        </div>
      </details>

      <pre class="log" id="log"></pre>
    </div>
<script>
(function () {
  const $ = (id) => document.getElementById(id);
  const secs = $('secs');
  let dirty = false;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

  function itemHtml(type, it) {
    const f = (k) => esc((it || {})[k] || '');
    const ops = '<div class="ops"><button class="btn" type="button" data-act="up" title="上移">↑</button><button class="btn" type="button" data-act="down" title="下移">↓</button><button class="btn danger" type="button" data-act="del" title="删除">×</button></div>';
    if (type === 'skill') {
      return '<div class="frow item">' + '<div class="fields"><input type="text" data-f="name" value="' + f('name') + '" placeholder="技能名"><input type="text" data-f="level" value="' + f('level') + '" placeholder="熟练度"></div>' + ops + '</div>';
    }
    return '<div class="frow item">' + '<div class="fields"><input type="text" data-f="role" value="' + f('role') + '" placeholder="角色"><input type="text" data-f="company" value="' + f('company') + '" placeholder="公司 / 学校"><input type="text" data-f="period" value="' + f('period') + '" placeholder="2024 — 至今"></div><textarea data-f="description" placeholder="做了什么（可选）">' + f('description') + '</textarea>' + ops + '</div>';
  }
  function secHtml(type, sec) {
    const f = (k) => esc((sec || {})[k] || '');
    const items = (sec && Array.isArray(sec.items) ? sec.items : []);
    const rows = items.map((it) => itemHtml(type, it)).join('') || '<p class="meta" style="grid-column:1/-1">还没有条目。</p>';
    return '<div class="frow sec">' + '<div class="fields"><select data-f="type"><option value="skill"' + (type === 'skill' ? ' selected' : '') + '>技能胶囊</option><option value="timeline"' + (type !== 'skill' ? ' selected' : '') + '>经历 / 时间线</option></select>'
      + '<input type="text" data-f="title" value="' + f('title') + '" placeholder="分区标题"><input type="text" data-f="en" value="' + f('en') + '" placeholder="英文标题"></div>'
      + '<div class="ops"><button class="btn" type="button" data-act="up">↑</button><button class="btn" type="button" data-act="down">↓</button><button class="btn" type="button" data-act="add-item">＋条目</button><button class="btn danger" type="button" data-act="del-sec">×</button></div>'
      + '<div class="form-rows items" style="grid-column:1/-1;margin-top:6px">' + rows + '</div></div>';
  }

  function mark() { dirty = true; $('state').textContent = '有未保存的改动'; }
  secs.addEventListener('input', mark);
  secs.addEventListener('change', (e) => {
    const t = e.target.closest('select[data-f="type"]');
    if (!t) return;
    const sec = t.closest('.sec');
    const items = [...sec.querySelectorAll('.item')];
    items.forEach((row) => {
      const type = t.value;
      const it = {};
      row.querySelectorAll('[data-f]').forEach((n) => { it[n.dataset.f] = n.value; });
      const nn = document.createElement('div');
      nn.innerHTML = itemHtml(type, it);
      const fresh = nn.firstElementChild;
      row.replaceWith(fresh);
    });
    mark();
  });
  secs.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'del') { b.closest('.item').remove(); mark(); return; }
    if (act === 'add-item') {
      const sec = b.closest('.sec');
      const type = sec.querySelector('select[data-f="type"]').value;
      sec.querySelector('.items').insertAdjacentHTML('beforeend', itemHtml(type, {}));
      mark(); return;
    }
    if (act === 'del-sec') { if (confirm('删除整个分区？')) { b.closest('.sec').remove(); mark(); } return; }
    const row = b.closest('.item, .sec');
    if (!row) return;
    const p = row.parentElement;
    const i = [...p.children].indexOf(row);
    if (act === 'up' && i > 0) p.insertBefore(row, p.children[i - 1]);
    else if (act === 'down') p.insertBefore(row, p.children[i + 1] || null);
    mark();
  });
  $('add-sec').addEventListener('click', () => {
    secs.insertAdjacentHTML('beforeend', secHtml('skill', {}));
    mark();
  });

  function collect() {
    const sections = [...secs.querySelectorAll('.sec')].map((sec) => {
      const type = sec.querySelector('select[data-f="type"]').value;
      const title = sec.querySelector('[data-f="title"]').value.trim();
      const en = sec.querySelector('[data-f="en"]').value.trim();
      const items = [...sec.querySelectorAll('.item')].map((row) => {
        const o = {};
        row.querySelectorAll('[data-f]').forEach((n) => { o[n.dataset.f] = n.value.trim(); });
        return o;
      }).filter((o) => Object.values(o).some((v) => v));
      return { type, title, en, items };
    }).filter((s) => s.title || s.items.length);
    return { intro: $('f-intro').value.trim(), sections };
  }

  $('save').addEventListener('click', async () => {
    const log = $('log'); log.classList.add('on'); log.classList.remove('err'); log.textContent = '保存中…';
    const r = await fetch('/api/resume', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: JSON.stringify(collect(), null, 2) }),
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
  window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
})();
</script>`,
  });
}

/** 关于：可视化表单（统计数字 + 社交链接 + 可选分区；技能胶囊默认沿用简历） */
export function aboutPage({ data = {}, raw = '', lastBuild }) {
  const stats = Array.isArray(data.stats) ? data.stats : [];
  const links = Array.isArray(data.links) ? data.links : [];
  const sections = Array.isArray(data.sections) ? data.sections : [];
  const statRow = (s, i) => `<div class="frow item">
      <div class="fields">
        <input type="text" data-f="value" value="${h(s.value || '')}" placeholder="数字，如：3">
        <input type="text" data-f="label" value="${h(s.label || '')}" placeholder="说明，如：篇文章">
      </div>
      <div class="ops"><button class="btn danger" type="button" data-act="del" title="删除">×</button></div>
    </div>`;
  const linkRow = (l, i) => `<div class="frow item">
      <div class="fields">
        <input type="text" data-f="label" value="${h(l.label || '')}" placeholder="文案，如：GitHub">
        <input type="text" data-f="href" value="${h(l.href || '')}" placeholder="https://… 或 mailto:…">
      </div>
      <div class="ops"><button class="btn danger" type="button" data-act="del" title="删除">×</button></div>
    </div>`;
  return layout({
    title: '关于',
    active: 'about',
    body: `<div class="wrap">
      <h1>关于</h1>
      <p class="sub">内容来自 <span class="mono">content/about.json</span>，保存后 <span class="mono">about.html</span> 立刻生效。技能胶囊默认沿用简历那份；想单独写就在「分区」里加。${lastBuild ? ` 上次操作：${h(lastBuild)}` : ''}</p>
      <div class="toolbar">
        <button class="btn primary" id="save">保存并生效</button>
        <a class="btn" href="/about.html" target="_blank" rel="noopener">看效果 ↗</a>
        <span class="meta" id="state">未修改</span>
      </div>

      <details class="fold" open>
        <summary>基本信息</summary>
        <div class="fold-body">
          <label for="f-title">标题</label>
          <input id="f-title" type="text" value="${h(data.title || '关于我')}" style="max-width:360px">
          <label for="f-intro">介绍（一段话）</label>
          <textarea id="f-intro" spellcheck="false" style="min-height:120px">${h(data.intro || '')}</textarea>
        </div>
      </details>

      <details class="fold" open>
        <summary>数字卡 <span class="cnt">stats · ${stats.length}</span></summary>
        <div class="fold-body">
          <div class="form-rows" id="stats">${stats.map(statRow).join('') || '<p class="empty">还没有统计数字。</p>'}</div>
          <div class="toolbar mini-add"><button class="btn" id="add-stat" type="button">+ 加一个数字</button></div>
        </div>
      </details>

      <details class="fold" open>
        <summary>社交链接 <span class="cnt">links · ${links.length}</span></summary>
        <div class="fold-body">
          <div class="form-rows" id="links">${links.map(linkRow).join('') || '<p class="empty">还没有社交链接。</p>'}</div>
          <div class="toolbar mini-add"><button class="btn" id="add-link" type="button">+ 加一个链接</button></div>
        </div>
      </details>

      <details class="fold">
        <summary>分区（可选，单独给关于页写技能/经历） <span class="cnt">sections · ${sections.length}</span></summary>
        <div class="fold-body">
          <div class="form-rows" id="secs">${sections.map((s, i) => sectionCard(s, i)).join('') || '<p class="empty">没有单独分区，技能胶囊会沿用简历里的。</p>'}</div>
          <div class="toolbar mini-add"><button class="btn" id="add-sec" type="button">+ 添加分区</button></div>
        </div>
      </details>

      <details class="fold">
        <summary>原始 JSON（高级） <span class="cnt">可直接粘贴，保存时以表单为准</span></summary>
        <div class="fold-body">
          <textarea id="f-raw" spellcheck="false" style="min-height:40vh;font-family:var(--mono);font-size:13px">${h(raw || '')}</textarea>
          <p class="meta">这个框只用来查看 / 复制 / 对照。保存按钮提交的是上面表单的内容。</p>
        </div>
      </details>

      <pre class="log" id="log"></pre>
    </div>
<script>
(function () {
  const $ = (id) => document.getElementById(id);
  let dirty = false;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const stats = $('stats'), links = $('links'), secs = $('secs');

  function itemHtml(kind, it) {
    if (kind === 'stat') return '<div class="frow item"><div class="fields"><input type="text" data-f="value" value="' + esc(it.value || '') + '" placeholder="数字"><input type="text" data-f="label" value="' + esc(it.label || '') + '" placeholder="说明"></div><div class="ops"><button class="btn danger" type="button" data-act="del">×</button></div></div>';
    if (kind === 'link') return '<div class="frow item"><div class="fields"><input type="text" data-f="label" value="' + esc(it.label || '') + '" placeholder="文案"><input type="text" data-f="href" value="' + esc(it.href || '') + '" placeholder="https://…"></div><div class="ops"><button class="btn danger" type="button" data-act="del">×</button></div></div>';
    const f = (k) => esc((it || {})[k] || '');
    const type = kind === 'timeline' ? 'timeline' : 'skill';
    const ops = '<div class="ops"><button class="btn" type="button" data-act="up">↑</button><button class="btn" type="button" data-act="down">↓</button><button class="btn" type="button" data-act="add-item">＋条目</button><button class="btn danger" type="button" data-act="del-sec">×</button></div>';
    if (type === 'skill') return '<div class="frow sec"><div class="fields"><select data-f="type"><option value="skill" selected>技能胶囊</option><option value="timeline">经历 / 时间线</option></select><input type="text" data-f="title" value="' + f('title') + '" placeholder="分区标题"><input type="text" data-f="en" value="' + f('en') + '" placeholder="英文标题"></div>' + ops + '<div class="form-rows items" style="grid-column:1/-1;margin-top:6px">' + ((it.items || []).map((x) => itemHtml('skill-item', x)).join('') || '<p class="meta" style="grid-column:1/-1">还没有条目。</p>') + '</div></div>';
    return '<div class="frow sec"><div class="fields"><select data-f="type"><option value="skill">技能胶囊</option><option value="timeline" selected>经历 / 时间线</option></select><input type="text" data-f="title" value="' + f('title') + '" placeholder="分区标题"><input type="text" data-f="en" value="' + f('en') + '" placeholder="英文标题"></div>' + ops + '<div class="form-rows items" style="grid-column:1/-1;margin-top:6px">' + ((it.items || []).map((x) => itemHtml('timeline-item', x)).join('') || '<p class="meta" style="grid-column:1/-1">还没有条目。</p>') + '</div></div>';
  }
  function itemHtml2(type, it) {
    const f = (k) => esc((it || {})[k] || '');
    const ops = '<div class="ops"><button class="btn" type="button" data-act="up">↑</button><button class="btn" type="button" data-act="down">↓</button><button class="btn danger" type="button" data-act="del">×</button></div>';
    if (type === 'skill-item') return '<div class="frow item"><div class="fields"><input type="text" data-f="name" value="' + f('name') + '" placeholder="技能名"><input type="text" data-f="level" value="' + f('level') + '" placeholder="熟练度"></div>' + ops + '</div>';
    return '<div class="frow item"><div class="fields"><input type="text" data-f="role" value="' + f('role') + '" placeholder="角色"><input type="text" data-f="company" value="' + f('company') + '" placeholder="公司 / 学校"><input type="text" data-f="period" value="' + f('period') + '" placeholder="2024 — 至今"></div><textarea data-f="description" placeholder="做了什么（可选）">' + f('description') + '</textarea>' + ops + '</div>';
  }
  function mark() { dirty = true; $('state').textContent = '有未保存的改动'; }
  [stats, links, secs].forEach((root) => root.addEventListener('input', mark));
  [stats, links, secs].forEach((root) => root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (root === stats || root === links) {
      if (act === 'del') { b.closest('.item').remove(); mark(); }
      return;
    }
    if (act === 'del') { b.closest('.item').remove(); mark(); return; }
    if (act === 'add-item') {
      const sec = b.closest('.sec');
      const type = sec.querySelector('select[data-f="type"]').value;
      sec.querySelector('.items').insertAdjacentHTML('beforeend', itemHtml2(type + '-item', {}));
      mark(); return;
    }
    if (act === 'del-sec') { if (confirm('删除整个分区？')) { b.closest('.sec').remove(); mark(); } return; }
    const row = b.closest('.item, .sec');
    if (!row) return;
    const p = row.parentElement;
    const i = [...p.children].indexOf(row);
    if (act === 'up' && i > 0) p.insertBefore(row, p.children[i - 1]);
    else if (act === 'down') p.insertBefore(row, p.children[i + 1] || null);
    mark();
  }));
  secs.addEventListener('change', (e) => {
    const t = e.target.closest('select[data-f="type"]');
    if (!t) return;
    const sec = t.closest('.sec');
    const it = {};
    [...sec.querySelectorAll('.item [data-f]')].forEach((n) => { it[n.dataset.f] = n.value; });
    const nn = document.createElement('div');
    nn.innerHTML = itemHtml(t.value, { title: sec.querySelector('[data-f="title"]').value, en: sec.querySelector('[data-f="en"]').value, items: it.items || [] });
    const fresh = nn.firstElementChild;
    sec.replaceWith(fresh);
    mark();
  });
  $('add-stat').addEventListener('click', () => { stats.insertAdjacentHTML('beforeend', itemHtml('stat', {})); mark(); });
  $('add-link').addEventListener('click', () => { links.insertAdjacentHTML('beforeend', itemHtml('link', {})); mark(); });
  $('add-sec').addEventListener('click', () => { secs.insertAdjacentHTML('beforeend', itemHtml('skill', {})); mark(); });

  function collect() {
    const read = (root) => [...root.querySelectorAll('.item')].map((row) => {
      const o = {};
      row.querySelectorAll('[data-f]').forEach((n) => { o[n.dataset.f] = n.value.trim(); });
      return o;
    }).filter((o) => Object.values(o).some((v) => v));
    const sections = [...secs.querySelectorAll('.sec')].map((sec) => {
      const type = sec.querySelector('select[data-f="type"]').value;
      return { type, title: sec.querySelector('[data-f="title"]').value.trim(), en: sec.querySelector('[data-f="en"]').value.trim(), items: read(sec.querySelector('.items')) };
    }).filter((s) => s.title || s.items.length);
    return { title: $('f-title').value.trim(), intro: $('f-intro').value.trim(), stats: read(stats), links: read(links), sections };
  }

  $('save').addEventListener('click', async () => {
    const log = $('log'); log.classList.add('on'); log.classList.remove('err'); log.textContent = '保存中…';
    const r = await fetch('/api/about', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: JSON.stringify(collect(), null, 2) }),
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
  window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
})();
</script>`,
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
  const row = (c, i) => `<div class="cardrow" data-i="${i}" data-card-index="${i}">
    <div class="card-head" data-act="toggle" title="点击展开 / 收起编辑">
      <span class="card-ico">${svg(c.icon || 'grid')}</span>
      <span class="card-main">
        <span class="card-title">${h(c.title || '（未命名卡片）')}</span>
        <span class="card-desc">${h(c.desc || (c.href ? c.href : '点击展开编辑此卡片'))}</span>
      </span>
      <span class="card-badge ${c.hidden ? 'hidden' : (c.href ? 'live' : '')}" data-card-status>${c.hidden ? '已隐藏' : (c.href ? '已上线' : '筹备中')}</span>
      <label class="card-switch" title="保存生效后公开首页是否显示"><input type="checkbox" data-f="hidden" ${c.hidden ? 'checked' : ''}><span class="sw-track"><span class="sw-dot"></span></span><span>显示</span></label>
      <span class="card-ops">
        <button class="btn" type="button" data-act="edit" title="展开 / 收起编辑">✎</button>
        <button class="btn" type="button" data-act="up" title="上移">↑</button>
        <button class="btn" type="button" data-act="down" title="下移">↓</button>
        <button class="btn" type="button" data-act="dup" title="复制一张">⧉</button>
        <button class="btn danger" type="button" data-act="del" title="删除">✕</button>
      </span>
    </div>
    <div class="card-body">
      <div class="mini">
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
        <div class="pv" data-pv data-card-preview></div>
        <p class="pv-note">预览 ≈ 首页上长这样</p>
      </div>
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
        <button class="btn primary" id="save-cards">保存并生效</button>
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
      hidden: (() => { const n = el.querySelector('[data-f="hidden"]'); return n ? n.checked : false; })(),
    };
  }

  function paint(el) {
    const c = readRow(el);
    const live = !!(c.href && c.href !== '#');
    const headTitle = el.querySelector('.card-title');
    if (headTitle) headTitle.textContent = c.title || '（未命名卡片）';
    const headDesc = el.querySelector('.card-desc');
    if (headDesc) headDesc.textContent = c.desc || (c.href ? c.href : '点击展开编辑此卡片');
    const badge = el.querySelector('[data-card-status]');
    if (badge) {
      badge.className = 'card-badge ' + (c.hidden ? 'hidden' : (live ? 'live' : ''));
      badge.textContent = c.hidden ? '已隐藏' : (live ? '已上线' : '筹备中');
    }
    el.classList.toggle('is-off', c.hidden || !live);
    const pv = el.querySelector('[data-pv]');
    if (!pv) return;
    if (c.hidden) {
      pv.innerHTML = '<div class="pv-card"><div class="pv-t" style="color:var(--muted)">已隐藏 — 保存生效后公开首页不显示</div></div>';
      return;
    }
    const badge2 = fill(c.badge || (live ? '已上线' : '筹备中'));
    pv.innerHTML =
      '<div class="pv-card">'
      + '<div class="pv-top"><span class="pv-ico">' + icon(c.icon) + '</span>'
      + '<span class="pv-num">' + String([...list.children].indexOf(el) + 1).padStart(2, '0') + '</span></div>'
      + '<div class="pv-t">' + (esc(c.title) || '<span style="color:var(--muted)">（还没写标题）</span>') + '</div>'
      + '<span class="pv-d">' + esc(c.desc) + '</span>'
      + '<div class="pv-f"><span class="pv-b' + (live ? ' live' : '') + '">' + esc(badge2) + '</span>'
      + '<span class="pv-go">' + (live ? '前往' : '查看详情') + ' ↗</span></div></div>';
  }

  function paintAll() {
    [...list.querySelectorAll('.cardrow')].forEach((el, i) => {
      el.dataset.cardIndex = String(i);
      paint(el);
    });
  }
  function mark() { dirty = true; $('state').textContent = '有未保存的改动'; }

  list.addEventListener('input', (e) => { const r = e.target.closest('.cardrow'); if (r) { paint(r); mark(); } });
  list.addEventListener('change', (e) => { const r = e.target.closest('.cardrow'); if (r) { paint(r); mark(); } });
  list.addEventListener('click', (e) => {
    const op = e.target.closest('[data-act]');
    const sw = e.target.closest('.card-switch');
    const r = e.target.closest('.cardrow');
    if (!r) return;
    if (sw) { e.stopPropagation(); }
    if (op) {
      e.stopPropagation();
      const i = [...list.children].indexOf(r);
      const act = op.dataset.act;
      if (act === 'edit' || act === 'toggle') { r.classList.toggle('open'); }
      else if (act === 'del') {
        if (!confirm('删掉第 ' + (i + 1) + ' 张卡片？保存之后首页上就没它了。')) return;
        r.remove(); paintAll(); mark();
      } else if (act === 'up' && i > 0) { list.insertBefore(r, list.children[i - 1]); paintAll(); mark(); }
      else if (act === 'down') { list.insertBefore(r, list.children[i + 2] || null); paintAll(); mark(); }
      else if (act === 'dup') {
        const clone = r.cloneNode(true);
        list.insertBefore(clone, r.nextSibling);
        const t = clone.querySelector('[data-f="title"]');
        if (t) t.value = (t.value || '') + ' 副本';
        paintAll(); mark();
      }
    } else if (e.target.closest('.card-head')) {
      r.classList.toggle('open');
    }
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
  $('save-cards').addEventListener('click', save);
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

  const body = `<div class="fold-grid">${groups.map((g, gi) => {
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
    return `<details class="fold"${gi === 0 ? ' open' : ''} data-fold>
      <summary>${h(g.label)} <span class="cnt">${items.filter((it) => it.group === g.key).length} 项</span></summary>
      <div class="fold-body">
        <p class="sub" style="margin:0 0 6px">${h(g.note || '')}</p>
        ${rows}
      </div>
    </details>`;
  }).join('')}</div>`;

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
          <button class="btn" id="fold-all" type="button">全部收起</button>
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
  const foldBtn = $('fold-all');
  if (foldBtn) foldBtn.addEventListener('click', () => {
    const folds = [...document.querySelectorAll('details[data-fold]')];
    const allOpen = folds.every((d) => d.open);
    folds.forEach((d) => { d.open = !allOpen; });
    foldBtn.textContent = allOpen ? '全部展开' : '全部收起';
  });

  syncLabels();
})();
</script>`,
  });
}

/* ==========================================================================
   图片库页：上传 / 浏览 / 复制 Markdown / 删除
   --------------------------------------------------------------------------
   上传的图片写进 content/images/，公开站渲染进程和构建都会自动带上；
   正文里写 ![说明](images/文件名) 就能引用。
   ========================================================================== */
export function imagesPage({ items = [], lastBuild = '' }) {
  const cell = (im) => `<div class="img-cell" data-name="${h(im.name)}">
      <img src="${h(im.url)}" alt="" loading="lazy">
      <div class="meta">${h(im.name)}<br>${im.dim && im.dim.width ? `${im.dim.width}×${im.dim.height} · ` : ''}${(im.bytes / 1024).toFixed(0)} KB</div>
      <div class="acts">
        <button class="btn" type="button" data-act="copy-md" title="复制 Markdown 引用">复制 MD</button>
        <button class="btn" type="button" data-act="copy-path" title="复制路径">复制路径</button>
        <button class="btn" type="button" data-act="del" title="删除">删除</button>
      </div>
    </div>`;
  return layout({
    title: '图片',
    active: 'images',
    body: `<div class="wrap">
      <h1>图片库</h1>
      <p class="sub">
        图片放在 <span class="mono">content/images/</span>，正文写 <span class="mono">![说明](images/文件名)</span> 引用。
        上传即生效（公开站渲染进程会直接读到），静态快照下次构建带上。
        ${lastBuild ? ` 上次操作：${h(lastBuild)}` : ''}
      </p>

      <div class="toolbar">
        <button class="btn primary" id="save">保存并重新构建</button>
        <a class="btn" href="/" target="_blank" rel="noopener">看站点 ↗</a>
        <span class="meta" id="state">${items.length} 张</span>
      </div>

      <label class="drop" id="drop">
        <input id="file" type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" multiple>
        <strong>拖图片到这里，或点击选择</strong><br>
        <span class="meta">支持 png / jpg / jpeg / gif / webp / svg，单张 ≤ 8MB</span>
      </label>
      <pre class="log" id="log"></pre>

      <div class="img-grid" id="grid">
        ${items.map(cell).join('') || '<div class="empty" style="grid-column:1/-1">还没有图片。上面拖一张进来试试。</div>'}
      </div>
    </div>
<script>
(function () {
  const $ = (id) => document.getElementById(id);
  const grid = $('grid');
  const log = $('log');

  async function uploadFile(file) {
    if (!/\.(png|jpe?g|gif|webp|svg)$/i.test(file.name)) { toast('不支持的格式：' + file.name); return; }
    if (file.size > 8 * 1024 * 1024) { toast('超过 8MB：' + file.name); return; }
    log.classList.add('on'); log.classList.remove('err');
    log.textContent = '上传 ' + file.name + ' …';
    try {
      const r = await fetch('/api/images?name=' + encodeURIComponent(file.name), {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: file,
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || '上传失败');
      toast('已上传 ' + j.image.name);
      location.reload();
    } catch (e) {
      log.classList.add('err'); log.textContent = String(e.message || e);
      toast('上传失败：' + (e.message || e));
    }
  }
  $('file').addEventListener('change', (e) => { [...(e.target.files || [])].forEach(uploadFile); e.target.value = ''; });
  const drop = $('drop');
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('drag'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault(); drop.classList.remove('drag');
    [...(e.dataTransfer.files || [])].forEach(uploadFile);
  });

  grid.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const cellEl = b.closest('.img-cell');
    const name = cellEl.dataset.name;
    const act = b.dataset.act;
    if (act === 'copy-md') {
      const alt = String(name).replace(/\.[^.]+$/, '');
      const txt = '![' + alt + '](images/' + name + ')';
      try { await navigator.clipboard.writeText(txt); toast('已复制 Markdown 引用'); }
      catch (er) { prompt('复制这段（Ctrl+C）：', txt); }
      return;
    }
    if (act === 'copy-path') {
      const txt = 'images/' + name;
      try { await navigator.clipboard.writeText(txt); toast('已复制路径'); }
      catch (er) { prompt('复制这段（Ctrl+C）：', txt); }
      return;
    }
    if (act === 'del') {
      if (!confirm('删除 ' + name + '？删除后公开站立即看不到它。')) return;
      const r = await fetch('/api/images/delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const j = await r.json();
      if (!j.ok) { toast('删除失败：' + (j.error || '')); return; }
      toast('已删除 ' + name);
      cellEl.remove();
    }
  });
})();
</script>`,
  });
}

/* ==========================================================================
   历史版本页：每个内容的保存快照，可以查看 / 恢复
   --------------------------------------------------------------------------
   每次保存 / 删除前，旧文件都会复制一份进 .history/。这里列出它们，
   恢复 = 把那一版写回 content/，同样立即生效。
   ========================================================================== */
export function historyPage({ kind = 'posts', slug = '', items = [], lastBuild = '' }) {
  const rows = items.length
    ? items.map((it) => `<li>
        <span class="mono">${h(it.ts)}</span>
        <span style="flex:1" class="meta">${(it.bytes / 1024).toFixed(1)} KB · ${h(String(it.mtime).slice(0, 19).replace('T', ' '))}</span>
        <button class="btn" type="button" data-act="view" data-ts="${h(it.ts)}">查看</button>
        <button class="btn primary" type="button" data-act="restore" data-ts="${h(it.ts)}">恢复此版</button>
      </li>`).join('')
    : '<p class="empty">还没有历史版本。保存 / 删除内容时会自动留档。</p>';
  return layout({
    title: '历史版本',
    active: kind,
    body: `<div class="wrap">
      <h1>历史版本</h1>
      <p class="sub">
        <span class="mono">${h(slug || '—')}.md</span> 的保存快照，按时间倒序。
        恢复会把当前版本先留档，再把选中的版本写回 —— 永远不会弄丢现在这份。
        <a href="/admin/${h(kind)}">← 回到列表</a>
        ${lastBuild ? ` · 上次操作：${h(lastBuild)}` : ''}
      </p>
      <div class="card" style="padding:0">
        <ul class="hist-list" id="hist">${rows}</ul>
      </div>
      <pre class="log" id="log"></pre>

      <div class="pick" id="pick" hidden>
        <div class="pick-box">
          <div class="pick-head"><h3>历史版本内容</h3><span style="flex:1"></span><button class="btn" id="pick-close" type="button">关闭</button></div>
          <pre id="pick-text" style="white-space:pre-wrap;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:14px;max-height:56vh;overflow:auto;font-size:12.5px"></pre>
        </div>
      </div>
    </div>
<script>
(function () {
  const $ = (id) => document.getElementById(id);
  const kind = ${JSON.stringify(kind)};
  const slug = ${JSON.stringify(slug)};
  $('hist').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const ts = b.dataset.ts;
    const act = b.dataset.act;
    const log = $('log');
    if (act === 'view') {
      try {
        const r = await fetch('/api/history/read?kind=' + encodeURIComponent(kind) + '&slug=' + encodeURIComponent(slug) + '&ts=' + encodeURIComponent(ts));
        const j = await r.json();
        if (!j.ok) throw new Error(j.error || '读取失败');
        $('pick-text').textContent = j.text || '（空）';
        $('pick').hidden = false;
      } catch (er) { toast('读取失败：' + (er.message || er)); }
      return;
    }
    if (act === 'restore') {
      if (!confirm('把 ' + ts + ' 这一版恢复成当前内容？（当前内容会先自动留档）')) return;
      const r = await fetch('/api/history/restore', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, slug, ts }),
      });
      const j = await r.json();
      if (!j.ok) { toast('恢复失败：' + (j.error || '')); return; }
      log.classList.add('on'); log.classList.remove('err');
      log.textContent = (j.build && j.build.log) || '已恢复';
      toast('已恢复 ' + ts + ' 这一版');
      setTimeout(() => location.reload(), 800);
    }
  });
  $('pick-close').addEventListener('click', () => { $('pick').hidden = true; });
  const pick = $('pick');
  pick.addEventListener('click', (e) => { if (e.target === pick) pick.hidden = true; });
})();
</script>`,
  });
}
