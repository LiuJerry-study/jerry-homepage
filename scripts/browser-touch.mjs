/* Real Chromium touch dispatch: no scrollTo or synthetic pointer-only shortcut. */
import assert from 'node:assert/strict';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {writeFileSync} from 'node:fs';
const {chromium}=await import(pathToFileURL(resolve(process.argv[2])).href);
const root=fileURLToPath(new URL('..',import.meta.url));
const browser=await chromium.launch({channel:'msedge',headless:true});
const results=[];
try {
 for(const js of [true,false]) for(const width of [320,390,768]) {
  const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,javaScriptEnabled:js});
  const page=await context.newPage();await page.goto(pathToFileURL(resolve(root,'index.html')).href);await page.waitForTimeout(350);
  const client=await context.newCDPSession(page);
  async function swipe(y,endY){const x=width/2;await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let n=1;n<=12;n++){await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+(endY-y)*n/12}]});await page.waitForTimeout(16);}await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(250);}
  const before=await page.evaluate(()=>({y:scrollY,touch:getComputedStyle(document.querySelector('.panel-scroll')).touchAction,overflow:getComputedStyle(document.querySelector('.panel-scroll')).overflowY,navClip:getComputedStyle(document.querySelector('.section-nav')).clipPath}));
  await swipe(650,200);
  const down=await page.evaluate(()=>scrollY);
  await swipe(200,650);
  const up=await page.evaluate(()=>scrollY);
  results.push({js,width,before,down,up});
  assert.ok(down>before.y+100,'upward touch swipe must scroll document, JS='+js+' width='+width);
  assert.ok(up<down-100,'downward touch swipe must scroll back');
  assert.equal(before.touch,'auto');assert.equal(before.overflow,'visible');assert.notEqual(before.navClip,'none');
  await context.close();
 }
 console.log(JSON.stringify(results,null,2));writeFileSync(resolve(root,'docs/optimization-evidence/touch.json'),JSON.stringify(results,null,2));
}finally{await browser.close();}
