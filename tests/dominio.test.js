// Pruebas unitarias de las clases del dominio (sin servidor ni base de datos).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Producto } from '../server/dominio/Producto.js';
import { Carrito } from '../server/dominio/Carrito.js';
import { Pedido } from '../server/dominio/Pedido.js';
import { ClaseBarista } from '../server/dominio/ClaseBarista.js';
import { Inscripcion } from '../server/dominio/Inscripcion.js';
import { Estadisticas } from '../server/dominio/Estadisticas.js';
import { Menu } from '../server/dominio/Menu.js';
import { Usuario } from '../server/dominio/Usuario.js';
import { Cliente } from '../server/dominio/Cliente.js';
import { Administrador } from '../server/dominio/Administrador.js';

const cafe = () => new Producto({ id: 1, nombre: 'Cappuccino', descripcion: 'Café con leche', precio: 3800, categoria: 'Cafés', disponible: true });
const agotado = () => new Producto({ id: 2, nombre: 'Iced latte', descripcion: 'Frío', precio: 4500, categoria: 'Bebidas frías', disponible: false });
const cliente = new Cliente({ id: 7, nombre: 'Ana', email: 'ana@test.com', claveHash: 'scrypt$secreto' });
const admin = new Administrador({ id: 1, nombre: 'Admin', email: 'admin@test.com' });

test('Usuario es abstracta y su JSON nunca incluye la clave', () => {
  assert.throws(() => new Usuario({ id: 1, nombre: 'X', email: 'x@x.com' }), /abstracta/);
  assert.equal(cliente.consultarPerfil(), cliente);
  assert.ok(!JSON.stringify(cliente.aJSON()).includes('secreto'));
  const otro = new Cliente({ id: 8, nombre: 'Ana', email: 'ana2@test.com', fotoPerfil: '/f.jpg' });
  otro.modificarPerfil('Ana María', undefined, 'Calle Falsa 123', '11 5555-0000');
  assert.equal(otro.fotoPerfil, '/f.jpg', 'sin foto nueva se conserva la actual');
  assert.equal(otro.nombre, 'Ana María');
});

test('Carrito: un producto agotado no puede agregarse', () => {
  const carrito = new Carrito();
  assert.throws(() => carrito.agregar(agotado(), 1), (e) => e.codigo === 'PRODUCTO_AGOTADO');
  assert.equal(carrito.estaVacio(), true);
});

test('Carrito: rechaza cantidades inválidas y recalcula el total', () => {
  const carrito = new Carrito();
  for (const invalida of [0, -1, 1.5, 100, 'abc']) {
    assert.throws(() => carrito.agregar(cafe(), invalida), (e) => e.codigo === 'DATOS_INVALIDOS');
  }
  carrito.agregar(cafe(), 2);
  carrito.agregar(cafe(), 1);
  assert.equal(carrito.lineas.length, 1);
  assert.equal(carrito.calcularTotal(), 3 * 3800);
  const linea = carrito.lineas[0];
  carrito.modificarCantidad(linea, 5);
  assert.equal(carrito.calcularTotal(), 5 * 3800);
  assert.throws(() => carrito.modificarCantidad(linea, 0));
  assert.equal(carrito.calcularTotal(), 5 * 3800, 'una modificación inválida no altera el carrito');
  carrito.eliminar(linea);
  assert.equal(carrito.calcularTotal(), 0);
  assert.throws(() => carrito.eliminar(linea), (e) => e.codigo === 'NO_ENCONTRADO');
});

test('Pedido: crea líneas propias que no comparte con el carrito (RN-03)', () => {
  const carrito = new Carrito();
  carrito.agregar(cafe(), 2);
  const aceptadas = [{ productoId: 1, cantidad: 2, precioUnitario: 3800 }];
  const pedido = Pedido.desdeCarrito({ cliente, carrito, aceptadas, fecha: new Date(), claveIdempotencia: 'clave-12345' });
  carrito.lineas[0].cantidad = 9;
  carrito.lineas[0].precioUnitario = 9999;
  assert.equal(pedido.lineas[0].cantidad, 2);
  assert.equal(pedido.lineas[0].precioUnitario, 3800);
  assert.equal(pedido.total, 7600);
  assert.equal(pedido.calcularTotal(), 7600);
  assert.equal(pedido.cliente, cliente);
  assert.equal(pedido.estado, 'RECIBIDO');
  pedido.cambiarEstado('ENTREGADO');
  assert.equal(pedido.estado, 'ENTREGADO');
  assert.throws(() => pedido.cambiarEstado('INVENTADO'), (e) => e.codigo === 'DATOS_INVALIDOS');
});

test('Pedido: rechaza si el resumen aceptado no coincide con los precios vigentes', () => {
  const carrito = new Carrito();
  carrito.agregar(cafe(), 1);
  assert.throws(
    () => Pedido.desdeCarrito({ cliente, carrito, aceptadas: [{ productoId: 1, cantidad: 1, precioUnitario: 3500 }], fecha: new Date(), claveIdempotencia: 'clave-12345' }),
    (e) => e.codigo === 'RESUMEN_DESACTUALIZADO',
  );
});

test('Inscripcion: se puede cancelar con 48 h o más; con menos, no (RN-01)', () => {
  const inicio = new Date('2026-12-10T13:00:00Z');
  const clase = new ClaseBarista({ id: 1, nombre: 'Espresso', descripcion: 'x', docente: 'y', ...ClaseBarista.desdeInicio(inicio), duracion: 60, cupoMaximo: 8 });
  assert.equal(clase.horario, '10:00', 'el horario se expresa en hora de Argentina');
  assert.equal(clase.inicio.toISOString(), inicio.toISOString());
  const inscripcion = () => new Inscripcion({ id: 1, cliente, clase, fechaInscripcion: new Date() });
  const exactamente48 = new Date(inicio.getTime() - 48 * 3600_000);
  const unMinutoTarde = new Date(exactamente48.getTime() + 60_000);
  assert.equal(inscripcion().puedeCancelarse(exactamente48), true);
  assert.equal(inscripcion().puedeCancelarse(new Date(exactamente48.getTime() - 3600_000)), true);
  assert.equal(inscripcion().puedeCancelarse(unMinutoTarde), false);
  assert.throws(() => inscripcion().cancelar(unMinutoTarde), (e) => e.codigo === 'CANCELACION_FUERA_DE_PLAZO');
  // CU-20: cancelar quita la inscripción de la clase (libera el cupo) y del cliente.
  const ana = new Cliente({ id: 9, nombre: 'Ana', email: 'ana2@test.com' });
  const insc = new Inscripcion({ id: 2, cliente: ana, clase, fechaInscripcion: new Date() });
  clase.agregarInscripcion(insc);
  ana.agregarInscripcion(insc);
  insc.cancelar(exactamente48);
  assert.equal(clase.getInscripciones().length, 0);
  assert.equal(ana.consultarMisClases().length, 0);
});

test('ClaseBarista: cupo entre 1 y 8 y no menor a las inscripciones activas (RN-02)', () => {
  const ahora = new Date('2026-11-01T12:00:00Z');
  const datos = { nombre: 'Latte art', descripcion: 'Descripción suficiente', docente: 'Docente', fecha: '2026-12-01', hora: '10:00', duracionMin: 90 };
  const nueva = (cambios) => {
    const clase = new ClaseBarista({});
    clase.actualizarDatos({ ...datos, ...cambios });
    return clase;
  };
  assert.ok('cupo' in ClaseBarista.validar(nueva({ cupo: 9 })));
  assert.ok('cupo' in ClaseBarista.validar(nueva({ cupo: 0 })));
  assert.throws(() => nueva({ fecha: '2026-10-01', cupo: 8 }).exigirFutura(ahora), (e) => 'fecha' in e.campos);
  const clase = nueva({ cupo: '8' });
  assert.deepEqual(ClaseBarista.validar(clase), {});
  assert.equal(clase.cupoMaximo, 8);
  assert.equal(clase.duracion, 90);
  assert.equal(clase.inicio.toISOString(), '2026-12-01T13:00:00.000Z', 'la hora se interpreta en Argentina (UTC-3)');
  const inscribir = (cantidad) => {
    for (let i = 0; i < cantidad; i++) clase.inscripciones.push(new Inscripcion({ cliente: { id: 100 + clase.inscripciones.length }, clase, fechaInscripcion: ahora }));
  };
  inscribir(5);
  assert.equal(clase.inscriptosActivos, 5);
  clase.actualizarDatos({ ...datos, cupo: 4 });
  assert.ok('cupo' in ClaseBarista.validar(clase));
  clase.actualizarDatos({ ...datos, cupo: 8 });
  inscribir(3);
  assert.equal(clase.hayCupo(), false);
  assert.throws(() => clase.exigirInscripcionPosible(ahora), (e) => e.codigo === 'CUPO_COMPLETO');
  assert.equal(clase.getInscripciones().length, 8);
});

test('ClaseBarista: cancelarInscripciones() anula todas y las quita de cada cliente (CU-23)', () => {
  const ahora = new Date('2026-11-01T12:00:00Z');
  const clase = new ClaseBarista({ id: 1, nombre: 'Cata', descripcion: 'x', docente: 'y', ...ClaseBarista.desdeInicio('2026-12-01T13:00:00Z'), duracion: 60, cupoMaximo: 8 });
  const ana = new Cliente({ id: 7, nombre: 'Ana', email: 'a@test.com' });
  const luis = new Cliente({ id: 8, nombre: 'Luis', email: 'l@test.com' });
  for (const c of [ana, luis]) {
    const insc = new Inscripcion({ cliente: c, clase, fechaInscripcion: ahora });
    clase.agregarInscripcion(insc);
    c.agregarInscripcion(insc);
  }
  assert.equal(clase.cancelarInscripciones(), 2);
  assert.equal(clase.cuposDisponibles(), 8);
  assert.equal(ana.consultarMisClases().length, 0);
  assert.equal(luis.consultarMisClases().length, 0);
});

test('Producto y Usuario: actualizan sus datos, alternan disponibilidad y verifican la clave', async () => {
  const producto = new Producto({});
  producto.actualizarDatos({ nombre: 'Mocha', descripcion: 'Café con chocolate', precio: 'abc', categoria: 'Cafés' });
  assert.ok('precio' in Producto.validar(producto));
  producto.actualizarDatos({ nombre: 'Mocha', descripcion: 'Café con chocolate', precio: '4100', categoria: 'Cafés' });
  assert.deepEqual(Producto.validar(producto), {});
  assert.equal(producto.getPrecio(), 4100);
  producto.cambiarDisponibilidad();
  assert.equal(producto.disponible, false);
  producto.cambiarDisponibilidad();
  assert.equal(producto.estaDisponible(), true);
  producto.eliminar();
  assert.equal(producto.estaDisponible(), false);
  const { hashearContrasena } = await import('../server/seguridad.js');
  const ana = new Cliente({ id: 3, nombre: 'Ana', email: 'x@test.com', claveHash: await hashearContrasena('Clave1234') });
  assert.equal(await ana.verificarClave('Clave1234'), true);
  assert.equal(await ana.verificarClave('otra'), false);
  assert.ok(ana.getCarrito() instanceof Carrito, 'el cliente crea su carrito');
  assert.equal(typeof admin.crearProducto, 'undefined', 'Administrador no tiene operaciones propias (Entrega 8)');
});

test('Menu: busca por nombre sin distinguir mayúsculas ni tildes', () => {
  const menu = new Menu([cafe(), agotado(), new Producto({ id: 3, nombre: 'Té helado', descripcion: 'x', precio: 1, categoria: 'Bebidas frías' })]);
  assert.deepEqual(menu.buscarPorNombre('CAPPU').map((p) => p.id), [1]);
  assert.deepEqual(menu.buscarPorNombre('te hel').map((p) => p.id), [3]);
  assert.equal(menu.buscarPorNombre('inexistente').length, 0);
  const nuevo = new Producto({ id: 4, nombre: 'Mocha', descripcion: 'x', precio: 1, categoria: 'Cafés' });
  menu.agregar(nuevo);
  assert.equal(menu.buscarPorId(4), nuevo);
  menu.eliminar(nuevo);
  assert.equal(menu.buscarPorId(4), null);
});

test('Estadisticas: usa precios históricos y contempla períodos sin ventas', () => {
  const linea = (id, nombre, cantidad, precioUnitario) => ({ producto: { id, nombre }, cantidad, precioUnitario, subtotal: () => cantidad * precioUnitario });
  const pedido = (fecha, lineas) => ({ fecha, lineas, calcularTotal: () => lineas.reduce((s, l) => s + l.subtotal(), 0) });
  const desde = new Date('2026-10-01T03:00:00Z');
  const hasta = new Date('2026-11-01T03:00:00Z');
  const e = new Estadisticas([pedido('2026-10-05T12:00:00Z', [linea(1, 'A', 2, 100), linea(2, 'B', 1, 500)]), pedido('2026-10-20T12:00:00Z', [linea(1, 'A', 3, 120)])]);
  assert.equal(e.calcularIngresos(desde, hasta), 200 + 500 + 360);
  assert.equal(e.cantidadVentas(desde, hasta), 2);
  assert.equal(e.cantidadVentas(hasta, new Date('2026-12-01T03:00:00Z')), 0, 'fuera del período no cuenta');
  assert.deepEqual(e.productosMasVendidos(desde, hasta, 5).map((p) => [p.nombre, p.unidades]), [['A', 5], ['B', 1]]);
  const vacia = new Estadisticas([]).aJSON(desde, hasta);
  assert.equal(vacia.importeTotal, 0);
  assert.equal(vacia.cantidadVentas, 0);
  assert.deepEqual(vacia.productosMasVendidos, []);
});
