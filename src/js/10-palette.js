/* ======================== 9. 命令面板（Ctrl / ⌘ + K） ======================== */
  function initPalette() {
    const root = document.getElementById('cmdk');
    const input = document.getElementById('cmdk-input');
    const list = document.getElementById('cmdk-list');
    const countEl = document.getElementById('cmdk-count');
    const openBtn = document.getElementById('cmdk-open');
    if (!root || !input || !list) return { isOpen: () => false, toggle: () => {}, close: () => {}, key: () => false };

    let items = [];
    let view = [];
    let sel = 0;
    let isOpen = false;
    let focusBack = null;

    function buildItems() {
      const out = [];
      scroller.panels && scroller.panels.forEach((p, i) => {
        out.push({
          group: '页面', icon: 'page',
          t: p.dataset.label || ('第 ' + (i + 1) + ' 屏'),
          s: '第 ' + (i + 1) + ' 屏 · ' + p.id,
          hay: (p.dataset.label || '') + ' ' + p.id + ' page',
          run: () => scroller.go(i)
        });
      });
      (Array.isArray(SITE.nav) ? SITE.nav : []).forEach((c, i) => {
        out.push({
          group: '导航卡片', icon: c.icon || 'grid',
          t: c.title || '',
          s: c.desc || '',
          hay: [c.title, c.desc, (c.tags || []).join(' '), (c.details || []).join(' ')].join(' '),
          run: () => {
            const pi = scroller.panels ? scroller.panels.findIndex((p) => $('#cards', p)) : -1;
            if (pi >= 0 && pi !== scroller.index()) {
              scroller.go(pi);                       /* 先回到有卡片的那一屏，再滑出详情页 */
              setTimeout(() => openItem(i), 780);
            } else {
              openItem(i);
            }
          }
        });
      });
      out.push(
        {
          group: '动作', icon: 'bolt', t: '切换明 / 暗主题', s: '从按钮处圆形揭开（T）', hay: '主题 深色 浅色 theme dark light',
          run: () => toggleTheme()
        },
        {
          group: '动作', icon: 'bolt', t: '重播标题动效', s: '首屏那行大字重新逐字浮现（R）', hay: '标题 重播 replay title',
          run: () => { scroller.go(0); setTimeout(replayTitle, 120); }
        },
        {
          group: '动作', icon: 'bolt', t: '把首屏大字打散成粒子', s: '跟点一下标题一样：字化成粒子，鼠标能把它们推开', hay: '标题 粒子 散开 消散 dissolve particles',
          run: () => {
            const wasHome = scroller.index() === 0;
            scroller.go(0);
            setTimeout(dissolveTitle, wasHome ? 120 : 900);
          }
        },
        {
          group: '动作', icon: 'bolt', t: '换一个转场', s: '下一屏换一套动效：淡入 / 推移 / 翻卡 / 缩放 / 虚化 / 擦除', hay: '转场 动效 transition 动画',
          run: () => {
            const t = scroller.cycleTransition();
            if (t) toast('下一页用「' + t.name + '」转场 —— 翻一下就看到了');
          }
        },
        {
          group: '动作', icon: 'bolt', t: '翻到下一屏 / 上一屏', s: '滚轮、空格、↑↓、拖动空白处都能翻', hay: '翻页 下一屏 上一屏 next prev',
          run: () => scroller.next()
        },
        {
          group: '动作', icon: 'bolt', t: '快捷键与互动一览', s: '所有能玩的东西都在这张表里（?）', hay: '快捷键 帮助 help 互动 说明',
          run: () => { if (featOn('tools.keys')) openKeys(); }
        },
        {
          group: '动作', icon: 'bolt', t: '暂停 / 继续背景粒子', s: '想安静一点、或者省点电', hay: '粒子 背景 暂停 省电 pause particles',
          run: () => {
            if (!fx) return;
            const paused = fx.setPaused(!fx.isPaused());
            toast(paused ? '背景粒子已暂停（鼠标划过就恢复？—— 用同一个命令恢复）' : '背景粒子继续');
          }
        }
      );

      /* 全文搜索：文章 / 作品 / 标签（索引由构建脚本生成，见下面的 ensureIndex） */
      const idx = window.SITE_INDEX;
      if (idx) {
        (idx.posts || []).forEach((p) => out.push({
          group: '文章', icon: 'pen', t: p.t, s: p.s, w: 4,
          hay: [p.t, p.s, p.k, p.d].join(' '),
          run: () => { location.href = p.u; }
        }));
        (idx.projects || []).forEach((p) => out.push({
          group: '作品', icon: 'grid', t: p.t, s: p.s, w: 4,
          hay: [p.t, p.s, p.k, p.d].join(' '),
          run: () => { location.href = p.u; }
        }));
        (idx.tags || []).forEach((t) => out.push({
          group: '标签', icon: 'book', t: '#' + t.t, s: t.n + ' 条', w: 1,
          hay: [t.t, '标签 tag'].join(' '),
          run: () => { location.href = t.u; }
        }));
      }
      return out;
    }

    /* ---------- 搜索索引：按需加载 ----------
       构建脚本生成 assets/site-index.js（window.SITE_INDEX），内容是文章/作品/标签的
       标题、摘要与标签。它**不**放在 <head> 里同步加载 —— 否则文章一多，首屏就被它拖慢；
       命令面板第一次打开时才拉，本地文件也就几毫秒。
       用 <script> 标签而不是 fetch：file:// 下 fetch 会被 CORS 拦，script 不会。 */
    let indexState = 'idle';           /* idle | loading | ready | failed */
    const indexWaiters = [];

    function ensureIndex(done) {
      if (window.SITE_INDEX || indexState === 'failed') { done(); return; }
      indexWaiters.push(done);
      if (indexState === 'loading') return;
      indexState = 'loading';

      const s = document.createElement('script');
      const base = SITE.searchIndex || 'assets/site-index.js';
      const v = SITE.assetVersion ? '?v=' + encodeURIComponent(SITE.assetVersion) : '';
      s.src = base + v;
      s.onload = () => {
        indexState = 'ready';
        indexWaiters.splice(0).forEach((f) => f());
      };
      s.onerror = () => {
        indexState = 'failed';
        toast('搜索索引没加载出来，暂时只能搜页面和卡片');
        indexWaiters.splice(0).forEach((f) => f());
      };
      document.head.appendChild(s);
    }

    /* 模糊匹配：按顺序命中就算匹配，连续命中加分 */
    function fuzzy(q, text) {
      if (!q) return { score: 0, hits: [] };
      q = q.toLowerCase();
      text = String(text || '').toLowerCase();
      let ti = 0, streak = 0, score = 0;
      const hits = [];
      for (let i = 0; i < q.length; i++) {
        const c = q[i];
        if (c === ' ') continue;
        const found = text.indexOf(c, ti);
        if (found < 0) return null;
        if (found === ti) { streak++; score += 4 + streak; } else { streak = 0; score += 1; }
        hits.push(found);
        ti = found + 1;
      }
      return { score: score - Math.floor(text.length / 14), hits: hits };
    }

    function mark(text, hits) {
      const set = {};
      hits.forEach((i) => { set[i] = 1; });
      let out = '', open = false;
      const chars = Array.from(String(text || ''));
      for (let i = 0; i < chars.length; i++) {
        const on = !!set[i];
        if (on && !open) { out += '<b>'; open = true; }
        else if (!on && open) { out += '</b>'; open = false; }
        out += esc(chars[i]);
      }
      return out + (open ? '</b>' : '');
    }

    function render() {
      if (!view.length) {
        list.innerHTML = '<div class="cmdk-empty">没有匹配项 —— 试试「简历」「主题」「转场」</div>';
        if (countEl) countEl.textContent = '0 项';
        return;
      }
      let html = '', lastGroup = '';
      view.forEach((it, i) => {
        if (it.group !== lastGroup) {
          html += '<div class="cmdk-group">' + esc(it.group) + '</div>';
          lastGroup = it.group;
        }
        html += '<button class="cmdk-item' + (i === sel ? ' is-sel' : '') + '" type="button" role="option"'
          + ' id="cmdk-i' + i + '" aria-selected="' + (i === sel ? 'true' : 'false') + '" data-i="' + i + '">'
          + '<span class="cmdk-ico">' + icon(it.icon) + '</span>'
          + '<span class="cmdk-txt"><span class="cmdk-t">' + (it.tHtml || esc(it.t)) + '</span>'
          + (it.s ? '<span class="cmdk-s">' + esc(it.s) + '</span>' : '')
          + '</span></button>';
      });
      list.innerHTML = html;
      if (countEl) countEl.textContent = view.length + ' 项';
      const selEl = document.getElementById('cmdk-i' + sel);
      if (selEl) {
        input.setAttribute('aria-activedescendant', 'cmdk-i' + sel);
        if (selEl.scrollIntoView) selEl.scrollIntoView({ block: 'nearest' });
      }
    }

    function filter() {
      const q = input.value.trim();
      view = [];
      items.forEach((it) => {
        const m = fuzzy(q, (it.t || '') + ' ' + (it.hay || ''));
        if (!m) return;
        view.push(Object.assign({}, it, { score: m.score + (it.group === '页面' ? 6 : 0) + (it.w || 0), tHtml: mark(it.t, fuzzy(q, it.t) ? fuzzy(q, it.t).hits : []) }));
      });
      view.sort((a, b) => b.score - a.score);
      sel = 0;
      render();
    }

    function open() {
      if (isOpen) return;
      items = buildItems();
      isOpen = true;
      openFlags.palette = true;
      root._focusTrigger = document.activeElement;
      root.hidden = false;
      input.value = '';
      sel = 0;
      filter();
      focusBack = document.activeElement;
      setTimeout(() => input.focus(), 20);
      /* 文章/作品/标签的索引是另一个文件，面板第一次打开时才拉。
         到了之后重建条目、按当前输入重新过滤 —— 不打断已经打了一半的字。 */
      ensureIndex(() => {
        if (!isOpen) return;
        items = buildItems();
        filter();
      });
    }

    function close() {
      if (!isOpen) return;
      isOpen = false;
      openFlags.palette = false;
      root.hidden = true;
      if (focusBack && focusBack.focus) { try { focusBack.focus(); } catch (e) { /* 忽略 */ } }
      focusBack = null;
    }

    function run(i) {
      const it = view[i];
      if (!it) return;
      close();
      setTimeout(() => it.run(), 30);
    }

    function move(d) {
      if (!view.length) return;
      sel = (sel + d + view.length) % view.length;
      render();
    }

    list.addEventListener('click', (e) => {
      const t = e.target;
      const item = t && t.closest ? t.closest('.cmdk-item') : null;
      if (item) run(Number(item.dataset.i));
    });
    list.addEventListener('pointermove', (e) => {
      const t = e.target;
      const item = t && t.closest ? t.closest('.cmdk-item') : null;
      if (!item) return;
      const i = Number(item.dataset.i);
      if (i !== sel) { sel = i; render(); }
    });
    input.addEventListener('input', filter);
    root.addEventListener('click', (e) => {
      const t = e.target;
      if (t && t.hasAttribute && t.hasAttribute('data-cmdk-close')) close();
    });
    if (openBtn) openBtn.addEventListener('click', open);

    return {
      isOpen: () => isOpen,
      open: open,
      close: close,
      toggle: () => (isOpen ? close() : open()),
      key: (e) => {
        if (!isOpen) return false;
        if (e.key === 'Escape') { e.preventDefault(); close(); return true; }
        if (e.key === 'ArrowDown') { e.preventDefault(); move(1); return true; }
        if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); return true; }
        if (e.key === 'Enter' && e.target === input) { e.preventDefault(); run(sel); return true; }
        return false;
      }
    };
  }
