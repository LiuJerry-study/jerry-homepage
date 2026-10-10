/* ======================== 10. 快捷键一览 ======================== */
  let keysEl = null;
  const KEY_ROWS = [
    { k: ['滚轮', '空格', '↓'], d: '翻到下一屏' },
    { k: ['↑', 'PgUp'], d: '翻到上一屏' },
    { k: ['1', '2'], d: '直接跳到第 N 屏' },
    { k: ['Home', 'End'], d: '第一屏 / 最后一屏' },
    { k: ['Ctrl', 'K'], d: '命令面板：搜索页面 / 卡片 / 动作' },
    { k: ['T'], d: '切换明暗主题（从按钮处圆形揭开）' },
    { k: ['R'], d: '重播标题逐字浮现' },
    { k: ['?'], d: '打开 / 收起这张表' },
    { k: ['Esc'], d: '关掉当前浮层 / 详情页' },
    { k: ['拖动空白处'], d: '拖拽翻屏：跟手、松手有惯性，够远或够快就翻' },
    { k: ['点标题'], d: '整行字散成粒子（鼠标能推开它们、还会连线）；约两秒后自己聚回来' },
    { k: ['点击任意处'], d: '核心闪光 + 冲击波 + 火星拖尾，鼠标附近的粒子会被推开' },
    { k: ['悬停卡片'], d: '停留一下看这条目的预览' },
    { k: ['点击卡片'], d: '从右侧滑进整屏详情页（返回按钮 / Esc / 向右滑回来）' }
  ];

  function initKeys() {
    keysEl = document.getElementById('keys');
    const grid = document.getElementById('keys-grid');
    if (!keysEl || !grid) return { isOpen: () => false, toggle: () => {}, close: () => {} };
    grid.innerHTML = KEY_ROWS.map((row) => (
      '<div class="key-row"><span class="key-k">'
      + row.k.map((k) => '<kbd>' + esc(k) + '</kbd>').join('')
      + '</span><span class="key-d">' + esc(row.d) + '</span></div>'
    )).join('');
    keysEl.addEventListener('click', (e) => {
      const t = e.target;
      if (t && t.closest && t.closest('[data-keys-close]')) closeKeys();
    });
    return { isOpen: () => openFlags.keys, toggle: () => (openFlags.keys ? closeKeys() : openKeys()), close: closeKeys };
  }

  function openKeys() {
    if (!keysEl) return;
    openFlags.keys = true;
    keysEl.hidden = false;
    const close = $('.keys-head .icon-btn', keysEl);
    if (close) close.focus();
  }
  function closeKeys() {
    if (!keysEl || !openFlags.keys) return;
    openFlags.keys = false;
    keysEl.hidden = true;
  }

  