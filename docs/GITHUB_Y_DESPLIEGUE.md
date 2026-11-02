# Subir a GitHub y publicar la aplicación

## 1. Subir el proyecto a GitHub

El proyecto ya incluye `.gitignore`: no se suben `node_modules/`, `.env`, la base `data/lately.db` ni las imágenes de `uploads/`.

### Opción A: desde la terminal (VS Code → Terminal → Nueva terminal)

1. Entrá a <https://github.com/new> y creá un repositorio, por ejemplo `lately-cafe`. Elegí si es público o privado y **no** marques “Add a README”, “.gitignore” ni “license” (el proyecto ya los tiene).
2. En la carpeta del proyecto, ejecutá:

```bash
git init
git add .
git commit -m "Primera versión de Lately Café"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/lately-cafe.git
git push -u origin main
```

La primera vez, Git pide iniciar sesión en GitHub (se abre el navegador o el administrador de credenciales).

Antes del primer `git commit`, si nunca configuraste Git:

```bash
git config --global user.name "Tu nombre"
git config --global user.email "tu-correo@ejemplo.com"
```

### Opción B: con GitHub Desktop

1. *File → Add local repository…* y elegí la carpeta del proyecto. Si avisa que no es un repositorio, elegí *create a repository*.
2. Escribí un resumen del commit (“Primera versión de Lately Café”) y hacé clic en *Commit to main*.
3. *Publish repository* y elegí tu cuenta. Podés marcarlo como privado.

### Mantenerlo después

```bash
git pull                     # traer cambios del equipo
git add .
git commit -m "Describe el cambio"
git push
```

Antes de cada `push`, ejecutá `npm test`.

### Clonar en otra computadora

```bash
git clone https://github.com/TU-USUARIO/lately-cafe.git
cd lately-cafe
npm install
npm start
```

## 2. Publicar la aplicación

La aplicación es **un único servicio Node.js** que sirve la API y el frontend. Necesita **disco persistente** para la base SQLite (`DATABASE_PATH`) y para las imágenes (`UPLOADS_DIR`).

> Las plataformas *serverless* o de sitios estáticos (Vercel, Netlify, GitHub Pages) **no sirven** tal como está el proyecto: no conservan archivos entre ejecuciones. Para usarlas, habría que migrar `Persistencia` a una base administrada (por ejemplo, PostgreSQL) y las imágenes a un almacenamiento de objetos.

### Configuración de producción (cualquier proveedor)

| Variable | Valor |
| --- | --- |
| `NODE_ENV` | `production` |
| `PUBLIC_URL` | `https://tu-dominio` (sin barra final). El menú público queda en `/menu`. |
| `DATABASE_PATH` | Ruta dentro del disco persistente, por ejemplo `/var/data/lately.db` |
| `UPLOADS_DIR` | Ruta dentro del disco persistente, por ejemplo `/var/data/uploads` |
| `SEED_DEMO` | `false` (las cuentas demo tienen contraseñas públicas) |
| `COOKIE_SECURE` | `true` |
| `TRUST_PROXY` | `true` si hay un proxy delante (Render, Railway, Nginx) |

Después del primer despliegue, creá el administrador desde la consola del servidor:

```bash
npm run crear-admin -- admin@tu-dominio.com "Administración" "UnaClaveSegura123"
```

Después reiniciá el servicio: el servidor carga las listas de usuarios al arrancar y, sin reiniciar, no reconoce la cuenta nueva.

Si es una demostración académica y querés los datos demo, dejá `SEED_DEMO=true` y avisá que son cuentas públicas.

### Opción 1: Render (recomendada, ya configurada)

El repositorio incluye `render.yaml` y una guía completa en **[RENDER.md](RENDER.md)**: conexión del repositorio privado, servicio con disco persistente, variables, creación del administrador, respaldos y costos.

### Opción 2: Railway

1. *New Project → Deploy from GitHub repo* y elegí el repositorio.
2. Agregá un **Volume** montado, por ejemplo, en `/data`. Configurá `DATABASE_PATH=/data/lately.db` y `UPLOADS_DIR=/data/uploads`, más el resto de las variables.
3. Railway detecta Node y usa `npm start`. Generá un dominio en *Settings → Networking* y copialo en `PUBLIC_URL`.

### Opción 3: servidor propio o VPS (Ubuntu)

```bash
# Node.js 22 LTS (por ejemplo, con nvm) y git instalados
git clone https://github.com/TU-USUARIO/lately-cafe.git && cd lately-cafe
npm ci --omit=dev
cp .env.example .env && nano .env       # completar con valores de producción
npm install -g pm2
pm2 start npm --name lately-cafe -- start
pm2 save && pm2 startup
```

Delante, poné **Nginx** como proxy inverso con HTTPS (Let's Encrypt / Certbot) hacia `http://127.0.0.1:3000`, y configurá `TRUST_PROXY=true`.

### Respaldo en producción

Copiá periódicamente el archivo de base de datos y la carpeta de imágenes. Por ejemplo, con `sqlite3 /var/data/lately.db ".backup /var/data/respaldos/lately-$(date +%F).db"` y una copia de `/var/data/uploads`.

### Actualizar la aplicación publicada

Render y Railway vuelven a desplegar solos con cada `git push` a `main`. En un VPS: `git pull && npm ci --omit=dev && pm2 restart lately-cafe`. Las migraciones nuevas (`server/persistencia/migraciones/*.sql`) se aplican automáticamente al iniciar.
