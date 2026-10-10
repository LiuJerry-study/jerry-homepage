/* ======================== 12. 启动 ======================== */
  let palette = null;

  function initGlobalKeys() {
    window.addEventListener('keydown', (e) => {
      /* 命令面板开着的时候，键盘全归它 */
      if (palette && palette.isOpen()) { palette.key(e); return; }

      if (e.key === 'Escape') {
        if (openFlags.detail) { closeItem(); return; }
        if (openFlags.keys) { closeKeys(); return; }
        return;
      }

      const t = e.target;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (typing) return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'k' || e.key === 'K') { e.preventDefault(); if (palette) palette.toggle(); }
        return;
      }
      if (e.altKey) return;
      /* 快捷键表开着时，键盘归它 —— 但 ? 例外，不然「再按一次 ? 收起」这段永远走不到 */
      if (openFlags.keys && e.key !== '?') return;

      const onControl = t && t.closest && t.closest('button, a, input');

      /* 详情页开着时，翻屏键别去动底下的舞台 —— 它是整屏页面，不是小浮层 */
      if (openFlags.detail && (/^(ArrowDown|ArrowUp|PageDown|PageUp|Home|End| )$/.test(e.key) || /^[1-9]$/.test(e.key))) {
        e.preventDefault();
        return;
      }

      switch (e.key) {
        case 'ArrowDown': case 'PageDown':
          e.preventDefault(); scroller.next(); return;
        case 'ArrowUp': case 'PageUp':
          e.preventDefault(); scroller.prev(); return;
        case ' ':
          if (onControl) return;
          e.preventDefault(); scroller.next(); return;
        case 'Home':
          e.preventDefault(); scroller.go(0); return;
        case 'End':
          e.preventDefault(); scroller.go(scroller.count() - 1); return;
        case 't': case 'T':
          toggleTheme(); return;
        case 'r': case 'R':
          scroller.go(0); setTimeout(replayTitle, 120); return;
        case 'k': case 'K': case '/':
          e.preventDefault(); if (palette) palette.toggle(); return;
        case '?':
          e.preventDefault();
          if (openFlags.keys) closeKeys(); else openKeys();
          return;
        default:
          break;
      }
      if (/^[1-9]$/.test(e.key)) {
        const i = Number(e.key) - 1;
        if (i < scroller.count()) { e.preventDefault(); scroller.go(i); }
      }
    });
  }

  function boot() {
    fx = initFx();
    applyTheme(html.dataset.theme || 'light', false);

    initTitle();
    initCards();
    initItemLayer();
    initPointer();
    initRipple();
    scroller = initStage();
    palette = initPalette();
    initKeys();
    initClock();

    const toggle = document.getElementById('theme-toggle');
    if (toggle) toggle.addEventListener('click', toggleTheme);
    const topBtn = document.getElementById('top-btn');
    if (topBtn) topBtn.addEventListener('click', () => scroller.go(0));
    const keysBtn = document.getElementById('keys-btn');
    if (keysBtn) keysBtn.addEventListener('click', openKeys);

    if (!motionOK) body.classList.add('no-fx');

    /* 先把三屏的紧凑度量好，再决定开头停在第几屏 */
    scroller.fitAll();
    let start = 0;
    const hash = (location.hash || '').replace(/^#/, '');
    if (hash) {
      for (let i = 0; i < scroller.count(); i++) {
        if (scroller.panels[i].id === hash) { start = i; break; }
      }
    }
    scroller.go(start, { force: true, instant: true });
    scroller.panels.forEach((p, i) => {
      p.setAttribute('aria-hidden', i === start ? 'false' : 'true');
    });

    initGlobalKeys();

    mqReduce.addEventListener && mqReduce.addEventListener('change', () => {
      motionOK = !mqReduce.matches;
      body.classList.toggle('no-fx', !motionOK);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
