/* ==========================================================================
   站点配置读取（构建脚本和写作后台共用同一份逻辑）
   --------------------------------------------------------------------------
   content/site.js 是给浏览器看的（window.SITE = {...}），不是模块，
   所以这里在 Node 里给它一个假的 window 跑一遍，把对象取出来。
   ========================================================================== */

import { readFileSync } from 'node:fs';

/** 在 Node 里执行一份 site.js，取出 window.SITE */
export function loadSiteObject(absPath) {
  const code = readFileSync(absPath, 'utf8');
  const sandbox = {};
  new Function('window', code)(sandbox);
  const site = sandbox.SITE;
  if (!site || typeof site !== 'object') throw new Error(`${absPath} 没有导出 window.SITE`);
  return site;
}

/** 站点根地址，去掉末尾斜杠 */
export function siteOrigin(site) {
  return String((site && site.url) || 'https://example.com').replace(/\/+$/, '');
}
