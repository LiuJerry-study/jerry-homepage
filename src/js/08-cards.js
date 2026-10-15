/* ======================== 7. 导航卡片：悬停预览 + 整屏详情页 ======================== */
  const icon = CardMarkup.icon;

  const cardsBox = document.getElementById('cards');
  const peekEl = document.getElementById('card-peek');
  const itemPage = document.getElementById('item-page');
  const itemBody = document.getElementById('item-body');
  const itemCount = document.getElementById('item-count');
  let cardEls = [];
  let cardData = [];
  let peekTimer = 0;
  let peekToken = 0;
  let itemFocusBack = null;

  function bindCard(el, i) {
    el.addEventListener('pointerenter', () => el.classList.add('is-hot'));
    el.addEventListener('pointerleave', () => {
      el.classList.remove('is-hot');
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
      hidePeek();
    });
    let moveRaf = 0, lastPoint = null, bounds = null;
    const invalidate = () => { bounds = null; };
    window.addEventListener('resize', invalidate, { passive: true });
    window.addEventListener('scroll', invalidate, { passive: true, capture: true });
    if (window.ResizeObserver) new ResizeObserver(invalidate).observe(el);
    el.addEventListener('pointermove', e => {
      if (coarse || !motionOK) return;
      lastPoint = { x: e.clientX, y: e.clientY };
      if (moveRaf) return;
      moveRaf = requestAnimationFrame(() => {
        moveRaf = 0;
        if (!motionOK || document.hidden || !el.matches(':hover')) return;
        const r = bounds || (bounds = el.getBoundingClientRect());
        if (!r.width || !r.height) return;
        el.style.setProperty('--mx', ((lastPoint.x - r.left) / r.width * 100).toFixed(2) + '%');
        el.style.setProperty('--my', ((lastPoint.y - r.top) / r.height * 100).toFixed(2) + '%');
        el.style.setProperty('--rx', ((.5 - (lastPoint.y - r.top) / r.height) * 7).toFixed(2) + 'deg');
        el.style.setProperty('--ry', (((lastPoint.x - r.left) / r.width - .5) * 9).toFixed(2) + 'deg');
      });
    });

    /* 悬停预览：停够 420ms 才出，免得扫过去一片浮层乱闪 */
    if (!coarse) {
      el.addEventListener('pointerenter', () => {
        clearTimeout(peekTimer);
        peekTimer = setTimeout(() => showPeek(el, i), 420);
      });
    }
    /* 键盘 Tab 过来才弹预览；鼠标点出来的焦点不弹（那时手上有光标，预览反而碍事） */
    el.addEventListener('focus', () => {
      let kb = true;
      try { kb = el.matches(':focus-visible'); } catch (err) { kb = true; }
      if (kb) showPeek(el, i);
    });
    el.addEventListener('blur', hidePeek);
  }

  function showPeek(card, i) {
    const d = cardData[i];
    if (!peekEl || !featOn('tools.hoverPeek') || !d || !d.details || !d.details.length || openFlags.detail) return;
    const token = ++peekToken;
    const live = !!(d.href && d.href !== '#');
    peekEl.innerHTML = '<div class="peek-title"><span class="pip"></span>' + esc(d.title || '') + '</div>'
      + '<ul class="peek-list">' + d.details.slice(0, 2).map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>'
      + '<div class="peek-more">' + (live ? '点击前往 · ' : '点击进入详情页 · ')
      + (d.details.length > 2 ? '还有 ' + (d.details.length - 2) + ' 条' : '就这些') + '</div>';
    peekEl.hidden = false;
    const r = card.getBoundingClientRect();
    const w = peekEl.offsetWidth, h = peekEl.offsetHeight;
    let left = r.right + 14;
    if (left + w > window.innerWidth - 12) left = r.left - w - 14;
    if (left < 12) left = clamp(r.left + r.width / 2 - w / 2, 12, window.innerWidth - w - 12);
    const top = clamp(r.top + 6, 12, Math.max(12, window.innerHeight - h - 12));
    peekEl.style.left = left + 'px';
    peekEl.style.top = top + 'px';
    /* token 变了说明中途已经收起 —— 别再把它点亮（否则详情开着的旧预览会诈尸） */
    requestAnimationFrame(() => {
      if (peekEl && token === peekToken && !openFlags.detail) peekEl.classList.add('is-on');
    });
  }

  function hidePeek() {
    clearTimeout(peekTimer);
    peekToken++;
    if (!peekEl) return;
    peekEl.classList.remove('is-on');
    setTimeout(() => { if (peekEl && !peekEl.classList.contains('is-on')) peekEl.hidden = true; }, 260);
  }

  /* 详情 = 整屏滑进来的新页面（不是浮在卡片上的小面板）。
     内容是打开时现填的，所以「点卡片」和「命令面板」两个入口共用这一个函数。 */
  function openItem(i) {
    if (!itemPage || !itemBody || !cardData[i]) return;
    const d = cardData[i];
    hidePeek();
    openFlags.detail = true;

    const live = !!(d.href && d.href !== '#');
    const details = (d.details || []).map((x, n) => '<li style="--i:' + n + '">' + esc(x) + '</li>').join('');
    const tags = (d.tags || []).map((x) => '<span>' + esc(x) + '</span>').join('');
    const cta = d.add
      ? '<span class="detail-note">改这一处就够了</span>'
      : (live
        ? '<a class="btn btn-primary" href="' + esc(d.href) + '">前往 <span class="btn-ico" aria-hidden="true">↗</span></a>'
        : '<span class="detail-note">' + esc(d.badge || '筹备中') + ' · 先看看这里会放什么</span>');

    itemBody.innerHTML =
      '<div class="detail-head">'
      + '<span class="detail-icon">' + icon(d.add ? 'plus' : d.icon) + '</span>'
      + '<div><h2 class="detail-title">' + esc(d.title || '') + '</h2>'
      + '<p class="detail-desc">' + esc(d.desc || '') + '</p></div>'
      + '</div>'
      + (details ? '<ul class="detail-list">' + details + '</ul>' : '')
      + (tags ? '<div class="detail-tags">' + tags + '</div>' : '')
      + '<div class="detail-foot">' + cta
      + '<button class="btn btn-ghost" type="button" data-item-close>返回导航</button></div>';

    if (itemCount) itemCount.textContent = String(i + 1).padStart(2, '0');
    itemPage.classList.remove('is-stuck');
    const sc = $('.item-scroll', itemPage);
    if (sc) sc.scrollTop = 0;

    itemFocusBack = document.activeElement;
    itemPage._focusTrigger = itemFocusBack;
    itemPage.hidden = false;
    itemPage.classList.remove('is-in');
    void itemPage.offsetWidth;               /* 从屏幕右侧开始滑，而不是直接跳到位 */
    itemPage.classList.add('is-in');
    const back = $('[data-item-close]', itemPage);
    if (back) back.focus();
  }

  function closeItem() {
    if (!openFlags.detail || !itemPage) return;
    openFlags.detail = false;
    itemPage.classList.remove('is-in');
    clearTimeout(itemPage._closeTimer);
    itemPage._closeTimer = setTimeout(() => {
      if (!itemPage.classList.contains('is-in')) itemPage.hidden = true;
    }, motionOK ? 600 : 0);
    if (itemFocusBack && itemFocusBack.focus) {
      try { itemFocusBack.focus(); } catch (e) { /* 忽略 */ }
    }
    itemFocusBack = null;
  }

  function initCards() {
    if (!cardsBox) return;
    if (!featOn('home.cards')) return;           /* 开关：首屏卡片墙 */
    const items = CardMarkup.items(SITE);
    cardData = items;
    if (!cardsBox.children.length) cardsBox.innerHTML = CardMarkup.render(items);
    cardsBox.classList.add('cards-enhanced');
    cardEls = $$('.card', cardsBox);
    cardEls.forEach((el, i) => {
      bindCard(el, i);
      if (!items[i].href || items[i].href === '#') {
        el.setAttribute('role', 'button'); el.tabIndex = 0;
        const summary = el.querySelector('summary');
        if (summary) summary.tabIndex = -1;
        el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); openItem(i); } });
      }
    });

    cardsBox.addEventListener('click', (e) => {
      const t = e.target;
      if (!t || !t.closest) return;
      const card = t.closest('.card');
      if (!card) return;
      const i = Number(card.dataset.i);
      const d = cardData[i] || {};
      if (d.href && d.href !== '#') return;      /* 真链接：让它正常跳走 */
      e.preventDefault();
      openItem(i);
    });
  }

  function initItemLayer() {
    if (!itemPage) return;
    itemPage.addEventListener('click', (e) => {
      const t = e.target;
      if (t && t.closest && t.closest('[data-item-close]')) closeItem();
    });

    /* 向右滑 = 返回（Esc 由全局快捷键管，见第 12 节）。
       竖向手势让给页面自己的滚动，只有横向明显拖过阈值才接管。 */
    let drag = null;
    itemPage.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      const t = e.target;
      if (window.getSelection() && !window.getSelection().isCollapsed) return;
      if (t && t.closest && t.closest('a, button, input, select, textarea, [contenteditable], p, li, h2')) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, on: false };
    });
    itemPage.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.on) {
        if (dx < 12 || Math.abs(dx) < Math.abs(dy)) return;
        drag.on = true;
        itemPage.classList.add('is-dragging');
        try { itemPage.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
      }
      drag.dx = Math.max(0, dx);
      itemPage.style.transform = 'translate3d(' + drag.dx.toFixed(1) + 'px, 0, 0)';
    });
    const endDrag = (e, cancelled) => {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      const far = drag.dx > 90;
      const pointerId = drag.id;
      drag = null;
      try { if (itemPage.hasPointerCapture(pointerId)) itemPage.releasePointerCapture(pointerId); } catch (err) { /* capture lost */ }
      itemPage.classList.remove('is-dragging');
      itemPage.style.transform = '';
      if (far && !cancelled) closeItem();
    };
    itemPage.addEventListener('pointerup', endDrag);
    itemPage.addEventListener('pointercancel', e => endDrag(e, true));
    itemPage.addEventListener('lostpointercapture', e => endDrag(e, true));
    window.addEventListener('blur', () => endDrag(null, true));

    const sc = $('.item-scroll', itemPage);
    if (sc) sc.addEventListener('scroll', () => {
      itemPage.classList.toggle('is-stuck', sc.scrollTop > 4);
    }, { passive: true });
  }
