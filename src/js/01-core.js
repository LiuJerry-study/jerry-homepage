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
       'random'  —— 每次点击**独立**随机挑一套（默认；开关是 site-data.js 的 randomBurst）
       'new'     —— 只用新的那套（核心闪光 + 冲击波 + 火星拖尾，画在 #fx-overlay 上）
       'classic' —— 只用旧的那套（巨大 DOM 圆 + 细环 + 小圆点）
     网址参数优先且能钉死：?fx=new / ?fx=classic / ?fx=random。
     proto/burst-lab.html 就是靠它做左右对照的。 */
  const FX_ARG = new URLSearchParams(location.search).get('fx');
  const FX_MODE = (FX_ARG === 'new' || FX_ARG === 'classic' || FX_ARG === 'random')
    ? FX_ARG
    : (SITE.randomBurst === false ? 'new' : 'random');

  