import 'dotenv/config';
import { ACTIVE_BOTS } from '../src/config.js';
import { getSession } from '../src/gateway.js';

// Muestra el estado de vinculación de cada sesión activa en WAHA.
(async () => {
  for (const bot of ACTIVE_BOTS) {
    try {
      const s = await getSession(bot);
      const status = s.status || s.state || 'UNKNOWN';
      console.log(`${bot.id.padEnd(8)} ${status.padEnd(14)} ${bot.number || '(sin número)'}`);
    } catch (err) {
      console.log(`${bot.id.padEnd(8)} ERROR          ${err?.response?.status || err?.message || ''}`);
    }
  }
})();
