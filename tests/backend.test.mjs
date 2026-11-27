import {test} from 'node:test';
import assert from 'node:assert/strict';
import {memoryDatabase} from './commerce-db.mjs';
import {databaseTarget,previewDatabase,migrate} from '../server/db.mjs';
import {readFile} from 'node:fs/promises';
import {commerce} from '../server/commerce.mjs';
import {previewAuth,provisionPreviewStaff} from '../server/preview-auth.mjs';
import {emailAddress,hashToken,token,newId,createSession} from '../server/security.mjs';
import {launchTemplate} from '../server/launch-mail.mjs';
import {productsSource} from '../server/orders.mjs';

test('Neon pooler and direct endpoints resolve to one database target',()=>{
  const url='postgresql://user@ep-slx-pooler.eu-west-1.aws.neon.tech/neondb';
  const direct=url.replace('-pooler','');
  assert.equal(databaseTarget(url),databaseTarget(direct));
  assert.equal(previewDatabase({SLX_DATABASE_URL:direct}),null);
  assert.equal(previewDatabase({VERCEL:'1',VERCEL_GIT_COMMIT_REF:'different',SLX_PREVIEW_DATABASE_URL:url}),null);
  assert.throws(()=>previewDatabase({SLX_PREVIEW_DATABASE_URL:url,SLX_DATABASE_URL:direct}),/different/);
  assert.throws(()=>previewDatabase({SLX_PREVIEW_DATABASE_URL:'postgresql://postgres@db.example.supabase.co/postgres'}),/dedicated Neon/);
});

test('email validation and launch template',()=>{
  assert.equal(emailAddress(' SLX+drop@Example.Test '),'slx+drop@example.test');
  for (const value of ['a..b@slx.test','a@a-.test','a@x.test@x.test','a@x.test\r\nBcc:','a@invalid']) assert.throws(()=>emailAddress(value));
  assert.match(launchTemplate({url:'https://slx.test/?x=1&y=2',unsubscribe:'https://slx.test/unsubscribe'},'<Print>'), /&lt;Print&gt;[\s\S]*x=1&amp;y=2/);
});

test('legacy production schema upgrades without changing account, session or subscriber records',async t=>{
  const db=await memoryDatabase();
  t.after(()=>db.close());
  await db.transaction(tx=>tx.exec(`SET LOCAL search_path TO slx_private, pg_catalog;
    DROP TABLE slx_preview_credentials,slx_store_content,slx_editorial_drafts,slx_mail_previews,slx_spreadshop_entries;
    ALTER TABLE slx_interests DROP COLUMN consent_at,DROP COLUMN consent_version,DROP COLUMN marketing_at,DROP COLUMN withdrawn_at;
    ALTER TABLE slx_users DROP CONSTRAINT slx_users_role_check, ADD CONSTRAINT slx_users_role_check
      CHECK(role IN ('owner','manager','operator','customer'));`));
  const owner={id:newId(),email:'owner@example.test',role:'owner'};
  const manager={id:newId(),email:'manager@example.test',role:'manager'};
  await db.query("INSERT INTO slx_users(id,email,role) VALUES ($1,$2,'owner'),($3,$4,'manager')",[owner.id,owner.email,manager.id,manager.email]);
  const existingCookie=(await createSession(db,owner,true)).split(';')[0];
  const subscriberId=newId(), orderId=newId();
  await db.query("INSERT INTO slx_interests(id,email,product,delivery_key,unsubscribe_hash,status) VALUES ($1,'legacy@example.test','newsletter',$1,$2,'pending')",[subscriberId,hashToken(token())]);
  await db.query("INSERT INTO slx_orders(id,mode,status,items,delivery) VALUES ($1,'test','new','[]','{}')",[orderId]);
  const snapshot=async()=>Object.fromEntries(await Promise.all(['slx_users','slx_sessions','slx_interests','slx_orders','slx_settings'].map(async name=>[
    name,(await db.query(`SELECT * FROM ${name} ORDER BY 1`)).rows.map(({consent_at,consent_version,marketing_at,withdrawn_at,...row})=>row),
  ])));
  const before=await snapshot();
  await migrate(db);
  await migrate(db);
  assert.deepEqual(await snapshot(),before);
  assert.deepEqual((await db.query('SELECT consent_at,consent_version,marketing_at,withdrawn_at FROM slx_interests WHERE id=$1',[subscriberId])).rows[0],
    {consent_at:null,consent_version:null,marketing_at:null,withdrawn_at:null});
  const auth={storageReady:false,password:async email=>email===manager.email?{...manager,email_confirmed_at:'2026-01-01'}:null};
  const env={VERCEL_ENV:'production',VERCEL:'1'};
  const api=commerce({db,auth,env});
  const origin='https://slx.example.test';
  const request=(op,{body,cookie=existingCookie}={})=>api(new Request(`${origin}/api/commerce?op=${op}`,{
    method:body?'POST':'GET',headers:{cookie,...(body?{origin,'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,
  }));
  const summary=await request('admin-summary&mode=live');
  assert.equal(summary.status,200);
  assert.equal((await summary.json()).user.id,owner.id);
  const login=await request('login',{body:{email:manager.email,password:'test-only password'}});
  assert.equal(login.status,200);
  assert.match(login.headers.get('set-cookie'),/^__Host-slx_session=.*HttpOnly; SameSite=Lax; Max-Age=28800; Secure$/);
  assert.equal((await request('admin-content',{cookie:login.headers.get('set-cookie').split(';')[0]})).status,200);
  assert.equal((await request('admin-test-order&mode=test',{body:{}})).status,409);
  assert.equal((await request('admin-orders&mode=live').then(response=>response.json())).orders.length,0);
  assert.equal((await request('admin-notify&mode=live',{body:{}})).status,409);
  assert.equal((await request('interest',{body:{}})).status,503);
});

test('database outages keep static storefront data usable and fail closed for administration',async()=>{
  const unavailable={query:async()=>{throw Object.assign(new Error('test-only outage'),{code:'ECONNRESET'});}};
  for (const db of [null,unavailable]) {
    const api=commerce({db,auth:{},env:{VERCEL_ENV:'production'}});
    const origin='https://slx.example.test';
    const cookie=`__Host-slx_session=${token()}`;
    const request=path=>api(new Request(`${origin}${path}`,{headers:{cookie}}));
    assert.deepEqual(await (await request('/api/commerce?op=catalog')).json(),{ready:false,sales:false,products:[]});
    assert.deepEqual(await (await request('/api/commerce?op=store-content')).json(),{collections:[],social:null});
    const admin=await request('/admin');
    assert.equal(admin.status,503);
    assert.equal(admin.headers.get('retry-after'),'30');
    assert.match(admin.headers.get('cache-control'),/no-store/);
    const html=await admin.text();
    assert.match(html,/Панель тимчасово недоступна/);
    assert.doesNotMatch(html,/id="admin-login"|id="admin-dashboard"/);
    const accounts=await request('/api/commerce?op=admin-subscribers');
    assert.equal(accounts.status,503);
    assert.doesNotMatch(await accounts.text(),/test-only outage/);
  }
});

test('Preview signup, roles and signed-in management use real database state',async t=>{
  const db=await memoryDatabase();
  t.after(()=>db.close());
  const auth=previewAuth(db);
  const password='isolated test-only credential 1234';
  await provisionPreviewStaff(db,'phase6-owner@example.test','owner',password);
  await provisionPreviewStaff(db,'phase6-operator@example.test','operator',password);
  await provisionPreviewStaff(db,'phase6-editor@example.test','editor',password);
  await provisionPreviewStaff(db,'phase6-analyst@example.test','analyst',password);
  await migrate(db);
  const origin='https://slx.example.test';
  const env={VERCEL_ENV:'preview',SLX_PREVIEW_SIGNUP:'1'};
  const requestFor=db=>commerce({db,auth,env});
  const handler=requestFor(db);
  const request=(op,body,cookie,fetch=handler)=>fetch(new Request(`${origin}/api/commerce?op=${op}`,{
    method:body?'POST':'GET',headers:{...(cookie?{cookie}:{}),...(body?{origin,'content-type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),
  }));
  const login=async role=>{
    const response=await request('login',{email:`phase6-${role}@example.test`,password});
    assert.equal(response.status,200);
    assert.match(response.headers.get('set-cookie'),/^__Host-slx_session=.*HttpOnly; SameSite=Lax; Max-Age=28800; Secure$/);
    return response.headers.get('set-cookie').split(';')[0];
  };
  assert.equal((await request('login',{email:'phase6-owner@example.test',password:'wrong'})).status,401);
  const owner=await login('owner');
  const operator=await login('operator');
  const editor=await login('editor');
  const analyst=await login('analyst');
  for (const route of ['admin-subscribers','admin-subscribers-csv','admin-social','admin-system','admin-collections']) {
    assert.equal((await request(route)).status,401);
    assert.equal((await request(route,null,operator)).status,403);
  }
  const item=productsSource[0];
  const signup={email:'phase6-buyer@example.test',product:item.id,consent:true};
  assert.equal((await request('interest',{...signup,email:'example@gmail.com'})).status,400);
  assert.equal((await request('interest',{...signup,website:'spam'})).status,400);
  assert.equal((await request('interest',{...signup,consent:false})).status,400);
  assert.equal((await request('interest',{...signup,product:'newsletter',email:'newsletter@example.test'})).status,400);
  assert.equal((await request('interest',{...signup,product:'newsletter',marketing:true,email:'newsletter@example.test'})).status,201);
  assert.equal((await request('interest',signup,null,requestFor(null))).status,503);
  const broken = requestFor({query:async()=>{throw Object.assign(new Error('test connection failed'),{code:'ECONNRESET'});}});
  const unavailable=await request('interest',signup,null,broken);
  assert.equal(unavailable.status,503);
  assert.equal((await unavailable.json()).ok,undefined);
  for (let i=0;i<8;i++) assert.equal((await request('interest',signup)).status,201);
  assert.equal((await request('interest',signup)).status,429);
  const {subscribers:[subscriber]}=await (await request('admin-subscribers&q=phase6-buyer&consent=active',null,owner)).json();
  assert.ok(subscriber.consent_at && subscriber.consent_version);
  const summary=await (await request('admin-summary',null,owner)).json();
  assert.equal(summary.signups.requests,1);
  assert.equal(summary.signups.designs[0].product,item.id);
  const csv=await request('admin-subscribers-csv',null,owner);
  assert.match(await csv.text(),/phase6-buyer@example\.test/);
  const revoke=token();
  await db.query('UPDATE slx_interests SET unsubscribe_hash=$2 WHERE id=$1',[subscriber.id,hashToken(revoke)]);
  assert.equal((await request('unsubscribe',{token:revoke})).status,200);
  const withdrawn=await (await request('admin-subscribers&consent=withdrawn',null,owner)).json();
  assert.equal(withdrawn.subscribers[0].id,subscriber.id);
  await db.query('DELETE FROM slx_rate');
  assert.equal((await request('interest',signup)).status,201);
  assert.equal((await db.query('SELECT status FROM slx_interests WHERE id=$1',[subscriber.id])).rows[0].status,'unsubscribed');
  assert.equal((await request('admin-subscriber-delete',{id:subscriber.id},operator)).status,403);
  assert.equal((await request('unsubscribe',{token:revoke,erase:true})).status,200);
  assert.equal((await db.query("SELECT id FROM slx_interests WHERE product<>'newsletter'")).rows.length,0);
  assert.equal((await request('interest',{...signup,email:'phase6-erase@example.test'})).status,201);
  const {rows:[extra]}=await db.query("SELECT id FROM slx_interests WHERE product<>'newsletter'");
  assert.equal((await request('admin-subscriber-delete',{id:extra.id},owner)).status,200);
  assert.equal((await request('admin-social',{YouTube:'https://youtube.com.evil.test/a'},owner)).status,400);
  assert.equal((await request('admin-social',{YouTube:'https://www.youtube.com/@SLXDivision'},owner)).status,200);
  assert.equal((await request('admin-collection',{id:item.collection,release:'live',hidden:[item.id]},owner)).status,200);
  assert.equal((await (await request('catalog')).json()).sales,false);
  const publicContent=await (await request('store-content')).json();
  assert.deepEqual(publicContent.collections[0].hidden,[item.id]);
  assert.equal(publicContent.collections[0].release,undefined);
  const system=await (await request('admin-system',null,owner)).json();
  assert.equal(system.database,'connected');
  assert.equal(system.spreadshop,false);
  assert.equal(system.analytics,false);
  assert.equal((await request('admin-subscribers',null,analyst)).status,403);
  assert.equal((await request('admin-subscribers-csv',null,editor)).status,403);
  assert.equal((await request('admin-orders',null,analyst)).status,403);
  assert.equal((await request('admin-collection',{id:item.collection,release:'live'},analyst)).status,403);
  const analyticSummary=await (await request('admin-summary',null,analyst)).text();
  assert.doesNotMatch(analyticSummary,/newsletter@example\.test|phase6-buyer@example\.test/);
  assert.equal((await request('admin-content',null,analyst)).status,403);
  const content=await (await request('admin-content',null,editor)).json();
  const collection={...content.collection[0],kind:'collection',status:'published',name:'Draft collection only'};
  assert.equal((await request('admin-content-save',collection,editor)).status,200);
  const origins=await handler(new Request(`${origin}/api/commerce?op=admin-content-save`,{
    method:'POST',headers:{origin:'https://untrusted.example.test',cookie:editor,'content-type':'application/json'},body:JSON.stringify(collection),
  }));
  assert.equal(origins.status,403);
  assert.doesNotMatch(await (await request('store-content')).text(),/Draft collection only/);
  assert.equal((await request('admin-content-save',{...collection,cover:'https://example.test/photo'},editor)).status,400);
  const bytes=await readFile('assets/brand/logo.webp');
  assert.equal((await request('admin-media-validate',{mime:'image/webp',base64:bytes.toString('base64')},editor)).status,200);
  assert.equal((await request('admin-media-validate',{mime:'image/png',base64:bytes.toString('base64')},editor)).status,400);
  assert.equal((await request('admin-email-dry-run',{template:'launch'},editor)).status,403);
  const dry=()=>request('admin-email-dry-run',{template:'launch'},owner).then(response=>response.json());
  assert.deepEqual(await dry(),{simulated:true,duplicate:false});
  assert.deepEqual(await dry(),{simulated:true,duplicate:true});
  assert.match(await (await request('admin-email&template=launch',null,owner)).text(),/DROP 001 has launched/);
  assert.equal((await request('interest',{...signup,email:'=formula@example.test'})).status,201);
  assert.match(await (await request('admin-subscribers-csv',null,owner)).text(),/"'=formula@example\.test"/);
  await db.query('UPDATE slx_sessions SET expires_at=now() WHERE token_hash=$1',[hashToken(analyst.split('=')[1])]);
  assert.equal((await request('admin-summary',null,analyst)).status,401);
  await provisionPreviewStaff(db,'phase6-owner@example.test','owner',`${password} changed`);
  assert.equal((await request('admin-system',null,owner)).status,401);
  env.VERCEL_ENV='production';
  assert.equal((await request('interest',{...signup,email:'phase6-prod@example.test'})).status,503);
});
