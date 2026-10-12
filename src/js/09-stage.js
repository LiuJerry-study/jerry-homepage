/* ======================== 8. 舞台：一屏一页 ======================== */
  const TRANSITIONS = [
    { id: 'fade', name: '淡入', dur: 600 },
    { id: 'push', name: '推移', dur: 660 },
    { id: 'flip', name: '翻卡', dur: 720 },
    { id: 'zoom', name: '缩放', dur: 640 },
    { id: 'blur', name: '虚化', dur: 700 },
    { id: 'wipe', name: '擦除', dur: 700 }
  ];
  const TRANS_CLASSES = TRANSITIONS.map((t) => 't-' + t.id);

  function initStage() {
    const stage = document.getElementById('stage');
    const panels = $$('.panel', stage);
    const dotsBox = featOn('home.dots') ? document.getElementById('dots') : null;
    const meter = document.getElementById('meter');
    if (!panels.length) {
      return { go: () => {}, next: () => {}, prev: () => {}, index: () => 0, count: () => 0, active: () => false };
    }

    let idx = 0;
    let busy = false;
    let pending = null;
    let flipTimer = 0;
    let forcedTrans = null;
    let lastTrans = -1;
    let lastFlipAt = 0;
    let wheelAcc = 0, wheelTimer = 0;
    let drag = null;

    const scrollBox = (p) => $('.panel-scroll', p);
    const canScroll = (p, dy) => {
      const sc = scrollBox(p);
      if (!sc) return false;
      return dy > 0 ? sc.scrollTop + sc.clientHeight < sc.scrollHeight - 2 : sc.scrollTop > 2;
    };
    const isScrollable = (p) => p.classList.contains('is-scrollable');

    function pickTrans() {
      if (SITE.randomTransition === false) return TRANSITIONS[0];
      let i = Math.floor(Math.random() * TRANSITIONS.length);
      if (TRANSITIONS.length > 1 && i === lastTrans) i = (i + 1 + Math.floor(Math.random() * (TRANSITIONS.length - 1))) % TRANSITIONS.length;
      lastTrans = i;
      return TRANSITIONS[i];
    }

    function clearTrans(p) {
      p.classList.remove('is-in', 'is-out');
      for (let i = 0; i < TRANS_CLASSES.length; i++) p.classList.remove(TRANS_CLASSES[i]);
    }

    /* 每一屏自己算「紧凑系数」--k：排不下就一档一档收紧，紧到底还排不下才允许屏内滚。
       面板虽然不可见（visibility:hidden）也参与布局，所以可以提前量。 */
    function fit(panel) {
      const sc = scrollBox(panel);
      if (!sc) return;
      panel.style.setProperty('--k', '1');
      let k = 1;
      for (let i = 0; i < 8; i++) {
        if (sc.scrollHeight <= sc.clientHeight + 1) break;
        k = Math.max(0.64, k - 0.06);
        panel.style.setProperty('--k', k.toFixed(2));
        if (k <= 0.64) break;
      }
      const over = sc.scrollHeight > sc.clientHeight + 1;
      panel.classList.toggle('is-scrollable', over);
    }

    function fitAll() { panels.forEach(fit); paint(); }

    function paint(trans, instant) {
      const p = panels[idx];
      /* 圆点 */
      if (dotsBox) {
        $$('.dot', dotsBox).forEach((d, i) => {
          d.classList.toggle('is-active', i === idx);
          d.setAttribute('aria-current', i === idx ? 'true' : 'false');
        });
      }
      /* 每屏的氛围（背景光斑 / 光晕色相） */
      body.dataset.page = p.id;
      /* 左下角屏序 + 这屏用的转场 */
      if (meter) {
        const pad = (n) => String(n).padStart(2, '0');
        const warn = isScrollable(p) ? '<span class="meter-warn">· ↕ 屏内可滚</span>' : '';
        const tName = trans && !instant ? '<span class="meter-trans is-pop">' + esc(trans.name) + '</span>' : '';
        meter.innerHTML = '<b>' + pad(idx + 1) + '</b><span>/ ' + pad(panels.length) + ' 屏</span>' + tName + warn;
      }
      /* 地址栏（file:// 下可能不让改，忽略即可） */
      try {
        const id = p.id;
        if (history.pushState && !instant) history.pushState({ page: id }, '', '#' + id);
        else if (history.replaceState) history.replaceState({ page: id }, '', '#' + id);
      } catch (e) { /* 忽略 */ }
    }

    /* 每翻一屏，这一屏里的 [data-reveal] 重播一次入场 */
    function reveal(panel, instant) {
      const els = $$('[data-reveal]', panel);
      if (!els.length) return;
      els.forEach((el) => el.classList.remove('is-in'));
      if (!motionOK || instant) { els.forEach((el) => el.classList.add('is-in')); return; }
      void panel.offsetWidth;
      setTimeout(() => els.forEach((el) => el.classList.add('is-in')), 90);
    }

    function finishFlip() {
      panels.forEach((p, i) => {
        clearTrans(p);
        if (i !== idx) p.classList.remove('is-active');
      });
      busy = false;
      if (pending != null) {
        const to = pending;
        pending = null;
        go(to, { force: true });
      }
    }

    function go(i, opts) {
      opts = opts || {};
      i = clamp(i, 0, panels.length - 1);
      if (i === idx && !opts.force) return false;
      if (busy && !opts.instant) { pending = i; return false; }

      const from = panels[idx];
      const to = panels[i];
      const dir = i >= idx ? 1 : -1;
      const trans = TRANSITIONS[0] && (opts.trans || forcedTrans || pickTrans());
      forcedTrans = null;
      const instant = !!opts.instant;

      clearTimeout(flipTimer);
      panels.forEach(clearTrans);

      to.classList.add('is-active');
      to.setAttribute('aria-hidden', 'false');

      if (from && from !== to) {
        from.setAttribute('aria-hidden', 'true');
        if (instant) from.classList.remove('is-active');
        else from.classList.add('is-out', 't-' + trans.id);
      }

      stage.dataset.dir = dir > 0 ? '1' : '-1';
      if (!instant) to.classList.add('is-in', 't-' + trans.id);

      idx = i;
      stage.style.setProperty('--drag-y', '0px');
      paint(trans, instant);
      reveal(to, instant);
      if (to.id === 'home' && !instant) setTimeout(() => replayTitle(), 200);

      if (instant) { busy = false; return true; }

      busy = true;
      const dur = motionOK ? trans.dur : 20;
      flipTimer = setTimeout(finishFlip, dur);
      lastFlipAt = performance.now();
      return true;
    }

    function next() { return go(idx + 1); }
    function prev() { return go(idx - 1); }
    function jump(i) { return go(i); }

    function buildDots() {
      if (!dotsBox) return;
      dotsBox.innerHTML = panels.map((s, i) => (
        '<button class="dot" type="button" data-i="' + i + '" aria-label="跳到：'
        + esc(s.dataset.label || ('第 ' + (i + 1) + ' 屏')) + '">'
        + '<span class="dot-lb">' + esc(s.dataset.label || '') + '</span></button>'
      )).join('');
      $$('.dot', dotsBox).forEach((d, i) => d.addEventListener('click', () => jump(i)));
      paint();
    }

    /* ---- 滚轮：文档不滚，滚轮只当翻页键 ---- */
    window.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) return;
      if (openFlags.palette || openFlags.keys) return;
      if (openFlags.detail) {
        /* 详情页自己能滚（内容长时），别把它的滚轮也吃掉 */
        const dt = e.target;
        if (!(dt && dt.closest && dt.closest('.item-page'))) e.preventDefault();
        return;
      }

      const cur = panels[idx];
      if (canScroll(cur, e.deltaY)) return;   /* 这一屏内部还没滚完：先让它滚 */

      e.preventDefault();
      let d = e.deltaY;
      if (e.deltaMode === 1) d *= 18;
      else if (e.deltaMode === 2) d *= window.innerHeight;
      if (!d) return;

      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => { wheelAcc = 0; }, 240);
      if (busy) { wheelAcc = 0; return; }
      if (performance.now() - lastFlipAt < 140) return;
      wheelAcc += d;
      if (Math.abs(wheelAcc) < 26) return;
      const dir = wheelAcc > 0 ? 1 : -1;
      wheelAcc = 0;
      go(idx + dir);
    }, { passive: false });

    /* ---- 拖拽翻屏：跟手一点点，松手看距离/速度，够就翻，不够就弹回 ---- */
    function setDrag(px) {
      stage.style.setProperty('--drag-y', px.toFixed(1) + 'px');
    }

    stage.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      if (openFlags.palette || openFlags.keys || openFlags.detail) return;
      const t = e.target;
      if (!t || !t.closest) return;
      if (t.closest('a, button, input, textarea, select, .card, .cmdk, .keys, #hero-title, [data-nodrag]')) return;
      /* 这一屏要屏内滚动时，纵向手势让给浏览器 */
      drag = {
        id: e.pointerId, y0: e.clientY, dy: 0, v: 0,
        lx: e.clientX, ly: e.clientY, t: performance.now(),
        moved: false, blocked: isScrollable(panels[idx])
      };
      if (!drag.blocked) {
        stage.classList.add('is-dragging');
        try { stage.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
      }
    });

    stage.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id || drag.blocked) return;
      const now = performance.now();
      const dt = Math.max(1, now - drag.t);
      drag.v = (e.clientY - drag.ly) / dt;
      drag.ly = e.clientY;
      drag.lx = e.clientX;
      drag.t = now;
      drag.dy = e.clientY - drag.y0;
      if (Math.abs(drag.dy) > 4) drag.moved = true;
      if (!drag.moved) return;
      /* 第一屏往上拖 / 最后一屏往下拖：拉不动，只给一点点回弹 */
      const atEdge = (idx === 0 && drag.dy > 0) || (idx === panels.length - 1 && drag.dy < 0);
      const damp = Math.min(64, Math.abs(drag.dy) * (atEdge ? 0.10 : 0.32));
      setDrag((drag.dy > 0 ? 1 : -1) * damp);
    });

    function endDrag(e) {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      const d = drag;
      drag = null;
      stage.classList.remove('is-dragging');
      try { stage.releasePointerCapture(d.id); } catch (err) { /* 忽略 */ }
      if (d.blocked || !d.moved) { setDrag(0); return; }

      const far = Math.abs(d.dy) > 76;
      const fast = Math.abs(d.v) > 0.5;
      setDrag(0);
      if (far || fast) {
        const dir = d.dy < 0 ? 1 : -1;   /* 往上拖 = 翻到下一屏 */
        if ((dir > 0 && idx < panels.length - 1) || (dir < 0 && idx > 0)) { go(idx + dir); return; }
      }
      /* 没到翻页的阈值：CSS 的 transform 过渡会把面板拉回原位 */
      stage.style.setProperty('--drag-y', '0px');
    }

    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);

    /* ---- 站内锚点：交给统一的缓动，别用浏览器默认跳转 ---- */
    document.addEventListener('click', (e) => {
      const t = e.target;
      const a = t && t.closest ? t.closest('a[href^="#"]') : null;
      if (!a) return;
      if (a.hasAttribute('data-item-close') || a.closest('.item-page')) return;
      const href = a.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.getElementById(href.slice(1));
      if (!target) return;
      e.preventDefault();
      const panel = target.closest('.panel') || target;
      const i = panels.indexOf(panel);
      if (i >= 0) go(i);
    });

    window.addEventListener('popstate', () => {
      const i = indexFromHash();
      if (i >= 0) go(i, { instant: false });
    });

    function indexFromHash() {
      const id = (location.hash || '').replace(/^#/, '');
      if (!id) return -1;
      for (let i = 0; i < panels.length; i++) if (panels[i].id === id) return i;
      return -1;
    }

    window.addEventListener('resize', () => {
      clearTimeout(initStage._rt);
      initStage._rt = setTimeout(() => { fitAll(); }, 180);
    });

    buildDots();

    return {
      panels: panels,
      go: (i, opts) => go(i, opts),
      next: next,
      prev: prev,
      index: () => idx,
      count: () => panels.length,
      scrollBox: () => scrollBox(panels[idx]),
      isScrollable: () => isScrollable(panels[idx]),
      fitAll: fitAll,
      setTransition: (id) => {
        const t = TRANSITIONS.filter((x) => x.id === id)[0];
        if (t) { forcedTrans = t; return t; }
        return null;
      },
      cycleTransition: () => {
        const t = pickTrans();
        forcedTrans = t;
        return t;
      },
      pushHistory: (id) => {
        try { if (history.pushState) history.pushState({ page: id }, '', '#' + id); } catch (e) { /* 忽略 */ }
      },
      emptyState: () => {}
    };
  }

  