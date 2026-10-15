/* Isolated configuration regression. Never writes live content or settings. */
import assert from 'node:assert/strict';
import { readFileSync,writeFileSync,mkdirSync,readdirSync,rmSync,mkdtempSync,existsSync } from 'node:fs';
import { resolve,join,dirname } from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import { loadSettings,defaultFeatures } from './lib/features.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
mkdirSync(join(root,'.build-cache'),{recursive:true});const fixture=mkdtempSync(join(root,'.build-cache/optimization-fixture-'));
try{
 function copy(from,to) { mkdirSync(to,{recursive:true});for(const entry of readdirSync(from,{withFileTypes:true})) { const src=join(from,entry.name), dest=join(to,entry.name); if(entry.isDirectory()) copy(src,dest); else if(entry.isFile()) writeFileSync(dest,readFileSync(src)); } }
 for(const d of ['scripts','src','content','assets']) copy(join(root,d),join(fixture,d));
 const config={'pages.blog':false,'pages.resume':false,'home.aboutPanel':false,'effects.halo':true,'effects.burst':true,'effects.magnetic':true,'effects.transitionStyle':'random','theme.mode':'dark','effects.quality':'light'};
 writeFileSync(join(fixture,'content/settings.json'),JSON.stringify(config));
 const {renderSite}=await import(pathToFileURL(join(fixture,'scripts/build.mjs')).href);
 const files=renderSite({quiet:true}),html=files.get('index.html'),data=files.get('assets/site-data.js');
 assert.ok(html&&!html.includes('id="about"')&&!html.includes('href="#about"'));
 assert.ok(!html.includes('href="blog/index.html"')&&!html.includes('href="resume.html"'));
 assert.ok(![...files.keys()].some(p=>p.startsWith('blog/')||p==='resume.html'));
 const sandbox={window:{}};runInNewContext(data,sandbox);
 assert.ok(!sandbox.window.SITE.nav.some(c=>c.href==='blog/index.html'||c.href==='resume.html'));
 assert.equal(sandbox.window.SITE.features['effects.halo'],true);
 assert.equal(sandbox.window.SITE.features['theme.mode'],'dark');
 assert.equal(sandbox.window.SITE.features['effects.quality'],'light');
 assert.equal(loadSettings(fixture,readFileSync,existsSync).settings['effects.magnetic'],true);
 assert.equal(defaultFeatures()['effects.burst'],true);
 const markup=runInNewContext(readFileSync(join(root,'src/js/00-card-render.js'),'utf8')+';CardMarkup');
 assert.ok(markup.render([{title:'<unsafe>',href:'',details:['<detail>']}]).includes('&lt;unsafe&gt;'));
 assert.ok(markup.render([{title:'detail',details:['content']}]).includes('<details'));
 writeFileSync(join(fixture,'content/settings.json'),JSON.stringify({...config,'home.cards':false}));
 assert.ok(!renderSite({quiet:true}).get('index.html').includes('class="card '));
 console.log('PASS disabled sections, no stale links, static/runtime filtering, explicit settings precedence, light quality, escaping, no-script details, cards disabled');
}finally{rmSync(fixture,{recursive:true,force:true});}
