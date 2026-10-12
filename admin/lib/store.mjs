/* ==========================================================================
   写作后台 · 内容库
   --------------------------------------------------------------------------
   直接操作仓库里的 content/ 目录：
     content/posts/*.md      博客文章（front-matter + 正文）
     content/projects/*.md   作品
     content/resume.json     简历
   不引入数据库 —— 内容就是文件，跟构建脚本看到的是同一份，没有"同步"这回事。

   所有写入都是原子的（先写 .tmp 再 rename），编辑器崩了也不会留下半截文件。
   ========================================================================== */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, renameSync, unlinkSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { frontMatter } from '../../scripts/lib/markdown.mjs';

export const KINDS = {
  posts: { dir: 'content/posts', label: '文章', type: 'post' },
  projects: { dir: 'content/projects', label: '作品', type: 'project' },
};

/** 文件名白名单：挡掉路径穿越和各种奇怪字符；允许中文 */
export function safeSlug(raw) {
  const s = String(raw == null ? '' : raw).trim();
  if (!s) return null;
  if (s.length > 80) return null;
  if (/[\\/:*?"<>|\u0000-\u001f]/.test(s)) return null;   // 路径分隔符 + Windows 非法字符 + 控制字符
  if (s === '.' || s === '..' || s.startsWith('.')) return null;
  return s;
}

function kindOf(kind) {
  const k = KINDS[kind];
  if (!k) throw new Error(`未知的内容类型：${kind}`);
  return k;
}

/* ------------------------------------------------------------ front-matter */

/** 写回文件时的字段顺序（其余字段按原顺序跟在后面） */
const FIELD_ORDER = [
  'title', 'date', 'draft', 'tags', 'excerpt', 'description', 'cover',
  'tech', 'demo', 'repo', 'featured', 'order', 'toc', 'html',
];

function yamlValue(v) {
  if (Array.isArray(v)) return `[${v.map((x) => String(x)).join(', ')}]`;
  if (typeof v === 'boolean' || typeof v === 'number') return String(v);
  const s = String(v == null ? '' : v);
  // 含冒号、井号、引号、或以特殊字符开头时加引号，避免被自己的解析器读错
  if (s === '' || /[:#'"]/.test(s) || /^[\s\-[{]/.test(s) || /\s$/.test(s)) {
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return s;
}

/** 把 {data, body} 拼回一个 .md 文件 */
export function serializeMarkdown(data, body) {
  const keys = [
    ...FIELD_ORDER.filter((k) => data[k] !== undefined && data[k] !== '' && !(Array.isArray(data[k]) && !data[k].length)),
    ...Object.keys(data).filter((k) => !FIELD_ORDER.includes(k) && data[k] !== undefined && data[k] !== ''),
  ];
  const head = keys.map((k) => `${k}: ${yamlValue(data[k])}`).join('\n');
  return `---\n${head}\n---\n\n${String(body || '').replace(/^\n+/, '')}`;
}

/* ---------------------------------------------------------------- 读取 */

function readDir(kind) {
  const { dir } = kindOf(kind);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.md'));
}

/** 列表：不含正文，只给列表页要用的字段 */
export function listContent(kind) {
  return readDir(kind).map((file) => {
    const slug = file.replace(/\.md$/, '');
    const raw = readFileSync(join(kindOf(kind).dir, file), 'utf8');
    const { data } = frontMatter(raw);
    const st = statSync(join(kindOf(kind).dir, file));
    return {
      slug,
      title: data.title || slug,
      date: typeof data.date === 'string' ? data.date : (data.date ? String(data.date) : ''),
      tags: Array.isArray(data.tags) ? data.tags : (Array.isArray(data.tech) ? data.tech : []),
      draft: data.draft === true,
      mtime: st.mtime.toISOString(),
      bytes: st.size,
    };
  }).sort((a, b) => String(b.date).localeCompare(String(a.date)) || a.slug.localeCompare(b.slug));
}

/** 读单篇：返回 {slug, data, body, exists} */
export function readContent(kind, rawSlug) {
  const slug = safeSlug(rawSlug);
  if (!slug) return null;
  const { dir } = kindOf(kind);
  const file = join(dir, `${slug}.md`);
  if (!existsSync(file)) return { slug, data: {}, body: '', exists: false };
  const { data, content } = frontMatter(readFileSync(file, 'utf8'));
  return { slug, data, body: content.replace(/^\n+/, ''), exists: true };
}

/* ---------------------------------------------------------------- 写入 */

function writeAtomic(absPath, text) {
  mkdirSync(dirname(absPath), { recursive: true });
  const tmp = `${absPath}.tmp-${process.pid}`;
  writeFileSync(tmp, text);
  renameSync(tmp, absPath);          // 同目录 rename 是原子操作
}

/** 写单篇；createOnly 时若已存在则拒绝（防手滑覆盖） */
export function writeContent(kind, rawSlug, data, body, opts = {}) {
  const slug = safeSlug(rawSlug);
  if (!slug) throw new Error('文件名不合法（不能含 / \\ : * ? " < > |，也不能以点开头）');
  const { dir } = kindOf(kind);
  const file = join(dir, `${slug}.md`);
  if (opts.createOnly && existsSync(file)) throw new Error(`已经有一篇叫「${slug}」的了`);

  const clean = Object.assign({}, data);
  if (!clean.title) clean.title = slug;
  if (!clean.date) clean.date = new Date().toISOString().slice(0, 10);
  writeAtomic(file, serializeMarkdown(clean, body));
  return { slug, file };
}

export function deleteContent(kind, rawSlug) {
  const slug = safeSlug(rawSlug);
  if (!slug) throw new Error('文件名不合法');
  const file = join(kindOf(kind).dir, `${slug}.md`);
  if (!existsSync(file)) throw new Error('要删的文件不存在');
  const backup = `${file}.deleted-${Date.now()}`;
  renameSync(file, backup);          // 先改名再删：留一次后悔的机会
  unlinkSync(backup);
  return { slug };
}

/* ---------------------------------------------------------------- 简历 */

const RESUME_FILE = 'content/resume.json';

export function readResume() {
  if (!existsSync(RESUME_FILE)) return { intro: '', sections: [] };
  return JSON.parse(readFileSync(RESUME_FILE, 'utf8'));
}

export function writeResume(text) {
  let obj;
  try { obj = JSON.parse(text); } catch (e) { throw new Error(`JSON 格式不对：${e.message}`); }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('根节点必须是一个对象');
  if (!Array.isArray(obj.sections)) throw new Error('缺少 sections 数组');
  writeAtomic(RESUME_FILE, JSON.stringify(obj, null, 2) + '\n');
  return obj;
}

/* ---------------------------------------------------------------- 开关 */

const FEATURES_FILE = 'content/features.json';

export function readFeatures() {
  if (!existsSync(FEATURES_FILE)) return {};
  const o = JSON.parse(readFileSync(FEATURES_FILE, 'utf8'));
  if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error('content/features.json 应该是一个对象');
  return o;
}

/** 只收 true/false（下划线开头的是注释，照留）。别的键一律丢掉 —— 别把垃圾写进配置。 */
export function writeFeatures(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('开关必须是一个对象');
  const clean = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'boolean' || (k.startsWith('_') && typeof v === 'string')) clean[k] = v;
  }
  writeAtomic(FEATURES_FILE, JSON.stringify(clean, null, 2) + '\n');
  return clean;
}
