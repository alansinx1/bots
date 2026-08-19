# WhatsApp AI Swarm — cuentas de WhatsApp que conversan entre sí con IA

Orquestador que conecta varias cuentas de WhatsApp (vía **WAHA**) y las hace
platicar entre ellas de forma natural usando **Gemini**. Cada cuenta es un
"personaje" con su propia personalidad. Incluye un **panel web** para ver el
estado, escanear los QR desde el navegador y encender la conversación.

```
WhatsApp ↔ WAHA (Easypanel) ──webhook──▶ Orquestador (Easypanel) ──▶ Gemini
                            ◀──enviar────
```

Empezamos con **2 cuentas** (ana y beto) y luego se escala a 10.

---

## ⚠️ Antes de empezar

- Necesitas **números reales** de WhatsApp (uno por cuenta).
- Automatizar cuentas para que se escriban entre sí **va contra los Términos de
  WhatsApp**. Riesgo real de **baneo**, sobre todo con números nuevos. El
  orquestador mete delays, "escribiendo…" y un tope de turnos para bajar el riesgo.

---

## PASO 0 — Actualizar WAHA (¡importante!)

Tu WAHA en Easypanel está en una versión vieja (2026.4.x) que **solo permite 1
cuenta**. La liberación de "sesiones ilimitadas gratis" llegó en **2026.6.1**.

En Easypanel, en el servicio **WAHA**:

1. **Source / Image:** usa `devlikeapro/waha:latest` (o fija `devlikeapro/waha:2026.6.1`
   o superior).
2. **Environment**, agrega/confirma:
   - `WAHA_API_KEY=<tu-clave>`
   - `WHATSAPP_DEFAULT_ENGINE=NOWEB`  (motor sin navegador: mucho menos CPU/RAM)
3. **Deploy / Redeploy.**

Verifica la versión (debe ser ≥ 2026.6.1):

```bash
curl -H "X-Api-Key: TU_CLAVE" https://TU-WAHA.easypanel.host/api/version
```

---

## PASO 1 — Desplegar el orquestador en Easypanel

Este proyecto trae un `Dockerfile`, así que Easypanel lo construye solo.

1. Sube este código a un repo de **GitHub** (ver "Subir a GitHub" abajo).
2. En Easypanel → **Create Service → App**.
3. **Source:** tu repo de GitHub (rama `main`). Build = **Dockerfile**.
4. **Port:** `8080` (el que expone el Dockerfile).
5. **Domains:** deja que Easypanel te asigne un dominio, ej.
   `https://bots-orquestador.cakkmp.easypanel.host`. Ese es tu `PUBLIC_URL`.
6. **Environment:** pega las variables (ver siguiente paso).
7. **Deploy.**

### Variables de entorno (pestaña Environment)

```
WAHA_URL=https://bots-waha.cakkmp.easypanel.host
WAHA_API_KEY=<tu-clave-de-waha>
PUBLIC_URL=https://bots-orquestador.cakkmp.easypanel.host   # el dominio de ESTA app
PORT=8080

GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-2.5-flash-lite

NUM_ANA=52xxxxxxxxxx
NUM_BETO=52xxxxxxxxxx

DASHBOARD_TOKEN=un-token-secreto
```

Al arrancar, el orquestador crea solo las sesiones de las cuentas con número
(ana y beto) y configura sus webhooks.

---

## PASO 2 — Vincular las cuentas (QR desde el navegador)

Abre el panel:

```
https://bots-orquestador.cakkmp.easypanel.host/?token=un-token-secreto
```

Verás una tabla con ana y beto. Cada una mostrará un **QR**: escanéalo desde el
teléfono correspondiente (**WhatsApp → Dispositivos vinculados → Vincular
dispositivo**). Cuando queden en estado **WORKING** (✅), están listas.

---

## PASO 3 — Encender la conversación

En el mismo panel, sección **"Encender conversación"**: elige *De* ana *a* beto,
escribe un mensaje inicial (opcional) y dale **Enviar primer mensaje**.

A partir de ahí las cuentas se responden solas con IA. Puedes ajustar el ritmo y
los topes con las variables `DELAY_*`, `MAX_TURNS_PER_PAIR` y `COOLDOWN_MS`.

---

## Escalar a 10 cuentas

Cuando el test de 2 funcione: agrega `NUM_CARO`, `NUM_DIEGO`, ... en Environment,
redeploy, escanea sus QR en el panel y listo. Las personalidades ya están
definidas en `src/config.js` (Ana, Beto, Caro, Diego, Eli, Fer, Gaby, Hugo, Ivon,
Javi). Edítalas a tu gusto.

---

## Subir a GitHub (una sola vez)

```bash
cd /Users/alansantos/Desktop/bots
git init
git add .
git commit -m "WhatsApp AI Swarm"
# crea un repo vacío en github.com y luego:
git remote add origin https://github.com/TU_USUARIO/bots.git
git branch -M main
git push -u origin main
```

`.env`, `node_modules/` y `qr/` están en `.gitignore`, así que no se suben
secretos.

---

## Correr en local (opcional, para desarrollo)

```bash
npm install
cp .env.example .env   # llena las variables
npm start              # panel en http://localhost:8080
```

Si corres local pero WAHA está en el VPS, WAHA no alcanza tu `localhost`; usa un
túnel (`cloudflared tunnel --url http://localhost:8080`) y pon esa URL en
`PUBLIC_URL`. Por eso desplegar en Easypanel es más simple.

## Estructura

```
src/config.js     -> bots (personalidades), números por env y ajustes
src/gateway.js    -> cliente de WAHA (sesiones, QR, enviar, typing)
src/ai.js         -> genera la respuesta con Gemini
src/store.js      -> historial de conversación en memoria
src/server.js     -> webhook + panel web + orquestación
scripts/          -> versiones por línea de comandos (setup/seed/status)
Dockerfile        -> para desplegar en Easypanel
waha/             -> docker-compose de WAHA (si lo corres tú directo)
```
