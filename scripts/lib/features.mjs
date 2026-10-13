/* ==========================================================================
   设置：站点有哪些板块、哪些功能、以及各种"不是开关"的参数
   --------------------------------------------------------------------------
   状态存在 content/settings.json，后台的「设置」页写它。
   没写到的项一律按默认值 —— 所以删掉整个文件 = 全部恢复默认，
   不会因为少一个字段就把站点关出毛病来。

   每一项都有一个 kind：
     bool      开关（true / false）
     text      单行文字
     textarea  多行文字
     number    数字
     select    单选下拉（options 里挑一个）

   两个层次（重要）：
     site    —— 板块级的。关掉之后**根本不生成**那些页面，
                sitemap / RSS / 搜索索引 / 导航卡片一起跟着消失。
                这是"渲染期"的事：动态站下保存即生效，静态快照要重跑构建。
     runtime —— 首页的装饰与交互。写进 assets/site-data.js，
                main.js 读它决定初始化哪些模块。首页专用（长页面不加载 main.js）。

   为什么不做成"实时读文件"：页面是服务器渲染的，导航、sitemap 这些
   本来就是渲染时才知道的结果；把它做成运行时开关，等于让每张页面
   自己去藏东西 —— 藏不干净就会留下点了 404 的链接。

   字段里还有一个可选的 site：
     写了它 = 这一项的值会盖到 content/site.js 的 window.SITE 上，
     构建期和浏览器里都是（见 scripts/build.mjs 的 siteOverrides()）。
     map 用来把下拉的文字值翻译成 SITE 上的值。
   ========================================================================== */

/**
 * 卡片图标。第三列是 SVG 路径，必须和 src/js/08-cards.js 里的 ICONS 逐字一致 ——
 * 后台的「卡片」页靠它画预览，站点靠那边画真卡片。改这里就要改那边。
 * （共用一份不太好办：那边是给浏览器看的普通脚本，不能在构建期 import。）
 */
export const CARD_ICONS = [
  ['resume', '简历（文档）', '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>'],
  ['pen', '笔 / 写作', '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>'],
  ['grid', '九宫格', '<rect x="3" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.6"/>'],
  ['book', '书 / 归档', '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'],
  ['user', '人像', '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'],
  ['mail', '信封', '<rect x="2" y="4" width="20" height="16" rx="2.5"/><path d="M3 7l9 6 9-6"/>'],
  ['plus', '加号', '<path d="M12 5v14M5 12h14"/>'],
  ['search', '放大镜', '<circle cx="11" cy="11" r="6.6"/><path d="M20.2 20.2 15.8 15.8"/>'],
  ['bolt', '闪电', '<path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13z"/>'],
  ['page', '文章列表', '<path d="M4 6h16M4 12h16M4 18h10"/>'],
  ['arrow', '斜箭头', '<path d="M7 17 17 7"/><path d="M8 7h9v9"/>'],
];

/** 每一项：key 要稳定（会被写进 settings.json），group 决定它出现在后台哪一组 */
export const FEATURE_ITEMS = [
  /* ---------------- 站点信息（这些不是开关，是"值"） ---------------- */
  { key: 'site.brand',       group: 'site', kind: 'text',   level: 'site', site: 'brand',       label: '站点名',     def: '个人门户', note: '长页面顶栏左侧、分享卡片、sitemap 里的名字' },
  { key: 'site.author',      group: 'site', kind: 'text',   level: 'site', site: 'author',      label: '作者',       def: 'Jerry',   note: '结构化数据（schema.org 的 Person）和版权用' },
  { key: 'site.url',         group: 'site', kind: 'text',   level: 'site', site: 'url',         label: '站点地址',   def: '',        note: 'https:// 开头、末尾不带斜杠。sitemap / RSS / canonical 的绝对地址由它拼' },
  { key: 'site.description', group: 'site', kind: 'textarea', level: 'site', site: 'description', label: '站点描述', def: '',        note: '搜索引擎和分享卡片上那句介绍' },
  { key: 'home.tagline',     group: 'site', kind: 'text',   level: 'runtime', site: 'tagline',  label: '主标语',     def: '未来 由我们创造', note: '首屏那一行大字，也是页脚和分享标题的来源' },
  { key: 'blog.perPage',     group: 'site', kind: 'number', level: 'site', site: 'postsPerPage', label: '博客每页几篇', def: 10, min: 1, max: 999, unit: '篇', note: '超过就自动分成 blog/page2.html、page3.html…。想一页到底就填 999' },

  /* ---------------- 主题 ---------------- */
  { key: 'theme.mode', group: 'theme', kind: 'select', level: 'runtime', site: 'themeMode', label: '默认明暗', def: 'random', note: '访客第一次打开时用哪种。他自己切过一次之后就记住他的选择，这里管不到了', options: [
    ['random', '每次随机（亮 / 暗）'], ['system', '跟随系统'],
    ['light', '固定浅色'], ['dark', '固定深色'],
  ] },

  /* ---------------- 板块 ---------------- */
  { key: 'pages.blog',     group: 'pages', kind: 'bool', level: 'site', href: 'blog/',       label: '博客',   note: '文章列表 + 详情 + 分页。关掉后文章不再出现在任何地方' },
  { key: 'pages.projects', group: 'pages', kind: 'bool', level: 'site', href: 'projects/',   label: '作品集', note: '项目列表 + 详情' },
  { key: 'pages.resume',   group: 'pages', kind: 'bool', level: 'site', href: 'resume.html', label: '简历',   note: '读 content/resume.json' },
  { key: 'pages.tags',     group: 'pages', kind: 'bool', level: 'site', href: 'tags/',       label: '标签页', note: '按标签翻文章与作品；标签是从文章和项目里长出来的' },
  { key: 'pages.about',    group: 'pages', kind: 'bool', level: 'site', href: 'about.html',  label: '关于页', note: '自我介绍 + 数字卡 + 技能胶囊 + 社交链接。读 content/about.json' },
  { key: 'pages.rss',      group: 'pages', kind: 'bool', level: 'site', label: 'RSS 订阅',   note: '生成 /rss.xml。关掉后阅读器和 <head> 里的订阅链接一起消失' },
  { key: 'pages.sitemap',  group: 'pages', kind: 'bool', level: 'site', label: '站点地图',   note: '生成 /sitemap.xml，给搜索引擎看' },
  { key: 'pages.robots',   group: 'pages', kind: 'bool', level: 'site', label: 'robots.txt', note: '给爬虫看的通行规则。关掉后搜索引擎只能自己猜' },

  /* ---------------- 首页 ---------------- */
  { key: 'home.heroTitle',    group: 'home', kind: 'bool', level: 'runtime', label: '首屏大标语', def: true,  note: '关掉之后首屏只剩卡片墙（标语文字在「站点」那一组里改）' },
  { key: 'home.taglineCaret', group: 'home', kind: 'bool', level: 'runtime', label: '标语光标',   def: true,  note: '大字末尾那根一闪一闪的竖线' },
  { key: 'home.cards',        group: 'home', kind: 'bool', level: 'runtime', label: '卡片墙',     def: true,  note: '首屏那几张入口卡片。卡片本身在「卡片」页里加' },
  { key: 'home.addCard',      group: 'home', kind: 'bool', level: 'runtime', site: 'showAddCard', label: '「＋ 添加新站点」占位卡', def: false, note: '开发时用的一张提示卡。现在加卡片有表单了，默认收起来' },
  { key: 'home.aboutPanel',   group: 'home', kind: 'bool', level: 'runtime', label: '「关于」屏', def: true,  note: '首页第二屏。关掉后只剩一屏，右侧圆点也跟着少一个' },
  { key: 'home.dots',         group: 'home', kind: 'bool', level: 'runtime', label: '右侧圆点',   def: true,  note: '一屏一个的小圆点导航' },
  { key: 'home.footer',       group: 'home', kind: 'bool', level: 'runtime', label: '页脚整行',   def: true,  note: '版权、时钟、快捷键提示那一行。关掉下面三个也一起没了' },
  { key: 'home.clock',        group: 'home', kind: 'bool', level: 'runtime', label: '页脚时钟',   def: true,  note: '页脚那个跳秒的钟' },
  { key: 'home.tips',         group: 'home', kind: 'bool', level: 'runtime', label: '快捷键提示', def: true,  note: '页脚那句「按 T 换主题 · 按 R 重播标题」' },

  /* ---------------- 装饰效果 ---------------- */
  { key: 'effects.particles',     group: 'effects', kind: 'bool', level: 'runtime', label: '背景粒子', note: '连线的粒子场，指针会搅动它们。关掉最省电' },
  { key: 'effects.wash',          group: 'effects', kind: 'bool', level: 'runtime', label: '背景柔光', note: '背景里那团大面积的颜色晕染' },
  { key: 'effects.blobs',         group: 'effects', kind: 'bool', level: 'runtime', label: '光斑色块', note: '缓慢漂移的两块模糊色斑' },
  { key: 'effects.noise',         group: 'effects', kind: 'bool', level: 'runtime', label: '颗粒噪点', note: '一层几乎看不见的胶片颗粒，让大面积纯色不那么"塑料"' },
  { key: 'effects.halo',          group: 'effects', kind: 'bool', level: 'runtime', label: '光标光晕', note: '跟着指针走的那团柔光' },
  { key: 'effects.burst',         group: 'effects', kind: 'bool', level: 'runtime', label: '点击爆点', note: '点一下炸开的那一圈' },
  { key: 'effects.burstStyle',    group: 'effects', kind: 'select', level: 'runtime', site: 'burstStyle', label: '爆点用哪套', def: 'random', note: '两套风格：新的那套是闪光 + 冲击波 + 火星拖尾，旧的那套是巨大圆环', options: [
    ['random', '每次随机'], ['new', '只用新的'], ['classic', '只用旧的'],
  ] },
  { key: 'effects.titleDissolve', group: 'effects', kind: 'bool', level: 'runtime', label: '标题消散', note: '点主标语散成粒子（两秒后自己聚回来）' },
  { key: 'effects.transition',    group: 'effects', kind: 'bool', level: 'runtime', label: '逐屏转场', note: '翻屏时的动效。关掉 = 全部用最朴素的淡入' },
  { key: 'effects.transitionStyle', group: 'effects', kind: 'select', level: 'runtime', label: '转场用哪套', def: 'random', note: '六套：淡入 / 推移 / 翻卡 / 缩放 / 虚化 / 擦除', options: [
    ['random', '每次随机（不连着重复）'], ['fade', '只用淡入'],
  ] },
  { key: 'effects.magnetic',      group: 'effects', kind: 'bool', level: 'runtime', label: '按钮磁吸', note: '指针靠近时按钮轻轻让开一点' },

  /* ---------------- 工具 ---------------- */
  { key: 'tools.cmdk',        group: 'tools', kind: 'bool', level: 'runtime', label: '命令面板', note: 'Ctrl / ⌘ + K 搜索与跳转' },
  { key: 'tools.themeToggle', group: 'tools', kind: 'bool', level: 'runtime', label: '主题切换', note: '右上角的明暗按钮，以及 T 键' },
  { key: 'tools.keys',        group: 'tools', kind: 'bool', level: 'runtime', label: '快捷键一览', note: '按 ? 弹出的那张表' },
  { key: 'tools.hoverPeek',   group: 'tools', kind: 'bool', level: 'runtime', label: '卡片悬停预览', note: '鼠标停在卡片上时浮出来的小面板' },
  { key: 'tools.meter',       group: 'tools', kind: 'bool', level: 'runtime', label: '屏序指示器', note: '左下角那个「01 / 02 屏」' },
];

export const FEATURE_GROUPS = [
  { key: 'site',    label: '站点',     note: '名字、地址、描述、主标语、每页几篇 —— 这些是"值"，不是开关。' },
  { key: 'theme',   label: '主题',     note: '访客第一次打开时用哪种明暗。' },
  { key: 'pages',   label: '板块',     note: '关掉之后整块页面不再生成，导航里那张卡、sitemap、RSS、搜索索引也一起消失。' },
  { key: 'home',    label: '首页',     note: '只影响首页那两屏。' },
  { key: 'effects', label: '装饰效果', note: '纯好看的东西，关掉不影响任何功能。' },
  { key: 'tools',   label: '工具',     note: '锦上添花的小工具。' },
];

/** key -> 注册项 */
export const ITEM_BY_KEY = new Map(FEATURE_ITEMS.map((i) => [i.key, i]));

/** 每一项的默认值 */
export function defaultFeatures() {
  const o = {};
  for (const it of FEATURE_ITEMS) {
    if (!('def' in it)) o[it.key] = true;                       // 开关默认全开
    else o[it.key] = it.def;
  }
  return o;
}

/**
 * 把一个来路不明的值按注册表洗干净。
 * 洗不动就返回 undefined —— 调用方保留默认值，绝不会让配置文件把站点搞黑。
 */
export function normalizeValue(item, raw) {
  if (!item) return undefined;
  switch (item.kind || 'bool') {
    case 'bool':
      if (raw === false || raw === true) return raw;
      if (raw === 'false') return false;                        // features.json 里手写成字符串也认
      if (raw === 'true') return true;
      return undefined;
    case 'number': {
      const n = Number(raw);
      if (!Number.isFinite(n)) return undefined;
      const lo = item.min === undefined ? -Infinity : item.min;
      const hi = item.max === undefined ? Infinity : item.max;
      return Math.min(hi, Math.max(lo, Math.round(n)));
    }
    case 'select':
      return item.options.some(([v]) => v === raw) ? raw : undefined;
    case 'text':
    case 'textarea':
      return typeof raw === 'string' ? raw : (typeof raw === 'number' ? String(raw) : undefined);
    default:
      return undefined;
  }
}

/**
 * 读配置：默认值 ← content/features.json（老文件，只有开关）← content/settings.json（新文件）
 *
 * 为什么还读老文件：上个版本的后台把开关写在 features.json 里。直接无视它
 * 等于把用户已经调过的设置悄悄改回默认。所以让它继续生效，只是**优先级最低**。
 * 后台的「设置」页上有一条提示，可以一键把老文件并进来然后删掉它。
 */
export function loadSettings(root, readFileSync, existsSync, seed) {
  const notes = [];
  const out = Object.assign(defaultFeatures(), seed || {});
  const base = root ? root + '/' : '';
  const legacyFile = base + 'content/features.json';
  const file = base + 'content/settings.json';
  const legacyUsed = [];

  const readJson = (p, what) => {
    if (!existsSync(p)) return null;
    try { return JSON.parse(readFileSync(p, 'utf8')); }
    catch (e) { notes.push(what + ' 解析失败（已忽略它）：' + e.message); return null; }
  };

  const legacy = readJson(legacyFile, 'content/features.json');
  if (legacy && typeof legacy === 'object' && !Array.isArray(legacy)) {
    for (const [k, v] of Object.entries(legacy)) {
      if (k.startsWith('_')) continue;
      const item = ITEM_BY_KEY.get(k);
      if (!item) { notes.push('features.json 里有不认识的项「' + k + '」，忽略'); continue; }
      const val = normalizeValue(item, v);
      if (val === undefined) { notes.push('features.json 的「' + k + '」值不合法，忽略'); continue; }
      out[k] = val;
      legacyUsed.push(k);
    }
  } else if (legacy) {
    notes.push('content/features.json 应该是一个对象（已忽略它）');
  }

  const raw = readJson(file, 'content/settings.json');
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw)) {
      if (k.startsWith('_')) continue;
      const item = ITEM_BY_KEY.get(k);
      if (!item) { notes.push('settings.json 里有不认识的项「' + k + '」，忽略'); continue; }
      const val = normalizeValue(item, v);
      if (val === undefined) { notes.push('settings.json 的「' + k + '」值不合法，忽略'); continue; }
      out[k] = val;
    }
  } else if (raw) {
    notes.push('content/settings.json 应该是一个对象（已忽略它）');
  }

  return { settings: out, notes, legacyFile: existsSync(legacyFile), legacyUsed };
}

/** 老名字，保持兼容（后台和构建都在用） */
export const loadFeatures = loadSettings;

/** 板块是否打开（渲染期用）。key 不带 pages. 前缀，例如 sectionOn(f, 'blog') */
export const sectionOn = (f, name) => f['pages.' + name] !== false;

/** 关掉的板块对应的路径前缀，用来过滤导航卡片 */
export function offHrefs(f) {
  return FEATURE_ITEMS
    .filter((i) => i.level === 'site' && i.href && f[i.key] === false)
    .map((i) => i.href);
}

/**
 * 从 content/site.js 反读一份"当前值"，当作注册表里那些项的默认值。
 *
 * 为什么需要它：site.url / brand / tagline 这些的默认值只能来自 site.js ——
 * 如果注册表里写死一个 ''，第一次渲染就会把 site.js 里的真地址盖成空字符串。
 * 有了这一步，「没在后台动过」的项就等于"保持 site.js 原样"。
 */
export function seedFromSite(site) {
  const o = {};
  for (const it of FEATURE_ITEMS) {
    if (!it.site) continue;
    const v = site ? site[it.site] : undefined;
    if (v === undefined) continue;
    const n = normalizeValue(it, v);
    if (n !== undefined) o[it.key] = n;
  }
  /* 两个老字段没有一一对应的新键，单独翻译一下：
     site.js 里只有 randomTheme / randomBurst 两个布尔，没有 themeMode / burstStyle。 */
  if (site && site.themeMode === undefined && site.randomTheme === false) o['theme.mode'] = 'system';
  if (site && site.burstStyle === undefined && site.randomBurst === false) o['effects.burstStyle'] = 'new';
  return o;
}

/**
 * 把注册表里带 site 的项翻译成一组对 window.SITE 的覆盖。
 * 构建脚本用它把后台里的值盖到 content/site.js 上（而不是去改那个文件）。
 */
export function siteOverrides(settings) {
  const o = {};
  for (const it of FEATURE_ITEMS) {
    if (!it.site) continue;
    const v = settings[it.key];
    if (v === undefined) continue;
    o[it.site] = it.map ? it.map[v] : v;
  }
  return o;
}
