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

  