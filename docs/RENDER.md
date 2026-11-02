# Publicar en Render (con SQLite y disco persistente)

Lately Café corre en Render como **un servicio web Node.js con un disco persistente**. La base SQLite y las imágenes subidas viven en ese disco. El resto del sistema de archivos de Render se borra en cada reinicio y en cada despliegue.

> **Costo.** Los servicios gratuitos de Render no admiten discos y borran los archivos al reiniciarse, así que **no sirven** para esta aplicación. Hace falta un servicio pago y un disco pago (ver “Costos” al final). Render muestra el precio antes de confirmar la creación.

## Qué ya está preparado en el repositorio

| Aspecto | Configuración |
| --- | --- |
| Puerto y red | El servidor usa `PORT` (Render lo define) y escucha en `0.0.0.0` (variable `HOST`). |
| Versión de Node | `NODE_VERSION=24` en `render.yaml`. `.nvmrc` = 24 y `engines` = `>=22.13.0 <25`. Necesita Node 22.13 o superior por el módulo `node:sqlite`. |
| Instalación | `npm ci --omit=dev`: instala exactamente lo de `package-lock.json`, sin dependencias de desarrollo. |
| Arranque | `npm start`. Aplica las migraciones pendientes y luego inicia el servidor. |
| Chequeo de salud | `GET /api/salud`. |
| Datos persistentes | Disco montado en `/var/data`: `DATABASE_PATH=/var/data/lately.db` y `UPLOADS_DIR=/var/data/uploads`. |
| Cuentas demo | Desactivadas: `SEED_DEMO=false`. En producción quedan desactivadas aunque falte la variable. |
| URL pública | Usa `PUBLIC_URL` si está definida; si no, la URL `…onrender.com` que Render publica en `RENDER_EXTERNAL_URL`. |
| HTTPS y cookies | `COOKIE_SECURE=true`. `TRUST_PROXY=true`, porque Render usa un proxy. |
| Blueprint | `render.yaml` describe todo lo anterior. |

### Por qué reiniciar o actualizar no borra datos

- La base y las imágenes están en el disco (`/var/data`), que Render conserva entre reinicios y despliegues.
- Al iniciar solo se aplican las migraciones **nuevas** (tabla `migraciones`). Nunca se borran tablas.
- La demostración solo se carga si la base está vacía **y** `SEED_DEMO=true`. En producción vale `false`.
- `npm run db:demo` (que borra todo) se niega a ejecutarse con `NODE_ENV=production`.
- Ante un reinicio, el servidor cierra ordenadamente al recibir `SIGTERM`: deja de aceptar conexiones y cierra la base. Cada operación ya quedó confirmada en su transacción.
- Render toma una **instantánea diaria del disco** y la guarda 7 días.

Las pruebas `tests/produccion.test.js` verifican esto: reinicio sobre el mismo archivo, ausencia de cuentas demo, `0.0.0.0` / `PORT` y el bloqueo de `db:demo`.

**Limitaciones de usar disco en Render:**
- El servicio no puede tener más de una instancia.
- No hay despliegues sin corte: durante cada actualización la aplicación queda sin responder unos segundos.

Para 50 usuarios concurrentes alcanza con una instancia (ver [PRUEBAS.md](PRUEBAS.md)).

## Paso a paso

### 1. Crear la cuenta y conectar GitHub

1. Entrá a <https://dashboard.render.com> y elegí **Sign in with GitHub**. Usá la cuenta **Fedeethomas**.
2. Cuando GitHub pregunte a qué repositorios dar acceso, elegí **Only select repositories** → `lately-cafe`. Render funciona con repositorios privados mientras tenga ese permiso.
3. Si ya tenías cuenta: *Account Settings → Git Providers → GitHub* y dale acceso a `lately-cafe`.

### 2. Crear el servicio

Hay dos formas. La A aplica `render.yaml` sin errores de tipeo; la B permite revisar cada opción.

**A) Con el Blueprint (recomendado)**

1. **New + → Blueprint** y elegí el repositorio `Fedeethomas/lately-cafe` (rama `main`).
2. Render lee `render.yaml` y muestra el servicio `lately-cafe` con su disco `lately-datos`.
3. Te pide `PUBLIC_URL`. **Dejala vacía** si vas a usar la dirección `…onrender.com`, o escribí tu dominio propio (`https://…`).
4. **Revisá el plan y el precio que muestra Render** antes de tocar **Apply / Deploy Blueprint**. Ese paso crea recursos pagos.

**B) Manual (Web Service)**

1. **New + → Web Service** → elegí `lately-cafe`.
2. Completá:

| Campo | Valor |
| --- | --- |
| Name | `lately-cafe` |
| Language / Runtime | `Node` |
| Branch | `main` |
| Region | `Virginia (US East)`, la más cercana a Argentina |
| Root Directory | (vacío) |
| Build Command | `npm ci --omit=dev` |
| Start Command | `npm start` |
| Instance Type | **0.5 CPU / 512 MB** (el plan inicial pago, antes “Starter”). No elijas *Free*: no admite disco. |

3. En **Advanced**:
   - **Health Check Path**: `/api/salud`
   - **Auto-Deploy**: *On Commit*
   - **Add Disk**: Name `lately-datos`, Mount Path `/var/data`, Size `1` GB.
4. En **Environment Variables**, agregá:

| Variable | Valor |
| --- | --- |
| `NODE_VERSION` | `24` |
| `NODE_ENV` | `production` |
| `DATABASE_PATH` | `/var/data/lately.db` |
| `UPLOADS_DIR` | `/var/data/uploads` |
| `SEED_DEMO` | `false` |
| `COOKIE_SECURE` | `true` |
| `TRUST_PROXY` | `true` |
| `PUBLIC_URL` | (opcional) tu dominio propio, sin barra final |

No pongas `PORT`: Render lo asigna solo.

5. Revisá el resumen de costos y tocá **Create Web Service**.

### 3. Verificar el primer despliegue

En la pestaña **Logs** deberían aparecer:

```
Base de datos: /var/data/lately.db
Imágenes subidas: /var/data/uploads
Lately Café escuchando en 0.0.0.0:10000 · https://lately-cafe-xxxx.onrender.com
```

Abrí la URL del servicio. El menú va a estar **vacío**: es lo esperado, porque producción arranca sin datos de demostración.

### 4. Crear el administrador real

1. En el servicio, abrí la pestaña **Shell** (disponible en servicios pagos).
2. Ejecutá, con tus datos:

```bash
npm run crear-admin -- admin@tu-correo.com "Administración Lately" "UnaClaveLarga123"
```

3. Reiniciá el servicio (**Manual Deploy → Restart service**). El servidor tiene las listas de usuarios en memoria y las vuelve a cargar de la base al arrancar; sin el reinicio, no reconoce la cuenta nueva.
4. Entrá a la URL pública con ese correo y esa contraseña. Desde **Panel admin** cargá productos y clases.
5. Si querés que la contraseña no quede en el historial del Shell, cambiala después en **Mi perfil → Cambiar contraseña**.

El mismo comando sirve para convertir en administradora una cuenta de cliente que ya existe. Además, cierra sus sesiones abiertas. También en ese caso hay que reiniciar el servicio.

### 5. Actualizaciones

Cada `git push` a `main` vuelve a desplegar el servicio. El disco y sus datos se conservan, y las migraciones nuevas se aplican solas al arrancar.

Para volver a una versión anterior: **Events / Deploys → Rollback**.

### 6. Respaldos

- **Automático:** Render toma una instantánea diaria del disco y la guarda 7 días (*Disks → Snapshots*). Restaurar reemplaza **todo** el disco con su contenido de ese momento.
- **Manual, recomendado antes de cambios grandes**, desde el Shell:

```bash
mkdir -p /var/data/respaldos
node -e "const {DatabaseSync}=require('node:sqlite');const d=new DatabaseSync('/var/data/lately.db');d.exec(\"VACUUM INTO '/var/data/respaldos/lately-\"+new Date().toISOString().slice(0,10)+\".db'\")"
```

Para bajar una copia a tu computadora, usá `scp` con la conexión SSH que ofrece Render (*Connect → SSH*).

## Costos

Valores consultados el 01/11/2026 en publicaciones de Render. **Confirmalos en el resumen que muestra Render antes de crear el servicio**, porque los precios pueden cambiar.

| Recurso | Precio | Fuente |
| --- | --- | --- |
| Workspace **Hobby** | USD 0 por mes (incluye 5 GB de tráfico saliente) | [Artículo de costos de Render (08/07/2026)](https://render.com/articles/how-much-does-cloud-application-hosting-cost-for-small-businesses) |
| Instancia **0.5 CPU / 512 MB** (`0.5c-512mb`, ex Starter) | **USD 7 por mes** (prorrateado por segundo) | [Página de precios de Render](https://render.com/pricing); cifra confirmada en comparativas de 2026 ([makerkit](https://makerkit.dev/pricing-calculator/render), [instapods](https://instapods.com/compare/railway-vs-render/)) |
| Disco persistente | **USD 0,25 por GB por mes** → 1 GB = USD 0,25 por mes | Artículo de costos de Render |
| Tráfico adicional | USD 0,15 por GB por encima de lo incluido | Artículo de costos de Render |
| **Total estimado** | **≈ USD 7,25 por mes** (más IVA o percepciones de la tarjeta, si corresponden) | |

Un disco se cobra mientras existe, aunque el servicio esté suspendido. Para dejar de pagar, hay que eliminar el servicio **y** el disco. Antes, hacé un respaldo.
