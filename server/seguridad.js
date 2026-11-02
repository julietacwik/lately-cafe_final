// Hash de contraseñas con scrypt (incluido en Node.js) y tokens de sesión.
import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);
const PARAMETROS = { N: 16384, r: 8, p: 1 };
const LARGO_CLAVE = 64;

export async function hashearContrasena(contrasena) {
  const sal = crypto.randomBytes(16);
  const derivada = await scrypt(contrasena, sal, LARGO_CLAVE, PARAMETROS);
  return ['scrypt', PARAMETROS.N, PARAMETROS.r, PARAMETROS.p, sal.toString('base64'), derivada.toString('base64')].join('$');
}

export async function verificarContrasena(contrasena, hashGuardado) {
  const [algoritmo, N, r, p, sal, hash] = String(hashGuardado).split('$');
  if (algoritmo !== 'scrypt') return false;
  const esperado = Buffer.from(hash, 'base64');
  const derivada = await scrypt(contrasena, Buffer.from(sal, 'base64'), esperado.length, { N: Number(N), r: Number(r), p: Number(p) });
  return crypto.timingSafeEqual(derivada, esperado);
}

// Hash usado cuando el correo no existe, para que la respuesta tarde lo mismo.
export const HASH_FICTICIO = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(LARGO_CLAVE).toString('base64');

export function generarToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}
