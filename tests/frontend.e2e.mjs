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
  const build=(env,args=[])=>execFileSync(process.execPath,['build-frontend.cjs',...args],{env:{...cleanEnv,...env}});
  build(previewEnv);
  const db=await memoryDatabase();
  t.after(()=>db.close());
  const email='slx-dashboard@example.test';
  const password='test-only random-looking credential 0793';
  await provisionPreviewStaff(db,email,'owner',password);
  const handle=commerce({db,auth:previewAuth(db),env:previewEnv,local:true});
  const mime={html:'text/html',css:'text/css',js:'text/javascript',webp:'image/webp',mp4:'video/mp4',png:'image/png',woff2:'font/woff2',svg:'image/svg+xml'};
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
    if (!/^(?:[\w-]+\/)*[\w.-]+\.(?:html|css|js|webp|mp4|png|woff2|svg)$/.test(file)) {res.writeHead(404).end();return;}
    try {
      const data=await readFile(resolve('dist',file));
      res.writeHead(200,{'content-type':mime[file.split('.').at(-1)],'content-length':data.length}).end(req.method==='HEAD'?undefined:data);
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
  async function go(label) {
    const mobile=page.getByRole('button',{name:'Відкрити навігацію'});
    if (await mobile.isVisible()) {await mobile.click();await page.locator('#admin-mobile-nav').getByRole('button',{name:label,exact:true}).click();}
    else await page.locator('#admin-navigation').getByRole('button',{name:label,exact:true}).click();
    await page.locator('#admin-panel h1').getByText(label==='Огляд'?'Огляд SLX Division':label,{exact:true}).waitFor();
    await page.waitForFunction(()=>document.querySelector('#admin-panel').getAttribute('aria-busy')==='false');
  }
  await page.getByRole('button',{name:'Згорнути панель'}).click();
  assert.equal(await page.locator('#admin-navigation').evaluate(node=>node.offsetWidth),64);
  await page.getByRole('button',{name:'Розгорнути панель'}).click();
  await page.keyboard.press('Control+k');
  await page.getByRole('searchbox',{name:'Знайти розділ'}).fill('Підписники');
  await page.keyboard.press('Enter');
  await page.getByRole('table',{name:'Підписники SLX'}).waitFor();
  await go('Огляд');
  if (output) await page.screenshot({path:resolve(output,'slx-admin-desktop.png'),fullPage:true});
  for (const [slug,label] of [['overview','Огляд'],['analytics','Аналітика'],['subscribers','Підписники'],['collections','Колекції'],['designs','Дизайни'],
    ['website','Вебсайт'],['media','Медіатека'],['email','Листи'],['social','Соцмережі'],['system','Система'],['products','Товари'],['orders','Замовлення'],
    ['customers','Клієнти'],['finance','Фінанси'],['referrals','SLX Circle'],['manufacturing','Виробництво'],['partners','Виробники'],['settings','Налаштування']]) {
    for (const width of [1440,390]) {
      await page.setViewportSize({width,height:920});
      await go(label);
      if (slug==='finance') await page.getByText('Звіт за період',{exact:true}).waitFor();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
      if (output) await page.screenshot({path:resolve(output,`${slug}-${width}.png`),fullPage:true});
    }
  }
  await page.setViewportSize({width:390,height:844});
  await go('Підписники');
  await page.getByText('e2e-preview@example.test').waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);
  if (output) await page.screenshot({path:resolve(output,'slx-admin-mobile.png'),fullPage:true});
  const actions=page.getByLabel('Дії підписника');
  await actions.click();await page.getByRole('button',{name:'Історія згоди'}).click();
  await page.getByRole('dialog',{name:'Історія згоди'}).waitFor();
  await page.keyboard.press('Escape');
  if (!(await page.getByRole('button',{name:'Видалити…',exact:true}).isVisible())) await actions.click();
  await page.getByText('Видалити…',{exact:true}).click();
  await page.keyboard.press('Escape');
  await page.getByText('e2e-preview@example.test').waitFor();
  if (!(await page.getByRole('button',{name:'Видалити…',exact:true}).isVisible())) await actions.click();
  await page.getByText('Видалити…',{exact:true}).click();
  await page.getByRole('button',{name:'Підтвердити видалення'}).click();
  await page.getByText('Записів за цими фільтрами немає.').waitFor();
  await go('Система');
  await page.getByText('Локальна база',{exact:true}).waitFor();
  await go('Колекції');
  await page.getByRole('button',{name:'Редагувати',exact:true}).click();
  await page.getByLabel('Slug',{exact:true}).waitFor();
  await page.keyboard.press('Escape');
  await go('Листи');
  await page.getByRole('button',{name:'Переглянути лист'}).first().click();
  await page.getByRole('button',{name:'Mobile'}).click();
  assert.equal(await page.locator('.console-email-preview').evaluate(node=>node.classList.contains('is-mobile')),true);
  await page.keyboard.press('Escape');
  await go('Вебсайт');
  await page.getByLabel('Hero',{exact:true}).fill('Phase 7 test draft');
  await page.getByRole('button',{name:'Переглянути чернетку',exact:true}).click();
  await page.getByRole('heading',{name:'Phase 7 test draft',exact:true}).waitFor();
  await page.getByRole('button',{name:'Зберегти чернетку'}).click();
  await page.getByText('Збережено.',{exact:true}).waitFor();
  for (const width of [360,390,768,1024,1440,1920]) {
    await page.setViewportSize({width,height:840});
    await go('Огляд');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
  }
  await page.getByRole('button',{name:'Вийти',exact:true}).click();
  await page.getByLabel('Пароль').waitFor();
  assert.equal((await page.request.get(`${origin}/api/commerce?op=admin-subscribers`)).status(),401);

  build({SLX_GA_DEBUG:'1'},['--local-admin']);
  let deliveries=0;
  await page.route('https://www.googletagmanager.com/**',route=>{deliveries++;return route.fulfill({body:'',contentType:'text/javascript'});});
  await page.route('https://www.youtube.com/**',route=>route.abort());
  await page.goto(`${origin}/?utm_source=youtube&utm_medium=social&utm_campaign=drop001&utm_content=video&email=private@example.test#private@example.test`,{
    referer:'https://www.youtube.com/watch?email=referrer@example.test',
  });
  assert.equal(deliveries,0);
  await page.getByRole('button',{name:'Reject',exact:true}).click();
  assert.equal(deliveries,0);
  await page.getByRole('button',{name:'Cookie settings'}).click();
  await page.getByRole('button',{name:'Allow',exact:true}).click();
  for (const width of [360,390,768,1024,1440,1920]) {
    await page.setViewportSize({width,height:840});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
  }
  await page.getByRole('button',{name:'Get collection updates',exact:true}).click();
  await page.getByRole('dialog').getByLabel('Email',{exact:true}).fill('phase7-news@example.test');
  await page.getByRole('dialog').getByRole('checkbox').first().check();
  await page.getByRole('dialog').getByRole('checkbox').last().check();
  await page.getByRole('dialog').getByRole('button',{name:'Subscribe',exact:true}).click();
  await page.getByText('Request received.').waitFor();
  await page.keyboard.press('Escape');
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
  for (const event of ['collection_view','artwork_view','social_click','teaser_play','notify_me_conversion']) {
    const emitted=events.filter(entry=>entry[0]==='event' && entry[1]===event);
    assert.equal(emitted.length,1,event);
    assert.equal(emitted[0][2].debug_mode,true);
  }
  const pageConfig=events.filter(entry=>entry[0]==='config');
  assert.equal(pageConfig.length,1);
  assert.equal(events.filter(entry=>entry[0]==='event' && entry[1]==='page_view').length,0);
  const pageView=pageConfig[0][2];
  assert.equal(pageView.debug_mode,true);
  assert.equal(pageView.page_location,`${origin}/?utm_source=youtube&utm_medium=social&utm_campaign=drop001&utm_content=video`);
  assert.equal(pageView.page_referrer,'https://youtube.com/');
  assert.equal(pageView.allow_google_signals,false);
  assert.equal(pageView.allow_ad_personalization_signals,false);
  assert.doesNotMatch(JSON.stringify(events),/private@example.test|phase7-news@example.test|referrer@example.test/);
  for (const [source,placement] of [['tiktok','bio'],['pinterest','pin']]) {
    await page.goto(`${origin}/product-blind-seraph-tee.html?utm_source=${source}&utm_medium=social&utm_campaign=drop001&utm_content=${placement}&utm_term=person%40example.test`,{
      referer:'https://personal-looking.example.test/account',
    });
    const commands=await page.evaluate(()=>window.dataLayer.map(entry=>Array.from(entry)));
    const configs=commands.filter(entry=>entry[0]==='config');
    assert.equal(configs.length,1);
    assert.equal(configs[0][2].page_location,`${origin}/product-blind-seraph-tee.html?utm_source=${source}&utm_medium=social&utm_campaign=drop001&utm_content=${placement}`);
    assert.equal(configs[0][2].page_referrer,'');
    assert.equal(commands.filter(entry=>entry[0]==='event' && entry[1]==='view_item').length,1);
  }
  await page.waitForFunction(()=>document.querySelector('script[src*="googletagmanager.com/gtag/js"]'));
  await page.evaluate(()=>{
    document.cookie='_ga=test-only; Path=/';
    document.cookie='_ga_FS55E1QPDN=test-only; Path=/';
    window.addEventListener('beforeunload',()=>{
      const consent=window.dataLayer.filter(entry=>entry[0]==='consent').at(-1)[2];
      sessionStorage.setItem('test-revocation',JSON.stringify({consent,disabled:window['ga-disable-G-FS55E1QPDN']}));
    },{once:true});
  });
  await page.getByRole('button',{name:'Cookie settings'}).click();
  await page.getByRole('button',{name:'Reject',exact:true}).click();
  await page.waitForFunction(()=>!window.dataLayer && localStorage.getItem('slx-analytics-consent-v1')==='denied');
  const withdrawal=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('test-revocation')));
  assert.equal(withdrawal.disabled,true);
  assert.deepEqual(Object.values(withdrawal.consent),['denied','denied','denied','denied']);
  assert.equal((await page.context().cookies()).some(cookie=>cookie.name.startsWith('_ga')),false);
  assert.equal(deliveries,3);
  assert.deepEqual(failures,[]);
});
