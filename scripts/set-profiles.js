import 'dotenv/config';
import axios from 'axios';
import { ACTIVE_BOTS, SETTINGS } from '../src/config.js';

// Pone nombre, bio (about) y foto de perfil a cada cuenta vinculada.
// Es una acción MUY humana y ayuda a "calentar" — pero córrela solo cuando las
// cuentas estén WORKING y NO restringidas.
//
// Fotos: define una URL por bot vía env, ej:  PHOTO_ANA=https://.../ana.jpg
// (debe ser una imagen pública que WAHA pueda descargar).
//
// Uso:  node scripts/set-profiles.js

// Bio corta por persona (edítalas a gusto).
const ABOUT = {
  ana: 'Diseñando cosas bonitas 🎨',
  beto: '⚽ y buen humor',
  caro: 'Estudiando y sobreviviendo ☕',
  diego: 'Papá, números y café',
  eli: 'La música es vida 🎶',
  fer: 'Cocinando algo rico 🍳',
  gaby: 'Aprendiendo siempre 📚',
  hugo: 'Code & coffee </>',
  ivon: 'Cuidando con cariño 💙',
  javi: 'Explorando el mundo 📷',
};

function http(bot) {
  return axios.create({
    baseURL: bot.baseUrl,
    timeout: 30000,
    headers: SETTINGS.wahaApiKey ? { 'X-Api-Key': SETTINGS.wahaApiKey } : {},
  });
}

async function setProfile(bot) {
  const api = http(bot);
  const name = bot.persona.displayName;
  const about = ABOUT[bot.id] || '';
  const photoUrl = process.env['PHOTO_' + bot.id.toUpperCase()];

  process.stdout.write(`\n[${bot.id}] `);
  try {
    // Verifica que esté WORKING antes de tocar el perfil.
    const s = await api.get(`/api/sessions/${bot.name}`);
    if ((s.data.status || s.data.state) !== 'WORKING') {
      console.log(`saltada (estado ${s.data.status || s.data.state}).`);
      return;
    }
  } catch {
    console.log('no se pudo leer la sesión, saltada.');
    return;
  }

  try {
    await api.put(`/api/${bot.name}/profile/name`, { name });
    process.stdout.write(`nombre✓ `);
  } catch (e) {
    process.stdout.write(`nombre✗(${e?.response?.status || ''}) `);
  }

  if (about) {
    try {
      await api.put(`/api/${bot.name}/profile/status`, { status: about });
      process.stdout.write(`bio✓ `);
    } catch (e) {
      process.stdout.write(`bio✗(${e?.response?.status || ''}) `);
    }
  }

  if (photoUrl) {
    try {
      await api.put(`/api/${bot.name}/profile/picture`, { file: { url: photoUrl } });
      process.stdout.write(`foto✓`);
    } catch (e) {
      process.stdout.write(`foto✗(${e?.response?.status || ''})`);
    }
  } else {
    process.stdout.write(`(sin PHOTO_${bot.id.toUpperCase()})`);
  }
}

(async () => {
  console.log(`Poniendo perfil a: ${ACTIVE_BOTS.map((b) => b.id).join(', ')}`);
  for (const bot of ACTIVE_BOTS) {
    await setProfile(bot);
  }
  console.log('\n\nListo. Si alguna foto falló, revisa que la URL sea una imagen pública accesible.');
})();
