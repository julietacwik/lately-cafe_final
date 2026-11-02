// Pruebas de configuración de producción y de persistencia entre reinicios (archivo SQLite real).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { crearAplicacion } from '../server/app.js';
import { config as configBase } from '../server/config.js';
import { crearCliente } from './ayudantes.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function leerConfig(env) {
  const salida = execFileSync(process.execPath, ['--input-type=module', '-e',
    "const { config } = await import('./server/config.js'); console.log(JSON.stringify(config));"],
  { cwd: RAIZ, env: { PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT, ...env } });
  return JSON.parse(salida.toString());
}

async function levantar(directorio, opciones) {
  const config = {
    ...configBase,
    rutaBaseDatos: path.join(directorio, 'lately.db'),
    directorioSubidas: path.join(directorio, 'uploads'),
    cookieSegura: false,
    ...opciones,
  };
  const { app, db } = await crearAplicacion(config);
  const servidor = await new Promise((resolver) => { const s = app.listen(0, '127.0.0.1', () => resolver(s)); });
  return {
    base: `http://127.0.0.1:${servidor.address().port}`,
    db,
    cerrar: () => new Promise((resolver) => servidor.close(() => { db.close(); resolver(); })),
  };
}

test('En producción, por defecto no hay cuentas demo, se escucha en 0.0.0.0 y se usa la URL de Render', () => {
  const produccion = leerConfig({ NODE_ENV: 'production', PORT: '10000', RENDER_EXTERNAL_URL: 'https://lately-cafe.onrender.com' });
  assert.equal(produccion.cargarDemoSiVacia, false);
  assert.equal(produccion.host, '0.0.0.0');
  assert.equal(produccion.puerto, 10000);
  assert.equal(produccion.cookieSegura, true);
  assert.equal(produccion.urlPublica, 'https://lately-cafe.onrender.com');
  const conDominio = leerConfig({ NODE_ENV: 'production', PUBLIC_URL: 'https://latelycafe.com.ar/', RENDER_EXTERNAL_URL: 'https://x.onrender.com' });
  assert.equal(conDominio.urlPublica, 'https://latelycafe.com.ar');
  const desarrollo = leerConfig({ NODE_ENV: 'development' });
  assert.equal(desarrollo.cargarDemoSiVacia, true);
});

test('Una base nueva en producción arranca vacía, sin cuentas de demostración', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lately-prod-'));
  const srv = await levantar(dir, { produccion: true, cargarDemoSiVacia: false });
  try {
    assert.equal(srv.db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n, 0);
    const r = await crearCliente(srv.base).post('/api/auth/ingreso', { email: 'admin@lately.demo', password: 'Admin1234' });
    assert.equal(r.estado, 401);
  } finally {
    await srv.cerrar();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Reiniciar la aplicación conserva los datos y no vuelve a cargar la demostración', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lately-reinicio-'));
  try {
    let srv = await levantar(dir, { cargarDemoSiVacia: true });
    const cliente = crearCliente(srv.base);
    await cliente.post('/api/auth/registro', { nombre: 'Persistente', email: 'persiste@test.com', password: 'Clave1234', confirmacion: 'Clave1234' });
    const { cuerpo: menu } = await cliente.get('/api/productos');
    const producto = menu.productos.find((p) => p.disponible);
    await cliente.post('/api/carrito/lineas', { productoId: producto.id, cantidad: 2 });
    const { cuerpo: { pedido } } = await cliente.post('/api/pedidos', { claveIdempotencia: 'reinicio-0001', lineasAceptadas: [{ productoId: producto.id, cantidad: 2, precioUnitario: producto.precio }] });
    await cliente.post('/api/carrito/lineas', { productoId: producto.id, cantidad: 3 });
    const conteo = (db) => db.prepare('SELECT (SELECT COUNT(*) FROM usuarios) AS u, (SELECT COUNT(*) FROM productos) AS p, (SELECT COUNT(*) FROM pedidos) AS o, (SELECT COUNT(*) FROM migraciones) AS m').get();
    const antes = { ...conteo(srv.db) };
    await srv.cerrar();

    // Segundo arranque sobre el mismo archivo (equivale a un reinicio o un nuevo despliegue en Render).
    srv = await levantar(dir, { cargarDemoSiVacia: true });
    assert.deepEqual({ ...conteo(srv.db) }, antes, 'no se duplican datos ni se reaplican migraciones');
    const otro = crearCliente(srv.base);
    await otro.ingresar('persiste@test.com', 'Clave1234');
    const recuperado = (await otro.get(`/api/pedidos/${pedido.id}`)).cuerpo;
    assert.equal(recuperado.total, 2 * producto.precio);
    const carrito = (await otro.get('/api/carrito')).cuerpo;
    assert.deepEqual(carrito.lineas.map((l) => [l.productoId, l.cantidad]), [[producto.id, 3]], 'el carrito también se conserva');
    await srv.cerrar();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('npm run db:demo se niega a borrar datos en producción', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lately-demo-'));
  try {
    assert.throws(() => execFileSync(process.execPath, ['--disable-warning=ExperimentalWarning', 'server/persistencia/datosDemo.js'], {
      cwd: RAIZ, stdio: 'pipe',
      env: { PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT, NODE_ENV: 'production', DATABASE_PATH: path.join(dir, 'x.db') },
    }), (error) => error.status === 1 && /Bloqueado/.test(error.stderr.toString()));
    assert.equal(fs.existsSync(path.join(dir, 'x.db')), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
