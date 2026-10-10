/* ==========================================================================
   代码高亮（零依赖，构建期使用）
   --------------------------------------------------------------------------
   不做完整语法分析，只按「注释 / 字符串 / 数字 / 关键字 / 内建 / 函数名 / 标点」
   做一轮词法扫描，够把常用语言点亮。输出 <span class="tok-*">，
   配色在 src/styles/21-pages.css 里（跟着站点主题走）。
   ========================================================================== */

const KEYWORDS = {
  js: 'const let var function return if else for while do break continue new class extends super this typeof instanceof in of try catch finally throw switch case default import export from as await async yield delete void static get set null undefined true false',
  ts: 'const let var function return if else for while do break continue new class extends implements interface type enum namespace declare public private protected readonly abstract as satisfies keyof infer is asserts any unknown never string number boolean object symbol bigint void null undefined true false import export from default async await yield static get set try catch finally throw switch case break continue for while do in of instanceof typeof delete new this super',
  json: 'true false null',
  css: '',
  html: '',
  bash: 'if then else elif fi for while do done case esac function return exit echo cd ls cat grep sed awk curl wget git npm node mkdir rm cp mv chmod export local set unset source sudo apt systemctl',
  python: 'def class return if elif else for while break continue import from as try except finally raise with lambda yield global nonlocal pass del in is not and or None True False async await assert self',
  go: 'package import func var const type struct interface map chan go defer return if else for range switch case break continue select nil true false',
  rust: 'fn let mut const struct enum impl trait use mod pub crate self super match if else for while loop return break continue where dyn ref move async await unsafe true false Some None Ok Err',
  sql: 'select from where insert into update delete create table drop alter join left right inner outer on group by order limit offset values set as and or not null primary key foreign distinct count sum avg min max',
  yaml: 'true false null',
  md: '',
  text: '',
};

const ALIAS = {
  javascript: 'js', jsx: 'js', mjs: 'js', cjs: 'js', node: 'js',
  typescript: 'ts', tsx: 'ts',
  shell: 'bash', sh: 'bash', zsh: 'bash', console: 'bash',
  py: 'python',
  golang: 'go', rs: 'rust',
  yml: 'yaml',
  htm: 'html', xml: 'html', svg: 'html', vue: 'html',
  scss: 'css', less: 'css',
};

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const span = (cls, text) => `<span class="${cls}">${esc(text)}</span>`;

/** 各语言的注释形态 */
function commentRe(lang) {
  switch (lang) {
    case 'js': case 'ts': case 'go': case 'rust': case 'css': case 'json':
      return lang === 'css' ? /\/\*[\s\S]*?\*\// : /\/\/[^\n]*|\/\*[\s\S]*?\*\//g;
    case 'html': return /<!--[\s\S]*?-->/g;
    case 'bash': case 'python': case 'yaml': return /#[^\n]*/g;
    case 'sql': return /--[^\n]*|\/\*[\s\S]*?\*\//g;
    default: return null;
  }
}

/** 各语言的字符串形态 */
function stringRe(lang) {
  switch (lang) {
    case 'js': case 'ts': case 'go': case 'rust': case 'json': case 'sql':
      return /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g;
    case 'python': return /"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g;
    case 'bash': return /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g;
    case 'html': return /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g;
    case 'css': return /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g;
    case 'yaml': return /"(?:\\.|[^"\\])*"|'(?:[^']|'')*'/g;
    default: return null;
  }
}

/**
 * 把源码切成 [类型, 文本] 序列，再拼成带 span 的 HTML。
 * 用「占位符替换」避免二次匹配：先把注释和字符串挖走，处理剩下的代码，最后填回。
 */
export function highlight(code, langRaw) {
  const lang = ALIAS[String(langRaw || '').toLowerCase()] || String(langRaw || '').toLowerCase();
  if (!KEYWORDS[lang] && lang !== 'css' && lang !== 'html') return esc(code);

  // 占位符用 Unicode 私用区字符（U+E000 起）：数字/关键字/标点那些正则都匹配不到它，
  // 所以「挖走 → 处理代码 → 填回」不会互相打架。
  const PUA = 0xe000;
  const holes = [];
  const stash = (cls, text) => {
    holes.push([cls, text]);
    return String.fromCharCode(PUA + holes.length - 1);
  };

  let src = code;

  const cRe = commentRe(lang);
  if (cRe) src = src.replace(cRe, (m) => stash('tok-com', m));
  const sRe = stringRe(lang);
  if (sRe) src = src.replace(sRe, (m) => stash('tok-str', m));

  if (lang === 'html') {
    src = src.replace(/<\/?([a-zA-Z][\w:-]*)/g, (m, tag) => (m.startsWith('</') ? '</' : '<') + stash('tok-kw', tag));
    src = src.replace(/([a-zA-Z-]+)=/g, (_, attr) => `${stash('tok-attr', attr)}=`);
  } else if (lang === 'css') {
    src = src.replace(/(^|[\s;{])([\w-]+)\s*:/g, (m, pre, prop) => `${pre}${stash('tok-attr', prop)}:`);
    src = src.replace(/([.#][\w-]+)/g, (m) => stash('tok-fn', m));
  } else {
    const kws = new Set((KEYWORDS[lang] || '').split(/\s+/).filter(Boolean));
    src = src.replace(/\b0[xX][0-9a-fA-F]+\b|\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/g, (m) => stash('tok-num', m));
    src = src.replace(/\b[A-Za-z_$][\w$]*\b/g, (word, off) => {
      if (kws.has(word)) return stash('tok-kw', word);
      // 后面跟 ( 的当作函数名
      if (/^\s*\(/.test(src.slice(off + word.length))) return stash('tok-fn', word);
      return word;
    });
  }

  let out = esc(src);
  out = out.replace(/[\uE000-\uF8FF]/g, (ch) => {
    const hole = holes[ch.charCodeAt(0) - PUA];
    return hole ? span(hole[0], hole[1]) : '';
  });
  return out;
}
