# SLX Division · Phase 02

Вітрина збирається з Git-каталогу в `dist/`. Vercel Functions обслуговують `/api/commerce` та захищену `/admin`. У PostgreSQL зберігаються ролі, сесії, замовлення, фінанси, налаштування й заявки. Каталог доповнюється операційними даними з бази, а нові сторінки, описи й власні фото можна далі додавати через коміти. Код обробляє значення цін у копійках.

## Supabase

1. Відкрий проєкт Supabase. Для Vercel скопіюй зі сторінки **Connect** рядок підключення через **Transaction pooler** (порт 6543) і додай `sslmode=verify-full` до його параметрів. Встанови `SLX_DATABASE_URL` у потрібному середовищі Vercel. У **Database Settings → SSL Configuration** завантаж кореневий сертифікат Supabase у форматі PEM. Закодуй вміст файла командою `node -e "console.log(require('node:fs').readFileSync(process.argv[1]).toString('base64'))" prod-ca-2021.crt` і збережи результат у `SLX_DATABASE_CA_BASE64`. Із цією змінною застосунок перевіряє і сертифікат, і ім’я хоста пулера. Для ізольованого Preview бажано використовувати окремий проєкт Supabase. [Підключення PostgreSQL](https://supabase.com/docs/guides/database/connecting-to-postgres) · [Перевірка TLS](https://supabase.com/docs/guides/platform/ssl-enforcement)
2. Задай `NEXT_PUBLIC_SUPABASE_URL` та `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Сервер також підтримує `SLX_SUPABASE_URL` і `SLX_SUPABASE_PUBLISHABLE_KEY`. Пароль бази, `SLX_SUPABASE_SECRET_KEY` та секрети вебхуків задавай лише на сервері. Старі `SLX_SUPABASE_ANON_KEY` і `SLX_SUPABASE_SERVICE_ROLE_KEY` підтримуються для сумісності. [Ключі Supabase](https://supabase.com/docs/guides/getting-started/api-keys)
3. У Supabase Auth увімкни провайдера Email та налаштуй OTP. У шаблонах Magic Link і підтвердження нового акаунта додай `{{ .Token }}`. Для зовнішніх адрес налаштуй власний SMTP. Після перевірки доставки коду та входу встанови `SLX_CUSTOMER_OTP_ENABLED=1` у відповідному середовищі Vercel. Доступ команди через `/admin` працює незалежно від цієї змінної. [OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless) · [SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
4. За потреби створи приватний bucket `slx-products` і вкажи цю назву в `SLX_STORAGE_BUCKET`. Завантаження працює у вкладці товарів і потребує серверного секретного ключа. У публічному API доступні зображення, які прив’язані до активного товару. Ліміт файлу в застосунку — 1,4 МБ. [Бакети Supabase](https://supabase.com/docs/guides/storage/buckets/fundamentals)

## Міграція та окремі акаунти команди

Поклади змінні обраного проєкту в локальний ігнорований Git файл `.env.local`. Для міграції та зв’язування акаунтів CLI читає `SLX_DATABASE_URL`. Локальне прев’ю використовує тільки `SLX_PREVIEW_DATABASE_URL`, тому не отримує доступ до production-бази випадково. Для першого налаштування preview обидві змінні в локальному файлі можуть вказувати на одну preview-базу.

```powershell
npm ci
node --env-file=.env.local server/setup.mjs migrate
```

У **Supabase Authentication → Users** створи й підтвердь два окремі акаунти з власними email та паролями. Підстав їхні UID та email в команди. Паролі задаються в Supabase.

```powershell
node --env-file=.env.local server/setup.mjs staff <first-user-uid> <email> owner
node --env-file=.env.local server/setup.mjs staff <second-user-uid> <email> manager
```

Власник може змінювати доступ менеджера чи оператора в налаштуваннях. Менеджер керує товарами, клієнтами, фінансами та SLX Circle. Оператор має доступ до замовлень і виробництва. Для локального запуску використовуй `npm run preview`. Кабінет покупця доступний за `/account.html`, адмінпанель — за `/admin`.

## Передзапуск, пошта і продажі

- За замовчуванням усі шість речей Heavy DAngels мають статус «Скоро». Кошик діє як список покупок. У тестовому режимі команда може пройти сценарій замовлення з власними тестовими сумами. Такі записи мають окремий режим і відсутні в історії покупця та робочих звітах.
- Заявки на сповіщення зберігаються в PostgreSQL. Для листів про наявність задай `SLX_UNSUBSCRIBE_SECRET` (випадковий секрет від 32 символів). Для UKR.NET, META Пошти або Gmail задай адресу скриньки бренду в `SLX_SMTP_USER` і пароль для SMTP в `SLX_SMTP_PASSWORD`. Для UKR.NET і Gmail використовуй пароль застосунку. У Supabase Auth налаштуй ту саму скриньку як відправника через `smtp.ukr.net`, `smtp.meta.ua` або `smtp.gmail.com`, порт `465`. Для іншого сервісу задай HTTPS-адресу в `SLX_EVENT_WEBHOOK` та, за потреби, токен у `SLX_EVENT_TOKEN`. Вебхук має пріоритет над SMTP і отримує подію `product.available`, ідентифікатор для дедуплікації, email, товар, варіант і посилання для відписки. Команда запускає надсилання з товару після відкриття продажів. Загальні новини через цей модуль автоматично не надсилаються. [Паролі застосунків UKR.NET](https://wiki.ukr.net/ManageIMAPAccess) · [Паролі застосунків Google](https://support.google.com/accounts/answer/185833)
- Для робочих **неоплачених** запитів потрібен `SLX_ALLOW_LIVE_ORDERS=1` лише у Production, доступні товари зі справжніми цінами, розмірами та кольорами, підтверджені виробництво й умови та окреме ввімкнення в адмінпанелі. Платіжний шлюз відсутній. Реальне замовлення не можна позначити як оплачене через цей інтерфейс. Передача виробнику і ТТН ведуться вручну.
- SLX Circle фіксує ставку на момент замовлення. Ставка за замовчуванням — 5%. Нарахування відбувається після доставки оплаченого замовлення і сторнується при фінальному поверненні або скасуванні. Звіти розділяють тестовий і робочий режими та використовують час Києва. Фінансові показники є внутрішнім розрахунком за введеними витратами.

## Перевірка

`npm run check`, `npm run build` і `npm test`. Тести запускають PostgreSQL у пам’яті та підставляють відповіді Auth і вебхука тільки в тестовому процесі. Для реального ввімкнення спочатку перевір вхід, збереження заявки, приватність Storage і ізоляцію звітів у захищеному Preview. Production гілка проєкту — `main`. [Змінні середовища Vercel](https://vercel.com/docs/environment-variables)
