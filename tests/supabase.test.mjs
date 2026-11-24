import { test } from 'node:test';
import assert from 'node:assert/strict';
import { supabase, supabaseConfig, supabaseServerHeaders } from '../server/supabase.mjs';

test('Supabase accepts public Next.js env names and keeps server credentials separate', async () => {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL:'https://phase02.example.test/',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',
    SLX_SUPABASE_SECRET_KEY:'sb_secret_test',
    SLX_STORAGE_BUCKET:'slx-products',
  };
  const requests = [];
  const adapter = supabase(env, async (url, init) => {
    requests.push([url.pathname,init.headers]);
    return Response.json({user:{id:'mock'}});
  });
  assert.equal(adapter.authReady,true);
  assert.equal(adapter.storageReady,true);
  await adapter.verify('buyer@example.test','123456');
  await adapter.download('sample.webp');
  assert.deepEqual(requests,[
    ['/auth/v1/verify',{apikey:'sb_publishable_test','Content-Type':'application/json'}],
    ['/storage/v1/object/authenticated/slx-products/sample.webp',{apikey:'sb_secret_test'}],
  ]);
  assert.deepEqual(supabaseServerHeaders('legacy.jwt.key'),{apikey:'legacy.jwt.key',Authorization:'Bearer legacy.jwt.key'});
  assert.equal(supabaseConfig({NEXT_PUBLIC_SUPABASE_URL:'http://phase02.example.test'}).address,undefined);
  assert.equal(supabase({NEXT_PUBLIC_SUPABASE_URL:env.NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}).storageReady,false);
});
