import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { ErrorNegocio, errores } from '../dominio/errores.js';

export const COOKIE_SESION = 'lately_sesion';

export function leerCookies(cabecera = '') {
  return Object.fromEntries(cabecera.split(';').map((parte) => parte.trim()).filter(Boolean).map((parte) => {
    const indice = parte.indexOf('=');
    return [parte.slice(0, indice), decodeURIComponent(parte.slice(indice + 1))];
  }));
}

// Carga en req.usuario al usuario de la sesión, verificando el token en la base.
export function cargarSesion(gestor) {
  return (req, _res, next) => {
    req.tokenSesion = leerCookies(req.headers.cookie)[COOKIE_SESION] || null;
    req.usuario = gestor.usuarioDeSesion(req.tokenSesion);
    next();
  };
}

export function opcionesCookie(config) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSegura,
    path: '/',
    maxAge: config.diasSesion * 24 * 60 * 60 * 1000,
  };
}

// Protección CSRF: toda operación que modifica datos debe llegar con la cabecera
// X-Requested-With, que un formulario de otro sitio no puede enviar sin CORS.
export function exigirCabeceraAjax(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('X-Requested-With') !== 'LatelyCafe') {
    return next(new ErrorNegocio(403, 'SOLICITUD_RECHAZADA', 'La solicitud fue rechazada por seguridad. Recargá la página.'));
  }
  next();
}

// Middlewares de rol. El Gestor vuelve a comprobarlo en cada operación.
export const requiereSesion = (req, _res, next) => next(req.usuario ? undefined : errores.noAutenticado());
export const requiereAdministrador = (req, _res, next) => {
  if (!req.usuario) return next(errores.noAutenticado());
  if (!req.usuario.esAdministrador()) return next(errores.prohibido('Solo un administrador puede realizar esta acción.'));
  next();
};

// Límite simple de intentos por IP para registro e inicio de sesión.
export function limitarIntentos({ maximo, ventanaMs }) {
  const intentos = new Map();
  return (req, _res, next) => {
    const ahora = Date.now();
    const clave = `${req.ip}:${req.path}`;
    const registro = intentos.get(clave);
    if (!registro || registro.reinicio < ahora) {
      intentos.set(clave, { cantidad: 1, reinicio: ahora + ventanaMs });
      if (intentos.size > 10_000) intentos.clear();
      return next();
    }
    registro.cantidad += 1;
    if (registro.cantidad > maximo) {
      return next(new ErrorNegocio(429, 'DEMASIADOS_INTENTOS', 'Hiciste demasiados intentos. Esperá unos minutos y volvé a probar.'));
    }
    next();
  };
}

export function cabecerasSeguridad(_req, res, next) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': [
      "default-src 'self'",
      "img-src 'self' data: blob:",
      "style-src 'self' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "script-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  });
  next();
}

// ---------- Imágenes subidas ----------

const FIRMAS = [
  { extension: 'jpg', coincide: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { extension: 'png', coincide: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { extension: 'webp', coincide: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' },
];

export const MAX_IMAGEN_BYTES = 2 * 1024 * 1024;

export function subidaImagen(campo) {
  const procesar = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGEN_BYTES, files: 1, fields: 20 } }).single(campo);
  return (req, res, next) => procesar(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') return next(errores.validacion({ [campo]: 'La imagen puede pesar hasta 2 MB.' }));
    next(errores.validacion({ [campo]: 'No pudimos leer la imagen. Probá con otro archivo.' }));
  });
}

// Verifica el contenido real del archivo (no solo la extensión) y lo guarda con nombre aleatorio.
export function guardarImagen(archivo, directorio, campo) {
  if (!archivo) return undefined;
  const firma = FIRMAS.find((f) => f.coincide(archivo.buffer));
  if (!firma) throw errores.validacion({ [campo]: 'Subí una imagen JPG, PNG o WEBP.' });
  fs.mkdirSync(directorio, { recursive: true });
  const nombre = `${crypto.randomUUID()}.${firma.extension}`;
  fs.writeFileSync(path.join(directorio, nombre), archivo.buffer);
  return `/uploads/${nombre}`;
}

export function manejarErrores(error, req, res, _next) {
  if (error instanceof ErrorNegocio) {
    return res.status(error.estado).json({ error: { codigo: error.codigo, mensaje: error.message, campos: error.campos } });
  }
  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { codigo: 'JSON_INVALIDO', mensaje: 'La solicitud tiene un formato inválido.' } });
  }
  if (error?.type === 'entity.too.large') {
    return res.status(413).json({ error: { codigo: 'DEMASIADO_GRANDE', mensaje: 'La solicitud es demasiado grande.' } });
  }
  if (Number.isInteger(error?.status) && error.status >= 400 && error.status < 500) {
    return res.status(error.status).json({ error: { codigo: 'SOLICITUD_INVALIDA', mensaje: error.status === 404 ? 'No encontrado.' : 'Solicitud inválida.' } });
  }
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, error);
  res.status(500).json({ error: { codigo: 'ERROR_INTERNO', mensaje: 'Ocurrió un error inesperado. Probá de nuevo en unos minutos.' } });
}
