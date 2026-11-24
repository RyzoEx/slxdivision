const http = require('node:http');
const path = require('node:path');
const { existsSync } = require('node:fs');
const { readFile } = require('node:fs/promises');
const { Readable } = require('node:stream');
const config = require('./vercel.json');

const localEnv = path.join(__dirname,'.env.local');
if (existsSync(localEnv)) process.loadEnvFile(localEnv);

const output = path.join(__dirname, 'dist');
const port = Number(process.env.PORT || 4173);
const api = Promise.all([import('./server/commerce.mjs'),import('./server/db.mjs'),import('./server/supabase.mjs')])
  .then(([{commerce},{openPostgres},{supabase}])=>commerce({
    db:openPostgres(process.env.SLX_PREVIEW_DATABASE_URL || null),auth:supabase(),
    env:{...process.env,VERCEL_ENV:'development'},local:true,
  }));
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.webp': 'image/webp', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.png': 'image/png', '.avif': 'image/avif',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml',
};
function headersFor(pathname) {
  const matched = config.headers.filter(rule => rule.source === '/(.*)' || rule.source === pathname);
  return Object.fromEntries(matched.flatMap(rule => rule.headers.map(({ key, value }) => [key, value])));
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
