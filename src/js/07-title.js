/* ======================== 6. 标题：逐字浮现 + 点击消散成粒子 ======================== */
  let replayTitle = () => {};
  let dissolveTitle = () => {};

  function initTitle() {
    const h1 = document.getElementById('hero-title');
    if (!h1) return;
    const raw = (h1.dataset.text || h1.textContent || SITE.tagline || '').trim();
    if (!raw) return;
    h1.dataset.text = raw;
    h1.setAttribute('aria-label', raw);

    const frag = document.createDocumentFragment();
    Array.from(raw).forEach((c, i) => {
      const s = document.createElement('span');
      s.className = 'ch' + (i < 2 ? ' accent' : '');
      s.textContent = c === ' ' ? '\u00A0' : c;
      s.style.setProperty('--i', String(i));
      s.setAttribute('aria-hidden', 'true');
      frag.appendChild(s);
    });
    const caret = document.createElement('span');
    caret.className = 'caret';
    caret.setAttribute('aria-hidden', 'true');
    frag.appendChild(caret);

    h1.textContent = '';
    h1.appendChild(frag);

    const chars = $$('.ch', h1);

    let goneTimer = 0;
    let dissolving = false;

    /* 标题回来（自动重聚 / R 键 / 翻回首屏）走同一条路：清掉待办的计时器、解除「散着」状态 */
    replayTitle = () => {
      clearTimeout(goneTimer);
      dissolving = false;
      h1.classList.remove('is-gone');
      h1.classList.remove('is-in');
      void h1.offsetWidth;
      h1.classList.add('is-in');
    };

    /* 点一下：整行字朝外炸开、化成一团粒子。
       大字本身不动（不拖、不位移）—— 动的只有「消散」这一下。
       粒子撒进背景层，和背景粒子同一套物理：鼠标能推开它们、还会连线。
       散完约 2s 自动重聚 —— 首页不能真的没有标题。
       散着的时候再点它没有反应（不会提前聚回来），只能等这一下走完。 */
    function dissolve(x, y) {
      if (dissolving) return;                            /* 散开中：点了也不聚回，等它自己聚 */
      if (!motionOK || !fx) { replayTitle(); return; }   /* 关了动效就退回「重播」 */
      dissolving = true;

      const vw = window.innerWidth, vh = window.innerHeight;
      const box = h1.getBoundingClientRect();
      const cx = (x == null) ? box.left + box.width / 2 : x;
      const cy = (y == null) ? box.top + box.height / 2 : y;

      /* 落点：先「分层抽样」保证铺得满，再叠一层**平滑的域扭曲**。
         只用分层 = 一张规则的格子，看着就是「排好队撒出去的」，很刻意。
         域扭曲是低频、平滑的位移：整体覆盖几乎不变（不会像纯随机那样这儿结块那儿留空），
         但格子的规律被打散，而且压缩的地方自然变密、拉伸的地方自然变疏 ——
         疏密是「长出来的」，不是算出来的。四个相位每次点击都重新掷。 */
      const wA = Math.random() * 6.2832, wB = Math.random() * 6.2832;
      const wC = Math.random() * 6.2832, wD = Math.random() * 6.2832;
      const warpX = (px0, py0) => Math.sin(py0 * 0.0130 + wA) * 46 + Math.sin(px0 * 0.0058 + wB) * 27;
      const warpY = (px0, py0) => Math.cos(px0 * 0.0108 + wC) * 40 + Math.cos(py0 * 0.0067 + wD) * 23;

      /* 粒子总数按**屏幕面积**给：屏越大撒得越多 —— 铺得满，又不至于糊成一团 */
      const budget = clamp(Math.round((vw * vh) / 4800), 90, 300);

      /* 落点用「分层抽样」铺满整屏：把屏幕切成 budget 个格子再打乱，一个粒子占一格（格内随机）。
         纯随机撒会这边结块、那边留空；分层之后是均匀铺满，看上去又不呆板。 */
      const cols = Math.max(2, Math.round(Math.sqrt(budget * vw / Math.max(1, vh))));
      const rows = Math.max(2, Math.ceil(budget / cols));
      const nCells = cols * rows;
      const order = [];
      for (let c0 = 0; c0 < nCells; c0++) order.push(c0);
      for (let c0 = order.length - 1; c0 > 0; c0--) {      /* 打乱，免得粒子按格子顺序排着队飞 */
        const j = Math.floor(Math.random() * (c0 + 1));
        const t0 = order[c0]; order[c0] = order[j]; order[j] = t0;
      }
      const cw = vw / cols, chh = vh / rows;
      let cellAt = 0;

      const boxes = [];
      let areaAll = 0;
      for (let i = 0; i < chars.length; i++) {
        const b = chars[i].getBoundingClientRect();
        boxes.push(b);
        if (b.width > 0 && b.height > 0) areaAll += b.width * b.height;
      }

      for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];
        const b = boxes[i];
        if (!b.width || !b.height) continue;
        const mx = b.left + b.width / 2;
        const my = b.top + b.height / 2;
        let dx = mx - cx, dy = my - cy;
        const d = Math.hypot(dx, dy) || 1;
        dx /= d; dy /= d;

        /* 这个字自己：朝离心方向飞一点、转一点、糊掉 */
        const push = 14 + Math.random() * 30;
        ch.style.setProperty('--ox', (dx * push + (Math.random() - .5) * 16).toFixed(1) + 'px');
        ch.style.setProperty('--oy', (dy * push - 6 - Math.random() * 16).toFixed(1) + 'px');
        ch.style.setProperty('--os', (1.04 + Math.random() * .22).toFixed(2));
        ch.style.setProperty('--or', ((Math.random() - .5) * 14).toFixed(1) + 'deg');
        ch.style.setProperty('--o', String(Math.round(i * 11 + Math.random() * 170)));

        /* 字里撒出粒子：起点按字框面积分（所以一散开就是「字」的形状），
           落点在**整屏**均匀取样（所以最后铺满整个屏幕，而不是堆在字这一带）。 */
        const acc = ch.classList.contains('accent');
        const count = Math.max(4, Math.round(budget * (b.width * b.height) / (areaAll || 1)));
        for (let n = 0; n < count; n++) {
          const sx = b.left + Math.random() * b.width;
          const sy = b.top + Math.random() * b.height;
          const cell = order[cellAt++ % nCells];
          const bx = Math.min(vw - 2, (cell % cols) * cw + Math.random() * cw);
          const by = Math.min(vh - 2, Math.floor(cell / cols) * chh + Math.random() * chh);
          /* 域扭曲：用没扭曲的坐标算位移，两个轴都算完再一起赋值 */
          let tx = clamp(bx + warpX(bx, by), 2, vw - 2);
          let ty = clamp(by + warpY(bx, by), 2, vh - 2);
          /* 落点离起点太近（正好落在字这一格）：顺着离心方向推出去一点，保证「飞出去」看得见 */
          const tdx = tx - sx, tdy = ty - sy;
          const tdist = Math.hypot(tdx, tdy);
          const need = Math.min(vw, vh) * 0.18;
          if (tdist < need) {
            const ux = tdist > 0.001 ? tdx / tdist : dx;
            const uy = tdist > 0.001 ? tdy / tdist : dy;
            tx = clamp(sx + ux * need, 2, vw - 2);
            ty = clamp(sy + uy * need, 2, vh - 2);
          }
          const vx = sx - cx, vy = sy - cy;
          const vd = Math.hypot(vx, vy) || 1;
          const sp = (0.25 + Math.random() * 2.1) * (acc ? 1.15 : 1);
          /* 每个粒子自己的节奏：起飞先后、逼近快慢、侧向漂移。
             三项都随机，散开时才不会像一张被整体平移的图。 */
          const ang = Math.random() * 6.2832;
          const wand = 0.12 + Math.random() * 0.45;
          fx.emit(sx, sy,
                  (vx / vd) * sp + (Math.random() - .5) * .4,
                  (vy / vd) * sp - .2 - Math.random() * .4,
                  { hi: acc, tx: tx, ty: ty,
                    seek: 420 + Math.random() * 760,
                    del: Math.random() * 190,
                    s: 0.040 + Math.random() * 0.090,
                    wx: Math.cos(ang) * wand,
                    wy: Math.sin(ang) * wand });
        }
      }

      h1.classList.add('is-gone');

      clearTimeout(goneTimer);
      goneTimer = setTimeout(() => {
        replayTitle();          /* 重聚：再逐字浮现一遍，剩下的粒子自己化掉 */
      }, 2000);
    }
    dissolveTitle = dissolve;

    h1.addEventListener('click', (e) => {
      e.stopPropagation();
      dissolve(e.clientX, e.clientY);
    });
    h1.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dissolve(); }
    });

    if (motionOK) requestAnimationFrame(() => requestAnimationFrame(replayTitle));
    else replayTitle();
  }

  