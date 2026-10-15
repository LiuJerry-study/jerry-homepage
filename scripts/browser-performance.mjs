/* Lab measurement only. Usage: node scripts/browser-performance.mjs <playwright module> [before|after] */
import { pathToFileURL,fileURLToPath } from 'node:url';
import { resolve,join,extname } from 'node:path';
import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
const {chromium}=await import(pathToFileURL(resolve(process.argv[2])).href);
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const version=process.argv[3]||'after';
const dir=version==='before'?join(root,'.build-cache/optimization-baseline'):root;
const server=createServer((req,res)=>{try{const p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const f=join(dir,p==='/'?'index.html':p);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[extname(f)]||'application/octet-stream');res.end(readFileSync(f));}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'msedge',headless:true});
const runs=[],base='http://127.0.0.1:'+server.address().port;
try{
 for(const scenario of ['idle','pointer','title','search','stage','debug-idle']){
  for(let repeat=0;repeat<3;repeat++){
   const context=await browser.newContext({viewport:{width:1366,height:768},colorScheme:'light'});
   await context.addInitScript(()=>{
    window.__m={lcp:0,cls:0,long:[],frames:[],appRaf:0,events:[]};
    const native=window.requestAnimationFrame.bind(window);window.__nativeRaf=native;
    window.requestAnimationFrame=fn=>native(t=>{window.__m.appRaf++;fn(t);});
    for(const type of ['largest-contentful-paint','layout-shift','longtask','event']){try{new PerformanceObserver(list=>{for(const e of list.getEntries()){if(type==='largest-contentful-paint')window.__m.lcp=e.startTime;if(type==='layout-shift'&&!e.hadRecentInput)window.__m.cls+=e.value;if(type==='longtask')window.__m.long.push({start:e.startTime,duration:e.duration});if(type==='event'&&e.interactionId)window.__m.events.push({name:e.name,duration:e.duration});}}).observe({type,buffered:true,...(type==='event'?{durationThreshold:16}:{})});}catch{}}
   });
   const p=await context.newPage();await p.goto(base+(scenario==='debug-idle'?'/?perf=1':'/'));await p.waitForTimeout(500);
   await p.evaluate(()=>{window.__m.frames=[];window.__m.appRaf=0;let last=performance.now();window.__collect=true;const frame=t=>{window.__m.frames.push(t-last);last=t;if(window.__collect)window.__nativeRaf(frame);};window.__nativeRaf(frame);});
   const start=Date.now();
   if(scenario==='pointer'){for(let i=0;i<35;i++){await p.mouse.move(150+i*25,220+Math.sin(i/4)*80);await p.waitForTimeout(30);}}
   if(scenario==='title')await p.locator('#hero-title').click();
   if(scenario==='search'){await p.locator('#cmdk-open').click();await p.locator('#cmdk-input').fill('粒子');await p.waitForTimeout(250);await p.keyboard.press('Escape');}
   if(scenario==='stage'){for(let i=0;i<4;i++){await p.locator('.dot').nth(i%2?0:1).click();await p.waitForTimeout(750);}}
   await p.waitForTimeout(Math.max(100,(scenario==='title'?2600:1700)-(Date.now()-start)));
   const measured=await p.evaluate(()=>{window.__collect=false;const m=window.__m,frames=m.frames.filter(x=>x>0).sort((a,b)=>a-b);return{lcp:m.lcp,cls:m.cls,p95:frames[Math.floor(frames.length*.95)],maxFrame:frames.at(-1),appRaf:m.appRaf,long:m.long,events:m.events};});
   runs.push({scenario,repeat,...measured});await context.close();
  }
 }
 const median=a=>a.sort((a,b)=>a-b)[Math.floor(a.length/2)];
 const summary=Object.fromEntries([...new Set(runs.map(x=>x.scenario))].map(s=>{const r=runs.filter(x=>x.scenario===s);return[s,{lcp:median(r.map(x=>x.lcp)),cls:median(r.map(x=>x.cls)),p95:median(r.map(x=>x.p95)),maxFrame:median(r.map(x=>x.maxFrame)),appRaf:median(r.map(x=>x.appRaf)),longTasks:r.flatMap(x=>x.long).length,maxEventDuration:Math.max(0,...r.flatMap(x=>x.events.map(e=>e.duration)))}];}));
 const out=join(root,'docs/optimization-evidence');mkdirSync(out,{recursive:true});writeFileSync(join(out,'performance-'+version+'.json'),JSON.stringify({version,browser:browser.version(),platform:process.platform,viewport:'1366x768',headless:true,baseline:version==='before'?'git HEAD reconstructed, excluding uncommitted changes':undefined,summary,runs},null,2));console.log(JSON.stringify({version,summary},null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
