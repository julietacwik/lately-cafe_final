// Levanta la aplicación con una base en memoria y ofrece un cliente HTTP con cookies.
import { crearAplicacion } from '../server/app.js';
import { config as configBase } from '../server/config.js';
import { CREDENCIALES_DEMO } from '../server/persistencia/datosDemo.js';
import os from 'node:os';
import path from 'node:path';

export { CREDENCIALES_DEMO };

export async function iniciarServidor({ reloj } = {}) {
  const config = {
    ...configBase,
    produccion: false,
    rutaBaseDatos: ':memory:',
    directorioSubidas: path.join(os.tmpdir(), 'lately-cafe-pruebas'),
    cargarDemoSiVacia: true,
    cookieSegura: false,
  };
  const { app, db } = await crearAplicacion(config, { reloj });
  const servidor = await new Promise((resolver) => {
    const s = app.listen(0, () => resolver(s));
  });
  const base = `http://127.0.0.1:${servidor.address().port}`;
  return {
    base,
    db,
    cerrar: () => new Promise((resolver) => servidor.close(() => { db.close(); resolver(); })),
  };
}

export function crearCliente(base) {
  let cookie = '';
  async function solicitud(metodo, ruta, datos, { sinCabecera = false } = {}) {
    const cabeceras = { Accept: 'application/json' };
    if (!sinCabecera) cabeceras['X-Requested-With'] = 'LatelyCafe';
    if (cookie) cabeceras.Cookie = cookie;
    if (datos !== undefined) cabeceras['Content-Type'] = 'application/json';
    const respuesta = await fetch(base + ruta, { method: metodo, headers: cabeceras, body: datos === undefined ? undefined : JSON.stringify(datos) });
    const nueva = respuesta.headers.get('set-cookie');
    if (nueva) cookie = nueva.split(';')[0];
    const cuerpo = await respuesta.json().catch(() => null);
    return { estado: respuesta.status, cuerpo };
  }
  return {
    get: (ruta, op) => solicitud('GET', ruta, undefined, op),
    post: (ruta, datos, op) => solicitud('POST', ruta, datos ?? {}, op),
    put: (ruta, datos) => solicitud('PUT', ruta, datos),
    patch: (ruta, datos) => solicitud('PATCH', ruta, datos),
    delete: (ruta) => solicitud('DELETE', ruta),
    async multipart(metodo, ruta, formulario) {
      const respuesta = await fetch(base + ruta, { method: metodo, headers: { 'X-Requested-With': 'LatelyCafe', Cookie: cookie }, body: formulario });
      return { estado: respuesta.status, cuerpo: await respuesta.json().catch(() => null) };
    },
    async ingresar(email, password) {
      const r = await solicitud('POST', '/api/auth/ingreso', { email, password });
      if (r.estado !== 200) throw new Error(`No se pudo ingresar: ${JSON.stringify(r.cuerpo)}`);
      return r.cuerpo.usuario;
    },
  };
}

export async function crearClienteRegistrado(base, sufijo) {
  const cliente = crearCliente(base);
  const r = await cliente.post('/api/auth/registro', { nombre: `Prueba ${sufijo}`, email: `prueba${sufijo}@test.com`, password: 'Clave1234', confirmacion: 'Clave1234' });
  if (r.estado !== 201) throw new Error(JSON.stringify(r.cuerpo));
  return cliente;
}

export async function crearClaseComoAdmin(admin, { horasDesdeAhora, cupo = 8, ahora = new Date() }) {
  const inicio = new Date(ahora.getTime() + horasDesdeAhora * 3600_000);
  const local = new Date(inicio.getTime() - 3 * 3600_000).toISOString();
  const formulario = new FormData();
  formulario.set('nombre', `Clase de prueba ${horasDesdeAhora}h`);
  formulario.set('descripcion', 'Descripción de una clase creada por las pruebas.');
  formulario.set('docente', 'Docente de prueba');
  formulario.set('fecha', local.slice(0, 10));
  formulario.set('hora', local.slice(11, 16));
  formulario.set('duracionMin', '60');
  formulario.set('cupo', String(cupo));
  return admin.multipart('POST', '/api/admin/clases', formulario);
}
