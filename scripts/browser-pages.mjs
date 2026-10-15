/* Development layout and contrast audit; gradient/canvas backgrounds require visual follow-up. */
import assert from 'node:assert/strict';import {pathToFileURL,fileURLToPath} from 'node:url';import {resolve} from 'node:path';import {mkdirSync,writeFileSync} from 'node:fs';
const {chromium}=await import(pathToFileURL(resolve(process.argv[2])).href);const root=resolve(fileURLToPath(new URL('..',import.meta.url))),out=resolve(root,'docs/optimization-evidence');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),results=[];
try{for(const theme of ['light','dark']){const context=await browser.newContext({colorScheme:theme});for(const file of ['index.html','blog/canvas-particle-grid.html','projects/personal-portal.html','resume.html','about.html']){const page=await context.newPage();await page.goto(pathToFileURL(resolve(root,file)).href);await page.waitForTimeout(180);
for(const [width,height] of [[320,640],[390,844],[768,1024],[844,390],[1366,768],[683,384]]){await page.setViewportSize({width,height});await page.waitForTimeout(180);
const audit=await page.evaluate(()=>{
 const parse=s=>{const v=s.match(/[\d.]+/g)?.map(Number)||[];return v.length>=3?[v[0],v[1],v[2],v[3]??1]:[0,0,0,0];};
 const blend=(a,b)=>a.slice(0,3).map((v,i)=>v*a[3]+b[i]*(1-a[3]));
 const bg=el=>{const chain=[];for(let p=el;p;p=p.parentElement)chain.unshift(p);let c=[255,255,255];for(const p of chain)c=blend(parse(getComputedStyle(p).backgroundColor),c);return c;};
 const lum=c=>c.slice(0,3).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;}).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);
 const ratio=(a,b)=>{const x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
 const text=[];const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;
 while(node=walker.nextNode()){
  if(!node.textContent.trim())continue;const el=node.parentElement,css=getComputedStyle(el);if(el.closest('script,style,[hidden],[inert]')||css.visibility!=='visible'||!el.getClientRects().length)continue;
  let transparent=false;for(let p=el;p;p=p.parentElement)if(+getComputedStyle(p).opacity<.95)transparent=true;if(transparent)continue;
  let colors=[parse(css.color)];if(css.webkitTextFillColor==='rgba(0, 0, 0, 0)')colors=(css.backgroundImage.match(/rgba?\([^)]+\)/g)||[]).map(parse);
  for(const color of colors){if(!color[3])continue;const r=ratio(blend(color,bg(el)),bg(el));const large=parseFloat(css.fontSize)>=24||(parseFloat(css.fontSize)>=18.66&&+css.fontWeight>=700);if(r<(large?3:4.5))text.push({text:node.textContent.trim().slice(0,35),selector:el.className,ratio:r,size:css.fontSize});}
 }
 const controls=Array.from(document.querySelectorAll('.icon-btn,.cmdk-open,.btn-ghost')).filter(e=>!e.closest('[hidden],[inert]')&&getComputedStyle(e).visibility==='visible').map(el=>({selector:el.className,ratio:ratio(parse(getComputedStyle(el).borderTopColor),bg(el)),width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height}));
 return{documentWidth:document.documentElement.scrollWidth,overflowElements:Array.from(document.querySelectorAll('body *')).filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.left>=0&&r.right>innerWidth+1&&!e.closest('[hidden],[inert]')&&getComputedStyle(e).visibility==='visible';}).slice(0,8).map(e=>({tag:e.tagName,cls:e.className,width:e.getBoundingClientRect().width})),textContrastFailures:text,controls};
});results.push({theme,file,width,height,...audit});if(width===390||width===1366)await page.screenshot({path:resolve(out,file.replaceAll('/','-').replace('.html','')+'-'+theme+'-'+width+'.png'),fullPage:true});}
await page.close();}await context.close();}writeFileSync(resolve(out,'pages.json'),JSON.stringify({browser:browser.version(),limitations:'CSS alpha compositing; does not sample moving canvas pixels or gradient backgrounds behind text.',results},null,2));console.log(JSON.stringify({cases:results.length,overflow:results.filter(x=>x.documentWidth>x.width),contrast:results.filter(x=>x.textContrastFailures.length).map(x=>({theme:x.theme,file:x.file,width:x.width,failures:x.textContrastFailures})),controls:results.flatMap(x=>x.controls).filter(x=>x.ratio<3)},null,2));if(results.some(x=>x.documentWidth>x.width||x.textContrastFailures.length))process.exitCode=1;}finally{await browser.close();}
