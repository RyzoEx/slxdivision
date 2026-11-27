const {
  copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync,
  realpathSync, rmSync, writeFileSync,
} = require('node:fs');
const path = require('node:path');
const { header, footer, escape } = require('./site-shell.cjs');
const editorial = require('./editorial-pages.cjs');
const { loadInventory } = require('./inventory.cjs');
const { inventoryPages } = require('./inventory-pages.cjs');
const { shop, usesSpreadshop, launchApproved } = require('./spreadshop/config.cjs');
const homeDrop = require('./home-drop.cjs');
const storefrontSettings = require('./content/storefront.json');
const { transformSync } = require('esbuild');
const separateStyles = ['style.css','commerce.css','drop.css'];

const root = realpathSync(__dirname);
let catalog;
try { catalog = loadInventory(root); }
catch (error) {
  console.error(error.message);
  process.exit(1);
}
const localPages = process.argv.includes('--local-pages');
const spreadshopPreview = process.argv.includes('--spreadshop-preview');
const localAdmin = process.argv.includes('--local-admin');
if (process.argv.includes('--fangor-preview')) throw new Error('The FANGOR preview is disabled.');
if (spreadshopPreview && (localPages || process.env.VERCEL)) throw new Error('Spreadshop preview is local only.');
const folder = spreadshopPreview ? '.spreadshop-preview' : 'dist';
const output = localPages ? root : path.join(root,folder);
const storefrontStyles = localPages
  ? separateStyles.map(file=>`<link rel="stylesheet" href="/${file}">`).join('')
  : '<link rel="stylesheet" href="/site.css">';
const vercelEnvironment = process.env.VERCEL_ENV;
const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const preview = localPages || spreadshopPreview || localAdmin || (vercelEnvironment && vercelEnvironment !== 'production');
const requestedOrigin = !preview && (process.env.SLX_SITE_URL
  || (vercelEnvironment === 'production' && vercelHost ? `https://${vercelHost}` : ''));
const address = requestedOrigin ? new URL(requestedOrigin) : null;
if (address && (address.protocol !== 'https:' || address.username || address.password
  || address.pathname !== '/' || address.search || address.hash)) {
  throw new Error('SLX_SITE_URL must be an HTTPS origin without a path, credentials, query, or fragment.');
}
const origin = address?.origin ?? '';
const spreadshopEnabled = spreadshopPreview || usesSpreadshop(process.env)
  || (vercelEnvironment === 'production' && origin === 'https://slxdivision.vercel.app')
  || (vercelEnvironment === 'preview' && ['codex/spreadshop','codex/backend-infrastructure'].includes(process.env.VERCEL_GIT_COMMIT_REF));
const approved = vercelEnvironment==='production' && !preview && launchApproved(process.env);
const spreadshop = spreadshopEnabled ? {
  preview:spreadshopPreview,
  frame:approved ? `${shop.frameOrigin}/`
    : spreadshopPreview && process.env.SLX_SPREADSHOP_PREVIEW_CATALOG==='1' ? 'http://localhost:4181/' : null,
} : null;
const fulfillmentMeta = spreadshop ? '<meta name="slx-fulfillment" content="spreadshop">' : '';
const previewSignupMeta = (localAdmin || vercelEnvironment==='preview') && require('./signup-config.cjs') ? '<meta name="slx-test-signup">' : '';
const writePage = (name, body) => writeFileSync(path.join(output, name), body);
const email = process.env.SLX_CONTACT_EMAIL ?? '';
const settings = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '',
  social: storefrontSettings.social,
};
const teaserPath = storefrontSettings.teaser;
if (teaserPath && !/^assets\/brand\/[a-z0-9][a-z0-9_-]*\.(mp4|webm)$/.test(teaserPath)) {
  throw new Error('Use an MP4 or WebM path inside assets/brand for the teaser.');
}
const teaser = teaserPath && existsSync(path.join(root,teaserPath)) ? teaserPath : '';
const posterPath = storefrontSettings.teaserPoster;
if (posterPath && !/^assets\/brand\/[a-z0-9][a-z0-9_-]*\.(webp|png|jpg)$/.test(posterPath)) {
  throw new Error('Use a WebP, PNG or JPG path inside assets/brand for the teaser poster.');
}
const teaserPoster = posterPath && existsSync(path.join(root,posterPath)) ? posterPath : '';
const analyticsLive = vercelEnvironment === 'production' && origin === 'https://slxdivision.vercel.app'
  && process.env.SLX_GA_STREAM_READY === '1';
const analyticsDebug = !process.env.VERCEL && !vercelEnvironment && process.env.SLX_GA_DEBUG === '1';
const analyticsMode = analyticsLive ? 'live' : analyticsDebug ? 'debug' : '';
const analyticsScript = '<script src="/analytics.js" defer></script>';
const campaignIds = (process.env.SLX_GA_CAMPAIGN_IDS ?? '').split(',').map(value=>value.trim());
const analyticsTag = file => analyticsMode ? `<meta name="slx-analytics" content="${analyticsMode}" data-path="/${escape(file)}">
<meta name="slx-campaign-ids" content="${campaignIds.filter(value=>/^[a-z0-9][a-z0-9_-]{0,47}$/.test(value)).join(',')}">` : '';

if (!localPages) {
  if (existsSync(output)) {
    const info = lstatSync(output);
    if (!info.isDirectory() || info.isSymbolicLink() || realpathSync(output) !== output) {
      throw new Error('Expected dist to be a regular directory inside the project.');
    }
    rmSync(output, { recursive: true });
  }
  mkdirSync(output);
  for (const file of ['style.css', 'commerce.css', 'drop.css', 'admin.css', 'artwork.js', 'commerce-client.js', 'account.js', 'admin-components.js', 'admin-ui.js', 'intro-start.js', 'metrics.js', 'experience.js', 'metrics.html', '404.html', 'storefront.js', 'catalog-ui.js', 'analytics.js']) {
    const source = path.join(root,file);
    const loader = path.extname(file).slice(1);
    if (loader === 'html') copyFileSync(source,path.join(output,file));
    else writePage(file,transformSync(readFileSync(source,'utf8'),{loader,minify:true,legalComments:'none'}).code);
  }
  mkdirSync(path.join(output,'assets','admin'),{recursive:true});
  for (const file of ['lucide.svg','LICENSE-Lucide.txt']) copyFileSync(path.join(root,'assets','admin',file),path.join(output,'assets','admin',file));
  const combined = separateStyles.map(file=>readFileSync(path.join(root,file),'utf8')).join('\n');
  writePage('site.css',transformSync(combined,{loader:'css',minify:true,legalComments:'none'}).code);
  if (spreadshop?.frame) copyFileSync(path.join(root,'spreadshop','bridge.js'),path.join(output,'spreadshop-bridge.js'));
  if (origin) {
    for (const file of readdirSync(root, { withFileTypes:true })) {
      if (!file.isFile() || !/^google[0-9a-f]+\.html$/.test(file.name)) continue;
      const source = path.join(root,file.name);
      if (readFileSync(source,'utf8').trim() !== `google-site-verification: ${file.name}`) {
        throw new Error(`Unexpected Google verification file content: ${file.name}`);
      }
      copyFileSync(source,path.join(output,file.name));
    }
  }
  for (const group of ['brand', 'fonts']) {
    const source = path.join(root, 'assets', group);
    const destination = path.join(output, 'assets', group);
    if (realpathSync(source) !== source) throw new Error(`Unexpected asset directory: ${group}`);
    mkdirSync(destination, { recursive: true });
    for (const asset of readdirSync(source, { withFileTypes: true })) {
      if (asset.isFile() && /\.(webp|jpg|png|woff2|txt)$/.test(asset.name)) {
        copyFileSync(path.join(source, asset.name), path.join(destination, asset.name));
      }
    }
  }
  for (const asset of catalog.images) {
    const destination = path.join(output, asset);
    mkdirSync(path.dirname(destination), { recursive: true });
    copyFileSync(path.join(root, asset), destination);
    const smaller=asset.replace(/-preview\.webp$/,'-web.webp');
    if (smaller!==asset && existsSync(path.join(root,smaller))) copyFileSync(path.join(root,smaller),path.join(output,smaller));
  }
  if (teaser) copyFileSync(path.join(root,teaser),path.join(output,teaser));
}
const url = file => origin ? `${origin}/${file}` : file;
const brandImage = { src:'assets/brand/logo.webp', alt:'SLX orbital emblem' };
const jsonLd = data => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g,'\\u003c')}</script>`;
const shareImage = (image = brandImage) => `<meta property="og:image" content="${escape(url(image.src))}">
<meta property="og:image:alt" content="${escape(image.alt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${escape(url(image.src))}">
<meta name="twitter:image:alt" content="${escape(image.alt)}">`;
const searchIndex = catalog.activeProducts.map(({ id, name, category, status, sizes, colors, photos }) =>
  ({ id, name, category, status:status==='available' ? 'coming-soon' : status, sizes:sizes ?? [], colors:colors ?? [], src:photos[0]?.src ?? '', price:null }));
writePage('catalog-index.js', `window.SLX_CATALOG = ${JSON.stringify(searchIndex)};\n`);

const homeCanonical = origin
  ? `  <link rel="canonical" href="${url('')}">
  <meta property="og:url" content="${url('')}">
  ${jsonLd({ '@context':'https://schema.org', '@graph':[
    { '@type':'WebSite', name:'SLX Division', alternateName:'SLX', url:url('') },
    { '@type':'Organization', name:'SLX Division', alternateName:'SLX', url:url(''),
      logo:url(brandImage.src), sameAs:Object.values(settings.social).filter(value=>/^https:\/\//.test(value)),
      ...(settings.email ? { email:settings.email } : {}) },
  ] })}\n`
  : '  <meta name="robots" content="noindex">\n';
const home = readFileSync(path.join(root, 'index.html'), 'utf8')
  .replace(/  <link rel="stylesheet" href="style.css">\s*<link rel="stylesheet" href="commerce.css">\s*<link rel="stylesheet" href="drop.css">/,
    storefrontStyles)
  .replace(/  <!-- SEO origin start -->[\s\S]*?  <!-- SEO origin end -->/, () =>
    `  <!-- SEO origin start -->\n${homeCanonical}  ${shareImage()}\n${fulfillmentMeta}\n${previewSignupMeta}\n${analyticsTag('')}\n  <!-- SEO origin end -->`)
  .replace('</head>', `${analyticsScript}\n</head>`)
  .replace(/<!-- SITE HEADER START -->[\s\S]*?<!-- SITE HEADER END -->/, () => `<!-- SITE HEADER START -->\n${header(true)}\n<!-- SITE HEADER END -->`)
  .replace(/<!-- SITE FOOTER START -->[\s\S]*?<!-- SITE FOOTER END -->/, () => `<!-- SITE FOOTER START -->\n${footer(settings)}\n<!-- SITE FOOTER END -->`)
  .replace(/<main>[\s\S]*?<\/main>/, () => `<main>\n${homeDrop({catalog,settings,teaser,teaserPoster})}\n</main>`);
writePage('index.html', home);

const pages = { ...editorial({ settings, catalog, spreadshop }), ...inventoryPages(catalog,{spreadshop}) };

for (const [file, page] of Object.entries(pages)) {
  const indexable = origin && !page.noindex;
  const title = `${page.seoTitle ?? page.title} | SLX Division`;
  const breadcrumbs = page.trail && jsonLd({
    '@context':'https://schema.org', '@type':'BreadcrumbList',
    itemListElement:[['Home',''], ...page.trail, [page.title,file]].map(([name, target], index) => ({
      '@type':'ListItem', position:index+1, name, item:url(target),
    })),
  });
  writePage(file, `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title><meta name="description" content="${escape(page.desc)}">
${indexable ? `<link rel="canonical" href="${url(file)}">\n<meta property="og:url" content="${url(file)}">` : '<meta name="robots" content="noindex">'}
${fulfillmentMeta}
${previewSignupMeta}
${page.analytics === false ? '' : analyticsTag(file)}
<meta property="og:type" content="website">
<meta property="og:locale" content="en_GB">
<meta property="og:site_name" content="SLX Division">
<meta property="og:title" content="${escape(title)}">
<meta property="og:description" content="${escape(page.desc)}">
${shareImage(page.image)}
${indexable && breadcrumbs ? breadcrumbs : ''}
${storefrontStyles}<link rel="icon" href="/assets/brand/favicon.png" sizes="96x96" type="image/png">
${analyticsScript}
<script src="catalog-index.js" defer></script><script src="commerce-client.js" defer></script><script src="metrics.js" defer></script><script src="storefront.js" defer></script><script src="catalog-ui.js" defer></script>
${page.script ? `<script src="${page.script}" defer></script>` : ''}
${file==='shop.html' && spreadshop?.frame ? '<script src="/spreadshop-bridge.js" defer></script>' : ''}
</head>
<body id="top" class="editorial-page">
${header()}
<main><div class="shell page-title"><h1>${escape(page.title)}</h1></div>${page.content}</main>
${footer(settings)}
</body></html>`);
}


if (origin) {
  const files = ['', ...Object.keys(pages).filter(file => !pages[file].noindex)];
  const entries = files.map(file => {
    const images = new Set(pages[file]?.searchImages?.map(image => image.src));
    const imageTags = [...images].map(src => `<image:image><image:loc>${escape(url(src))}</image:loc></image:image>`).join('');
    return `  <url><loc>${escape(url(file))}</loc>${imageTags}</url>`;
  });
  writePage('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${entries.join('\n')}\n</urlset>\n`);
  writePage('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${url('sitemap.xml')}\n`);
}
