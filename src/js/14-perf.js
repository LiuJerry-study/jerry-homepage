/* ======================== 13. 性能面板（?perf=1） ========================
   只在网址带 ?perf=1 时才会建出来，正常访问在第一行就 return 了 —— 零开销。
   为什么需要它：首页大字散开那一下卡不卡，取决于访客的 CPU / GPU，
   开发机上量不出来，只有在真正卡的那台机器上看数字，才知道改对了没有。
   它显示三样：
     · 实时 FPS
     · 消散期间的最低 FPS、最长帧间隔（同步卡顿全体现在最长帧上）
     · 消散持续了多久、期间粒子数峰值
   用法：打开 index.html?perf=1，点一下标题。换页就没了。 */
  function initPerf() {
    if (!/[?&]perf=1(&|$)/.test(location.search)) return;

    const box = document.createElement('div');
    /* 调试用的东西不进 styles.css：它永远不该出现在正式产物里，
       所以样式就地内联 —— 不占 STYLE_MANIFEST，也不进 CSS 缓存。 */
    box.style.cssText = 'position:fixed;left:12px;top:12px;z-index:99;pointer-events:none;'
      + 'font:11px/1.7 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;'
      + 'padding:8px 11px;border-radius:8px;background:rgba(0,0,0,.74);'
      + 'color:#eee;white-space:pre;tab-size:2';
    box.setAttribute('aria-hidden', 'true');
    document.body.appendChild(box);

    const h1 = document.getElementById('hero-title');
    let frames = 0, fps = 0, t0 = performance.now(), last = t0;
    let dissolving = false, startAt = 0, worstGap = 0, minFps = Infinity, peak = 0, dur = 0;

    function stat() { return (fx && fx.stats) ? fx.stats() : { parts: 0, motes: 0 }; }

    function sample() {
      const s = stat();
      box.textContent =
        'FPS  ' + fps + (dissolving ? '   ← 消散中' : '') + '\n' +
        '粒子 ' + s.parts + '（墨点 ' + s.motes + '）\n' +
        '消散 ' + (dur ? dur + 'ms' : '还没点过') +
        '   最低 ' + (minFps === Infinity ? '—' : minFps) + 'fps' +
        '   最长帧 ' + Math.round(worstGap) + 'ms' +
        (peak ? '   峰值 ' + peak + ' 颗' : '');
    }

    function tick(now) {
      requestAnimationFrame(tick);
      const gap = now - last;
      last = now;
      const s = stat();
      if (dissolving) {
        if (gap > worstGap) worstGap = gap;
        if (s.motes > peak) peak = s.motes;
      }
      frames++;
      if (now - t0 >= 400) {
        fps = Math.round(frames * 1000 / (now - t0));
        frames = 0;
        t0 = now;
        if (dissolving && fps < minFps) minFps = fps;
        sample();
      }
    }
    requestAnimationFrame(tick);

    /* 消散的开始 / 结束不用去改第 6 节：那两下本来就会给标题加、摘 .is-gone，
       这里盯着 class 变化就够了，两边逻辑互不打扰。 */
    if (h1 && window.MutationObserver) {
      new MutationObserver(() => {
        const gone = h1.classList.contains('is-gone');
        if (gone === dissolving) return;
        dissolving = gone;
        if (gone) {
          startAt = performance.now();
          worstGap = 0; minFps = Infinity; peak = 0;
        } else {
          dur = Math.round(performance.now() - startAt);
        }
        sample();
      }).observe(h1, { attributes: true, attributeFilter: ['class'] });
    }
    sample();
  }

  