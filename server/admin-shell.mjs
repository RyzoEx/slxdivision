export function adminPage(authenticated) {
  return `<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex"><title>SLX Management Console</title><link rel="stylesheet" href="/style.css">
  <link rel="stylesheet" href="/commerce.css"><link rel="stylesheet" href="/admin.css"><script src="/commerce-client.js" defer></script>
  <script src="/admin-components.js" defer></script><script src="/admin-ui.js" defer></script></head>
  <body class="ops slx-console">
  ${authenticated ? '<div id="admin-dashboard"><aside id="admin-navigation" aria-label="Панель навігації"></aside><div class="ops-workspace"><header id="admin-topbar" aria-label="Панель керування"></header><main class="console-main"><p role="status" id="admin-message"></p><section id="admin-panel" aria-busy="true"></section></main></div><dialog id="admin-mobile-nav" aria-label="Навігація консолі"></dialog></div>'
    : '<main class="shell ops-login console-login"><a href="/" class="console-wordmark"><img src="/assets/brand/logo-480.webp" alt="SLX" width="62" height="45"><span>Management Console</span></a><h1>Вхід для команди SLX</h1><form id="admin-login"><label>Email<input name="email" type="email" autocomplete="username" required></label><label>Пароль<input name="password" type="password" autocomplete="current-password" required></label><button class="primary" type="submit">Увійти</button><p role="status"></p></form></main>'}
  </body></html>`;
}
