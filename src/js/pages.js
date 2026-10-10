/* ==========================================================================
   长页面脚本（资产名 assets/pages.js）
   --------------------------------------------------------------------------
   只做两件事：主题（切换方式必须和首页一模一样）+ 年份。
   舞台页那套（粒子、转场、命令面板）在长页面上不需要，也不该跑。

   主题相关的三个 key / 逻辑要和下面两处保持一致：
     - scripts/lib/templates.mjs 的 themeBootScript()   首绘前定主题
     - src/js/03-theme.js                                首页的 applyTheme / toggleTheme
   ========================================================================== */
(() => {
  'use strict';

  const html = document.documentElement;
  const KEY = 'portal-theme';
  const SESSION_KEY = 'portal-theme-session';
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

  /* 切换 = 记住选择（localStorage 永久 + sessionStorage 本标签页），再重绘。
     和首页一样用 View Transition 的圆形揭示：从按钮位置揭开（CSS 见第 18 节）。
     浏览器不支持 startViewTransition 或用户要求减弱动效时，直接换 —— 不留半成品状态。 */
  function toggle() {
    const next = html.dataset.theme === 'dark' ? 'light' : 'dark';
    const run = () => {
      paint(next);
      try {
        localStorage.setItem(KEY, next);
        sessionStorage.setItem(SESSION_KEY, next);
      } catch (e) { /* 隐私模式忽略 */ }
    };

    if (!document.startViewTransition || mqReduce.matches) { run(); return; }

    try {
      const r = btn
        ? btn.getBoundingClientRect()
        : { left: window.innerWidth - 60, top: 40, width: 0, height: 0 };
      html.style.setProperty('--vt-x', (r.left + r.width / 2) + 'px');
      html.style.setProperty('--vt-y', (r.top + r.height / 2) + 'px');
      const vt = document.startViewTransition(run);
      if (vt && vt.finished && vt.finished.catch) vt.finished.catch(() => { /* 忽略中断 */ });
    } catch (e) { run(); }
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
