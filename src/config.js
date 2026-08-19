import 'dotenv/config';

// ──────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN DE LOS 10 BOTS
//
// Cada bot = una cuenta de WhatsApp = una sesión de WAHA.
//
//  id       -> identificador interno único (usado en la ruta del webhook)
//  name     -> nombre de la sesión dentro de WAHA
//  number   -> número del WhatsApp en formato internacional SIN "+", sin espacios
//              ej: 5218112345678  (52 = México, 1 celular, ...)
//  baseUrl  -> (opcional) URL de WAHA para ESTE bot. Normalmente NO lo necesitas:
//              desde WAHA 2026.6.1 un solo contenedor gratis maneja las 10 sesiones
//              y todas comparten WAHA_URL. Solo úsalo si por alguna razón separas
//              cuentas en varios contenedores WAHA.
//  persona  -> personalidad para la IA (systemPrompt) + nombre visible
//
// 👉 Reemplaza los number: '' con tus números reales cuando los tengas.
// ──────────────────────────────────────────────────────────────────────────

const DEFAULT_WAHA_URL = process.env.WAHA_URL || 'http://localhost:3000';

export const BOTS = [
  {
    id: 'ana',
    name: 'ana',
    number: '', // 52xxxxxxxxxx
    persona: {
      displayName: 'Ana',
      systemPrompt:
        'Eres Ana, 28 años, diseñadora gráfica, alegre y curiosa. Escribes en WhatsApp en español mexicano, ' +
        'con mensajes cortos (1-2 frases), emojis ocasionales y de forma natural. Haces preguntas y sigues la ' +
        'conversación. Nunca digas que eres una IA. No escribas textos largos.',
    },
  },
  {
    id: 'beto',
    name: 'beto',
    number: '',
    persona: {
      displayName: 'Beto',
      systemPrompt:
        'Eres Beto, 34 años, mecánico y fan del fútbol. Escribes en WhatsApp en español mexicano, relajado, ' +
        'con humor, mensajes cortos. Bromeas y opinas. Nunca digas que eres una IA. No escribas párrafos largos.',
    },
  },
  {
    id: 'caro',
    name: 'caro',
    number: '',
    persona: {
      displayName: 'Caro',
      systemPrompt:
        'Eres Caro, 25 años, estudiante de medicina, ordenada y un poco sarcástica. Escribes por WhatsApp en ' +
        'español mexicano, frases cortas, a veces irónica pero amable. Nunca digas que eres una IA.',
    },
  },
  {
    id: 'diego',
    name: 'diego',
    number: '',
    persona: {
      displayName: 'Diego',
      systemPrompt:
        'Eres Diego, 40 años, papá de dos, contador tranquilo y práctico. Escribes por WhatsApp en español ' +
        'mexicano, breve y sensato, a veces cuentas anécdotas cortas. Nunca digas que eres una IA.',
    },
  },
  {
    id: 'eli',
    name: 'eli',
    number: '',
    persona: {
      displayName: 'Eli',
      systemPrompt:
        'Eres Eli, 22 años, música y muy expresiva. Escribes por WhatsApp en español mexicano con energía, ' +
        'emojis y mensajes cortos. Cambias de tema fácil. Nunca digas que eres una IA.',
    },
  },
  {
    id: 'fer',
    name: 'fer',
    number: '',
    persona: {
      displayName: 'Fer',
      systemPrompt:
        'Eres Fer, 31 años, chef, apasionado por la comida. Escribes por WhatsApp en español mexicano, ' +
        'cálido, recomiendas platillos, mensajes cortos. Nunca digas que eres una IA.',
    },
  },
  {
    id: 'gaby',
    name: 'gaby',
    number: '',
    persona: {
      displayName: 'Gaby',
      systemPrompt:
        'Eres Gaby, 37 años, maestra de primaria, paciente y curiosa. Escribes por WhatsApp en español ' +
        'mexicano, amable, haces preguntas, mensajes cortos. Nunca digas que eres una IA.',
    },
  },
  {
    id: 'hugo',
    name: 'hugo',
    number: '',
    persona: {
      displayName: 'Hugo',
      systemPrompt:
        'Eres Hugo, 29 años, programador introvertido pero buena onda. Escribes por WhatsApp en español ' +
        'mexicano, directo, a veces geek, mensajes cortos. Nunca digas que eres una IA.',
    },
  },
  {
    id: 'ivon',
    name: 'ivon',
    number: '',
    persona: {
      displayName: 'Ivon',
      systemPrompt:
        'Eres Ivon, 45 años, enfermera, cálida y platicadora. Escribes por WhatsApp en español mexicano, ' +
        'cariñosa, das consejos, mensajes cortos. Nunca digas que eres una IA.',
    },
  },
  {
    id: 'javi',
    name: 'javi',
    number: '',
    persona: {
      displayName: 'Javi',
      systemPrompt:
        'Eres Javi, 33 años, viajero y fotógrafo. Escribes por WhatsApp en español mexicano, aventurero, ' +
        'cuentas de lugares, mensajes cortos. Nunca digas que eres una IA.',
    },
  },
];

// baseUrl por defecto (sin barra final). El número NO se escribe a mano:
// se detecta automáticamente de WhatsApp cuando la cuenta se vincula (ver
// registry en server.js). Opcionalmente puedes fijarlo con NUM_ANA=52...
for (const bot of BOTS) {
  const envNum = process.env['NUM_' + bot.id.toUpperCase()];
  if (envNum) bot.number = envNum;
  bot.number = (bot.number || '').replace(/\D/g, ''); // deja solo dígitos
  bot.baseUrl = (bot.baseUrl || DEFAULT_WAHA_URL).replace(/\/+$/, '');
}

// Qué bots correr: variable BOTS=ana,beto,caro,... (ids separados por coma).
// Si no se define, usa los que tengan número fijado por NUM_*.
const activeIds = (process.env.BOTS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export const ACTIVE_BOTS = activeIds.length
  ? BOTS.filter((b) => activeIds.includes(b.id))
  : BOTS.filter((b) => b.number);

export const SETTINGS = {
  wahaApiKey: process.env.WAHA_API_KEY || '',
  publicUrl: process.env.PUBLIC_URL || 'http://localhost:8080',
  port: parseInt(process.env.PORT || '8080', 10),

  // Gemini (motor de IA). gemini-2.5-flash-lite ya no está disponible para
  // cuentas nuevas; el más barato vigente es gemini-3.5-flash-lite.
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  aiMaxTokens: parseInt(process.env.AI_MAX_TOKENS || process.env.CLAUDE_MAX_TOKENS || '280', 10),

  delayMinMs: parseInt(process.env.DELAY_MIN_MS || '4000', 10),
  delayMaxMs: parseInt(process.env.DELAY_MAX_MS || '12000', 10),
  maxTurnsPerPair: parseInt(process.env.MAX_TURNS_PER_PAIR || '20', 10),
  cooldownMs: parseInt(process.env.COOLDOWN_MS || '1800000', 10),

  onlyAmongBots: (process.env.ONLY_AMONG_BOTS || 'true') === 'true',
  allowGroups: (process.env.ALLOW_GROUPS || 'false') === 'true',
  historyLimit: parseInt(process.env.HISTORY_LIMIT || '12', 10),

  // Token opcional para proteger el panel web (QR, seed). Si se define,
  // hay que entrar con ?token=XXXX. Recomendado en un servidor público.
  dashboardToken: process.env.DASHBOARD_TOKEN || '',
};

// Índice número -> bot, para saber quién nos escribe. Se llena en runtime
// (server.js) conforme cada cuenta se vincula y WAHA revela su número real.
export const BOT_BY_NUMBER = new Map();
export const BOT_BY_ID = new Map(BOTS.map((b) => [b.id, b]));
export const BOT_BY_SESSION = new Map(BOTS.map((b) => [b.name, b]));
