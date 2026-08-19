import 'dotenv/config';
import { BOTS, BOT_BY_ID } from '../src/config.js';
import { sendText, chatIdOf } from '../src/gateway.js';

// Enciende la conversación: manda un primer mensaje de un bot a otro.
// A partir de ahí, el orquestador (npm start) mantiene el ida y vuelta solo.
//
// Uso:
//   node scripts/seed.js                 -> ana escribe a beto (por defecto)
//   node scripts/seed.js ana beto        -> de ana a beto
//   node scripts/seed.js ana beto "hola, ¿cómo vas?"

const [fromId = 'ana', toId = 'beto', ...rest] = process.argv.slice(2);
const openers = [
  '¡Hola! ¿cómo va tu día?',
  'Oye, ¿qué has hecho hoy?',
  '¡Ey! tenía rato sin saber de ti, ¿todo bien?',
  '¿Qué onda? ¿algo nuevo por ahí?',
];
const text = rest.join(' ') || openers[Math.floor(Math.random() * openers.length)];

const from = BOT_BY_ID.get(fromId);
const to = BOT_BY_ID.get(toId);

if (!from || !to) {
  console.error(`Bots válidos: ${BOTS.map((b) => b.id).join(', ')}`);
  process.exit(1);
}
if (!to.number) {
  console.error(`El bot destino "${to.id}" no tiene number en src/config.js.`);
  process.exit(1);
}

(async () => {
  try {
    await sendText(from, chatIdOf(to.number), text);
    console.log(`✅ ${from.id} -> ${to.id}: ${text}`);
    console.log('La conversación debería continuar sola si el orquestador está corriendo.');
  } catch (err) {
    console.error('Error al enviar:', err?.response?.data || err?.message || err);
    process.exit(1);
  }
})();
