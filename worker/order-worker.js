/* Cloudflare Worker «На подарунок»: приймає замовлення з сайту й пересилає їх ботом у Telegram.
   Також переправляє повідомлення покупців боту менеджеру й відповіді менеджера назад.

   Секрети (Cloudflare → Worker → Settings → Variables and Secrets, тип «Secret»):
     BOT_TOKEN — токен від @BotFather. Ніколи не кладіть його в код сайту чи в репозиторій.
     CHAT_ID   — ваш chat id (див. worker/README.md).
   Змінна (тип «Text», необовʼязково):
     ALLOWED_ORIGIN — https://napodarunok.github.io

   Маршрути:
     POST /order    — замовлення з сайту (JSON { text, name, phone, website })
     POST /telegram — вебхук бота (повідомлення покупців ↔ менеджер)
*/

const MAX_TEXT = 4000;           // ліміт Telegram на одне повідомлення — 4096
const RATE_WINDOW_MS = 60_000;   // не більше RATE_MAX замовлень з однієї IP за хвилину
const RATE_MAX = 3;
const hits = new Map();          // памʼять одного екземпляра Worker'а — для простого захисту від спаму вистачає

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = env.ALLOWED_ORIGIN || 'https://napodarunok.github.io';
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    };

    if (url.pathname === '/order') {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
      if (request.method !== 'POST') return json({ ok: false, error: 'method' }, 405, cors);
      if (request.headers.get('Origin') !== origin) return json({ ok: false, error: 'origin' }, 403, cors);
      return handleOrder(request, env, cors);
    }

    if (url.pathname === '/telegram' && request.method === 'POST') {
      // Telegram надсилає цей заголовок, якщо при setWebhook вказати secret_token = WEBHOOK_SECRET
      if (env.WEBHOOK_SECRET && request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.WEBHOOK_SECRET) {
        return new Response('forbidden', { status: 403 });
      }
      const update = await request.json().catch(() => null);
      if (update) await handleUpdate(update, env);
      return new Response('ok');
    }

    return new Response('На подарунок — order worker', { status: 200 });
  }
};

async function handleOrder(request, env, cors) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (list.length >= RATE_MAX) return json({ ok: false, error: 'rate' }, 429, cors);
  list.push(now);
  hits.set(ip, list);

  const body = await request.json().catch(() => null);
  if (!body || typeof body.text !== 'string') return json({ ok: false, error: 'bad' }, 400, cors);
  if (body.website) return json({ ok: true }, 200, cors);           // honeypot: поле, яке бачать лише боти
  const text = body.text.trim().slice(0, MAX_TEXT);
  const phone = String(body.phone || '').replace(/[^\d+]/g, '');
  if (text.length < 20 || phone.replace(/\D/g, '').length < 10) return json({ ok: false, error: 'bad' }, 400, cors);

  const sent = await tg(env, 'sendMessage', { chat_id: env.CHAT_ID, text, disable_web_page_preview: true });
  if (!sent.ok) return json({ ok: false, error: 'telegram' }, 502, cors);
  return json({ ok: true }, 200, cors);
}

/* Покупець пише боту → менеджер отримує «💬 Ім'я (id …): текст».
   Менеджер відповідає на це повідомлення (Reply) → відповідь іде покупцю. */
async function handleUpdate(update, env) {
  const m = update.message;
  if (!m || !m.chat) return;
  const fromManager = String(m.chat.id) === String(env.CHAT_ID);

  if (fromManager) {
    const replied = m.reply_to_message && (m.reply_to_message.text || '');
    const id = replied && (replied.match(/\(id (\d+)\)/) || [])[1];
    if (!id) {
      if (m.text && m.text.startsWith('/start')) await tg(env, 'sendMessage', { chat_id: m.chat.id, text: 'Сюди приходитимуть замовлення з сайту й повідомлення покупців. Щоб відповісти покупцю — зробіть Reply на його повідомлення.' });
      return;
    }
    if (m.text) await tg(env, 'sendMessage', { chat_id: id, text: m.text });
    else await tg(env, 'copyMessage', { chat_id: id, from_chat_id: m.chat.id, message_id: m.message_id });
    return;
  }

  if (m.text && m.text.startsWith('/start')) {
    await tg(env, 'sendMessage', { chat_id: m.chat.id, text: 'Вітаємо в «На подарунок»! Напишіть ваше питання або номер замовлення — менеджер відповість тут.' });
    return;
  }
  const who = [m.from && m.from.first_name, m.from && m.from.last_name].filter(Boolean).join(' ') || 'Покупець';
  const handle = m.from && m.from.username ? ' @' + m.from.username : '';
  await tg(env, 'sendMessage', { chat_id: env.CHAT_ID, text: '💬 ' + who + handle + ' (id ' + m.chat.id + '):\n' + (m.text || m.caption || '[вкладення нижче]') });
  if (!m.text) await tg(env, 'copyMessage', { chat_id: env.CHAT_ID, from_chat_id: m.chat.id, message_id: m.message_id });
}

async function tg(env, method, payload) {
  const r = await fetch('https://api.telegram.org/bot' + env.BOT_TOKEN + '/' + method, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return r.json().catch(() => ({ ok: false }));
}

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), { status, headers: Object.assign({ 'Content-Type': 'application/json' }, headers) });
}
