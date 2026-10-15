/* Shared modal focus management; inert state outside the dialog is restored exactly. */
  function initModalFocus() {
    const dialogs = $$('[role="dialog"][aria-modal="true"]');
    const saved = new Map();
    let current = null, trigger = null;
    const focusable = d => $$('a[href], button, input, select, textarea, [tabindex]', d).filter(el => !el.disabled && el.tabIndex >= 0 && !el.closest('[hidden], [inert]') && el.getClientRects().length);
    function restore() { saved.forEach((value, el) => { el.inert = value; }); saved.clear(); }
    function sync() {
      const next = dialogs.filter(d => !d.hidden).pop() || null;
      if (next === current) return;
      restore();
      if (next) {
        if (!current) trigger = next._focusTrigger || document.activeElement;
        current = next;
        Array.from(body.children).forEach(el => { if (el !== next && !el.contains(next) && !/^(SCRIPT|STYLE)$/.test(el.tagName)) { saved.set(el, el.inert); el.inert = true; } });
        const target = focusable(next)[0] || next;
        if (target === next) next.tabIndex = -1;
        if (!next.contains(document.activeElement)) target.focus({ preventScroll: true });
      } else {
        current = null;
        if (trigger && trigger.isConnected && !trigger.closest('[inert], [hidden]')) trigger.focus({ preventScroll: true });
        else { const fallback = document.querySelector('.panel:not([inert]) a[href], .topbar a[href]'); if (fallback) fallback.focus({ preventScroll: true }); }
        trigger = null;
      }
    }
    const observer = new MutationObserver(sync);
    dialogs.forEach(d => observer.observe(d, { attributes: true, attributeFilter: ['hidden'] }));
    document.addEventListener('keydown', e => {
      if (!current || e.key !== 'Tab') return;
      const list = focusable(current), first = list[0], last = list[list.length - 1];
      if (!first) { e.preventDefault(); current.focus(); return; }
      if (e.shiftKey && (document.activeElement === first || !current.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !current.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    }, true);
    sync();
  }
