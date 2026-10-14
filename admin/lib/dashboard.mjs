export function getDashboardData({ store, site = {}, lastBuild = null }) {
  const posts = store.listContent('posts');
  const projects = store.listContent('projects');
  const all = [
    ...posts.map((item) => ({ ...item, kind: 'posts' })),
    ...projects.map((item) => ({ ...item, kind: 'projects' })),
  ];
  const recent = all
    .slice()
    .sort((a, b) => String(b.mtime).localeCompare(String(a.mtime)))
    .slice(0, 6);
  const nav = store.readNav();
  return {
    site,
    counts: {
      published: all.filter((item) => !item.draft).length,
      drafts: all.filter((item) => item.draft).length,
      cards: nav.items.length,
      build: lastBuild ? `${lastBuild.ms || 0}ms` : '尚未构建',
    },
    recent,
    health: [
      { label: '内容列表', status: 'ok', detail: `${all.length} 条内容可读取` },
      { label: '首页卡片', status: nav.items.length ? 'ok' : 'warn', detail: `${nav.items.length} 个入口` },
      {
        label: '最近构建',
        status: lastBuild ? (lastBuild.ok ? 'ok' : 'error') : 'warn',
        detail: lastBuild ? (lastBuild.log || '') : '本次会话尚未构建',
      },
    ],
  };
}
