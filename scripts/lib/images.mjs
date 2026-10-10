/* ==========================================================================
   图片小工具（零依赖，构建期使用）
   --------------------------------------------------------------------------
   只做两件事：
     1. 从文件头读出宽高（PNG / JPEG / GIF / WebP / SVG），用来给 <img> 补上
        width/height —— 图片加载前就占好位置，正文不会跳（CLS）。
     2. 把 content/images/ 整棵目录拷到 assets/images/。
   不做压缩、不做缩略图：那需要图片编解码库，跟"零依赖"冲突。
   （要压缩就用现成工具处理完再放进 content/images/，构建这边不管。）
   ========================================================================== */

import { readFileSync, readdirSync, mkdirSync, copyFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';

/** 从 buffer 里读图片尺寸；读不出来返回 null */
export function imageSize(buf) {
  try {
    if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
      // PNG：IHDR 紧跟在 8 字节签名 + 4 字节长度 + 4 字节类型之后
      return { type: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
    if (buf.length > 10 && (buf.toString('ascii', 0, 3) === 'GIF')) {
      return { type: 'gif', width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
    }
    if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
      // JPEG：逐个段扫，找 SOFn
      let i = 2;
      while (i + 9 < buf.length) {
        if (buf[i] !== 0xff) { i++; continue; }
        const marker = buf[i + 1];
        const len = buf.readUInt16BE(i + 2);
        const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
        if (isSOF) return { type: 'jpeg', height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
        i += 2 + len;
      }
      return null;
    }
    if (buf.length > 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
      const fourcc = buf.toString('ascii', 12, 16);
      if (fourcc === 'VP8X') {
        const w = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
        const h = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
        return { type: 'webp', width: w, height: h };
      }
      if (fourcc === 'VP8 ') {
        return { type: 'webp', width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
      }
      if (fourcc === 'VP8L') {
        const bits = buf.readUInt32LE(21);
        return { type: 'webp', width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
      return null;
    }
    if (buf.length > 40 && /^\s*<(\?xml|svg)/i.test(buf.toString('utf8', 0, 200))) {
      const head = buf.toString('utf8', 0, 2000);
      const w = /\swidth="([\d.]+)/.exec(head);
      const h = /\sheight="([\d.]+)/.exec(head);
      if (w && h) return { type: 'svg', width: Math.round(+w[1]), height: Math.round(+h[1]) };
      const vb = /viewBox="[\d.+-]+[\s,]+[\d.+-]+[\s,]+([\d.]+)[\s,]+([\d.]+)"/.exec(head);
      if (vb) return { type: 'svg', width: Math.round(+vb[1]), height: Math.round(+vb[2]) };
      return { type: 'svg', width: 0, height: 0 };
    }
  } catch (e) { /* 文件损坏或格式不认：当未知处理 */ }
  return null;
}

/** 读磁盘上一个图片文件的尺寸 */
export function imageSizeOfFile(absPath) {
  if (!existsSync(absPath)) return null;
  return imageSize(readFileSync(absPath));
}

/** 把整个目录拷过去（递归）；返回拷贝的文件数 */
export function copyTree(srcDir, destDir) {
  if (!existsSync(srcDir)) return 0;
  let n = 0;
  const walk = (from, to) => {
    mkdirSync(to, { recursive: true });
    for (const name of readdirSync(from)) {
      const a = join(from, name);
      const b = join(to, name);
      if (statSync(a).isDirectory()) walk(a, b);
      else { copyFileSync(a, b); n++; }
    }
  };
  walk(srcDir, destDir);
  return n;
}

/** 判断扩展名是不是图片 */
export function isImage(p) {
  return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif'].includes(extname(p).toLowerCase());
}
