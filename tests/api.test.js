// Pruebas de integración contra la API real (servidor + SQLite en memoria + datos demo).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarServidor, crearCliente, crearClienteRegistrado, crearClaseComoAdmin, CREDENCIALES_DEMO } from './ayudantes.js';

let srv;
let admin;
let contador = 0;
const nuevoCliente = () => crearClienteRegistrado(srv.base, `${Date.now()}${contador++}`);

before(async () => {
  srv = await iniciarServidor();
  admin = crearCliente(srv.base);
  await admin.ingresar(CREDENCIALES_DEMO.administrador.email, CREDENCIALES_DEMO.administrador.password);
});
after(() => srv.cerrar());

async function productoPorNombre(nombre) {
  const { cuerpo } = await crearCliente(srv.base).get('/api/productos');
  return cuerpo.productos.find((p) => p.nombre === nombre);
}

test('Un visitante no puede administrar; un cliente tampoco (control en el servidor)', async () => {
  const visitante = crearCliente(srv.base);
  assert.equal((await visitante.get('/api/admin/productos')).estado, 401);
  assert.equal((await visitante.patch('/api/admin/productos/1/disponibilidad', { disponible: false })).estado, 401);
  assert.equal((await visitante.delete('/api/admin/clases/1')).estado, 401);
  assert.equal((await visitante.get('/api/admin/estadisticas?desde=2026-01-01&hasta=2026-12-31')).estado, 401);
  const cliente = await nuevoCliente();
  assert.equal((await cliente.get('/api/admin/productos')).estado, 403);
  assert.equal((await cliente.delete('/api/admin/productos/1')).estado, 403);
  assert.equal((await cliente.get('/api/admin/estadisticas?desde=2026-01-01&hasta=2026-12-31')).estado, 403);
  assert.equal((await visitante.get('/api/carrito')).estado, 401);
});

test('El registro público crea solo clientes aunque se envíe un rol', async () => {
  const visitante = crearCliente(srv.base);
  const r = await visitante.post('/api/auth/registro', { nombre: 'Intruso', email: 'intruso@test.com', password: 'Clave1234', confirmacion: 'Clave1234', rol: 'ADMINISTRADOR', tipo: 'ADMINISTRADOR' });
  assert.equal(r.estado, 201);
  assert.equal(r.cuerpo.usuario.rol, 'CLIENTE');
  assert.equal((await visitante.get('/api/admin/productos')).estado, 403);
  const fila = srv.db.prepare('SELECT tipo, password_hash FROM usuarios WHERE email = ?').get('intruso@test.com');
  assert.equal(fila.tipo, 'CLIENTE');
  assert.match(fila.password_hash, /^scrypt\$/, 'la contraseña se guarda con hash');
});

test('Registro e ingreso informan correo duplicado, datos inválidos y credenciales incorrectas', async () => {
  const visitante = crearCliente(srv.base);
  const duplicado = await visitante.post('/api/auth/registro', { nombre: 'Otra', email: CREDENCIALES_DEMO.cliente.email, password: 'Clave1234', confirmacion: 'Clave1234' });
  assert.equal(duplicado.estado, 409);
  assert.ok(duplicado.cuerpo.error.campos.email);
  const invalido = await visitante.post('/api/auth/registro', { nombre: 'A', email: 'no-es-correo', password: '123', confirmacion: '1' });
  assert.equal(invalido.estado, 400);
  assert.deepEqual(Object.keys(invalido.cuerpo.error.campos).sort(), ['confirmacion', 'email', 'nombre', 'password']);
  const incorrecto = await visitante.post('/api/auth/ingreso', { email: CREDENCIALES_DEMO.cliente.email, password: 'Incorrecta1' });
  assert.equal(incorrecto.estado, 401);
  assert.equal(incorrecto.cuerpo.error.codigo, 'CREDENCIALES_INCORRECTAS');
});

test('Las operaciones que modifican datos exigen la cabecera anti-CSRF', async () => {
  const r = await crearCliente(srv.base).post('/api/auth/ingreso', CREDENCIALES_DEMO.cliente, { sinCabecera: true });
  assert.equal(r.estado, 403);
});

test('Un producto agotado no puede agregarse al carrito', async () => {
  const cliente = await nuevoCliente();
  const agotado = await productoPorNombre('Iced latte');
  assert.equal(agotado.disponible, false);
  const r = await cliente.post('/api/carrito/lineas', { productoId: agotado.id, cantidad: 1 });
  assert.equal(r.estado, 409);
  assert.equal(r.cuerpo.error.codigo, 'PRODUCTO_AGOTADO');
  assert.equal((await cliente.get('/api/carrito')).cuerpo.lineas.length, 0);
});

test('El carrito rechaza cantidades inválidas y recalcula importes', async () => {
  const cliente = await nuevoCliente();
  const cortado = await productoPorNombre('Cortado');
  for (const cantidad of [0, -2, 1.5, 100, 'diez']) {
    assert.equal((await cliente.post('/api/carrito/lineas', { productoId: cortado.id, cantidad })).estado, 400);
  }
  let r = await cliente.post('/api/carrito/lineas', { productoId: cortado.id, cantidad: 2 });
  assert.equal(r.cuerpo.total, 2 * cortado.precio);
  r = await cliente.patch(`/api/carrito/lineas/${cortado.id}`, { cantidad: 4 });
  assert.equal(r.cuerpo.lineas[0].subtotal, 4 * cortado.precio);
  assert.equal((await cliente.patch(`/api/carrito/lineas/${cortado.id}`, { cantidad: 0 })).estado, 400);
  r = await cliente.delete(`/api/carrito/lineas/${cortado.id}`);
  assert.equal(r.cuerpo.total, 0);
});

test('Una clase no supera su cupo ante inscripciones simultáneas (RN-02)', async () => {
  const clase = await crearClaseComoAdmin(admin, { horasDesdeAhora: 24 * 10, cupo: 8 });
  assert.equal(clase.estado, 201, JSON.stringify(clase.cuerpo));
  const clientes = await Promise.all(Array.from({ length: 14 }, () => nuevoCliente()));
  const resultados = await Promise.all(clientes.map((c) => c.post(`/api/clases/${clase.cuerpo.id}/inscripciones`)));
  const exitosas = resultados.filter((r) => r.estado === 201).length;
  const rechazadas = resultados.filter((r) => r.estado === 409 && r.cuerpo.error.codigo === 'CUPO_COMPLETO').length;
  assert.equal(exitosas, 8);
  assert.equal(rechazadas, 6);
  const activas = srv.db.prepare(`SELECT COUNT(*) AS n FROM inscripciones WHERE clase_id = ?`).get(clase.cuerpo.id).n;
  assert.equal(activas, 8);
});

test('No se permiten inscripciones duplicadas ni reducir el cupo por debajo de los inscriptos', async () => {
  const clase = await crearClaseComoAdmin(admin, { horasDesdeAhora: 24 * 12, cupo: 3 });
  const cliente = await nuevoCliente();
  const otro = await nuevoCliente();
  assert.equal((await cliente.post(`/api/clases/${clase.cuerpo.id}/inscripciones`)).estado, 201);
  const repetida = await cliente.post(`/api/clases/${clase.cuerpo.id}/inscripciones`);
  assert.equal(repetida.estado, 409);
  assert.equal(repetida.cuerpo.error.codigo, 'INSCRIPCION_DUPLICADA');
  assert.equal((await otro.post(`/api/clases/${clase.cuerpo.id}/inscripciones`)).estado, 201);

  const local = new Date(new Date(clase.cuerpo.inicio).getTime() - 3 * 3600_000).toISOString();
  const formulario = new FormData();
  Object.entries({ nombre: clase.cuerpo.nombre, descripcion: clase.cuerpo.descripcion, docente: clase.cuerpo.docente, fecha: local.slice(0, 10), hora: local.slice(11, 16), duracionMin: '60', cupo: '1' })
    .forEach(([k, v]) => formulario.set(k, v));
  const reduccion = await admin.multipart('PUT', `/api/admin/clases/${clase.cuerpo.id}`, formulario);
  assert.equal(reduccion.estado, 400);
  assert.ok(reduccion.cuerpo.error.campos.cupo);
});

test('La cancelación respeta las 48 horas (RN-01)', async () => {
  const cercana = await crearClaseComoAdmin(admin, { horasDesdeAhora: 47 });
  const lejana = await crearClaseComoAdmin(admin, { horasDesdeAhora: 50 });
  const cliente = await nuevoCliente();
  const i1 = await cliente.post(`/api/clases/${cercana.cuerpo.id}/inscripciones`);
  const i2 = await cliente.post(`/api/clases/${lejana.cuerpo.id}/inscripciones`);
  assert.equal(i1.cuerpo.puedeCancelar, false);
  assert.equal(i2.cuerpo.puedeCancelar, true);

  const rechazo = await cliente.delete(`/api/inscripciones/${i1.cuerpo.id}`);
  assert.equal(rechazo.estado, 409);
  assert.equal(rechazo.cuerpo.error.codigo, 'CANCELACION_FUERA_DE_PLAZO');
  const ok = await cliente.delete(`/api/inscripciones/${i2.cuerpo.id}`);
  assert.equal(ok.estado, 200);
  assert.equal(ok.cuerpo.ok, true);
  assert.ok(!(await cliente.get('/api/inscripciones')).cuerpo.some((i) => i.id === i2.cuerpo.id), 'la inscripción se quita del cliente');

  const clases = (await cliente.get('/api/clases')).cuerpo;
  assert.equal(clases.find((c) => c.id === lejana.cuerpo.id).inscriptos, 0, 'se libera el cupo');
});

test('Cada cliente accede solo a sus pedidos e inscripciones', async () => {
  const duenio = await nuevoCliente();
  const ajeno = await nuevoCliente();
  const cortado = await productoPorNombre('Cortado');
  await duenio.post('/api/carrito/lineas', { productoId: cortado.id, cantidad: 1 });
  const { cuerpo: { pedido } } = await duenio.post('/api/pedidos', { claveIdempotencia: 'pertenencia-001', lineasAceptadas: [{ productoId: cortado.id, cantidad: 1, precioUnitario: cortado.precio }] });
  assert.equal((await ajeno.get(`/api/pedidos/${pedido.id}`)).estado, 404);
  assert.equal((await ajeno.get('/api/pedidos')).cuerpo.length, 0);

  const clase = await crearClaseComoAdmin(admin, { horasDesdeAhora: 24 * 20 });
  const inscripcion = await duenio.post(`/api/clases/${clase.cuerpo.id}/inscripciones`);
  assert.equal((await ajeno.delete(`/api/inscripciones/${inscripcion.cuerpo.id}`)).estado, 404);
});

test('Los pedidos conservan sus precios históricos y evitan duplicados (RN-03)', async () => {
  const cliente = await nuevoCliente();
  const latte = await productoPorNombre('Latte');
  await cliente.post('/api/carrito/lineas', { productoId: latte.id, cantidad: 2 });
  const aceptadas = [{ productoId: latte.id, cantidad: 2, precioUnitario: latte.precio }];

  // Resumen desactualizado: se rechaza y el carrito NO se vacía.
  const desactualizado = await cliente.post('/api/pedidos', { claveIdempotencia: 'historico-000', lineasAceptadas: [{ ...aceptadas[0], precioUnitario: latte.precio - 1 }] });
  assert.equal(desactualizado.estado, 409);
  assert.equal((await cliente.get('/api/carrito')).cuerpo.lineas.length, 1);

  // Varios clics simultáneos con la misma clave generan un único pedido.
  const respuestas = await Promise.all(Array.from({ length: 5 }, () => cliente.post('/api/pedidos', { claveIdempotencia: 'historico-001', lineasAceptadas: aceptadas })));
  const ids = new Set(respuestas.map((r) => r.cuerpo.pedido.id));
  assert.equal(ids.size, 1);
  assert.equal(respuestas.filter((r) => r.estado === 201).length, 1);
  const pedido = respuestas[0].cuerpo.pedido;
  assert.equal(pedido.estado, 'RECIBIDO');
  assert.equal(pedido.total, 2 * latte.precio);
  assert.equal((await cliente.get('/api/carrito')).cuerpo.lineas.length, 0, 'el carrito se vacía después de guardar');

  // El administrador cambia el precio: el pedido no cambia.
  const formulario = new FormData();
  Object.entries({ nombre: latte.nombre, descripcion: latte.descripcion, precio: String(latte.precio + 1000), categoria: latte.categoria }).forEach(([k, v]) => formulario.set(k, v));
  assert.equal((await admin.multipart('PUT', `/api/admin/productos/${latte.id}`, formulario)).estado, 200);
  const consultado = (await cliente.get(`/api/pedidos/${pedido.id}`)).cuerpo;
  assert.equal(consultado.lineas[0].precioUnitario, latte.precio);
  assert.equal(consultado.total, 2 * latte.precio);
  assert.equal((await productoPorNombre('Latte')).precio, latte.precio + 1000);
});

test('No se confirma un pedido con el carrito vacío ni con productos agotados', async () => {
  const cliente = await nuevoCliente();
  const vacio = await cliente.post('/api/pedidos', { claveIdempotencia: 'vacio-00001', lineasAceptadas: [] });
  assert.equal(vacio.estado, 409);
  assert.equal(vacio.cuerpo.error.codigo, 'CARRITO_VACIO');

  const cookie = await productoPorNombre('Cookie con chips');
  await cliente.post('/api/carrito/lineas', { productoId: cookie.id, cantidad: 1 });
  await admin.patch(`/api/admin/productos/${cookie.id}/disponibilidad`, { disponible: false });
  const conAgotado = await cliente.post('/api/pedidos', { claveIdempotencia: 'agotado-0001', lineasAceptadas: [{ productoId: cookie.id, cantidad: 1, precioUnitario: cookie.precio }] });
  assert.equal(conAgotado.estado, 409);
  assert.equal(conAgotado.cuerpo.error.codigo, 'PRODUCTO_AGOTADO');
  await admin.patch(`/api/admin/productos/${cookie.id}/disponibilidad`, { disponible: true });
});

test('Eliminar una clase cancela sus inscripciones asociadas', async () => {
  const clase = await crearClaseComoAdmin(admin, { horasDesdeAhora: 24 * 15 });
  const cliente = await nuevoCliente();
  await cliente.post(`/api/clases/${clase.cuerpo.id}/inscripciones`);
  const r = await admin.delete(`/api/admin/clases/${clase.cuerpo.id}`);
  assert.equal(r.cuerpo.inscripcionesCanceladas, 1);
  const inscripciones = (await cliente.get('/api/inscripciones')).cuerpo;
  assert.ok(!inscripciones.some((i) => i.clase.id === clase.cuerpo.id), 'la inscripción se quita del cliente');
  assert.equal(srv.db.prepare('SELECT COUNT(*) AS n FROM inscripciones WHERE clase_id = ?').get(clase.cuerpo.id).n, 0);
  assert.ok(!(await cliente.get('/api/clases')).cuerpo.some((c) => c.id === clase.cuerpo.id));
});

test('Estadísticas: valida el rango y contempla períodos sin ventas', async () => {
  const invertido = await admin.get('/api/admin/estadisticas?desde=2026-12-31&hasta=2026-01-01');
  assert.equal(invertido.estado, 400);
  assert.ok(invertido.cuerpo.error.campos.desde);
  const sinVentas = await admin.get('/api/admin/estadisticas?desde=2001-01-01&hasta=2001-01-31');
  assert.equal(sinVentas.estado, 200);
  assert.equal(sinVentas.cuerpo.cantidadVentas, 0);
  assert.equal(sinVentas.cuerpo.importeTotal, 0);
  const conVentas = await admin.get('/api/admin/estadisticas?desde=2000-01-01&hasta=2099-12-31');
  assert.equal(conVentas.estado, 400, 'el período máximo es de tres años');
  const hoy = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  const anio = new Date(Date.now() - 3 * 3600_000 - 300 * 86400_000).toISOString().slice(0, 10);
  const r = await admin.get(`/api/admin/estadisticas?desde=${anio}&hasta=${hoy}`);
  assert.ok(r.cuerpo.cantidadVentas > 0);
  assert.ok(r.cuerpo.productosMasVendidos.length > 0);
});

test('Cada cambio se guarda en la base en el momento y el carrito usa el precio vigente', async () => {
  const cliente = await nuevoCliente();
  const medialuna = await productoPorNombre('Medialuna de manteca');
  const { cuerpo: perfil } = await cliente.get('/api/perfil');
  const fila = () => srv.db.prepare('SELECT cantidad FROM carrito_lineas WHERE cliente_id = ? AND producto_id = ?').get(perfil.id, medialuna.id);

  await cliente.post('/api/carrito/lineas', { productoId: medialuna.id, cantidad: 2 });
  assert.equal(fila().cantidad, 2, 'el carrito ya está en la base');

  const cambiarPrecio = (precio) => {
    const formulario = new FormData();
    Object.entries({ nombre: medialuna.nombre, descripcion: medialuna.descripcion, precio: String(precio), categoria: medialuna.categoria }).forEach(([k, v]) => formulario.set(k, v));
    return admin.multipart('PUT', `/api/admin/productos/${medialuna.id}`, formulario);
  };
  await cambiarPrecio(medialuna.precio + 100);
  assert.equal(srv.db.prepare('SELECT precio FROM productos WHERE id = ?').get(medialuna.id).precio, medialuna.precio + 100);
  assert.equal((await cliente.get('/api/carrito')).cuerpo.total, 2 * (medialuna.precio + 100));
  await cambiarPrecio(medialuna.precio);

  const clase = await crearClaseComoAdmin(admin, { horasDesdeAhora: 24 * 30 });
  const inscripcion = await cliente.post(`/api/clases/${clase.cuerpo.id}/inscripciones`);
  assert.ok(srv.db.prepare('SELECT id FROM inscripciones WHERE id = ?').get(inscripcion.cuerpo.id), 'la inscripción ya está en la base');
  await cliente.delete(`/api/inscripciones/${inscripcion.cuerpo.id}`);
  assert.equal(srv.db.prepare('SELECT id FROM inscripciones WHERE id = ?').get(inscripcion.cuerpo.id), undefined, 'cancelar borra el registro');
});

test('El menú es público, admite búsqueda y responde en /menu', async () => {
  const visitante = crearCliente(srv.base);
  const r = await visitante.get('/api/productos?q=CAPPU');
  assert.equal(r.estado, 200);
  assert.deepEqual(r.cuerpo.productos.map((p) => p.nombre), ['Cappuccino']);
  assert.equal((await visitante.get('/api/productos?q=zzzz')).cuerpo.productos.length, 0);
  const pagina = await fetch(`${srv.base}/menu`);
  assert.equal(pagina.status, 200);
  assert.match(await pagina.text(), /<main id="contenido"/);
});
