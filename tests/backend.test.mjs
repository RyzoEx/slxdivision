import {test} from 'node:test';
import assert from 'node:assert/strict';
import {memoryDatabase} from './commerce-db.mjs';
import {databaseTarget,previewDatabase} from '../server/db.mjs';
import {commerce} from '../server/commerce.mjs';
import {previewAuth,provisionPreviewStaff} from '../server/preview-auth.mjs';
import {emailAddress,hashToken,token} from '../server/security.mjs';
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

test('Preview signup, roles and signed-in management use real database state',async t=>{
  const db=await memoryDatabase();
  t.after(()=>db.close());
  const auth=previewAuth(db);
  const password='isolated test-only credential 1234';
  await provisionPreviewStaff(db,'phase6-owner@example.test','owner',password);
  await provisionPreviewStaff(db,'phase6-operator@example.test','operator',password);
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
  for (const route of ['admin-subscribers','admin-subscribers-csv','admin-social','admin-system','admin-collections']) {
    assert.equal((await request(route)).status,401);
    assert.equal((await request(route,null,operator)).status,403);
  }
  const item=productsSource[0];
  const signup={email:'phase6-buyer@example.test',product:item.id,consent:true};
  assert.equal((await request('interest',{...signup,email:'example@gmail.com'})).status,400);
  assert.equal((await request('interest',{...signup,website:'spam'})).status,400);
  assert.equal((await request('interest',{...signup,consent:false})).status,400);
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
  assert.equal((await request('admin-subscriber-delete',{id:subscriber.id},operator)).status,403);
  assert.equal((await request('unsubscribe',{token:revoke,erase:true})).status,200);
  assert.equal((await db.query('SELECT id FROM slx_interests')).rows.length,0);
  assert.equal((await request('interest',{...signup,email:'phase6-erase@example.test'})).status,201);
  const {rows:[extra]}=await db.query('SELECT id FROM slx_interests');
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
  await provisionPreviewStaff(db,'phase6-owner@example.test','owner',`${password} changed`);
  assert.equal((await request('admin-system',null,owner)).status,401);
  env.VERCEL_ENV='production';
  assert.equal((await request('interest',{...signup,email:'phase6-prod@example.test'})).status,503);
});
