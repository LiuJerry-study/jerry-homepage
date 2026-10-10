/* ======================== 2. 主题 ======================== */
  const THEME_KEY = 'portal-theme';
  const themeMeta = document.querySelector('meta[name="theme-color"]');

  function applyTheme(theme, persist) {
    html.dataset.theme = theme;
    if (persist) { try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* 隐私模式忽略 */ } }
    if (themeMeta) themeMeta.setAttribute('content', theme === 'dark' ? '#07130F' : '#F4F9F5');
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
      btn.title = theme === 'dark' ? '切到浅色（T）' : '切到深色（T）';
    }
    if (fx) fx.recolor();
  }

  function toggleTheme() {
    const next = html.dataset.theme === 'dark' ? 'light' : 'dark';
    const run = () => applyTheme(next, true);
    const btn = document.getElementById('theme-toggle');
    if (!document.startViewTransition || !motionOK) { run(); return; }
    try {
      const r = btn ? btn.getBoundingClientRect() : { left: window.innerWidth - 60, top: 40, width: 0, height: 0 };
      html.style.setProperty('--vt-x', (r.left + r.width / 2) + 'px');
      html.style.setProperty('--vt-y', (r.top + r.height / 2) + 'px');
      const vt = document.startViewTransition(run);
      if (vt && vt.finished && vt.finished.catch) vt.finished.catch(() => {});
    } catch (e) { run(); }
  }

  