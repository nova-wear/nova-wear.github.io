# Worker замовлень Nova

`order-worker.js` приймає замовлення з сайту й пересилає їх ботом менеджеру в Telegram.
Також (необовʼязково) переправляє повідомлення покупців боту менеджеру; відповідь Reply-ем іде покупцю.

## Налаштування (Cloudflare → Compute → Workers & Pages)

1. **Create** → **Start with Hello World** → назва `nova-orders` → **Deploy**.
2. **Edit code** → замінити весь код вмістом `order-worker.js` → **Deploy**.
3. **Settings → Variables and Secrets → Add**:
   - `BOT_TOKEN` (Secret) — токен бота від @BotFather;
   - `CHAT_ID` (Secret) — ваш chat id (крок 4), лише число;
   - `WEBHOOK_SECRET` (Secret) — будь-який довгий випадковий рядок;
   - `ALLOWED_ORIGIN` (Text) — адреса сайту, напр. `https://<організація>.github.io` (без `/` у кінці).
4. **CHAT_ID**: напишіть боту `/start`, відкрийте в браузері
   `https://api.telegram.org/bot<ТОКЕН>/getUpdates` і візьміть число з `"chat":{"id":…}`.
5. На сайті в `app.js` → `CONFIG.orderEndpoint` вписати `https://nova-orders.<ваш-субдомен>.workers.dev/order`.

Токен ніколи не кладемо в код сайту чи в репозиторій — лише в секрети Worker'а.
