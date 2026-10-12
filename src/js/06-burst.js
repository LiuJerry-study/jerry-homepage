/* ======================== 5. 点击爆点 ======================== */
  function initRipple() {
    if (!featOn('effects.burst')) return;        /* 开关：见 content/features.json */
    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      /* 详情页是整屏页面，把画布整个盖住了 —— 在它上面点，别在背后放看不见的爆炸 */
      if (e.target && e.target.closest && e.target.closest('.item-page')) return;
      /* 点首屏大字：那里有自己的「散成粒子」，再叠一圈涟漪就太吵了 */
      const onTitle = !!(e.target && e.target.closest && e.target.closest('#hero-title'));
      if (coarse || !motionOK || onTitle) {
        if (fx && !onTitle) fx.burst(e.clientX, e.clientY, 1);
        return;
      }
      /* 爆炸本身每次都会响（burst 内部自己决定用哪套）。
         而那个巨大的 DOM 圆只有「这一下正好掷到旧的那套」时才建 ——
         默认的爆炸整套画在 #fx-overlay 上，没有新 DOM、没有新图层、没有新位图。 */
      const usedClassic = fx ? fx.burst(e.clientX, e.clientY, 1) === true : false;
      if (!usedClassic) return;
      const el = document.createElement('span');
      el.className = 'ripple';
      el.style.left = e.clientX + 'px';
      el.style.top = e.clientY + 'px';
      const d = Math.min(2600, Math.hypot(
        Math.max(e.clientX, window.innerWidth - e.clientX),
        Math.max(e.clientY, window.innerHeight - e.clientY)
      ) * 2);
      el.style.width = d + 'px';
      el.style.height = d + 'px';
      document.body.appendChild(el);
      const kill = () => { if (el.parentNode) el.parentNode.removeChild(el); };
      el.addEventListener('animationend', kill, { once: true });
      setTimeout(kill, 1500);
    }, { passive: true });
  }

  