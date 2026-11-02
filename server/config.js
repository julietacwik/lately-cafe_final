// Configuración central. Lee variables de entorno (archivo .env opcional).
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const archivoEnv = path.join(RAIZ, '.env');
if (fs.existsSync(archivoEnv) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(archivoEnv);
}

function booleano(valor, porDefecto) {
  if (valor === undefined || valor === '') return porDefecto;
  return ['1', 'true', 'si', 'sí', 'yes'].includes(String(valor).toLowerCase());
}

function rutaAbsoluta(valor, porDefecto) {
  const ruta = valor || porDefecto;
  return path.isAbsolute(ruta) ? ruta : path.join(RAIZ, ruta);
}

const produccion = process.env.NODE_ENV === 'production';

const puerto = Number(process.env.PORT) || 3000;

export const config = {
  produccion,
  puerto,
  // 0.0.0.0 acepta conexiones externas (necesario en Render y contenedores).
  host: process.env.HOST || '0.0.0.0',
  // Render define RENDER_EXTERNAL_URL automáticamente; PUBLIC_URL tiene prioridad (dominio propio).
  urlPublica: (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${puerto}`).replace(/\/$/, ''),
  rutaBaseDatos: process.env.DATABASE_PATH === ':memory:' ? ':memory:' : rutaAbsoluta(process.env.DATABASE_PATH, 'data/lately.db'),
  directorioSubidas: rutaAbsoluta(process.env.UPLOADS_DIR, 'uploads'),
  cookieSegura: booleano(process.env.COOKIE_SECURE, produccion),
  diasSesion: Number(process.env.SESSION_DAYS) || 7,
  // En producción las cuentas de demostración quedan desactivadas salvo que se pidan explícitamente.
  cargarDemoSiVacia: booleano(process.env.SEED_DEMO, !produccion),
  confiarProxy: booleano(process.env.TRUST_PROXY, false),
};

// Lately Café opera en Argentina (UTC-03:00, sin horario de verano).
export const ZONA_HORARIA = 'America/Argentina/Buenos_Aires';
export const DESFASE_ARGENTINA = '-03:00';

export const CATEGORIAS = ['Cafés', 'Bebidas frías', 'Pastelería', 'Salado', 'Té e infusiones'];
