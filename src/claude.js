import Anthropic from '@anthropic-ai/sdk';
import { SETTINGS } from './config.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Genera la respuesta del bot dado su persona y el historial de la conversación.
// history: [{ role: 'user' | 'assistant', text: string }]
//   'user'      = mensajes que le llegaron (del otro bot)
//   'assistant' = mensajes que este bot ya envió
export async function generateReply({ persona, history }) {
  const messages = history.map((m) => ({ role: m.role, content: m.text }));

  const res = await client.messages.create({
    model: SETTINGS.claudeModel,
    max_tokens: SETTINGS.claudeMaxTokens,
    system: persona.systemPrompt,
    messages,
  });

  return res.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}
