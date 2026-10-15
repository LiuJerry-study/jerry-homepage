/* Development-only browser regression. Usage: node scripts/browser-smoke.mjs <playwright index.mjs> */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
const { chromium } = await import(pathToFileURL(resolve(process.argv[2])).href);
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const url = pathToFileURL(resolve(root, 'index.html')).href;
const errors = [], results = [];
const out = resolve(root, 'docs/optimization-evidence'); mkdirSync(out, { recursive: true });
try {
 for (const colorScheme of ['light','dark']) {
  const context = await browser.newContext({ colorScheme, viewport: { width:1366, height:768 } });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.stack));
  await page.goto(url); await page.waitForTimeout(700);
  console.log('state', colorScheme, await page.evaluate(() => ({ready:document.documentElement.className, theme:document.documentElement.dataset.theme, cards:document.querySelectorAll('#cards a[href]').length})));
  for (const [width,height] of [[360,640],[390,844],[768,1024],[844,390],[1366,768],[320,640],[683,384]]) {
    await page.setViewportSize({width,height}); await page.waitForTimeout(250);
    const state = await page.evaluate(() => ({width:innerWidth, documentWidth:document.documentElement.scrollWidth, desktop:document.documentElement.classList.contains('stage-ready'), visible:Array.from(document.querySelectorAll('.panel')).map(p=>({id:p.id,inert:p.inert,visibility:getComputedStyle(p).visibility, height:p.getBoundingClientRect().height}))}));
    results.push({colorScheme,width,height,...state});
    await page.screenshot({path:resolve(out, 'home-'+colorScheme+'-'+width+'x'+height+'.png'),fullPage:true});
  }
  await context.close();
 }
 const context = await browser.newContext({ javaScriptEnabled:false,viewport:{width:390,height:844} });
 const page = await context.newPage(); await page.goto(url);
 results.push({noScript:true,links:await page.locator('#cards a[href]').count(), width:await page.evaluate(()=>document.documentElement.scrollWidth)});
 await page.screenshot({path:resolve(out,'home-noscript.png'),fullPage:true}); await context.close();
 console.log(JSON.stringify({errors, results: results.map(r => ({ colorScheme:r.colorScheme, width:r.width, height:r.height, desktop:r.desktop, overflow:r.documentWidth > r.width, noScript:r.noScript, links:r.links }))},null,2));
 writeFileSync(resolve(out,'smoke.json'),JSON.stringify({browser:browser.version(),errors,results},null,2));
 if(errors.length) process.exitCode=1;
} finally { await browser.close(); }