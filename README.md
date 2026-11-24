# SLX

## Локальне прев’ю

Потрібен Node.js 22 або новіший. З кореня проєкту запусти `npm ci`, потім `npm run preview`. Сайт відкриється на `http://127.0.0.1:4173`. Команда `npm run build` збирає статичну частину в `dist/`. Налаштування API, Supabase і адмінпанелі описані в [Phase 02](PHASE-02.md).

## Vercel

1. У Vercel обери **Add New → Project** та імпортуй [RyzoEx/slxdivision](https://github.com/RyzoEx/slxdivision). Перевір, що production-гілка — `main`. Команду збірки, каталог публікації та заголовки проєкт бере з `vercel.json`.
2. У **Settings → Deployment Protection** обери **Vercel Authentication**. **Standard Protection** залишає основний production-домен відкритим і захищає адреси прев’ю. **All Deployments** закриває також production-домен, якщо показ замовникам має бути приватним.
3. Після підключення Git пуш у `main` збирає публічну версію, а пуш в іншу гілку — прев’ю. Збірка використовує production-домен Vercel автоматично. За потреби вкажи свій HTTPS-домен у `SLX_SITE_URL` тільки для **Production**. Виробнича збірка створює канонічні URL і карту сайту. Прев’ю позначене `noindex`. [Деплой із GitHub](https://vercel.com/docs/git/vercel-for-github)

Заголовки CSP, HSTS і заборона вбудовування у фрейми задані у проєкті. Обмеження доступу задається в акаунті Vercel.

## Як додати колекцію або річ через Git

1. Поклади свої фото в `assets/products/` або `assets/collections/`. Використовуй нижній регістр у назвах, наприклад `assets/products/drop-001/hoodie-front.webp`.
2. Додай запис у відповідний масив у `content/catalog.json`. Нижче показано формат записів, а шляхи й тексти потрібно замінити власними.
3. Запусти `npm run check` і `npm run preview`. Відкрий локальний сайт і перевір фото та сторінку.
4. Додай до коміту і JSON, і потрібні фото, потім зроби пуш. Збірка створить каталог, сторінки речей і колекцій та оновить пошук. Якщо дані помилкові або фото відсутнє, збірка покаже точне поле з помилкою.

```json
{
  "collections": [
    {
      "id": "drop-001",
      "name": "Назва колекції",
      "description": "Опис колекції",
      "cover": { "src": "assets/collections/drop-001/cover.webp", "alt": "Опис кадру" }
    }
  ],
  "products": [
    {
      "id": "hoodie-001",
      "collection": "drop-001",
      "name": "Назва худі",
      "category": "Худі",
      "description": "Опис речі",
      "status": "coming-soon",
      "sizes": ["S", "M", "L"],
      "colors": ["Чорний"],
      "photos": [
        { "src": "assets/products/drop-001/hoodie-front.webp", "alt": "Худі спереду" },
        { "src": "assets/products/drop-001/hoodie-back.webp", "alt": "Худі ззаду" }
      ],
      "specifications": { "Крій": "Опис крою" }
    }
  ]
}
```

- `id` залишається незмінним після публікації. На його основі будується адреса, наприклад `product-hoodie-001.html`.
- Для чернетки задай `"published": false`. Чернетка та її окремі фото не потраплять до публічної збірки.
- Для Lookbook додай до колекції масив `"lookbook"` із записами `{ "src": "...", "alt": "..." }`. Щоб перенести колекцію з магазину в Archive, задай їй `"archived": true`.
- `coming-soon` показує форму сповіщення, `available` — доступність після відкриття продажів, `sold-out` — статус розпродажу. `price` у JSON — підтверджена ціна в цілих гривнях. Керування ціною й варіантами доступне в адмінпанелі.

## Контакти та сповіщення

- Для контактів у **Production** вкажи `SLX_CONTACT_EMAIL`, `SLX_INSTAGRAM_URL`, `SLX_TIKTOK_URL` та `SLX_TELEGRAM_URL`. Після зміни змінних потрібен новий деплой.
- Щоб приймати заявки, підключи в **Production** `SLX_SUBSCRIBE_WEBHOOK` до HTTPS-адреси свого сервісу збору підписок. Функція Vercel передає JSON з полями `email`, `product`, `size` і `color`. Якщо сервіс потребує Bearer-токен, задай `SLX_SUBSCRIBE_TOKEN` у Vercel. Підтвердження підписки та надсилання листів налаштовуються в сервісі.
- Phase 02 зберігає заявки в PostgreSQL. Якщо база недоступна, можна використовувати налаштований попередній вебхук. У браузері зберігаються лише локальний кошик і обране.

## Зображення

- `assets/brand/logo.webp` — оригінальна емблема SLX. Банер використовує цю емблему та фон зі `style.css`.
- `assets/fonts/` — шрифти з ліцензіями.

Документація Vercel. [Налаштування проєкту](https://vercel.com/docs/project-configuration) · [Захист розгортань](https://vercel.com/docs/deployment-protection)
