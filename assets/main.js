/* ==========================================================================
   个人门户 · 交互层（零依赖，原生 JS）
   --------------------------------------------------------------------------
   0  工具与全局状态                    7  导航卡片（悬停预览 · 详情页）
   1  提示条                            8  舞台：一屏一页（锁死不滚 + 六套转场）
   2  主题（明/暗 + 圆形揭示）          9  命令面板（Ctrl / ⌘ + K）
   3  背景：粒子连线 / 爆点 / 文字粒子    10 快捷键一览
   4  光标：光晕 + 磁吸 + 拖拽惯性        11 时钟与年份
   5  点击爆点（新：画家在 #fx-overlay 上）  12 启动
   6  标题：逐字浮现 + 点击消散成粒子

   「爆点」有两套，默认**每次点击独立掷一次骰子**（content/site.js 的 randomBurst）：
     新 —— 核心闪光 + 冲击波 + 火星拖尾，整套画在 #fx-overlay 上，没有新 DOM、没有新位图；
     旧 —— 一个最大 2600×2600px 的 DOM 圆 + 细环 + 小圆点，画在卡片后面。
   网址能把风格钉死：?fx=random（随机）/ ?fx=new / ?fx=classic。
   proto/burst-lab.html 靠这个参数做左右对照。

   版式的核心在第 8 节：文档（html/body）锁死 height:100% + overflow:hidden，
   翻屏不靠滚动，而是把「面板」原地换掉 —— 所以页面本身永远不动。
   某一屏真的装不下时，只有那一屏内部滚（.panel-scroll），文档仍然不动。
   ========================================================================== */
(() => {
  'use strict';

  /* ======================== 0. 工具与全局状态 ======================== */
  const SITE = Object.assign({
    tagline: '未来 由我们创造',
    showAddCard: true,
    randomTransition: true,
    nav: []
  }, window.SITE || {});

  const html = document.documentElement;
  const body = document.body;
  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  let motionOK = !mqReduce.matches;

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  /* 指针位置：t* 是目标，p* 是缓动后的实际值 */
  const state = {
    px: window.innerWidth * 0.5,
    py: window.innerHeight * 0.35,
    tx: window.innerWidth * 0.5,
    ty: window.innerHeight * 0.35
  };

  let fx = null;                    /* 背景特效（initFx 之后可用） */
  let scroller = {                  /* 舞台控制器（initStage 之后可用） */
    go: () => {}, next: () => {}, prev: () => {}, index: () => 0, count: () => 1, active: () => false
  };
  const openFlags = { palette: false, keys: false, detail: false };

  /* 爆点风格。三档：
       'random'  —— 每次点击**独立**随机挑一套（默认；开关是 content/site.js 的 randomBurst）
       'new'     —— 只用新的那套（核心闪光 + 冲击波 + 火星拖尾，画在 #fx-overlay 上）
       'classic' —— 只用旧的那套（巨大 DOM 圆 + 细环 + 小圆点）
     网址参数优先且能钉死：?fx=new / ?fx=classic / ?fx=random。
     proto/burst-lab.html 就是靠它做左右对照的。 */
  const FX_ARG = new URLSearchParams(location.search).get('fx');
  const FX_MODE = (FX_ARG === 'new' || FX_ARG === 'classic' || FX_ARG === 'random')
    ? FX_ARG
    : (SITE.randomBurst === false ? 'new' : 'random');

  /* ======================== 1. 提示条 ======================== */
  const toastEl = document.getElementById('toast');
  let toastTimer = 0;
  function toast(msg, sticky) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    if (!sticky) toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 3400);
  }
  function toastOff() {
    clearTimeout(toastTimer);
    if (toastEl) toastEl.classList.remove('is-on');
  }

  /* ======================== 2. 主题 ======================== */
  const THEME_KEY = 'portal-theme';
  const themeMeta = document.querySelector('meta[name="theme-color"]');

  function applyTheme(theme, persist) {
    html.dataset.theme = theme;
    if (persist) { try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* 隐私模式忽略 */ } }
    if (themeMeta) themeMeta.setAttribute('content', theme === 'dark' ? '#07130F' : '#F4F9F5');
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
      btn.title = theme === 'dark' ? '切到浅色（T）' : '切到深色（T）';
    }
    if (fx) fx.recolor();
  }

  function toggleTheme() {
    const next = html.dataset.theme === 'dark' ? 'light' : 'dark';
    const run = () => applyTheme(next, true);
    const btn = document.getElementById('theme-toggle');
    if (!document.startViewTransition || !motionOK) { run(); return; }
    try {
      const r = btn ? btn.getBoundingClientRect() : { left: window.innerWidth - 60, top: 40, width: 0, height: 0 };
      html.style.setProperty('--vt-x', (r.left + r.width / 2) + 'px');
      html.style.setProperty('--vt-y', (r.top + r.height / 2) + 'px');
      const vt = document.startViewTransition(run);
      if (vt && vt.finished && vt.finished.catch) vt.finished.catch(() => {});
    } catch (e) { run(); }
  }

  /* ======================== 3. 背景：粒子 + 连线 + 爆点 + 文字粒子 ======================== */
  function initFx() {
    const canvas = document.getElementById('fx-canvas');
    const bgEl = document.getElementById('bg');
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    /* 爆点层：在内容之上（和以前的 .ripple 同一层），专门画爆炸。
       旧的 DOM 涟漪是一张 2600×2600 的位图，每次点击都要新建、栅格化、再回收；
       现在是同一张画布上的几个圆和几条线。
       random 模式下两套都可能用到，所以这里照样建 —— classic 模式才省掉它。 */
    let ov = null;
    if (FX_MODE !== 'classic') {
      ov = document.getElementById('fx-overlay');
      if (!ov) {
        /* 兜底：万一浏览器缓存里的 index.html 还是旧版（没有这个元素），
           而 main.js 已经是新的 —— 不补一个的话 octx 就是 null，
           random 模式会永远只走旧的那套，看着就像「新爆点不出现」。 */
        ov = document.createElement('canvas');
        ov.id = 'fx-overlay';
        ov.setAttribute('aria-hidden', 'true');
        ov.style.cssText = 'position:fixed;inset:0;z-index:3;width:100%;height:100%;pointer-events:none';
        document.body.appendChild(ov);
      }
    }
    const octx = ov ? ov.getContext('2d') : null;

    let W = 0, H = 0;
    let parts = [], sparks = [], rings = [], blasts = [];
    let buckets = [];        /* 连线用的空间网格，逐帧复用，不重新分配 */
    let linkPaths = [[], [], [], []];   /* 连线按透明度分 4 档，逐帧复用 */
    let dotPaths = null;                /* 小圆点按「颜色 × 透明度档」分组，逐帧复用 */
    let rgb = '18,184,134', line = '18,184,134', rgbHi = '78,216,168';
    let raf = 0, last = 0, rt = 0, paused = false, t0 = 0;
    let nMotes = 0;        /* 文字散出来的「墨点」数量：单独限流，不去挤背景粒子 */
    let ovDirty = false;   /* 爆点层上一帧画过东西没有（没有就不用每帧清一遍） */

    function readColors() {
      const cs = getComputedStyle(html);
      const p = cs.getPropertyValue('--particle').trim();
      const l = cs.getPropertyValue('--link-line').trim();
      const h = cs.getPropertyValue('--particle-hi').trim();
      if (p) rgb = p;
      if (l) line = l;
      if (h) rgbHi = h;
    }

    function seed() {
      const n = clamp(Math.round((W * H) / 26000), 24, 84);
      parts = [];
      for (let i = 0; i < n; i++) {
        const soft = i % 7 === 0;
        parts.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random() - .5) * .16,
          vy: (Math.random() - .5) * .16 - .04,
          r: soft ? 18 + Math.random() * 26 : .6 + Math.random() * 1.5,
          a: soft ? .10 + Math.random() * .10 : .18 + Math.random() * .34,
          soft: soft,
          ph: Math.random() * Math.PI * 2
        });
      }
      sparks = [];
      rings = [];
      blasts = [];
      nMotes = 0;
    }

    function resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.max(1, Math.floor(W * dpr));
      canvas.height = Math.max(1, Math.floor(H * dpr));
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (ov) {
        ov.width = Math.max(1, Math.floor(W * dpr));
        ov.height = Math.max(1, Math.floor(H * dpr));
        ov.style.width = W + 'px';
        ov.style.height = H + 'px';
        octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      seed();
    }

    /* 柔和光斑用一张预渲染的小图，而不是每帧 createRadialGradient。
       以前 12 个光斑 × 每帧一个渐变对象 = 每秒 700 多次分配，
       现在只在配色变了的时候重画一次这张 96×96 的贴图。 */
    let spriteCv = null, spriteCol = '';
    function softSprite(col) {
      if (spriteCv && spriteCol === col) return spriteCv;
      const S = 96;
      const cv = document.createElement('canvas');
      cv.width = cv.height = S;
      const c = cv.getContext('2d');
      const g = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      g.addColorStop(0, 'rgba(' + col + ',1)');
      g.addColorStop(1, 'rgba(' + col + ',0)');
      c.fillStyle = g;
      c.fillRect(0, 0, S, S);
      spriteCv = cv;
      spriteCol = col;
      return cv;
    }

    /* 判定一对粒子要不要连线。分桶之后它每帧只被叫「附近的对」那么多次。 */
    function linkPair(a, b, MAXD2, linkPaths) {
      const dx = a.x - b.x, dy = a.y - b.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= MAXD2) return;
      const fa = a.__f, fb = b.__f;
      const al = (1 - d2 / MAXD2) * 0.16 * (fa < fb ? fa : fb);
      const lv = al > .12 ? 3 : (al > .08 ? 2 : (al > .04 ? 1 : 0));
      linkPaths[lv].push(a.x, a.y, b.x, b.y);
    }

    /* 只往「格子序号更大」的 4 个邻格看，一对就只会被数一次 */
    const NEI = [[1, 0], [-1, 1], [0, 1], [1, 1]];

    /* 颜色小工具：把 "r,g,b" 拆开，按比例混向另一个色，再拼回去。
       爆点每次换个色温就是靠这两个（仍然在同一套绿里换气质，不动品牌色）。 */
    function rgbOf(s) {
      const p = String(s).split(',');
      return [+p[0] || 0, +p[1] || 0, +p[2] || 0];
    }
    function mixTo(a, b, t) {
      return [
        Math.round(a[0] + (b[0] - a[0]) * t),
        Math.round(a[1] + (b[1] - a[1]) * t),
        Math.round(a[2] + (b[2] - a[2]) * t)
      ].join(',');
    }
    function pick(n) { return (Math.random() * n) | 0; }

    /* 点一下的爆点。
       推开周围的粒子这一步两条路径都有 —— 爆炸的「劲」一半在这儿，不在画面上。
       新路径：核心闪光 + 一圈冲击波 + 十几条火星拖尾，全部画在内容之上的爆点层。
       旧路径：细环 + 小圆点火花，画在粒子画布上（也就是卡片后面），外加一个 DOM 圆。
       返回 true 表示「这一下走的是旧路径」，外面据此决定要不要建那个 DOM 圆。 */
    function burst(x, y, power) {
      power = power || 1;

      /* 这一下用哪套？random 模式就在这儿掷骰子 —— 每次点击**独立**掷，
         不是新旧交替，所以连着两下是同一套是正常的。 */
      const classic = FX_MODE === 'classic' || !octx
        || (FX_MODE === 'random' && Math.random() < 0.5);

      /* 把周围粒子往外轰一把 */
      const R = 240 * power, R2 = R * R;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        const dx = p.x - x, dy = p.y - y;
        const d2 = dx * dx + dy * dy;
        if (d2 < R2 && d2 > 1) {
          const d = Math.sqrt(d2);
          const f = (1 - d / R) * (p.soft ? 1.6 : 7) * power;
          p.vx += (dx / d) * f;
          p.vy += (dy / d) * f;
        }
      }

      if (classic) {
        rings.push({ x: x, y: y, r: 6, max: 190 * power, life: 0, dur: 640 });
        const n = coarse ? 5 : 12;
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2;
          const sp = (0.5 + Math.random() * 1.9) * power;
          sparks.push({
            x: x, y: y,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp,
            life: 0,
            dur: 480 + Math.random() * 560,
            r: .8 + Math.random() * 1.7
          });
        }
        if (sparks.length > 90) sparks.splice(0, sparks.length - 90);
        return true;
      }

      /* 每次挑一个色温：偏白更「炸」、偏青更冷、偏深更收，第一个就是原本的品牌绿 */
      const base = rgbOf(rgbHi);
      const lineRgb = rgbOf(line);
      const deep = rgbOf(rgb);
      const HUES = [
        [rgbHi, line],
        [mixTo(base, [255, 255, 255], .42), mixTo(lineRgb, [255, 255, 255], .20)],
        [mixTo(base, [120, 232, 255], .38), line],
        [mixTo(base, deep, .42), mixTo(lineRgb, deep, .35)]
      ];
      const hue = HUES[pick(HUES.length)];
      const hi = hue[0], ln = hue[1];

      /* 形状也每次变一点：起始朝向、大小、火星与余烬的条数 ——
         连着点十几下，没有两下长得一样。 */
      const spin = Math.random() * 6.2832;
      const rScale = 0.88 + Math.random() * 0.30;

      const bits = [];

      /* 火星：起步很快、拖着尾巴冲出去，然后迅速被拖住 —— 快起慢收才有「炸」的感觉。
         角度按「均分 + 一点抖动」，纯随机会有几条挤成一堆、别处空着。 */
      const n = coarse ? 5 + pick(4) : 11 + pick(8);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 6.2832 + spin + (Math.random() - .5) * .55;
        const sp = (3.2 + Math.random() * 5.8) * power;
        bits.push({
          x: x, y: y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 0,
          dur: 320 + Math.random() * 340,
          w: 1.2 + Math.random() * 1.7,
          hot: Math.random() < .4,
          g: .012,
          streak: true
        });
      }

      /* 余烬：慢、久、轻轻往上飘。火星灭了它还在亮 —— 爆炸才有「余温」而不是一闪就没 */
      const em = coarse ? 1 + pick(3) : 4 + pick(5);
      for (let i = 0; i < em; i++) {
        const a = Math.random() * 6.2832;
        const sp = (.3 + Math.random() * .9) * power;
        bits.push({
          x: x, y: y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - .2,
          life: 0,
          dur: 560 + Math.random() * 360,
          w: 1 + Math.random() * 1,
          hot: true,
          g: -.004,
          streak: false
        });
      }

      /* 冲击波和闪光 720ms 走完，可余烬能亮到 1.1s —— 所以「这一场」的寿命按最长的那个算，
         不然余烬会在半路被整场一起丢掉。 */
      let end = 720;
      for (let i = 0; i < bits.length; i++) if (bits[i].dur > end) end = bits[i].dur;

      blasts.push({
        x: x, y: y, power: power, life: 0,
        dur: 720,                /* 冲击波与闪光的时间线 */
        end: end,                /* 整场真正结束的时刻 */
        R: (168 + 96 * power) * rScale,   /* 冲击波最大半径 */
        flash: 240,              /* 核心闪光只亮这么久 */
        hi: hi,                  /* 这一场自己的两个颜色，见上面 HUES */
        ln: ln,
        bits: bits
      });
      /* 连点也不怕：同时最多留 4 场，多出来的从最旧的开始丢 */
      if (blasts.length > 4) blasts.splice(0, blasts.length - 4);
      return false;
    }

    /* 画一场爆炸。整场只有几个圆和几条线，所以贵不到哪去。
       颜色用这一场自己的 o.hi / o.ln（每次点击挑的色温），不是全局的那两个。 */
    function drawBlast(o) {
      /* 环和闪光有自己的时间线；余烬比它们活得久，所以两段分开判 */
      if (o.life < o.dur) {
        const k = clamp(o.life / o.dur, 0, 1);
        const e = 1 - Math.pow(1 - k, 2.6);     /* 先快后慢：一口气冲出去，再收住 */
        const fade = 1 - k;
        const R = o.R * e;

        /* ① 核心闪光：极短、很亮，负责「炸」的那一下。
           alpha 用线性衰减而不是平方 —— 平方会让它在肉眼看到之前就没了。 */
        const fk = 1 - o.life / o.flash;
        if (fk > 0) {
          const fr = (46 + 58 * o.power) * (0.55 + 0.45 * fk);
          const g = octx.createRadialGradient(o.x, o.y, 0, o.x, o.y, fr);
          g.addColorStop(0, 'rgba(255,255,255,' + (0.66 * fk).toFixed(3) + ')');
          g.addColorStop(.30, 'rgba(' + o.hi + ',' + (0.48 * fk).toFixed(3) + ')');
          g.addColorStop(1, 'rgba(' + o.hi + ',0)');
          octx.globalCompositeOperation = 'lighter';   /* 发光，而不是盖一层白 */
          octx.fillStyle = g;
          octx.beginPath();
          octx.arc(o.x, o.y, fr, 0, 6.2832);
          octx.fill();
          octx.globalCompositeOperation = 'source-over';
        }

        /* ② 冲击波：前面一圈亮边，后面拖一层很快淡掉的柔光 */
        const gf = 1 - k * 1.7;
        if (gf > 0.01 && R > 1) {
          const g = octx.createRadialGradient(o.x, o.y, 0, o.x, o.y, R);
          g.addColorStop(0, 'rgba(' + o.hi + ',' + (0.09 * gf).toFixed(3) + ')');
          g.addColorStop(.72, 'rgba(' + o.ln + ',' + (0.19 * gf).toFixed(3) + ')');
          g.addColorStop(1, 'rgba(' + o.ln + ',0)');
          octx.fillStyle = g;
          octx.beginPath();
          octx.arc(o.x, o.y, R, 0, 6.2832);
          octx.fill();
        }
        if (fade > 0.02 && R > 2) {
          octx.strokeStyle = 'rgba(' + o.hi + ',' + (0.68 * fade * fade).toFixed(3) + ')';
          octx.lineWidth = 1.1 + 5.2 * fade;
          octx.beginPath();
          octx.arc(o.x, o.y, R, 0, 6.2832);
          octx.stroke();
        }
      }

      /* ③ 火星与余烬 */
      octx.lineCap = 'round';
      for (let i = 0; i < o.bits.length; i++) {
        const s = o.bits[i];
        const sk = 1 - s.life / s.dur;
        if (sk <= 0) continue;
        const a = sk * sk;
        const col = s.hot ? o.hi : o.ln;
        if (!s.streak) {
          /* 余烬用「发光」叠上去，而且衰减是线性的 ——
             平方衰减会让它还没被看见就已经没了 */
          octx.globalCompositeOperation = 'lighter';
          octx.fillStyle = 'rgba(' + col + ',' + (sk * 0.5).toFixed(3) + ')';
          octx.beginPath();
          octx.arc(s.x, s.y, s.w * (0.5 + sk * 0.8), 0, 6.2832);
          octx.fill();
          octx.globalCompositeOperation = 'source-over';
          continue;
        }
        /* 一条会淡的尾巴 + 一根更亮的芯：比画个圆点有力得多，也只多一次 stroke */
        const tl = 2.1 + Math.min(13, Math.hypot(s.vx, s.vy) * 2.1);
        const tx = s.x - s.vx * tl, ty = s.y - s.vy * tl;
        octx.strokeStyle = 'rgba(' + col + ',' + (a * 0.30).toFixed(3) + ')';
        octx.lineWidth = s.w * sk * 2.8;
        octx.beginPath();
        octx.moveTo(s.x, s.y);
        octx.lineTo(tx, ty);
        octx.stroke();
        octx.strokeStyle = 'rgba(' + col + ',' + (a * 0.85).toFixed(3) + ')';
        octx.lineWidth = s.w * sk;
        octx.beginPath();
        octx.moveTo(s.x, s.y);
        octx.lineTo(s.x - (s.x - tx) * .8, s.y - (s.y - ty) * .8);
        octx.stroke();
      }
    }

    /* 撒一把「墨点」—— 首屏大字被打散时，每个字里撒出来的就是它们。
       每个墨点带一个**落点**（tx/ty，调用方在整屏均匀取样）：先飞过去，把粒子铺满整个屏幕；
       落定之后就跟背景粒子完全一样 —— 鼠标推得动、互相连线、被冲击波轰走。
       带 dur 的会自己化掉（文字重聚时它们也散干净了）。 */
    function emit(x, y, vx, vy, opt) {
      opt = opt || {};
      if (nMotes > 340) return;
      nMotes++;
      parts.push({
        x: x, y: y, vx: vx, vy: vy,
        tx: opt.tx == null ? x : opt.tx,
        ty: opt.ty == null ? y : opt.ty,
        seek: opt.seek || 0,          /* 还剩多少毫秒的「飞行阶段」 */
        del: opt.del || 0,            /* 起飞延迟：晚一点才动，像被一阵一阵吹散 */
        s: opt.s || 0.075,            /* 逼近落点的速度：每个粒子不一样，才不会一起到 */
        wx: opt.wx || 0,              /* 侧向漂移：让路径带弧度，而不是一条直线 */
        wy: opt.wy || 0,
        r: opt.r || (.55 + Math.random() * 2.1),
        a: opt.a || (.26 + Math.random() * .52),
        soft: false,
        ph: Math.random() * 6.2832,
        c: opt.hi ? rgbHi : '',
        max: opt.max || (1.5 + Math.random() * 2.1),
        life: 0,
        dur: opt.dur || (1700 + Math.random() * 1100),
        f: 0
      });
    }

    function draw(now) {
      ctx.clearRect(0, 0, W, H);

      /* 粒子之间的连线：近的才连，越近越清楚。
         这里必须分桶 —— 大字散开时粒子有 320 颗左右（大屏上最多 380 多），两两比就是
         每帧 4.9 万次距离计算（大屏上 7 万次）。格子边长取连线半径，所以「可能连上」的一对
         必定落在 3×3 邻域里，分桶不会漏，只是把每帧的比较次数掉了 15 倍（连线结果一模一样）。 */
      const nP = parts.length;
      const MAXD = nP > 260 ? 104 : 116;
      const MAXD2 = MAXD * MAXD;
      const LINK_A = [0.02, 0.06, 0.10, 0.14];
      for (let i = 0; i < 4; i++) linkPaths[i].length = 0;   /* 复用，别每帧新建数组 */

      const gw = Math.max(1, Math.ceil(W / MAXD) + 1);
      const gh = Math.max(1, Math.ceil(H / MAXD) + 1);
      const nCell = gw * gh;
      if (buckets.length !== nCell) {
        buckets = new Array(nCell);
        for (let i = 0; i < nCell; i++) buckets[i] = [];
      }
      for (let i = 0; i < nCell; i++) buckets[i].length = 0;

      for (let i = 0; i < nP; i++) {
        const p = parts[i];
        if (p.soft) continue;
        const f = p.dur ? p.f : 1;
        if (f < 0.05) continue;
        p.__f = f;
        const cx0 = clamp(Math.floor(p.x / MAXD), 0, gw - 1);
        const cy0 = clamp(Math.floor(p.y / MAXD), 0, gh - 1);
        buckets[cy0 * gw + cx0].push(p);
      }

      for (let cy0 = 0; cy0 < gh; cy0++) {
        for (let cx0 = 0; cx0 < gw; cx0++) {
          const cell = buckets[cy0 * gw + cx0];
          const cn = cell.length;
          if (!cn) continue;
          if (cn > 1) {
            for (let m = 0; m < cn; m++) {
              const a = cell[m];
              for (let k = m + 1; k < cn; k++) linkPair(a, cell[k], MAXD2, linkPaths);
            }
          }
          for (let o = 0; o < 4; o++) {
            const nx0 = cx0 + NEI[o][0], ny0 = cy0 + NEI[o][1];
            if (nx0 < 0 || nx0 >= gw || ny0 >= gh) continue;
            const other = buckets[ny0 * gw + nx0];
            const on = other.length;
            if (!on) continue;
            for (let m = 0; m < cn; m++) {
              const a = cell[m];
              for (let k = 0; k < on; k++) linkPair(a, other[k], MAXD2, linkPaths);
            }
          }
        }
      }
      ctx.lineWidth = 1;
      for (let lv = 0; lv < 4; lv++) {
        const seg = linkPaths[lv];
        if (!seg.length) continue;
        ctx.strokeStyle = 'rgba(' + line + ',' + LINK_A[lv] + ')';
        ctx.beginPath();
        for (let i = 0; i < seg.length; i += 4) {
          ctx.moveTo(seg[i], seg[i + 1]);
          ctx.lineTo(seg[i + 2], seg[i + 3]);
        }
        ctx.stroke();
      }

      /* 指针与粒子的连线：光标像一块磁铁，把周围的粒子连起来（同样分档批量描） */
      if (body.classList.contains('has-pointer')) {
        const R = 168, R2 = R * R;
        const poiPaths = [[], [], [], []];
        for (let i = 0; i < parts.length; i++) {
          const p = parts[i];
          if (p.soft) continue;
          const pf = p.dur ? p.f : 1;
          if (pf < 0.05) continue;
          const dx = p.x - state.px, dy = p.y - state.py;
          const d2 = dx * dx + dy * dy;
          if (d2 < R2) {
            const k = (1 - Math.sqrt(d2) / R) * 0.34 * pf;
            const lv = k > .24 ? 3 : (k > .16 ? 2 : (k > .08 ? 1 : 0));
            poiPaths[lv].push(p.x, p.y);
          }
        }
        for (let lv = 0; lv < 4; lv++) {
          const pts = poiPaths[lv];
          if (!pts.length) continue;
          ctx.strokeStyle = 'rgba(' + line + ',' + [0.05, 0.12, 0.2, 0.3][lv] + ')';
          ctx.beginPath();
          for (let i = 0; i < pts.length; i += 2) {
            ctx.moveTo(state.px, state.py);
            ctx.lineTo(pts[i], pts[i + 1]);
          }
          ctx.stroke();
        }
      }

      /* 粒子本体（文字散出来的墨点会自己化掉，f 就是它的存活系数）。分两类画：
         · 柔和光斑 —— 预渲染贴图缩放着贴上去（每帧十几张），不每帧新建径向渐变对象；
         · 小圆点   —— 按「颜色 × 透明度档」攒进几条路径，一次 fill 画完。
         以前每颗粒子都是一次 beginPath/arc/fill：大字散开时 350 多颗就是每帧 350 多次
         绘制调用，这才是散开时最贵的一笔 —— 现在降到十几次。 */
      const DOT_N = 8;
      const DOT_A = [0.06, 0.19, 0.31, 0.44, 0.56, 0.69, 0.81, 0.94];
      if (!dotPaths) {
        dotPaths = [];
        for (let i = 0; i < DOT_N * 2; i++) dotPaths.push([]);
      }
      for (let i = 0; i < dotPaths.length; i++) dotPaths[i].length = 0;

      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        const f = p.dur ? p.f : 1;
        if (f < 0.02) continue;
        const col = p.c || rgb;
        if (p.soft) {
          const a = p.a * (0.85 + 0.3 * Math.sin(now / 2600 + p.ph));
          ctx.globalAlpha = clamp(a, 0, 1);
          ctx.drawImage(softSprite(col), p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
          ctx.globalAlpha = 1;
          continue;
        }
        const al = p.a * f;
        if (al < 0.03) continue;
        let lv = (al * DOT_N) | 0;
        if (lv > DOT_N - 1) lv = DOT_N - 1;
        dotPaths[(p.c ? DOT_N : 0) + lv].push(p.x, p.y, p.r);
      }

      for (let g = 0; g < dotPaths.length; g++) {
        const seg = dotPaths[g];
        if (!seg.length) continue;
        ctx.fillStyle = 'rgba(' + (g >= DOT_N ? rgbHi : rgb) + ',' + DOT_A[g % DOT_N] + ')';
        ctx.beginPath();
        for (let i = 0; i < seg.length; i += 3) {
          const rr = seg[i + 2];
          ctx.moveTo(seg[i] + rr, seg[i + 1]);   /* 每颗先 moveTo，否则会和上一颗连成一条线 */
          ctx.arc(seg[i], seg[i + 1], rr, 0, 6.2832);
        }
        ctx.fill();
      }

      /* 冲击波 */
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        const k = r.life / r.dur;
        if (k >= 1) { rings.splice(i, 1); continue; }
        const rad = 6 + (r.max - 6) * (1 - Math.pow(1 - k, 2.4));
        ctx.strokeStyle = 'rgba(' + line + ',' + ((1 - k) * 0.5).toFixed(3) + ')';
        ctx.lineWidth = 1.4 * (1 - k) + 0.3;
        ctx.beginPath();
        ctx.arc(r.x, r.y, rad, 0, 6.2832);
        ctx.stroke();
      }

      /* 火花 */
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        const k = s.life / s.dur;
        if (k >= 1) { sparks.splice(i, 1); continue; }
        ctx.fillStyle = 'rgba(' + line + ',' + ((1 - k) * 0.8).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * (1 - k * .5), 0, 6.2832);
        ctx.fill();
      }
      ctx.lineWidth = 1;

      /* 爆炸画在内容之上那一层。没有爆炸的帧只清一次，不多做任何事。 */
      if (octx) {
        if (blasts.length) {
          octx.clearRect(0, 0, W, H);
          for (let i = 0; i < blasts.length; i++) drawBlast(blasts[i]);
          ovDirty = true;
        } else if (ovDirty) {
          octx.clearRect(0, 0, W, H);
          ovDirty = false;
        }
      }
    }

    function step(now) {
      raf = requestAnimationFrame(step);
      const dt = Math.min(48, (now - last) || 16);
      last = now;
      const k = dt / 16.67;
      const px = state.px, py = state.py;
      const R = 180, R2 = R * R;

      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        const mote = !!p.dur;               /* 文字散出来的墨点：有寿命 */

        if (mote) {                         /* 先亮起来，铺满之后才开始化掉 */
          p.life += dt;
          const lk = p.life / p.dur;
          if (lk >= 1) { parts.splice(i, 1); i--; nMotes--; continue; }
          p.f = (lk < .06 ? lk / .06 : 1) * (lk < .5 ? 1 : Math.max(0, 1 - (lk - .5) / .5));
        }

        /* 鼠标附近的粒子被推开 —— 「搅动」的手感（墨点被推得更明显） */
        const dx = p.x - px, dy = p.y - py;
        const d2 = dx * dx + dy * dy;
        if (d2 < R2 && d2 > 1) {
          const d = Math.sqrt(d2);
          const f = (1 - d / R) * (p.soft ? 0.05 : (mote ? 0.22 : 0.16)) * k;
          p.vx += (dx / d) * f;
          p.vy += (dy / d) * f;
        }
        /* 飞行阶段：朝落点指数逼近 —— 一上来最快（像炸开），越近越慢，不会过冲。
           鼠标此时也推得动它们（推出来的速度掺 35% 进去），所以飞行途中就能被拨开。 */
        if (mote && p.seek > 0) {
          if (p.del > 0) {
            p.del -= dt;                    /* 还没轮到它：先原地亮着 */
          } else {
            p.seek -= dt;
            /* 逼近速度每个粒子都不同（p.s），再加一点侧向漂移（p.wx / p.wy）——
               所以它们不是排着队走直线、也不是一起到位，而是各有快慢、路径带弧度。
               「自然感」主要就来自这两点。 */
            const s = p.s * k;
            p.x += (p.tx - p.x) * s + (p.vx + p.wx) * k * 0.35;
            p.y += (p.ty - p.y) * s + (p.vy + p.wy) * k * 0.35;
            p.vx *= 0.97;
            p.vy *= 0.97;
          }
          continue;                         /* 位置已经更新过，跳过下面的漂移 */
        }

        /* 落定之后就是背景粒子：阻力、噪声、限速，跟别人一样飘着 */
        const drag = mote ? 0.99 : 0.995;
        p.vx *= drag;
        p.vy *= drag;
        p.vx += (Math.random() - .5) * .0025 * k;
        p.vy += (Math.random() - .5) * .0025 * k - .0008 * k;
        const baseMax = p.soft ? .22 : .6;
        if (mote && p.max > baseMax) p.max += (baseMax - p.max) * 0.02 * k;
        const sp = Math.hypot(p.vx, p.vy);
        const max = mote ? p.max : baseMax;
        if (sp > max) { p.vx = p.vx / sp * max; p.vy = p.vy / sp * max; }
        p.x += p.vx * k;
        p.y += p.vy * k;
        if (p.x < -60) p.x = W + 60; else if (p.x > W + 60) p.x = -60;
        if (p.y < -60) p.y = H + 60; else if (p.y > H + 60) p.y = -60;
      }

      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life += dt;
        s.x += s.vx * k;
        s.y += s.vy * k;
        s.vx *= 0.97;
        s.vy *= 0.97;
        s.vy += 0.012 * k;
      }
      for (let i = 0; i < rings.length; i++) rings[i].life += dt;

      /* 爆炸的火星与余烬：阻力给得很足，所以是「一炸就冲出去、然后迅速收住」 */
      for (let i = blasts.length - 1; i >= 0; i--) {
        const o = blasts[i];
        o.life += dt;
        if (o.life >= o.end) { blasts.splice(i, 1); continue; }
        for (let j = 0; j < o.bits.length; j++) {
          const s = o.bits[j];
          if (s.life >= s.dur) continue;
          s.life += dt;
          s.x += s.vx * k;
          s.y += s.vy * k;
          const dr = Math.pow(0.92, k);
          s.vx *= dr;
          s.vy *= dr;
          s.vy += s.g * k;
        }
      }

      draw(now);
    }

    function start() {
      if (raf || !motionOK || paused) return;
      last = performance.now();
      raf = requestAnimationFrame(step);
    }
    function stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop(); else start();
    });
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(resize, 160);
    });

    resize();
    readColors();
    t0 = performance.now();
    if (motionOK) start(); else draw(t0);

    /* 背景「搅动」：把指针位置（相对屏幕中心的 -1~1）写给 CSS，
       光斑和色场用它做位移（见 styles.css 第 3 节）。
       省两处：值没变就不写（鼠标停住时这块开销直接归零），以及降到 30Hz
       （本来就是慢速漂移，差一帧看不出来）。自定义属性一写，`#bg` 整棵子树都要重算样式 ——
       实测指针一直在动的时候，样式重算会从 ~250ms/3s 涨到 ~770ms/3s，钱就花在这儿。 */
    let poiRaf = 0, poiTick = 0, poiX = 9, poiY = 9;
    function poiLoop() {
      poiRaf = requestAnimationFrame(poiLoop);
      if (!bgEl) return;
      if ((poiTick++ & 1) === 0) return;
      const nx = clamp((state.px / window.innerWidth - .5) * 2, -1, 1);
      const ny = clamp((state.py / window.innerHeight - .5) * 2, -1, 1);
      if (Math.abs(nx - poiX) < .002 && Math.abs(ny - poiY) < .002) return;
      poiX = nx;
      poiY = ny;
      bgEl.style.setProperty('--poi-x', nx.toFixed(3));
      bgEl.style.setProperty('--poi-y', ny.toFixed(3));
    }
    poiLoop();

    return {
      recolor: () => { readColors(); if (!motionOK) draw(performance.now()); },
      burst: burst,
      emit: emit,
      setPaused: (v) => {
        paused = !!v;
        if (paused) { stop(); draw(performance.now()); } else start();
        return paused;
      },
      isPaused: () => paused
    };
  }

  /* ======================== 4. 光标：光晕 + 磁吸 + 拖拽惯性 ======================== */
  function initPointer() {
    const halo = document.getElementById('halo');

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
    const mags = $$('.magnetic');
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

  /* ======================== 5. 点击爆点 ======================== */
  function initRipple() {
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
    const dotsBox = document.getElementById('dots');
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
          run: () => openKeys()
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
      return out;
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
        view.push(Object.assign({}, it, { score: m.score + (it.group === '页面' ? 6 : 0), tHtml: mark(it.t, fuzzy(q, it.t) ? fuzzy(q, it.t).hits : []) }));
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
      root.hidden = false;
      input.value = '';
      sel = 0;
      filter();
      focusBack = document.activeElement;
      setTimeout(() => input.focus(), 20);
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
        if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) { e.preventDefault(); move(1); return true; }
        if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) { e.preventDefault(); move(-1); return true; }
        if (e.key === 'Enter') { e.preventDefault(); run(sel); return true; }
        return false;
      }
    };
  }

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

  /* ======================== 11. 时钟与年份 ======================== */
  function initClock() {
    const clock = document.getElementById('clock');
    const year = document.getElementById('year');
    if (year) year.textContent = String(new Date().getFullYear());
    if (!clock) return;
    const paint = () => {
      const d = new Date();
      clock.textContent = [d.getHours(), d.getMinutes(), d.getSeconds()]
        .map((n) => String(n).padStart(2, '0')).join(':');
    };
    paint();
    setInterval(paint, 1000);
  }

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
})();
