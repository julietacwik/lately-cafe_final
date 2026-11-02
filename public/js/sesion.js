// Estado de la sesión en la interfaz. Es solo una copia para decidir qué mostrar:
// la autorización real la decide el servidor en cada solicitud.
import { get, post } from './api.js';

const estado = { usuario: null, unidadesCarrito: 0 };
const oyentes = new Set();

export const usuarioActual = () => estado.usuario;
export const unidadesCarrito = () => estado.unidadesCarrito;
export const esCliente = () => estado.usuario?.rol === 'CLIENTE';
export const esAdministrador = () => estado.usuario?.rol === 'ADMINISTRADOR';

export function suscribir(oyente) {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

function notificar() {
  oyentes.forEach((oyente) => oyente(estado));
}

export function establecerUsuario(usuario) {
  estado.usuario = usuario;
  if (!usuario || usuario.rol !== 'CLIENTE') estado.unidadesCarrito = 0;
  notificar();
  if (usuario?.rol === 'CLIENTE') refrescarCarrito();
}

export function establecerUnidades(unidades) {
  estado.unidadesCarrito = unidades;
  notificar();
}

export async function cargarSesion() {
  try {
    const { usuario } = await get('/auth/sesion');
    establecerUsuario(usuario);
  } catch {
    establecerUsuario(null);
  }
}

export async function refrescarCarrito() {
  if (!esCliente()) return;
  try {
    const carrito = await get('/carrito', { silenciar401: true });
    establecerUnidades(carrito.cantidadUnidades);
  } catch {
    /* El contador es informativo; si falla se mantiene el valor anterior. */
  }
}

export async function cerrarSesion() {
  try {
    await post('/auth/salida');
  } finally {
    establecerUsuario(null);
  }
}
