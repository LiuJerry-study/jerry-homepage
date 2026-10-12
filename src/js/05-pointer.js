/* ======================== 4. 光标：光晕 + 磁吸 + 拖拽惯性 ======================== */
  function initPointer() {
    const halo = featOn('effects.halo') ? document.getElementById('halo') : null;

    if (!coarse && motionOK) {
      window.addEventListener('pointermove', (e) => {
        state.tx = e.clientX;
        state.ty = e.clientY;
        if (!body.classList.contains('has-pointer')) body.classList.add('has-pointer');
        const hot = e.target && e.target.closest
          ? e.target.closest('a, button, .card, #hero-title, [data-hot]')
          : null;
        /* 只在真的变了的时候才动 class —— class 一改，整棵文档的样式都要重算一遍 */
        if (!!hot !== body.classList.contains('is-hot')) body.classList.toggle('is-hot', !!hot);
      }, { passive: true });

      window.addEventListener('pointerdown', () => body.classList.add('is-press'), { passive: true });
      window.addEventListener('pointerup', () => body.classList.remove('is-press'), { passive: true });
      document.addEventListener('mouseleave', () => body.classList.remove('has-pointer'));
      document.addEventListener('mouseenter', () => body.classList.add('has-pointer'));
    } else {
      body.classList.add('no-fx');
    }

    /* 磁吸：按钮朝指针挪一点点，松手弹回（CSS 里 .magnetic 用 --mtx/--mty）。
       两条硬约束 —— 也就是「按钮会重合、顶栏会越界」的正面回答：
         ① 同一时刻只吸「离指针最近的那一个」：两个一起挪，就会挤到一起；
         ② 位移限幅（顶栏 5px / 正文 9px）+ 给同级的兄弟让路：相邻按钮之间
            永远留着空隙。
       基准框取「没有位移时」的位置 —— 边挪边算会把自己越拽越远。 */
    const mags = featOn('effects.magnetic') ? $$('.magnetic') : [];
    let magOn = null;

    function magBase(el) {
      const r = el.getBoundingClientRect();
      const dx = parseFloat(el.style.getPropertyValue('--mtx')) || 0;
      const dy = parseFloat(el.style.getPropertyValue('--mty')) || 0;
      return {
        x0: r.left - dx, y0: r.top - dy, x1: r.right - dx, y1: r.bottom - dy,
        cx: r.left + r.width / 2 - dx, cy: r.top + r.height / 2 - dy,
        w: r.width, h: r.height
      };
    }
    function magRelease(el) {
      if (!el || !el.classList.contains('is-pulling')) return;
      el.style.setProperty('--mtx', '0px');
      el.style.setProperty('--mty', '0px');
      el.classList.remove('is-pulling');
    }
    /* 让路：朝一个方向最多挪到「再走一步就贴上兄弟」为止 */
    function magGaps(el, b, dx, dy) {
      const parent = el.parentElement;
      const GAP = 6;
      if (!parent) return { dx: dx, dy: dy };
      for (let i = 0; i < parent.children.length; i++) {
        const s = parent.children[i];
        if (s === el || typeof s.getBoundingClientRect !== 'function') continue;
        const r = s.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        if (b.y0 + dy < r.bottom + GAP && b.y1 + dy > r.top - GAP) {
          if (dx > 0 && r.left >= b.x1) dx = Math.min(dx, Math.max(0, r.left - b.x1 - GAP));
          else if (dx < 0 && r.right <= b.x0) dx = Math.max(dx, Math.min(0, r.right + GAP - b.x0));
        }
        if (b.x0 + dx < r.right + GAP && b.x1 + dx > r.left - GAP) {
          if (dy > 0 && r.top >= b.y1) dy = Math.min(dy, Math.max(0, r.top - b.y1 - GAP));
          else if (dy < 0 && r.bottom <= b.y0) dy = Math.max(dy, Math.min(0, r.bottom + GAP - b.y0));
        }
      }
      return { dx: dx, dy: dy };
    }

    if (mags.length && !coarse && motionOK) {
      window.addEventListener('pointermove', (e) => {
        /* ① 先挑出「离指针最近、且在感应圈里」的那一个 */
        let pick = null, pickB = null, pickD = 1e9, pickR = 1;
        for (let i = 0; i < mags.length; i++) {
          const el = mags[i];
          const b = magBase(el);
          if (!b.w || !b.h) continue;
          const d = Math.hypot(e.clientX - b.cx, e.clientY - b.cy);
          /* 感应圈按「长边」算：宽按钮（比如「搜索 / 跳转」）整条都得有磁性 */
          const R = Math.max(b.w, b.h) * 0.5 + 26;
          if (d < R && d < pickD) { pick = el; pickB = b; pickD = d; pickR = R; }
        }
        if (magOn && magOn !== pick) magRelease(magOn);
        magOn = pick;
        if (!pick) return;

        /* ② 限幅 + 让开兄弟 */
        const MAX = pick.closest('.topbar') ? 5 : 9;
        const pull = (1 - pickD / pickR) * 0.34;
        let dx = (e.clientX - pickB.cx) * pull;
        let dy = (e.clientY - pickB.cy) * pull;
        const m = Math.hypot(dx, dy);
        if (m > MAX) { dx = dx / m * MAX; dy = dy / m * MAX; }
        const lim = magGaps(pick, pickB, dx, dy);
        pick.style.setProperty('--mtx', lim.dx.toFixed(1) + 'px');
        pick.style.setProperty('--mty', lim.dy.toFixed(1) + 'px');
        pick.classList.add('is-pulling');
      }, { passive: true });
      window.addEventListener('blur', () => { magRelease(magOn); magOn = null; });
    }

    /* 光晕：跟手缓动，还会顺着移动方向稍微拉长（速度越快越明显） */
    if (!halo || coarse || !motionOK) return;
    let lx = state.px, ly = state.py, lastTf = '';
    (function loop() {
      requestAnimationFrame(loop);
      state.px += (state.tx - state.px) * 0.11;
      state.py += (state.ty - state.py) * 0.11;
      let ang = 0, st = 0;
      if (body.classList.contains('has-pointer')) {
        const vx = state.px - lx, vy = state.py - ly;
        const sp = Math.hypot(vx, vy);
        if (sp > 0.35) { ang = Math.atan2(vy, vx); st = clamp(sp * 0.012, 0, 0.15); }
      }
      lx = state.px;
      ly = state.py;
      const tf = 'translate3d(' + state.px.toFixed(1) + 'px,' + state.py.toFixed(1) + 'px,0)'
        + ' translate(-50%,-50%) rotate(' + ang.toFixed(3) + 'rad)'
        + ' scale(' + (1 + st).toFixed(3) + ',' + (1 - st * 0.7).toFixed(3) + ')';
      /* 值没变就不写。写一次 transform 就是一次样式重算，而光晕绝大多数时间是不动的 */
      if (tf !== lastTf) { lastTf = tf; halo.style.transform = tf; }
    })();
  }

  