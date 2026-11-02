// Cliente HTTP de la API. Todas las solicitudes viajan con la cookie de sesión
// (httpOnly, no accesible desde JavaScript) y la cabecera anti-CSRF.

export class ApiError extends Error {
  constructor(estado, { codigo, mensaje, campos } = {}) {
    super(mensaje || 'No pudimos completar la operación.');
    this.estado = estado;
    this.codigo = codigo;
    this.campos = campos;
  }
}

const oyentesSesionVencida = new Set();
export const alVencerSesion = (oyente) => oyentesSesionVencida.add(oyente);

export async function api(ruta, { metodo = 'GET', datos, formulario, silenciar401 = false } = {}) {
  const opciones = { method: metodo, credentials: 'same-origin', headers: { 'X-Requested-With': 'LatelyCafe', Accept: 'application/json' } };
  if (formulario) {
    opciones.body = formulario;
  } else if (datos !== undefined) {
    opciones.headers['Content-Type'] = 'application/json';
    opciones.body = JSON.stringify(datos);
  }

  let respuesta;
  try {
    respuesta = await fetch(`/api${ruta}`, opciones);
  } catch {
    throw new ApiError(0, { codigo: 'SIN_CONEXION', mensaje: 'No hay conexión con el servidor. Revisá tu conexión e intentá de nuevo.' });
  }

  const cuerpo = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const error = new ApiError(respuesta.status, cuerpo.error);
    if (respuesta.status === 401 && !silenciar401) oyentesSesionVencida.forEach((oyente) => oyente(error));
    throw error;
  }
  return cuerpo;
}

export const get = (ruta, opciones) => api(ruta, opciones);
export const post = (ruta, datos, opciones) => api(ruta, { ...opciones, metodo: 'POST', datos });
export const put = (ruta, datos) => api(ruta, { metodo: 'PUT', datos });
export const patch = (ruta, datos) => api(ruta, { metodo: 'PATCH', datos });
export const borrar = (ruta) => api(ruta, { metodo: 'DELETE' });
export const enviarFormulario = (ruta, formulario, metodo = 'POST') => api(ruta, { metodo, formulario });
