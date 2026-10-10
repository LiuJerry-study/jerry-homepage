/* ======================== 7. 导航卡片：悬停预览 + 整屏详情页 ======================== */
  const ICONS = {
    resume: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>',
    pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.6"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2.5"/><path d="M3 7l9 6 9-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    arrow: '<path d="M7 17 17 7"/><path d="M8 7h9v9"/>',
    search: '<circle cx="11" cy="11" r="6.6"/><path d="M20.2 20.2 15.8 15.8"/>',
    bolt: '<path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13z"/>',
    page: '<path d="M4 6h16M4 12h16M4 18h10"/>'
  };

  function icon(name) {
    const d = ICONS[name] || ICONS.grid;
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"'
      + ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  }

  const RING = '<span class="ring" aria-hidden="true"></span><span class="spot" aria-hidden="true"></span>';

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
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      el.style.setProperty('--mx', (px * 100).toFixed(2) + '%');
      el.style.setProperty('--my', (py * 100).toFixed(2) + '%');
      if (coarse || !motionOK) return;
      el.style.setProperty('--rx', ((0.5 - py) * 7).toFixed(2) + 'deg');
      el.style.setProperty('--ry', ((px - 0.5) * 9).toFixed(2) + 'deg');
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
    if (!peekEl || !d || !d.details || !d.details.length || openFlags.detail) return;
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
    }, 640);
    if (itemFocusBack && itemFocusBack.focus) {
      try { itemFocusBack.focus(); } catch (e) { /* 忽略 */ }
    }
    itemFocusBack = null;
  }

  function initCards() {
    if (!cardsBox) return;
    const items = (Array.isArray(SITE.nav) ? SITE.nav : []).slice();
    if (SITE.showAddCard !== false) {
      items.push({
        add: true,
        title: '添加新站点',
        desc: '往 content/site.js 的 nav 里加一个对象，卡片自己长出来',
        badge: '开发用',
        tags: ['开发', 'content', 'site', 'nav', '新增'],
        details: [
          '打开 content/site.js',
          '往 nav 数组里加一个对象：title / desc / icon / href',
          '想加详情就再写 details 和 tags，预览和搜索都会自动用上',
          'href 填上之后，卡片自动变成真链接'
        ]
      });
    }
    cardData = items;

    cardsBox.innerHTML = items.map((it, i) => {
      const num = String(i + 1).padStart(2, '0');
      if (it.add) {
        return '<button class="card card-add" type="button" data-i="' + i + '">' + RING
          + '<div class="card-inner">'
          + '<div class="card-top"><span class="card-icon">' + icon('plus') + '</span>'
          + '<span class="card-num mono">' + num + '</span></div>'
          + '<div class="card-body"><strong class="card-title">添加新站点</strong>'
          + '<span class="card-desc">' + esc(it.desc) + '</span></div>'
          + '<div class="card-foot"><span class="badge">开发用</span>'
          + '<span class="card-go">看一眼<span class="go-ico">' + icon('arrow') + '</span></span></div>'
          + '</div></button>';
      }
      const live = !!(it.href && it.href !== '#');
      const tag = live ? 'a' : 'button';
      const attrs = live
        ? ' href="' + esc(it.href) + '"'
        : ' type="button"';
      return '<' + tag + ' class="card ' + (live ? 'is-live' : 'is-soon') + '" data-i="' + i + '"' + attrs + '>' + RING
        + '<div class="card-inner">'
        + '<div class="card-top"><span class="card-icon">' + icon(it.icon) + '</span>'
        + '<span class="card-num mono">' + num + '</span></div>'
        + '<div class="card-body"><strong class="card-title">' + esc(it.title || '') + '</strong>'
        + '<span class="card-desc">' + esc(it.desc || '') + '</span></div>'
        + '<div class="card-foot"><span class="badge' + (live ? ' badge-live' : '') + '">'
        + esc(it.badge || (live ? '已上线' : '筹备中')) + '</span>'
        + '<span class="card-go">' + (live ? '前往' : '查看详情')
        + '<span class="go-ico">' + icon('arrow') + '</span></span></div>'
        + '</div></' + tag + '>';
    }).join('');

    cardEls = $$('.card', cardsBox);
    cardEls.forEach((el, i) => bindCard(el, i));

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
      if (t && t.closest && t.closest('a, button')) return;
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
    const endDrag = (e) => {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      const far = drag.dx > 90;
      drag = null;
      itemPage.classList.remove('is-dragging');
      itemPage.style.transform = '';
      if (far) closeItem();
    };
    itemPage.addEventListener('pointerup', endDrag);
    itemPage.addEventListener('pointercancel', endDrag);

    const sc = $('.item-scroll', itemPage);
    if (sc) sc.addEventListener('scroll', () => {
      itemPage.classList.toggle('is-stuck', sc.scrollTop > 4);
    }, { passive: true });
  }

  