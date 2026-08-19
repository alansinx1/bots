import { SETTINGS } from './config.js';

// Estado de conversación en memoria, por pareja (bot que responde + chat del otro).
// Para producción real podrías cambiarlo por Redis o una base de datos.
const conversations = new Map(); // key: `${botId}|${chatId}` -> { messages, turns, cooldownUntil }

function keyFor(botId, chatId) {
  return `${botId}|${chatId}`;
}

export function getConversation(botId, chatId) {
  const key = keyFor(botId, chatId);
  if (!conversations.has(key)) {
    conversations.set(key, { messages: [], turns: 0, cooldownUntil: 0 });
  }
  return conversations.get(key);
}

export function pushMessage(conv, role, text) {
  conv.messages.push({ role, text });
  // Recorta el historial para no crecer sin límite ni disparar el costo.
  const max = SETTINGS.historyLimit;
  if (conv.messages.length > max) {
    conv.messages.splice(0, conv.messages.length - max);
  }
}

export function snapshot() {
  const out = [];
  for (const [key, conv] of conversations.entries()) {
    out.push({ key, turns: conv.turns, messages: conv.messages.length, cooldownUntil: conv.cooldownUntil });
  }
  return out;
}
