/* Development regression only. No runtime dependency. Pass a Playwright index.mjs path. */
import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
const { chromium } = await import(pathToFileURL(resolve(process.argv[2])).href);
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const server = spawn(process.execPath,['site/server.mjs','--host','127.0.0.1','--port','18765'],{cwd:root,stdio:['ignore','pipe','pipe']});
const base='http://127.0.0.1:18765', failures=[], passed=[], errors=[];
let browser;
async function test(name, fn) { try { await fn(); passed.push(name); console.log('PASS',name); } catch(e) { failures.push({name,error:e.stack}); console.error('FAIL',name,e.message); } }
try {
 await new Promise((yes,no)=>{const t=setTimeout(()=>no(Error('server startup timeout')),10000); server.stdout.on('data',b=>{if(String(b).includes('公开口')){clearTimeout(t);yes();}});server.once('error',no);server.once('exit',code=>{clearTimeout(t);no(Error('server exit '+code));});});
 browser=await chromium.launch({channel:'msedge',headless:true});
 const context=await browser.newContext({viewport:{width:1366,height:768},colorScheme:'light'});
 await context.addInitScript(()=>{
   window.__history=[];
   for(const method of ['pushState','replaceState']) {const old=history[method].bind(history);history[method]=(...args)=>{window.__history.push({method,url:args[2]});return old(...args);};}
   const raf=window.requestAnimationFrame.bind(window); window.__rafCount=0;
   window.requestAnimationFrame=fn=>raf(t=>{window.__rafCount++;fn(t);});
 });
 context.setDefaultTimeout(5000);
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.stack));
 const home=async()=>{await page.goto(base);await page.waitForFunction(()=>document.documentElement.classList.contains('app-ready'));};
 const active=()=>page.evaluate(()=>document.querySelector('.panel.is-active')?.id);
 await home();
 await test('HTTP boot, static cards reused and default effects',async()=>{
  assert.equal(await page.locator('#cards a[href]').count(),5);
  assert.equal(await page.evaluate(()=>window.SITE.features['effects.burst']),true);
  assert.equal(await page.evaluate(()=>window.SITE.features['effects.halo']),true);
  assert.equal(await page.evaluate(()=>window.SITE.features['effects.magnetic']),true);
  assert.equal(await page.evaluate(()=>window.SITE.features['effects.transitionStyle']),'random');
  assert.equal(await page.locator('h1 button#hero-title').count(),1);
  assert.equal(await page.evaluate(()=>document.querySelector('#about').inert),true);
 });
 await test('history replay and resize never append history',async()=>{
  await page.locator('.dot[data-i="1"]').click();await page.waitForTimeout(850);assert.equal(await active(),'about');
  const pushes=await page.evaluate(()=>window.__history.filter(x=>x.method==='pushState').length);
  await page.goBack();await page.waitForTimeout(100);assert.equal(await active(),'home');
  await page.goForward();await page.waitForTimeout(100);assert.equal(await active(),'about');
  await page.setViewportSize({width:1280,height:720});await page.waitForTimeout(180);
  assert.equal(await page.evaluate(()=>window.__history.filter(x=>x.method==='pushState').length),pushes);
  assert.equal(new URL(page.url()).hash,'#about');
 });
 await test('modal traps Tab and restores trigger focus',async()=>{
  await page.locator('#cmdk-open').click();await page.waitForTimeout(80);
  assert.equal(await page.evaluate(()=>document.querySelector('#stage').inert),true);
  for(let i=0;i<30;i++){await page.keyboard.press(i%2?'Shift+Tab':'Tab');assert.equal(await page.evaluate(()=>!!document.activeElement.closest('#cmdk')),true);}
  await page.keyboard.press('Escape');await page.waitForTimeout(50);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'cmdk-open');
  assert.equal(await page.evaluate(()=>document.querySelector('#stage').inert),false);
  assert.equal(await page.evaluate(()=>document.querySelector('#home').inert),true);
 });
 await home();
 await test('pointer cancel, lost capture and blur never commit a drag',async()=>{
  for(const kind of ['pointercancel','lostpointercapture','blur']) {
   await page.evaluate(kind=>{const target=document.querySelector('#home .wrap');target.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:7,clientX:50,clientY:300,pointerType:'touch'}));target.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:7,clientX:50,clientY:80,pointerType:'touch'}));if(kind==='blur')window.dispatchEvent(new Event('blur'));else target.dispatchEvent(new PointerEvent(kind,{bubbles:true,pointerId:7,clientX:50,clientY:80,pointerType:'touch'}));},kind);
   await page.waitForTimeout(50);assert.equal(await active(),'home');
  }
 });
 await test('keyboard reads long panel before navigating',async()=>{
  await page.evaluate(()=>{const sc=document.querySelector('#home .panel-scroll');const content=document.createElement('div');content.id='long-test';content.style.height='1600px';content.textContent='long panel';sc.append(content);sc.tabIndex=0;sc.focus();sc.scrollTop=0;});
  await page.waitForTimeout(180);await page.keyboard.press('PageDown');await page.waitForTimeout(300);
  assert.equal(await active(),'home');assert.ok(await page.evaluate(()=>document.querySelector('#home .panel-scroll').scrollTop>100));
  await page.evaluate(()=>document.querySelector('#long-test').remove());
 });
 await test('nested wheel gesture cannot flip at its content boundary',async()=>{
  await page.evaluate(()=>{const sc=document.querySelector('#home .panel-scroll');sc.scrollTop=0;const child=document.createElement('div');child.id='wheel-test';child.style.cssText='height:50px;overflow:auto';child.innerHTML='<div style="height:500px">nested scroll</div>';sc.prepend(child);});
  await page.locator('#wheel-test').dispatchEvent('wheel',{deltaY:80,bubbles:true,cancelable:true});
  await page.evaluate(()=>{const c=document.querySelector('#wheel-test');c.scrollTop=500;document.querySelector('#home .panel-scroll').scrollTop=5000;});
  await page.locator('#wheel-test').dispatchEvent('wheel',{deltaY:100,bubbles:true,cancelable:true});await page.waitForTimeout(80);assert.equal(await active(),'home');
  await page.waitForTimeout(250);await page.locator('#wheel-test').dispatchEvent('wheel',{deltaY:100,bubbles:true,cancelable:true});await page.waitForTimeout(850);assert.equal(await active(),'about');
 });
 await home();
 await test('cross breakpoint clears inert and returns to nearest section',async()=>{
  await page.locator('.dot[data-i="1"]').click();await page.setViewportSize({width:390,height:844});await page.waitForTimeout(220);
  assert.equal(await page.evaluate(()=>Array.from(document.querySelectorAll('.panel')).some(p=>p.inert)),false);
  await page.locator('#about').scrollIntoViewIfNeeded();await page.setViewportSize({width:1366,height:768});await page.waitForTimeout(220);
  assert.equal(await active(),'about');assert.equal(await page.evaluate(()=>document.querySelector('#home').inert),true);
 });
 await home();
 await test('manual theme persists across pages',async()=>{
  await page.locator('#theme-toggle').click();await page.waitForTimeout(550);
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'dark');
  await page.goto(base+'/blog/');assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'dark');
 });
 await home();
 await test('reduced motion stops decorative RAF and keeps title visible',async()=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(400);
  const a=await page.evaluate(()=>window.__rafCount);await page.waitForTimeout(250);const b=await page.evaluate(()=>window.__rafCount);assert.equal(b,a);
  await page.locator('#hero-title').click();assert.equal(await page.evaluate(()=>document.querySelector('#hero-title').classList.contains('is-gone')),false);
  await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(100);assert.ok(await page.evaluate(()=>window.__rafCount)>b);
 });
 await context.close();
 await test('blocked main script still has readable navigation',async()=>{
  const c=await browser.newContext({viewport:{width:390,height:844}});await c.route('**/assets/main.js*',route=>route.abort());const p=await c.newPage();await p.goto(base);
  assert.equal(await p.locator('#cards a[href]').count(),5);assert.equal(await p.evaluate(()=>getComputedStyle(document.querySelector('#about')).visibility),'visible');
  await p.locator('#cards a[href="blog/index.html"]').click();assert.ok(p.url().includes('/blog/'));await c.close();
 });
 await test('hidden lifecycle cancels all application RAF',async()=>{
  const c=await browser.newContext({viewport:{width:1366,height:768}});const p=await c.newPage();await p.goto(base);await p.waitForFunction(()=>document.documentElement.classList.contains('app-ready'));
  await p.evaluate(()=>{const native=window.requestAnimationFrame.bind(window);window.__ticks=0;window.requestAnimationFrame=fn=>native(t=>{window.__ticks++;fn(t);});Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});await p.waitForTimeout(80);const count=await p.evaluate(()=>window.__ticks);await p.waitForTimeout(180);assert.equal(await p.evaluate(()=>window.__ticks),count);
  await p.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});await p.waitForTimeout(80);assert.ok(await p.evaluate(()=>window.__ticks)>count);await c.close();
 });
 await test('enabled experimental effects obey reduced motion and idle halo converges',async()=>{
  const c=await browser.newContext({viewport:{width:1366,height:768},reducedMotion:'reduce'});await c.route('**/assets/site-data.js*',async route=>{const res=await route.fetch();await route.fulfill({response:res,body:await res.text()+';window.SITE.features["effects.halo"]=true;window.SITE.features["effects.magnetic"]=true;window.SITE.features["effects.burst"]=true;window.SITE.features["effects.quality"]="light";'});});const p=await c.newPage();await p.goto(base);await p.waitForFunction(()=>document.documentElement.classList.contains('app-ready'));assert.equal(await p.evaluate(()=>document.documentElement.dataset.fxQuality),'light');
  await p.emulateMedia({reducedMotion:'no-preference'});await p.mouse.move(300,300);await p.waitForTimeout(900);assert.notEqual(await p.locator('#halo').evaluate(e=>e.style.transform),'');
  await p.emulateMedia({reducedMotion:'reduce'});await p.waitForTimeout(120);const tf=await p.locator('#halo').evaluate(e=>e.style.transform);await p.mouse.move(600,600);await p.waitForTimeout(120);assert.equal(await p.locator('#halo').evaluate(e=>e.style.transform),tf);await c.close();
 });
 await test('system theme changes before manual override',async()=>{
  const c=await browser.newContext({colorScheme:'light'});const p=await c.newPage();await p.goto(base);await p.waitForFunction(()=>document.documentElement.classList.contains('app-ready'));await p.emulateMedia({colorScheme:'dark'});await p.waitForTimeout(50);assert.equal(await p.evaluate(()=>document.documentElement.dataset.theme),'dark');await p.locator('#theme-toggle').click();await p.waitForTimeout(500);await p.emulateMedia({colorScheme:'light'});await p.emulateMedia({colorScheme:'dark'});await p.waitForTimeout(50);assert.equal(await p.evaluate(()=>document.documentElement.dataset.theme),'light');await c.close();
 });
 await test('rapid navigation retains only the final request',async()=>{
  const c=await browser.newContext({viewport:{width:1366,height:768}});const p=await c.newPage();await p.goto(base);await p.waitForFunction(()=>document.documentElement.classList.contains('app-ready'));
  await p.evaluate(()=>{const d=document.querySelectorAll('.dot');d[1].click();d[0].click();d[1].click();});await p.waitForTimeout(750);assert.equal(await p.evaluate(()=>document.querySelector('.panel.is-active').id),'about');await c.close();
 });
 await test('detail and shortcuts modal restore their own triggers',async()=>{
  const c=await browser.newContext({viewport:{width:1366,height:768},reducedMotion:'reduce'});const p=await c.newPage();await p.goto(base);await p.waitForFunction(()=>document.documentElement.classList.contains('app-ready'));
  const card=p.locator('.card.is-soon');await card.focus();await p.keyboard.press('Enter');await p.waitForTimeout(40);assert.equal(await p.locator('#item-page').isVisible(),true);
  await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>!!document.activeElement.closest('#item-page')),true);await p.keyboard.press('Escape');await p.waitForTimeout(40);
  assert.equal(await p.evaluate(()=>document.activeElement.matches('.card.is-soon')),true);assert.equal(await p.locator('#item-page').isVisible(),false);
  await p.locator('.dot[data-i="1"]').click();await p.locator('#keys-btn').click();await p.waitForTimeout(40);await p.keyboard.press('Escape');await p.waitForTimeout(40);assert.equal(await p.evaluate(()=>document.activeElement.id),'keys-btn');await c.close();
 });
 await test('server rendering matches build output',async()=>{
  const check=spawn(process.execPath,['scripts/verify-server.mjs','--port','18765'],{cwd:root,stdio:['ignore','pipe','pipe']});let output='';check.stdout.on('data',b=>output+=b);check.stderr.on('data',b=>output+=b);const [code]=await once(check,'exit');assert.equal(code,0,output);
 });
 await test('file protocol and no-script links open',async()=>{
  const c=await browser.newContext({javaScriptEnabled:false});const p=await c.newPage();await p.goto(pathToFileURL(resolve(root,'index.html')).href);await p.locator('#cards a[href="blog/index.html"]').click();assert.ok(p.url().includes('/blog'));await c.close();
 });
 if(errors.length) failures.push({name:'console errors',error:errors.join('\n')});
 const out=resolve(root,'docs/optimization-evidence');mkdirSync(out,{recursive:true});writeFileSync(resolve(out,'regression.json'),JSON.stringify({browser:browser.version(),passed,failures},null,2));
 console.log(JSON.stringify({passed:passed.length,failures},null,2));if(failures.length)process.exitCode=1;
} finally {if(browser)await browser.close();const closed=once(server,'exit');server.kill();await closed;}
