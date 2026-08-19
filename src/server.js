import 'dotenv/config';
import express from 'express';
import { ACTIVE_BOTS, BOT_BY_ID, BOT_BY_NUMBER, SETTINGS } from './config.js';
import {
  sendText,
  startTyping,
  stopTyping,
  startSession,
  getSession,
  logoutSession,
  getQrPng,
  chatIdOf,
} from './gateway.js';
import { generateReply } from './ai.js';
import { getConversation, pushMessage, snapshot } from './store.js';

const app = express();
app.use(express.json({ limit: '2mb' }));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (min, max) => Math.floor(min + Math.random() * (max - min));

// Marca los bots que en algún momento sí se vincularon (para auto-reconectar
// solo esos, sin tocar los que apenas esperan su primer QR).
const everLinked = new Set();

// Mantenimiento periódico: (1) detecta el número real de cada cuenta vinculada,
// (2) reconecta sola cualquier cuenta ya vinculada que se haya caído.
async function maintainSessions() {
  for (const bot of ACTIVE_BOTS) {
    try {
      const s = await getSession(bot);
      const status = s?.status;
      const meId = s?.me?.id; // ej: "5217772159435@c.us"

      if (status === 'WORKING') {
        everLinked.add(bot.id);
        if (meId) {
          const num = meId.split('@')[0].replace(/\D/g, '');
          if (num) {
            bot.number = num;
            BOT_BY_NUMBER.set(num, bot);
          }
        }
      } else if ((status === 'FAILED' || status === 'STOPPED') && everLinked.has(bot.id)) {
        // Cuenta ya vinculada que se cayó: reconecta SIN logout (no re-escanear).
        console.log(`[${bot.id}] caída (${status}) — reconectando...`);
        await startSession(bot).catch(() => {});
      }
    } catch {}
  }
}

// Serializa los envíos por cada bot para no mandar dos mensajes a la vez.
const sendLocks = new Map();
function withSendLock(botId, fn) {
  const prev = sendLocks.get(botId) || Promise.resolve();
  const next = prev.then(fn, fn);
  sendLocks.set(botId, next.catch(() => {}));
  return next;
}

// ── Orquestación de la conversación ──────────────────────────────────────────

async function handleIncoming(bot, payload) {
  if (payload.fromMe) return; // ignora eco de mensajes propios

  const chatId = payload.from;
  if (!chatId) return;

  const isGroup = chatId.endsWith('@g.us');
  if (isGroup && !SETTINGS.allowGroups) return;

  const text = (payload.body || '').trim();
  if (!text) return;

  const senderNumber = chatId.split('@')[0];
  const senderBot = BOT_BY_NUMBER.get(senderNumber);
  if (SETTINGS.onlyAmongBots && !senderBot && !isGroup) return;

  const conv = getConversation(bot.id, chatId);

  const now = Date.now();
  if (conv.cooldownUntil > now) return;
  if (SETTINGS.maxTurnsPerPair > 0 && conv.turns >= SETTINGS.maxTurnsPerPair) {
    conv.cooldownUntil = now + SETTINGS.cooldownMs;
    conv.turns = 0;
    console.log(`[${bot.id}] pausa con ${chatId} por ${Math.round(SETTINGS.cooldownMs / 60000)} min`);
    return;
  }

  pushMessage(conv, 'user', text);

  let reply;
  try {
    reply = await generateReply({ persona: bot.persona, history: conv.messages });
  } catch (err) {
    console.error(`[${bot.id}] error generando respuesta:`, err?.message || err);
    return;
  }
  if (!reply) return;

  await withSendLock(bot.id, async () => {
    const delay = rand(SETTINGS.delayMinMs, SETTINGS.delayMaxMs);
    await startTyping(bot, chatId);
    await sleep(delay);
    await stopTyping(bot, chatId);
    try {
      await sendText(bot, chatId, reply);
      pushMessage(conv, 'assistant', reply);
      conv.turns += 1;
      console.log(`[${bot.id} -> ${senderBot?.id || senderNumber}] ${reply}`);
    } catch (err) {
      console.error(`[${bot.id}] error enviando:`, err?.response?.data || err?.message || err);
    }
  });
}

// ── Webhook de WAHA ──────────────────────────────────────────────────────────

// Guarda los últimos webhooks recibidos (diagnóstico).
const lastHooks = [];
function recordHook(botId, body) {
  lastHooks.unshift({ botId, event: body?.event, payload: body?.payload });
  if (lastHooks.length > 15) lastHooks.pop();
}

app.post('/webhook/:botId', (req, res) => {
  res.sendStatus(200);
  const bot = BOT_BY_ID.get(req.params.botId);
  recordHook(req.params.botId, req.body);
  if (!bot) return;
  const { event, payload } = req.body || {};
  if (event !== 'message') return;
  handleIncoming(bot, payload).catch((e) => console.error(e));
});

app.get('/lasthooks', (req, res) => {
  if (!guard(req, res)) return;
  res.json({ count: lastHooks.length, hooks: lastHooks });
});

// ── Protección opcional del panel ────────────────────────────────────────────

function guard(req, res) {
  if (!SETTINGS.dashboardToken) return true;
  if (req.query.token === SETTINGS.dashboardToken) return true;
  res.status(401).send('No autorizado. Agrega ?token=TU_TOKEN a la URL.');
  return false;
}
const tokenQS = () => (SETTINGS.dashboardToken ? `?token=${encodeURIComponent(SETTINGS.dashboardToken)}` : '');

// ── Panel web ────────────────────────────────────────────────────────────────

app.get('/qr/:botId.png', async (req, res) => {
  if (!guard(req, res)) return;
  const bot = BOT_BY_ID.get(req.params.botId);
  if (!bot) return res.sendStatus(404);
  try {
    const png = await getQrPng(bot);
    res.set('Content-Type', 'image/png').send(png);
  } catch {
    res.sendStatus(204); // sin QR (ya vinculada o no lista)
  }
});

app.get('/start/:botId', async (req, res) => {
  if (!guard(req, res)) return;
  const bot = BOT_BY_ID.get(req.params.botId);
  if (!bot) return res.sendStatus(404);
  try {
    // Si ya está vinculada, no la toques (evita desvincularla por accidente).
    let status = null;
    try {
      status = (await getSession(bot))?.status;
    } catch {}
    if (status !== 'WORKING') {
      // Limpieza + arranque: recupera sesiones atascadas en FAILED con QR nuevo.
      await logoutSession(bot);
      await startSession(bot);
    }
  } catch (e) {
    console.error(`[${bot.id}] start:`, e?.response?.data || e?.message);
  }
  res.redirect('/' + tokenQS());
});

app.get('/seed', async (req, res) => {
  if (!guard(req, res)) return;
  const from = BOT_BY_ID.get(req.query.from);
  const to = BOT_BY_ID.get(req.query.to);
  const text = (req.query.text || '¡Hola! ¿cómo va tu día?').toString();
  if (!from || !to) {
    return res.status(400).send('Parámetros inválidos: revisa "from" y "to".');
  }
  if (!to.number) {
    return res
      .status(400)
      .send(`La cuenta destino "${to.id}" aún no está vinculada (WORKING). Escanea su QR primero.`);
  }
  try {
    await sendText(from, chatIdOf(to.number), text);
  } catch (e) {
    return res.status(500).send('Error al enviar: ' + (e?.response?.data?.message || e?.message));
  }
  res.redirect('/' + tokenQS());
});

app.get('/', async (req, res) => {
  if (!guard(req, res)) return;

  const rows = await Promise.all(
    ACTIVE_BOTS.map(async (bot) => {
      let status = 'DESCONOCIDO';
      try {
        const s = await getSession(bot);
        status = s.status || s.state || 'DESCONOCIDO';
      } catch {}
      let qr;
      if (status === 'WORKING') {
        qr = '<span style="color:#16a34a">✅ vinculada</span>';
      } else if (status === 'SCAN_QR_CODE') {
        qr = `<div><img src="/qr/${bot.id}.png${tokenQS()}" alt="QR ${bot.id}" width="200" style="background:#fff;padding:6px;border-radius:8px"/><br/><small>Escanea con el WhatsApp de ${bot.persona.displayName}</small></div>`;
      } else {
        qr = `<span style="color:#dc2626">⚠ ${status} — clic en "reiniciar sesión" para un QR nuevo</span>`;
      }
      return `<tr>
        <td><b>${bot.persona.displayName}</b><br/><small>${bot.id}</small></td>
        <td>${bot.number || '(sin número)'}</td>
        <td>${status}</td>
        <td>${qr}</td>
        <td><a href="/start/${bot.id}${tokenQS()}">reiniciar sesión</a></td>
      </tr>`;
    })
  );

  const options = ACTIVE_BOTS.map((b) => `<option value="${b.id}">${b.persona.displayName}</option>`).join('');
  const t = SETTINGS.dashboardToken;
  const hidden = t ? `<input type="hidden" name="token" value="${t}"/>` : '';

  res.send(`<!doctype html><html lang="es"><head><meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>WhatsApp AI Swarm</title>
  <style>
    body{font-family:system-ui,sans-serif;max-width:820px;margin:24px auto;padding:0 16px;color:#111}
    table{border-collapse:collapse;width:100%;margin:16px 0}
    td,th{border:1px solid #e5e7eb;padding:10px;text-align:left;vertical-align:top}
    th{background:#f9fafb}
    .card{border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin:16px 0}
    button,select,input{padding:8px;border-radius:8px;border:1px solid #d1d5db}
    button{background:#111;color:#fff;cursor:pointer;border:none}
    a{color:#2563eb}
  </style></head><body>
  <h1>🤖 WhatsApp AI Swarm</h1>
  <p>Estado de las cuentas. Escanea el QR de cada una desde el WhatsApp correspondiente
  (WhatsApp → Dispositivos vinculados → Vincular dispositivo). Esta página se
  refresca sola cada 8&nbsp;s.</p>
  <table>
    <tr><th>Cuenta</th><th>Número</th><th>Estado</th><th>QR</th><th></th></tr>
    ${rows.join('')}
  </table>
  <div class="card">
    <h3>Encender conversación</h3>
    <form action="/seed" method="get">
      ${hidden}
      De <select name="from">${options}</select>
      a <select name="to">${options}</select>
      <input name="text" placeholder="mensaje inicial (opcional)" size="28"/>
      <button type="submit">Enviar primer mensaje</button>
    </form>
    <small>Ambas deben estar <b>WORKING</b>. Después de esto se responden solas.</small>
  </div>
  <p><small>Modelo: ${SETTINGS.geminiModel} · delay ${SETTINGS.delayMinMs}-${SETTINGS.delayMaxMs}ms ·
  tope ${SETTINGS.maxTurnsPerPair} turnos/pareja</small></p>
  <script>setTimeout(()=>location.reload(), 8000)</script>
  </body></html>`);
});

// Diagnóstico: llama a Gemini y devuelve la respuesta cruda (para depurar).
app.get('/diag', async (req, res) => {
  if (!guard(req, res)) return;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${SETTINGS.geminiModel}:generateContent`;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': SETTINGS.geminiApiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: 'Responde breve y amistoso en español.' }] },
        contents: [{ role: 'user', parts: [{ text: 'Hola, dime algo corto.' }] }],
        generationConfig: { maxOutputTokens: SETTINGS.aiMaxTokens, temperature: 0.9 },
      }),
    });
    const body = await r.json().catch(() => ({}));
    res.json({
      httpStatus: r.status,
      model: SETTINGS.geminiModel,
      keyPresent: !!SETTINGS.geminiApiKey,
      keyLen: (SETTINGS.geminiApiKey || '').length,
      gemini: body,
    });
  } catch (e) {
    res.json({ error: String(e?.message || e) });
  }
});

app.get('/health', (req, res) => {
  res.json({ ok: true, activeBots: ACTIVE_BOTS.map((b) => b.id), conversations: snapshot() });
});

// ── Arranque ─────────────────────────────────────────────────────────────────

async function initSessions() {
  if (ACTIVE_BOTS.length === 0) {
    console.log('⚠  Ningún bot con número (define NUM_ANA, NUM_BETO, ... en el entorno).');
    return;
  }
  console.log(`Iniciando sesiones: ${ACTIVE_BOTS.map((b) => b.id).join(', ')}`);
  for (const bot of ACTIVE_BOTS) {
    try {
      // No reinicies una cuenta ya vinculada (evita desvincularla en un redeploy).
      let status = null;
      try {
        status = (await getSession(bot))?.status;
      } catch {}
      if (status === 'WORKING') {
        console.log(`[${bot.id}] ya vinculada, se conserva.`);
        continue;
      }
      await startSession(bot);
    } catch (e) {
      console.error(`[${bot.id}] no se pudo iniciar:`, e?.response?.data?.message || e?.message);
    }
  }
  await maintainSessions();
  // Cada 15s: capta números nuevos y reconecta cuentas caídas.
  setInterval(() => maintainSessions().catch(() => {}), 15000);
}

app.listen(SETTINGS.port, () => {
  console.log(`Orquestador escuchando en :${SETTINGS.port}`);
  console.log(`Panel: ${SETTINGS.publicUrl}/${tokenQS()}`);
  console.log(`Webhook: ${SETTINGS.publicUrl}/webhook/:botId`);
  initSessions();
});
