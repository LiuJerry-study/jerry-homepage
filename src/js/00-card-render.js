/* Pure card markup: shared by build, server and classic browser bundle. */
const CardMarkup = (() => {
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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


function items(SITE) {
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

return items;
}
function render(items) {
  return items.map((it, i) => {
    const live = !!(it.href && it.href !== '#');
    const tag = live ? 'a' : 'details';
    const inner = live ? 'div' : 'summary';
    const attrs = live ? ' href="' + esc(it.href) + '"' : '';
    return '<' + tag + ' class="card ' + (it.add ? 'card-add' : live ? 'is-live' : 'is-soon') + '" data-i="' + i + '"' + attrs + '>' + RING
      + '<' + inner + ' class="card-inner">'
      + '<div class="card-top"><span class="card-icon">' + icon(it.add ? 'plus' : it.icon) + '</span>'
      + '<span class="card-num mono">' + String(i + 1).padStart(2, '0') + '</span></div>'
      + '<div class="card-body"><strong class="card-title">' + esc(it.title || '') + '</strong>'
      + '<span class="card-desc">' + esc(it.desc || '') + '</span></div>'
      + '<div class="card-foot"><span class="badge' + (live ? ' badge-live' : '') + '">' + esc(it.badge || (live ? '已上线' : '筹备中')) + '</span>'
      + '<span class="card-go">' + (live ? '前往' : '查看详情') + '<span class="go-ico">' + icon('arrow') + '</span></span></div>'
      + '</' + inner + '>'
      + (!live ? '<ul class="card-fallback">' + (it.details || []).map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '')
      + '</' + tag + '>';
  }).join('');
}
return { items, render, icon };
})();
