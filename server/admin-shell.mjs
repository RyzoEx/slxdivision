export function adminPage(authenticated) {
  return `<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex"><title>SLX · Управління</title><link rel="stylesheet" href="/style.css">
  <link rel="stylesheet" href="/commerce.css"><script src="/commerce-client.js" defer></script><script src="/admin-ui.js" defer></script></head>
  <body class="ops"><header class="ops-header"><a href="/"><img src="/assets/brand/logo.webp" alt="SLX" width="62"></a>
  <p>SLX / Управління</p>${authenticated ? '<button type="button" data-admin-logout>Вийти</button>' : ''}</header>
  ${authenticated ? '<main class="shell ops-main" id="admin-dashboard"><div id="admin-navigation"></div><div class="ops-workspace"><p role="status" id="admin-message"></p><section id="admin-panel"></section></div></main>'
    : '<main class="shell ops-login"><h1>Вхід для команди SLX</h1><form id="admin-login"><label>Email<input name="email" type="email" autocomplete="username" required></label><label>Пароль<input name="password" type="password" autocomplete="current-password" required></label><button class="primary" type="submit">Увійти</button><p role="status"></p></form></main>'}
  </body></html>`;
}
