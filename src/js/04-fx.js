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
      /* 上限跟 budget 走（见 main.js 第 6 节的 dissolve）：一次消散最多撒 160 颗，
         这里留一点余量，防止连点时把背景粒子的帧率挤没。 */
      if (nMotes > 180) return;
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
      /* 给 ?perf=1 的性能面板用（见 main.js 第 13 节） */
      stats: () => ({ parts: parts.length, motes: nMotes, sparks: sparks.length, blasts: blasts.length }),
      setPaused: (v) => {
        paused = !!v;
        if (paused) { stop(); draw(performance.now()); } else start();
        return paused;
      },
      isPaused: () => paused
    };
  }

  