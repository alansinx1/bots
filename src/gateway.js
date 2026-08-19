import axios from 'axios';
import { SETTINGS } from './config.js';

// Reutiliza un cliente HTTP por cada baseUrl distinta (soporta 1 WAHA compartido
// o varios contenedores WAHA Core, uno por número).
const clients = new Map();

function clientFor(baseUrl) {
  if (!clients.has(baseUrl)) {
    clients.set(
      baseUrl,
      axios.create({
        baseURL: baseUrl,
        timeout: 30000,
        headers: SETTINGS.wahaApiKey ? { 'X-Api-Key': SETTINGS.wahaApiKey } : {},
      })
    );
  }
  return clients.get(baseUrl);
}

// chatId de un número individual en WAHA
export function chatIdOf(number) {
  return `${number}@c.us`;
}

// ── Sesiones ────────────────────────────────────────────────────────────────

export async function startSession(bot) {
  const http = clientFor(bot.baseUrl);
  const config = {
    webhooks: [
      {
        url: `${SETTINGS.publicUrl}/webhook/${bot.id}`,
        events: ['message'],
      },
    ],
  };
  // WAHA moderno: crear + arrancar en una sola llamada.
  try {
    const r = await http.post('/api/sessions', { name: bot.name, start: true, config });
    return r.data;
  } catch (err) {
    const status = err?.response?.status;
    // 422/409 -> ya existe: solo arráncala y actualiza el webhook.
    if (status === 422 || status === 409) {
      await http.put(`/api/sessions/${bot.name}`, { config }).catch(() => {});
      await http.post(`/api/sessions/${bot.name}/start`).catch(() => {});
      return { name: bot.name, reused: true };
    }
    throw err;
  }
}

export async function getSession(bot) {
  const http = clientFor(bot.baseUrl);
  const r = await http.get(`/api/sessions/${bot.name}`);
  return r.data;
}

// Devuelve el QR como Buffer PNG (para escanear y vincular la cuenta).
export async function getQrPng(bot) {
  const http = clientFor(bot.baseUrl);
  const r = await http.get(`/api/${bot.name}/auth/qr`, {
    params: { format: 'image' },
    responseType: 'arraybuffer',
  });
  return Buffer.from(r.data);
}

// ── Mensajería ──────────────────────────────────────────────────────────────

export async function sendText(bot, chatId, text) {
  const http = clientFor(bot.baseUrl);
  const r = await http.post('/api/sendText', { session: bot.name, chatId, text });
  return r.data;
}

export async function startTyping(bot, chatId) {
  const http = clientFor(bot.baseUrl);
  await http.post('/api/startTyping', { session: bot.name, chatId }).catch(() => {});
}

export async function stopTyping(bot, chatId) {
  const http = clientFor(bot.baseUrl);
  await http.post('/api/stopTyping', { session: bot.name, chatId }).catch(() => {});
}
