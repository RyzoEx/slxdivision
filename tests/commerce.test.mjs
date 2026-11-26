import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryDatabase } from './commerce-db.mjs';
import { commerce } from '../server/commerce.mjs';
import { newId, hashToken, createSession } from '../server/security.mjs';
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
  env.SLX_SMTP_USER = 'store@ukr.net';
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
    const manager = {id:newId(),email:'manager@example.test',email_confirmed_at:'2026-01-01'};
    const customer = {id:newId(),email:'buyer@example.test',email_confirmed_at:'2026-01-01'};
    await db.query("INSERT INTO slx_users(id,email,role) VALUES ($1,$2,'owner'),($3,$4,'operator'),($5,$6,'manager')",[owner.id,owner.email,operator.id,operator.email,manager.id,manager.email]);
    const otpRecipients = [];
    const auth = { authReady:true, password:email=>[owner,operator,manager,customer].find(identity=>identity.email===email),
      otp:async email=>{otpRecipients.push(email);}, verify:async()=>customer };
    const env = {};
    const events = [];
    const telegram = [];
    const fetch = commerce({db,auth,env,local:true,fetcher:async (url,init)=>{
      if (url.startsWith('https://api.telegram.org/')) {
        telegram.push(JSON.parse(init.body).text);
        return Response.json({ok:true});
      }
      assert.equal(url,'https://mail.example.test/slx');
      events.push({payload:JSON.parse(init.body),key:init.headers['Idempotency-Key']});
      return new Response(null,{status:204});
    }});
    const origin = 'http://127.0.0.1:4173';
    function request(op, {body,cookie,wrongOrigin=false,authorization} = {}) {
      return fetch(new Request(`${origin}/api/commerce?op=${op}`,{
        method:body ? 'POST' : 'GET',
        headers:{ ...(cookie ? {cookie} : {}), ...(authorization ? {authorization} : {}), ...(body ? {'Content-Type':'application/json',origin:wrongOrigin ? 'http://bad.test' : origin} : {}) },
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
    const managerCookie = cookie(await request('login',{body:{email:manager.email,password:'value'}}));
    assert.equal((await request('admin-finance',{cookie:operatorCookie})).status,403);
    assert.equal((await (await request('account')).json()).authReady,false);
    assert.equal((await request('otp',{body:{email:customer.email}})).status,503);
    assert.equal((await request('verify',{body:{email:customer.email, code:'123456'}})).status,503);
    env.SLX_CUSTOMER_OTP_ENABLED = '1';
    assert.equal((await (await request('account')).json()).authReady,true);
    const staffOtp = await request('otp',{body:{email:owner.email}});
    const buyerOtp = await request('otp',{body:{email:customer.email}});
    assert.equal(staffOtp.status,buyerOtp.status);
    assert.deepEqual(await staffOtp.json(),await buyerOtp.json());
    assert.deepEqual(otpRecipients,[customer.email]);
    const buyerCookie = cookie(await request('verify',{body:{email:customer.email,code:'123456'}}));
    assert.equal((await request('admin-products',{cookie:buyerCookie})).status,403);
    const item = productsSource[0].id;
    const lines = [{id:item,quantity:2,size:'M',color:'Чорний',testPrice:120000}];
    assert.equal((await request('admin-funds',{cookie:managerCookie})).status,200);
    assert.equal((await request('admin-funds',{cookie:operatorCookie})).status,403);
    assert.equal((await request('admin-manufacturers',{cookie:buyerCookie})).status,403);
    assert.equal((await request('admin-settings&mode=live',{cookie:ownerCookie,body:{
      sales:false,reserve_bps:2000,fund_goal:500000,
    }})).status,200);
    const partnerId=newId();
    assert.equal((await request('admin-manufacturer&mode=live',{cookie:managerCookie,body:{
      id:partnerId,name:'Test partner',contact:'Internal only',directShipping:true,packaging:1000,
    }})).status,200);
    const values={retail:123000,advance:60000,garment:30000,printing:10000,fulfillment:5000,other:2000,taxBps:500,feeBps:200,commissionKind:'fixed',commissionValue:3000};
    const pricing=await request('admin-pricing&mode=live',{cookie:managerCookie,body:{id:item,manufacturerId:partnerId,values}});
    assert.equal(pricing.status,200,await pricing.clone().text());
    const quote=await pricing.json();
    assert.equal(quote.profit,64390);
    assert.equal(quote.reserve,12878);
    assert.equal(quote.relocation,51512);
    assert.equal(quote.remainder,63000);
    assert.deepEqual(quote.projections.map(row=>row.units),[10,30,60,90,150,300]);
    assert.equal(quote.projections.at(-1).profit,19317000);
    assert.equal((await request('admin-pricing&mode=live',{cookie:managerCookie,body:{id:item,manufacturerId:partnerId,values:{...values,advance:124000}}})).status,400);
    const catalogPrelaunch=(await (await request('catalog')).json()).products[0];
    assert.equal(catalogPrelaunch.pricing,undefined);
    assert.equal(catalogPrelaunch.manufacturerId,undefined);
    assert.equal(catalogPrelaunch.price,null);
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
    for (const status of ['availability_check','awaiting_payment','paid','sent_to_manufacturer','in_production','preparing_shipment','shipped','delivered','completed','return_requested','returned']) {
      const response = await request('admin-order&mode=test',{cookie:ownerCookie,body:{
        id:requestId,expectedStatus:previous,status,tracking:'204500000001',
        ...(['return_requested','returned'].includes(status) ? {} : {costs:{garment:60000,printing:22000}}),
      }});
      assert.equal(response.status,200,await response.text());
      previous=status;
      const info = await (await request('admin-referrals&mode=test',{cookie:ownerCookie})).json();
      assert.equal(info.history.length,status==='returned' ? 2 : ['completed','return_requested'].includes(status) ? 1 : 0);
      const ledger=await (await request('admin-funds',{cookie:managerCookie})).json();
      assert.equal(ledger.balance,status==='returned' ? -82000 : ['completed','return_requested'].includes(status) ? 146000 : 0);
      if (status==='completed') {
        assert.equal(ledger.reserve,29200);
        assert.equal(ledger.fund,116800);
        const transfer={requestId:newId(),amount:10000,from:'fund',to:'reserve',note:'Test allocation'};
        assert.equal((await request('admin-funds-transfer',{cookie:managerCookie,body:transfer})).status,403);
        assert.equal((await request('admin-funds-transfer',{cookie:ownerCookie,body:transfer})).status,200);
        assert.equal((await request('admin-funds-transfer',{cookie:ownerCookie,body:transfer})).status,200);
        const moved=await (await request('admin-funds',{cookie:ownerCookie})).json();
        assert.equal(moved.reserve,39200);
        assert.equal(moved.history.filter(row=>row.kind==='transfer').length,1);
      }
    }
    const {totals,founder} = await (await request('admin-finance&mode=test&from=2020-01-01&to=2020-12-31',{cookie:ownerCookie})).json();
    assert.equal(totals.profit,0);
    assert.equal(founder,undefined);
    const today = new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Kyiv',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const realized = await (await request(`admin-finance&mode=test&from=${today}&to=${today}`,{cookie:ownerCookie})).json();
    assert.equal(realized.totals.revenue,240000);
    assert.equal(realized.totals.refunds,240000);
    assert.equal(realized.totals.referrals,0);
    assert.equal(realized.totals.profit,-82000);
    assert.equal((await request('admin-referral&mode=test',{cookie:managerCookie,body:{code:'FIXED-TEST',label:'Fixed test',fixed:8000}})).status,200);
    const fixedId=newId();
    assert.equal((await request('admin-test-order&mode=test',{cookie:managerCookie,body:{requestId:fixedId,items:lines,referral:'FIXED-TEST'}})).status,201);
    let fixedPrevious='new';
    for(const status of ['availability_check','awaiting_payment','paid','sent_to_manufacturer','in_production','shipped','delivered','completed']){
      assert.equal((await request('admin-order&mode=test',{cookie:managerCookie,body:{
        id:fixedId,expectedStatus:fixedPrevious,status,tracking:'204500000002',
      }})).status,200);
      fixedPrevious=status;
    }
    const fixedEntries=(await (await request('admin-referrals&mode=test',{cookie:managerCookie})).json()).history.filter(row=>row.order_id===fixedId);
    assert.deepEqual(fixedEntries.map(row=>Number(row.amount)),[8000]);
    const cancelId=newId();
    assert.equal((await request('admin-test-order&mode=test',{cookie:managerCookie,body:{requestId:cancelId,items:lines}})).status,201);
    for(const [expectedStatus,status] of [['new','availability_check'],['availability_check','awaiting_payment'],['awaiting_payment','paid'],['paid','cancelled']]){
      assert.equal((await request('admin-order&mode=test',{cookie:managerCookie,body:{
        id:cancelId,expectedStatus,status,reason:'Test reason',
      }})).status,200);
    }
    const cancelled=(await (await request('admin-orders&mode=test',{cookie:managerCookie})).json()).orders.find(row=>row.id===cancelId);
    assert.equal(cancelled.resolution.refund,120000);
    assert.equal(cancelled.resolution.reason,'Test reason');
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
      SLX_TELEGRAM_BOT_TOKEN:'123456:synthetic-token-only-for-test',SLX_TELEGRAM_CHAT_ID:'-100123456',
    });
    assert.equal((await request('admin-product&mode=live',{cookie:ownerCookie,body:{
      id:item,status:'available',price:123000,sizes:['M'],colors:['Чорний'],
    }})).status,200);
    const launch={
      sales:true,manufacturer_ready:true,terms_ready:true,prices_ready:true,sample_ready:true,seller_ready:true,payment_ready:true,referral_bps:500,
    };
    assert.equal((await request('admin-settings&mode=live',{cookie:ownerCookie,body:{...launch,payment_ready:false}})).status,409);
    const enable = await request('admin-settings&mode=live',{cookie:ownerCookie,body:launch});
    assert.equal(enable.status,200,await enable.text());
    const liveId = newId();
    const delivery={name:'Test Buyer',phone:'+380000000000',city:'Київ',point:'47',contact:'buyer@example.test',payment:'advance_and_on_delivery'};
    assert.equal((await request('order',{cookie:buyerCookie,body:{requestId:liveId,items:lines,delivery}})).status,400);
    assert.equal((await request('order',{cookie:buyerCookie,body:{requestId:liveId,items:lines,delivery:{...delivery,termsAccepted:true}}})).status,201);
    const history = (await (await request('account',{cookie:buyerCookie})).json()).orders;
    assert.equal(history.length,1);
    assert.equal(Number(history[0].subtotal),246000);
    assert.equal(Number(history[0].advance),120000);
    assert.equal(history[0].items[0].manufacturerId,undefined);
    assert.equal(history[0].items[0].price,123000);
    for (const [expectedStatus,status] of [['new','availability_check'],['availability_check','awaiting_payment']]) {
      assert.equal((await request('admin-order&mode=live',{cookie:ownerCookie,body:{id:liveId,expectedStatus,status}})).status,200);
    }
    assert.equal((await request('admin-order&mode=live',{cookie:ownerCookie,body:{
      id:liveId,expectedStatus:'awaiting_payment',status:'paid',
    }})).status,409);
    assert.equal((await request('admin-order&mode=live',{cookie:ownerCookie,body:{
      id:liveId,expectedStatus:'awaiting_payment',status:'cancelled',reason:'Test cancellation',
    }})).status,200);
    assert.equal(telegram.length,4);
    assert.ok(telegram.at(-1).includes('скасовано'));
    assert.ok(telegram.every(message=>!message.includes(delivery.contact)&&!message.includes(delivery.phone)));
    assert.equal((await request('telegram-cron')).status,401);
    env.CRON_SECRET='test-cron-secret-24-chars';
    const authorization='Bearer '+env.CRON_SECRET;
    assert.equal((await request('telegram-cron',{authorization})).status,200);
    assert.equal((await request('telegram-cron',{authorization})).status,200);
    assert.equal(telegram.length,5);
    assert.match(telegram.at(-1),/Завершені замовлення/);
    const fulfilled=newId();
    assert.equal((await request('order',{cookie:buyerCookie,body:{requestId:fulfilled,items:lines,delivery:{...delivery,termsAccepted:true}}})).status,201);
    env.SLX_ALLOW_MANUAL_PREPAYMENT='1';
    let fulfilledPrevious='new';
    for(const status of ['availability_check','awaiting_payment','paid','sent_to_manufacturer','in_production','shipped','delivered','completed']){
      const body={id:fulfilled,expectedStatus:fulfilledPrevious,status,advanceReceived:120000,advanceReference:'Test confirmation',
        balanceReceived:126000,tracking:'204500000003'};
      if (status==='paid') assert.equal((await request('admin-order&mode=live',{cookie:managerCookie,body:{...body,advanceReceived:1}})).status,400);
      assert.equal((await request('admin-order&mode=live',{cookie:managerCookie,body})).status,200);
      fulfilledPrevious=status;
    }
    const stranger={id:newId(),role:'customer'};
    await db.query("INSERT INTO slx_users(id,email,role) VALUES ($1,'other@example.test','customer')",[stranger.id]);
    const strangerCookie=(await createSession(db,stranger,false)).split(';')[0];
    const returnBody={id:fulfilled,expectedStatus:'completed',reason:'Test return request'};
    assert.equal((await request('order-return',{cookie:strangerCookie,body:returnBody})).status,404);
    assert.equal((await request('order-return',{cookie:buyerCookie,body:returnBody})).status,200);
    assert.ok(telegram.some(message=>message.includes('Передоплату перевірено')));
    assert.ok(telegram.at(-1).includes('Запит на повернення'));
    assert.ok(!telegram.at(-1).includes(returnBody.reason));
    assert.equal((await request('admin-order&mode=live',{cookie:managerCookie,body:{
      id:fulfilled,expectedStatus:'return_requested',status:'returned',refund:246000,
    }})).status,200);
    assert.equal((await (await request('admin-funds&mode=live',{cookie:managerCookie})).json()).balance,0);
    const notice = await request('admin-notify&mode=live',{cookie:ownerCookie,body:{id:item}});
    assert.equal(notice.status,200,await notice.clone().text());
    assert.deepEqual(await notice.json(),{sent:1,failed:0});
    assert.equal(events[0].key,events[0].payload.id);
    const unsubscribe = new URLSearchParams(new URL(events[0].payload.unsubscribe).hash.slice(1)).get('unsubscribe');
    assert.equal((await request('unsubscribe',{body:{token:unsubscribe}})).status,200);
    assert.equal((await db.query('SELECT status FROM slx_interests')).rows[0].status,'unsubscribed');
    env.SLX_FULFILLMENT='spreadshop';
    const beforeProviderSwitch=await request('catalog');
    assert.equal((await beforeProviderSwitch.json()).sales,false);
    assert.equal((await request('order',{cookie:buyerCookie,body:{requestId:newId(),items:lines,delivery:{...delivery,termsAccepted:true}}})).status,409);
    const statement={kind:'credit',currency:'GBP',reference:'TEST-CREDIT-1',day:today,amount:1234};
    assert.equal((await request('admin-spreadshop-entry',{cookie:buyerCookie,body:statement})).status,403);
    assert.equal((await request('admin-spreadshop-entry',{cookie:managerCookie,body:statement})).status,200);
    assert.equal((await request('admin-spreadshop-entry',{cookie:managerCookie,body:statement})).status,200);
    assert.equal((await request('admin-spreadshop-entry',{cookie:managerCookie,body:{...statement,amount:999}})).status,409);
    assert.equal((await request('admin-spreadshop-entry',{cookie:ownerCookie,body:{...statement,kind:'adjustment',reference:'TEST-ADJUST',amount:-234}})).status,200);
    assert.equal((await request('admin-spreadshop-entry',{cookie:ownerCookie,body:{...statement,kind:'payout',currency:'EUR',reference:'TEST-PAYOUT',amount:900}})).status,200);
    const spreadReport=await (await request(`admin-finance&mode=test&from=${today}&to=${today}`,{cookie:managerCookie})).json();
    assert.equal(spreadReport.provider,'spreadshop');
    assert.deepEqual(spreadReport.byCurrency,[
      {currency:'GBP',credit:1234,adjustment:-234,payout:0,earned:1000},
      {currency:'EUR',credit:0,adjustment:0,payout:900,earned:0},
    ]);
    assert.equal(spreadReport.entries.length,3);
    const liveProvider=await (await request(`admin-finance&mode=live&from=${today}&to=${today}`,{cookie:managerCookie})).json();
    assert.equal(liveProvider.entries.length,0);
    const spreadCsv=await (await request(`admin-finance-csv&mode=test&from=${today}&to=${today}`,{cookie:managerCookie})).text();
    assert.match(spreadCsv,/credit,GBP,TEST-CREDIT-1,12\.34/);
    delete env.SLX_FULFILLMENT;
    assert.ok((await (await request('catalog')).json()).sales);
  } finally { await db.close(); }
});
