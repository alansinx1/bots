import { SETTINGS } from './config.js';

// Genera la respuesta del bot con Gemini (API de Google Generative Language).
// Usa fetch directo (sin SDK) contra el endpoint generateContent.
//
// history: [{ role: 'user' | 'assistant', text }]
//   'user'      = mensajes que le llegaron (del otro bot)  -> rol Gemini "user"
//   'assistant' = mensajes que este bot ya envió           -> rol Gemini "model"
export async function generateReply({ persona, history }) {
  const contents = history.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.text }],
  }));
  // Gemini exige que la conversación empiece con un turno "user".
  while (contents.length && contents[0].role === 'model') contents.shift();
  if (!contents.length) return '';

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${SETTINGS.geminiModel}:generateContent`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': SETTINGS.geminiApiKey,
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: persona.systemPrompt }] },
      contents,
      generationConfig: {
        maxOutputTokens: SETTINGS.aiMaxTokens,
        temperature: 0.9,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts
    .map((p) => p.text || '')
    .join('')
    .trim();
}
