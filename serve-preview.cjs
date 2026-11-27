const http = require('node:http');
const path = require('node:path');
const { existsSync } = require('node:fs');
const { readFile } = require('node:fs/promises');
const { Readable } = require('node:stream');
const config = require('./vercel.json');

if (process.argv.includes('--fangor-preview')) throw new Error('The FANGOR preview is disabled.');
const spreadshopPreview = process.argv.includes('--spreadshop-preview');
const localAdmin = process.argv.includes('--local-admin');
const localEnv = path.join(__dirname,'.env.local');
if (!spreadshopPreview && !localAdmin && existsSync(localEnv)) process.loadEnvFile(localEnv);

const output = path.join(__dirname, spreadshopPreview ? '.spreadshop-preview' : 'dist');
const port = Number(process.env.PORT || (spreadshopPreview ? 4180 : 4173));
const api = Promise.all([import('./server/commerce.mjs'),import('./server/db.mjs'),import('./server/preview-auth.mjs')])
  .then(async ([{commerce},{previewDatabase},{previewAuth,provisionPreviewStaff}])=>{
    if (localAdmin) {
      const {embeddedDatabase}=await import('./server/local-db.mjs');
      const db=await embeddedDatabase(path.join(__dirname,'.slx-local-db'));
      if (process.env.SLX_LOCAL_ADMIN_PASSWORD) {
        await provisionPreviewStaff(db,'owner@slx.test','owner',process.env.SLX_LOCAL_ADMIN_PASSWORD);
        delete process.env.SLX_LOCAL_ADMIN_PASSWORD;
      }
      return commerce({db,auth:previewAuth(db),local:true,env:{VERCEL_ENV:'preview',SLX_PREVIEW_SIGNUP:'1'}});
    }
    const db = spreadshopPreview ? null : previewDatabase();
    return commerce({db,auth:previewAuth(db),local:true,env:{...process.env,VERCEL_ENV:'preview',
      ...(spreadshopPreview ? {SLX_FULFILLMENT:'spreadshop'} : {})}});
  });
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.webp': 'image/webp', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.png': 'image/png', '.avif': 'image/avif',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.svg': 'image/svg+xml',
};
function headersFor(pathname) {
  const matched = config.headers.filter(rule => rule.source === '/(.*)' || rule.source === pathname);
  const headers = Object.fromEntries(matched.flatMap(rule => rule.headers.map(({ key, value }) => [key, value])));
  if (spreadshopPreview && pathname==='/shop.html') {
    headers['Content-Security-Policy']=headers['Content-Security-Policy'].replace(/frame-src [^;]+/, 'frame-src http://localhost:4181');
  }
  return headers;
}

if (spreadshopPreview && process.env.SLX_SPREADSHOP_PREVIEW_CATALOG==='1') {
  require('./spreadshop/frame.cjs').startPreviewFrame(port,4181);
}

http.createServer(async (request, response) => {
  let requestPath;
  try {
    requestPath = new URL(request.url, 'http://127.0.0.1').pathname;
  } catch {
    response.writeHead(400, headersFor('')).end();
    return;
  }
  const filename = requestPath === '/' ? 'index.html' : requestPath.slice(1);
  const headers = headersFor(requestPath);
  if (requestPath==='/admin' || requestPath==='/api/commerce') {
    try {
      const host = request.headers.host;
      if (!/^(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(host ?? '')) {
        response.writeHead(400,headers).end();
        return;
      }
      const init = {method:request.method,headers:request.headers};
      if (!['GET','HEAD'].includes(request.method)) {
        init.body = Readable.toWeb(request);
        init.duplex = 'half';
      }
      const result = await (await api)(new Request(new URL(request.url,`http://${host}`),init));
      response.writeHead(result.status,{...headers,...Object.fromEntries(result.headers)});
      if (result.body) Readable.fromWeb(result.body).pipe(response);
      else response.end();
    } catch {
      response.writeHead(500,headers).end();
    }
    return;
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { ...headers, Allow: 'GET, HEAD' }).end();
    return;
  }
  const type = types[path.extname(filename)];
  if (/^(?:assets\/(?:[a-z0-9][a-z0-9_-]*\/)+)?[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(filename) && type) {
    try {
      const content = await readFile(path.join(output, filename));
      response.writeHead(200, { ...headers, 'Content-Type': type, 'Content-Length': content.length });
      response.end(request.method === 'HEAD' ? undefined : content);
      return;
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'EISDIR') {
        response.writeHead(500, headers).end();
        return;
      }
    }
  }
  const missing = await readFile(path.join(output, '404.html')).catch(() => 'Not found');
  response.writeHead(404, { ...headers, 'Content-Type': types['.html'] });
  response.end(request.method === 'HEAD' ? undefined : missing);
}).listen(port, '127.0.0.1', () => console.log(`SLX preview: http://127.0.0.1:${port}/`));
