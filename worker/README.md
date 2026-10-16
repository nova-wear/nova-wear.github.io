# Worker замовлень «На подарунок»

`order-worker.js` приймає замовлення з сайту й пересилає їх ботом @napodarunok_bot менеджеру в Telegram.
Також переправляє повідомлення покупців боту менеджеру; відповідь Reply-ем іде покупцю.

## Налаштування (Cloudflare → Compute → Workers & Pages)

1. **Create** → **Start with Hello World** → назва `napodarunok-orders` → **Deploy**.
2. **Edit code** → замінити весь код вмістом `order-worker.js` → **Deploy**.
3. **Settings → Variables and Secrets → Add**:
   - `BOT_TOKEN` (Secret) — токен від @BotFather;
   - `CHAT_ID` (Secret) — ваш chat id (крок 4);
   - `WEBHOOK_SECRET` (Secret) — будь-який довгий випадковий рядок;
   - `ALLOWED_ORIGIN` (Text) — `https://napodarunok.github.io`.
4. **CHAT_ID**: напишіть боту `/start`, відкрийте в браузері
   `https://api.telegram.org/bot<ТОКЕН>/getUpdates` і візьміть число з `"chat":{"id":…}`.
5. **Вебхук** (щоб працювали повідомлення покупців): відкрийте в браузері
   `https://api.telegram.org/bot<ТОКЕН>/setWebhook?url=https://napodarunok-orders.stvory.workers.dev/telegram&secret_token=<WEBHOOK_SECRET>`
6. На сайті в `app.js` → `CONFIG.orderEndpoint` вписати `https://napodarunok-orders.stvory.workers.dev/order`.

Токен ніколи не кладемо в код сайту чи в репозиторій — лише в секрети Worker'а.
