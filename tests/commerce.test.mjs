import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryDatabase } from './commerce-db.mjs';
import { commerce } from '../server/commerce.mjs';
import { newId, hashToken } from '../server/security.mjs';
import { productsSource } from '../server/orders.mjs';
import { launchMailReady } from '../server/launch-mail.mjs';

test('launch mail requires a production sender and an unsubscribe secret', () => {
  const env = {
    SLX_SMTP_USER:'store@example.com', SLX_SMTP_PASSWORD:'abcdefghijklmnop',
    SLX_UNSUBSCRIBE_SECRET:'a-local-test-secret-with-at-least-32-characters',
    VERCEL_ENV:'production',
  };
  assert.equal(launchMailReady(env),false);
  env.SLX_SMTP_USER = 'store@gmail.com';
  assert.equal(launchMailReady(env),true);
  env.SLX_SMTP_USER = 'store@meta.ua';
  assert.equal(launchMailReady(env),true);
  assert.equal(launchMailReady({...env,SLX_SMTP_PASSWORD:''}),false);
  assert.equal(launchMailReady({...env,SLX_UNSUBSCRIBE_SECRET:''}),false);
  assert.equal(launchMailReady({...env,VERCEL_ENV:'preview'}),false);
});

test('server-backed auth, protected admin, prelaunch, isolated order pipeline and finance',async () => {
  const db = await memoryDatabase();
  try {
    const owner = {id:newId(),email:'owner@example.test',email_confirmed_at:'2026-01-01'};
    const operator = {id:newId(),email:'operator@example.test',email_confirmed_at:'2026-01-01'};
    const customer = {id:newId(),email:'buyer@example.test',email_confirmed_at:'2026-01-01'};
    await db.query("INSERT INTO slx_users(id,email,role) VALUES ($1,$2,'owner'),($3,$4,'operator')",[owner.id,owner.email,operator.id,operator.email]);
    const auth = { authReady:true, password:email=>[owner,operator,customer].find(identity=>identity.email===email),
      otp:async()=>{}, verify:async()=>customer };
    const env = {};
    const events = [];
    const fetch = commerce({db,auth,env,local:true,fetcher:async (url,init)=>{
      assert.equal(url,'https://mail.example.test/slx');
      events.push({payload:JSON.parse(init.body),key:init.headers['Idempotency-Key']});
      return new Response(null,{status:204});
    }});
    const origin = 'http://127.0.0.1:4173';
    function request(op, {body,cookie,wrongOrigin=false} = {}) {
      return fetch(new Request(`${origin}/api/commerce?op=${op}`,{
        method:body ? 'POST' : 'GET',
        headers:{ ...(cookie ? {cookie} : {}), ...(body ? {'Content-Type':'application/json',origin:wrongOrigin ? 'http://bad.test' : origin} : {}) },
        body:body ? JSON.stringify(body) : undefined,
      }));
    }
    const cookie = response => response.headers.get('set-cookie').split(';')[0];
    assert.equal((await request('admin-orders')).status,401);
    assert.match(await (await fetch(new Request(origin+'/admin'))).text(),/admin-login/);
    assert.equal((await request('login',{body:{email:owner.email,password:'value'},wrongOrigin:true})).status,403);
    const ownerCookie = cookie(await request('login',{body:{email:owner.email,password:'value'}}));
    assert.ok((await db.query('SELECT token_hash FROM slx_sessions')).rows.some(row=>row.token_hash===hashToken(ownerCookie.split('=')[1])));
    const operatorCookie = cookie(await request('login',{body:{email:operator.email,password:'value'}}));
    assert.equal((await request('admin-finance',{cookie:operatorCookie})).status,403);
    assert.equal((await (await request('account')).json()).authReady,false);
    assert.equal((await request('otp',{body:{email:customer.email}})).status,503);
    assert.equal((await request('verify',{body:{email:customer.email, code:'123456'}})).status,503);
    env.SLX_CUSTOMER_OTP_ENABLED = '1';
    assert.equal((await (await request('account')).json()).authReady,true);
    const buyerCookie = cookie(await request('verify',{body:{email:customer.email,code:'123456'}}));
    assert.equal((await request('admin-products',{cookie:buyerCookie})).status,403);
    const item = productsSource[0].id;
    const lines = [{id:item,quantity:2,size:'M',color:'Чорний',testPrice:120000}];
    assert.equal((await request('order',{cookie:buyerCookie,body:{requestId:newId(),items:lines}})).status,409);
    assert.equal((await request('admin-settings&mode=live',{cookie:ownerCookie,body:{
      sales:true,manufacturer_ready:true,terms_ready:true,founder_share_bps:5000,referral_bps:500,
    }})).status,409);
    assert.equal((await request('admin-referral&mode=test',{cookie:ownerCookie,body:{code:'SLX-TEST',label:'Test'}})).status,200);
    const requestId = newId();
    const payload = {requestId,items:lines,referral:'SLX-TEST',delivery:{phone:'+380123456789'}};
    assert.equal((await request('admin-test-order&mode=test',{cookie:ownerCookie,body:payload})).status,201);
    assert.equal((await request('admin-test-order&mode=test',{cookie:ownerCookie,body:payload})).status,201);
    assert.equal((await (await request('admin-orders&mode=live',{cookie:ownerCookie})).json()).orders.length,0);
    assert.equal((await (await request('account',{cookie:buyerCookie})).json()).orders.length,0);
    const operations = await (await request('admin-orders&mode=test',{cookie:operatorCookie})).json();
    assert.equal(operations.orders.length,1);
    assert.equal(operations.orders[0].financials,undefined);
    assert.deepEqual(operations.orders[0].delivery,{name:'Тестове замовлення'});
    assert.equal((await request('admin-order&mode=test',{cookie:operatorCookie,body:{id:requestId,expectedStatus:'new',costs:{garment:2000}}})).status,403);
    assert.equal((await request('admin-order&mode=test',{cookie:ownerCookie,body:{id:requestId,expectedStatus:'new',status:'shipped'}})).status,409);
    let previous = 'new';
    for (const status of ['availability_check','awaiting_payment','paid','sent_to_manufacturer','in_production','shipped','delivered','returned']) {
      const response = await request('admin-order&mode=test',{cookie:ownerCookie,body:{
        id:requestId,expectedStatus:previous,status,tracking:'204500000001',costs:{garment:60000,printing:22000},
      }});
      assert.equal(response.status,200,await response.text());
      previous=status;
      const info = await (await request('admin-referrals&mode=test',{cookie:ownerCookie})).json();
      assert.equal(info.history.length,status==='returned' ? 2 : status==='delivered' ? 1 : 0);
    }
    const {totals,founder} = await (await request('admin-finance&mode=test&from=2020-01-01&to=2020-12-31',{cookie:ownerCookie})).json();
    assert.equal(totals.profit,0);
    assert.deepEqual(founder,{first:0,second:0});
    const today = new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Kyiv',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const realized = await (await request(`admin-finance&mode=test&from=${today}&to=${today}`,{cookie:ownerCookie})).json();
    assert.equal(realized.totals.revenue,240000);
    assert.equal(realized.totals.refunds,240000);
    assert.equal(realized.totals.referrals,0);
    assert.equal(realized.totals.profit,-82000);
    const exportResult = await request(`admin-finance-csv&mode=test&from=${today}&to=${today}`,{cookie:ownerCookie});
    assert.match(exportResult.headers.get('content-type'),/text\/csv/);
    assert.doesNotMatch(await exportResult.text(),/example.test/);
    assert.equal((await request('admin-staff&mode=live',{cookie:ownerCookie,body:{id:operator.id,role:'operator',active:false}})).status,200);
    assert.equal((await request('admin-orders',{cookie:operatorCookie})).status,401);
    assert.equal((await request('interest',{body:{email:customer.email,product:item,size:'',color:''}})).status,201);
    assert.equal((await request('admin-product&mode=test',{cookie:ownerCookie,body:{id:item}})).status,403);
    Object.assign(env,{
      VERCEL_ENV:'production', SLX_ALLOW_LIVE_ORDERS:'1', SLX_SUPABASE_URL:'https://auth.example.test',
      SLX_SUPABASE_ANON_KEY:'test-key', SLX_EVENT_WEBHOOK:'https://mail.example.test/slx',
      SLX_UNSUBSCRIBE_SECRET:'test-only-secret-for-contract-test',
    });
    assert.equal((await request('admin-product&mode=live',{cookie:ownerCookie,body:{
      id:item,status:'available',price:123000,sizes:['M'],colors:['Чорний'],
    }})).status,200);
    const enable = await request('admin-settings&mode=live',{cookie:ownerCookie,body:{
      sales:true,manufacturer_ready:true,terms_ready:true,founder_share_bps:5000,referral_bps:500,
    }});
    assert.equal(enable.status,200,await enable.text());
    const liveId = newId();
    assert.equal((await request('order',{cookie:buyerCookie,body:{requestId:liveId,items:lines,delivery:{
      name:'T',phone:'+380000000000',city:'Київ',point:'47',
    }}})).status,201);
    const history = (await (await request('account',{cookie:buyerCookie})).json()).orders;
    assert.equal(history.length,1);
    assert.equal(Number(history[0].subtotal),246000);
    assert.equal(history[0].items[0].price,123000);
    for (const [expectedStatus,status] of [['new','availability_check'],['availability_check','awaiting_payment']]) {
      assert.equal((await request('admin-order&mode=live',{cookie:ownerCookie,body:{id:liveId,expectedStatus,status}})).status,200);
    }
    assert.equal((await request('admin-order&mode=live',{cookie:ownerCookie,body:{
      id:liveId,expectedStatus:'awaiting_payment',status:'paid',
    }})).status,409);
    const notice = await request('admin-notify&mode=live',{cookie:ownerCookie,body:{id:item}});
    assert.equal(notice.status,200,await notice.clone().text());
    assert.deepEqual(await notice.json(),{sent:1,failed:0});
    assert.equal(events[0].key,events[0].payload.id);
    const unsubscribe = new URLSearchParams(new URL(events[0].payload.unsubscribe).hash.slice(1)).get('unsubscribe');
    assert.equal((await request('unsubscribe',{body:{token:unsubscribe}})).status,200);
    assert.equal((await db.query('SELECT status FROM slx_interests')).rows[0].status,'unsubscribed');
  } finally { await db.close(); }
});
