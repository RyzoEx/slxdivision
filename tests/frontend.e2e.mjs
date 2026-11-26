import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {test} from 'node:test';
import {chromium} from 'playwright-core';
import {memoryDatabase} from './commerce-db.mjs';
import {commerce} from '../server/commerce.mjs';
import {previewAuth,provisionPreviewStaff} from '../server/preview-auth.mjs';

test('browser verifies Preview signup, responsive management and local GA consent', {timeout:60000},async t=>{
  const previewEnv={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'codex/backend-infrastructure',SLX_PREVIEW_SIGNUP:'1'};
  const cleanEnv={...process.env};
  for (const key of Object.keys(cleanEnv)) if (/^(SLX_|VERCEL)/.test(key)) delete cleanEnv[key];
  const build=env=>execFileSync(process.execPath,['build-frontend.cjs'],{env:{...cleanEnv,...env}});
  build(previewEnv);
  const db=await memoryDatabase();
  t.after(()=>db.close());
  const email='slx-dashboard@example.test';
  const password='test-only random-looking credential 0793';
  await provisionPreviewStaff(db,email,'owner',password);
  const handle=commerce({db,auth:previewAuth(db),env:previewEnv,local:true});
  const mime={html:'text/html',css:'text/css',js:'text/javascript',webp:'image/webp',mp4:'video/mp4',png:'image/png',woff2:'font/woff2'};
  const server=createServer(async(req,res)=>{
    const url=new URL(req.url,origin);
    if (url.pathname==='/admin' || url.pathname==='/api/commerce') {
      const chunks=[];
      for await (const chunk of req) chunks.push(chunk);
      const response=await handle(new Request(url,{method:req.method,headers:req.headers,
        ...(chunks.length ? {body:Buffer.concat(chunks)} : {})}));
      res.writeHead(response.status,Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    const file=url.pathname==='/' ? 'index.html' : url.pathname.slice(1);
    if (!/^(?:[\w-]+\/)*[\w.-]+\.(?:html|css|js|webp|mp4|png|woff2)$/.test(file)) {res.writeHead(404).end();return;}
    try {
      const data=await readFile(resolve('dist',file));
      res.writeHead(200,{'content-type':mime[file.split('.').at(-1)]}).end(data);
    } catch {res.writeHead(404).end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>server.close());
  const origin=`http://127.0.0.1:${server.address().port}`;
  const output=process.env.SLX_TEST_SCREENSHOTS;
  if (output) await mkdir(output,{recursive:true});
  const browser=await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE} : {channel:'msedge'});
  t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  page.setDefaultTimeout(6000);
  const failures=[];
  page.on('pageerror',error=>failures.push(error.message));
  await page.goto(`${origin}/product-blind-seraph-tee.html`);
  const notify=page.getByRole('button',{name:'Notify me at launch',exact:true});
  await notify.click();
  const signup=page.getByRole('dialog');
  await signup.getByLabel('Email',{exact:true}).fill('e2e-preview@example.test');
  await signup.getByRole('checkbox').check();
  await signup.getByRole('button',{name:'Subscribe',exact:true}).click();
  await signup.getByText('Request received.').waitFor();
  await page.goto(`${origin}/admin`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль').fill(password);
  await page.getByRole('button',{name:'Увійти'}).click();
  await page.getByText('Попит за дизайнами').waitFor();
  if (output) await page.screenshot({path:resolve(output,'slx-admin-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Підписники',exact:true}).click();
  await page.getByText('e2e-preview@example.test').waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);
  if (output) await page.screenshot({path:resolve(output,'slx-admin-mobile.png'),fullPage:true});
  await page.getByText('Видалити…',{exact:true}).click();
  await page.getByRole('button',{name:'Підтвердити видалення'}).click();
  await page.getByText('Записів за цими фільтрами немає.').waitFor();
  await page.getByRole('button',{name:'Система',exact:true}).click();
  await page.getByText(/Підключено/).waitFor();
  await page.getByRole('button',{name:'Вийти'}).click();
  await page.getByLabel('Пароль').waitFor();
  assert.equal((await page.request.get(`${origin}/api/commerce?op=admin-subscribers`)).status(),401);

  build({SLX_GA_DEBUG:'1'});
  let deliveries=0;
  await page.route('https://www.googletagmanager.com/**',route=>{deliveries++;return route.fulfill({body:'',contentType:'text/javascript'});});
  await page.route('https://www.youtube.com/**',route=>route.abort());
  await page.goto(`${origin}/?utm_source=instagram&utm_medium=social&utm_campaign=drop001&email=private@example.test`);
  await page.getByRole('button',{name:'Reject',exact:true}).click();
  assert.equal(deliveries,0);
  await page.getByRole('button',{name:'Cookie settings'}).click();
  await page.getByRole('button',{name:'Allow',exact:true}).click();
  await page.getByRole('heading',{name:'Collection Preview'}).scrollIntoViewIfNeeded();
  await page.getByRole('link',{name:'Enlarge Blind Seraph artwork'}).click();
  await page.keyboard.press('Escape');
  await page.locator('.drop-follow a[data-social-platform="youtube"]').evaluate(link=>{
    link.addEventListener('click',event=>event.preventDefault(),{once:true});link.click();
  });
  await page.locator('video[data-teaser-play]').dispatchEvent('play');
  await page.waitForFunction(()=>window.dataLayer.some(entry=>entry[1]==='collection_view'));
  const events = await page.evaluate(()=>window.dataLayer.map(entry=>Array.from(entry)));
  assert.equal(deliveries,1);
  assert.deepEqual(events.filter(entry=>entry[0]==='consent').map(entry=>entry[2].analytics_storage),['denied','granted']);
  for (const event of ['page_view','collection_view','artwork_view','social_click','teaser_play']) {
    const emitted=events.filter(entry=>entry[0]==='event' && entry[1]===event);
    assert.equal(emitted.length,1,event);
    assert.equal(emitted[0][2].debug_mode,true);
  }
  const pageView=events.find(entry=>entry[1]==='page_view')[2];
  assert.match(pageView.page_location,/utm_source=instagram/);
  assert.doesNotMatch(JSON.stringify(events),/private@example.test/);
  await page.getByRole('button',{name:'Cookie settings'}).click();
  await page.getByRole('button',{name:'Reject',exact:true}).click();
  await page.waitForFunction(()=>!window.dataLayer && localStorage.getItem('slx-analytics-consent-v1')==='denied');
  assert.equal(deliveries,1);
  assert.deepEqual(failures,[]);
});
