/* ==========================================================================
   长页面脚本（资产名 assets/pages.js）
   --------------------------------------------------------------------------
   只做三件事：主题按钮 + T 快捷键、年份、以及「首屏可见时给正文加个淡入」——
   舞台页那套（粒子、转场、命令面板）在长页面上不需要，也不该跑。
   和舞台页共用 localStorage 的 portal-theme，所以主题在两个页面之间是连续的。
   ========================================================================== */
(() => {
  'use strict';

  const html = document.documentElement;
  const KEY = 'portal-theme';
  const meta = document.querySelector('meta[name="theme-color"]');
  const btn = document.getElementById('theme-toggle');
  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  function paint(theme) {
    html.dataset.theme = theme;
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#07130F' : '#F4F9F5');
    if (btn) {
      btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
      btn.title = theme === 'dark' ? '切到浅色（T）' : '切到深色（T）';
    }
  }

  function toggle() {
    const next = html.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(KEY, next); } catch (e) { /* 隐私模式忽略 */ }
    paint(next);
  }

  paint(html.dataset.theme || 'light');
  if (btn) btn.addEventListener('click', toggle);

  window.addEventListener('keydown', (e) => {
    if (e.key !== 't' && e.key !== 'T') return;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.metaKey || e.ctrlKey) return;
    toggle();
  });

  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  /* 正文淡入：只有一次，不参与任何翻屏/粒子逻辑 */
  if (!mqReduce.matches) {
    const main = document.getElementById('main');
    if (main) {
      main.style.opacity = '0';
      main.style.transition = 'opacity .5s cubic-bezier(.16,1,.3,1)';
      requestAnimationFrame(() => { main.style.opacity = '1'; });
    }
  }
})();
