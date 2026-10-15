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
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
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
        return;
      }

      const stageKey = /^(ArrowDown|ArrowUp|PageDown|PageUp|Home|End| )$/.test(e.key) || /^[1-9]$/.test(e.key);
      if (stageKey && (!scroller.active() || onControl)) return;
      if (stageKey && !/^[1-9]$/.test(e.key)) {
        const direction = /^(ArrowUp|PageUp|Home)$/.test(e.key) || (e.key === ' ' && e.shiftKey) ? -1 : 1;
        let node = t;
        while (node && node !== body) {
          if (node.scrollHeight > node.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(node).overflowY) && (direction > 0 ? node.scrollTop + node.clientHeight < node.scrollHeight - 2 : node.scrollTop > 2)) return;
          node = node.parentElement;
        }
        const box = scroller.scrollBox();
        if (box && (direction > 0 ? box.scrollTop + box.clientHeight < box.scrollHeight - 2 : box.scrollTop > 2)) return;
      }

      switch (e.key) {
        case 'ArrowDown': case 'PageDown':
          e.preventDefault(); scroller.next(); return;
        case 'ArrowUp': case 'PageUp':
          e.preventDefault(); scroller.prev(); return;
        case ' ':
          if (onControl) return;
          e.preventDefault(); e.shiftKey ? scroller.prev() : scroller.next(); return;
        case 'Home':
          e.preventDefault(); scroller.go(0); return;
        case 'End':
          e.preventDefault(); scroller.go(scroller.count() - 1); return;
        case 't': case 'T':
          if (featOn('tools.themeToggle')) toggleTheme();
          return;
        case 'r': case 'R':
          scroller.go(0); setTimeout(replayTitle, 120); return;
        case 'k': case 'K': case '/':
          e.preventDefault(); if (palette) palette.toggle(); return;
        case '?':
          e.preventDefault();
          if (openFlags.keys) closeKeys();
          else if (featOn('tools.keys')) openKeys();
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

  /* ------------------------------------------------------------------
     设置：由构建脚本写进 assets/site-data.js（定义见 scripts/lib/features.mjs），
     后台的「设置」页改的就是它。取不到一律当"开" ——
     万一 site-data.js 还是旧版（没重新构建过），也不会突然少东西。
     featOn() 问"开着吗"，opt() 问"值是多少"（文字 / 数字 / 下拉）。
     ------------------------------------------------------------------ */
  function featOn(key) {
    const f = (window.SITE && window.SITE.features) || {};
    return f[key] !== false;
  }
  function opt(key, dflt) {
    const f = (window.SITE && window.SITE.features) || {};
    return f[key] === undefined ? dflt : f[key];
  }

  /** 关掉的入口元素直接摘掉：留在屏幕上却点不动，比没有更难懂 */
  function drop(sel) {
    document.querySelectorAll(sel).forEach((el) => el.remove());
  }

  function boot() {
    try {
      /* 「关于」屏必须赶在 initStage() 之前摘掉 ——
         那一屏的元素是 initStage() 里一次性采集的，摘晚了它还会占着一屏
         （圆点会多一个、翻屏计数也会算上它）。 */
      if (!featOn('home.aboutPanel')) drop('#about');

      /* 后台「设置」里能关掉的那些零碎。一律"连元素一起摘掉"——
         留在屏幕上却点不动、或者空占一块地方，比没有更难懂。
         注意顺序：摘 .foot 要在 initClock() 之前，免得它抓到一个已经被摘掉的 #clock。 */
      if (!featOn('home.heroTitle')) drop('#hero-title');
      if (!featOn('home.footer')) {
        drop('#about .foot');
      } else {
        if (!featOn('home.clock')) drop('#clock');
        if (!featOn('home.tips')) drop('.kbd-hint');
      }
      if (!featOn('effects.wash')) drop('#bg .wash');
      if (!featOn('effects.noise')) drop('#bg .noise');
      if (!featOn('tools.meter')) drop('#meter');

      /* 转场：总开关关掉、或者风格选了"只用淡入"，都是同一件事 ——
         把 SITE.randomTransition 置 false（09-stage.js 的 pickTrans() 读的就是它） */
      SITE.randomTransition = featOn('effects.transition') && opt('effects.transitionStyle', 'random') === 'random';
      if (!SITE.randomTransition) {
        /* 注意改的是本文件顶部的 SITE（第 01 节的常量），不是 window.SITE ——
           01-core.js 当初是 Object.assign 复制出来的，改 window.SITE 那份它看不见。
           （这个开关以前就是这么失效的：写 window.SITE，09-stage.js 读的却是 SITE。） */
        SITE.randomTransition = false;
      }

      fx = featOn('effects.particles') ? initFx() : null;
      applyTheme(html.dataset.theme || 'light', false);

      initTitle();
      initCards();
      initItemLayer();
      initPointer();
      initRipple();
      scroller = initStage();
      palette = featOn('tools.cmdk') ? initPalette() : null;
      if (featOn('tools.keys')) initKeys(); else drop('#keys-btn');
      initClock();

      if (!featOn('tools.cmdk')) drop('#cmdk-open');

      const toggle = document.getElementById('theme-toggle');
      if (toggle && featOn('tools.themeToggle')) toggle.addEventListener('click', toggleTheme);
      if (!featOn('tools.themeToggle')) drop('#theme-toggle');
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
      scroller.go(start, { force: true, instant: true, initial: true });

      initModalFocus();
      initGlobalKeys();
      html.classList.add('app-ready');
      initPerf();                       /* 只在 ?perf=1 时真的建东西，见第 13 节 */

      mqReduce.addEventListener && mqReduce.addEventListener('change', () => {
        motionOK = !mqReduce.matches;
        body.classList.toggle('no-fx', !motionOK);
        replayTitle();
        if (fx && fx.refreshMotion) fx.refreshMotion();
        if (scroller.refresh) scroller.refresh();
      });
    } catch (error) {
      html.classList.remove('stage-ready', 'app-ready');
      document.querySelectorAll('.panel').forEach(p => { p.inert = false; p.setAttribute('aria-hidden', 'false'); });
      console.error(error);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
