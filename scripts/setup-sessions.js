import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ACTIVE_BOTS } from '../src/config.js';
import { startSession, getSession, getQrPng } from '../src/gateway.js';

// Arranca cada sesión de WAHA y guarda el QR de las que necesitan vincularse.
// Escanea cada PNG con el WhatsApp correspondiente (Dispositivos vinculados).

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const qrDir = path.join(__dirname, '..', 'qr');
fs.mkdirSync(qrDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function setupBot(bot) {
  process.stdout.write(`\n[${bot.id}] arrancando sesión... `);
  try {
    await startSession(bot);
  } catch (err) {
    console.log(`ERROR: ${err?.response?.data?.message || err?.message || err}`);
    return;
  }

  // Espera hasta que WAHA reporte estado (WORKING = ya vinculada, SCAN_QR_CODE = falta QR).
  for (let i = 0; i < 20; i++) {
    let status = 'UNKNOWN';
    try {
      const s = await getSession(bot);
      status = s.status || s.state || 'UNKNOWN';
    } catch {}

    if (status === 'WORKING') {
      console.log('ya vinculada ✅');
      return;
    }
    if (status === 'SCAN_QR_CODE' || status === 'STARTING' || status === 'UNKNOWN') {
      try {
        const png = await getQrPng(bot);
        const file = path.join(qrDir, `${bot.id}.png`);
        fs.writeFileSync(file, png);
        console.log(`escanea el QR -> ${file}`);
        return;
      } catch {
        // aún no hay QR listo; reintenta
      }
    }
    await sleep(1500);
  }
  console.log('no se pudo obtener estado/QR (revisa WAHA).');
}

(async () => {
  if (ACTIVE_BOTS.length === 0) {
    console.log('⚠  Ningún bot tiene number en src/config.js.');
    console.log('   Llena el number de ana y beto (formato 52xxxxxxxxxx) para probar con 2 cuentas.');
    return;
  }
  console.log(`Vinculando ${ACTIVE_BOTS.length} cuenta(s): ${ACTIVE_BOTS.map((b) => b.id).join(', ')}`);
  for (const bot of ACTIVE_BOTS) {
    await setupBot(bot);
  }
  console.log('\nListo. Escanea los QR en la carpeta ./qr con cada teléfono.');
  console.log('Luego arranca el orquestador con:  npm start');
})();
