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

  