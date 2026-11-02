// DATOS DE DEMOSTRACIÓN. Productos, precios, docentes, clientes y pedidos son ficticios.
// Se cargan automáticamente si la base está vacía (SEED_DEMO=true) o con: npm run db:demo
// (ese comando BORRA los datos existentes y vuelve a cargar la demostración).
import { pathToFileURL } from 'node:url';
import { hashearContrasena } from '../seguridad.js';
import { DESFASE_ARGENTINA } from '../config.js';

export const CREDENCIALES_DEMO = {
  administrador: { email: 'admin@lately.demo', password: 'Admin1234' },
  cliente: { email: 'cliente@lately.demo', password: 'Cliente1234' },
};

const PRODUCTOS = [
  ['Cortado', 'Espresso doble cortado con un toque de leche texturizada.', 3200, 'Cafés', 'cortado.jpg', 1],
  ['Americano', 'Espresso alargado con agua caliente, suave y aromático.', 3000, 'Cafés', 'americano.jpg', 1],
  ['Cappuccino', 'Espresso, leche texturizada y una capa de espuma sedosa.', 3800, 'Cafés', 'cappuccino.jpg', 1],
  ['Flat white', 'Doble ristretto con leche microespumada, intenso y cremoso.', 4000, 'Cafés', 'flat-white.jpg', 1],
  ['Latte', 'Espresso con abundante leche y una fina capa de espuma.', 3900, 'Cafés', 'latte.jpg', 1],
  ['Filtrado V60', 'Café de origen preparado en V60. Consultá el grano del día.', 4200, 'Cafés', 'filtrado-v60.jpg', 1],
  ['Cold brew', 'Café extraído en frío durante 18 horas, servido con hielo.', 4300, 'Bebidas frías', 'cold-brew.jpg', 1],
  ['Iced latte', 'Espresso doble, leche fría y hielo.', 4500, 'Bebidas frías', 'iced-latte.jpg', 0],
  ['Té helado de limón', 'Té negro frío con limón y un toque de menta.', 3500, 'Bebidas frías', 'te-helado.jpg', 1],
  ['Jugo de naranja', 'Naranjas exprimidas en el momento.', 3700, 'Bebidas frías', 'jugo-naranja.jpg', 0],
  ['Medialuna de manteca', 'Medialuna hojaldrada horneada en el día.', 1500, 'Pastelería', 'medialuna.jpg', 1],
  ['Cookie con chips', 'Cookie de manteca con chips de chocolate semiamargo.', 2200, 'Pastelería', 'cookie.jpg', 1],
  ['Torta de chocolate', 'Porción de torta húmeda de chocolate con ganache.', 4800, 'Pastelería', 'torta-chocolate.jpg', 0],
];

// Precios "anteriores" usados en pedidos viejos, para mostrar RN-03 (precios históricos).
const PRECIOS_ANTERIORES = { Cortado: 2900, Cappuccino: 3500, Latte: 3600, 'Medialuna de manteca': 1300, 'Cold brew': 3900 };

const CLASES = [
  { nombre: 'Introducción al espresso', dias: 10, hora: '10:00', duracion: 120, cupo: 8, docente: 'Martina R. (docente de demostración)', imagen: 'espresso.jpg',
    descripcion: 'Molienda, dosis, tiempos de extracción y calibración básica de la máquina. Ideal para empezar desde cero.' },
  { nombre: 'Latte art: primeros diseños', dias: 1, hora: '19:00', duracion: 150, cupo: 8, docente: 'Joaquín P. (docente de demostración)', imagen: 'latte-art.jpg',
    descripcion: 'Texturizado de leche y vertido para lograr corazón y tulipán. Comienza en menos de 48 horas: su inscripción de ejemplo ya no puede cancelarse.' },
  { nombre: 'Métodos de filtrado', dias: 14, hora: '17:00', duracion: 120, cupo: 8, docente: 'Martina R. (docente de demostración)', imagen: 'filtrado.jpg',
    descripcion: 'V60, Chemex y prensa francesa: variables de preparación y cómo influyen en la taza. Clase de ejemplo completa.' },
  { nombre: 'Cata y perfiles de tueste', dias: 21, hora: '11:00', duracion: 90, cupo: 6, docente: 'Lucas M. (docente de demostración)', imagen: 'cata.jpg',
    descripcion: 'Aprendé a reconocer acidez, dulzor y cuerpo comparando cafés de distintos orígenes y tuestes.' },
];

export function baseVacia(db) {
  return db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n === 0;
}

function enArgentina(instante, hora) {
  const fecha = new Date(instante.getTime() - 3 * 3600_000).toISOString().slice(0, 10);
  return new Date(`${fecha}T${hora}:00${DESFASE_ARGENTINA}`);
}

export async function cargarDatosDemo(db) {
  const ahora = new Date();
  const iso = (fecha) => fecha.toISOString();
  const hashAdmin = await hashearContrasena(CREDENCIALES_DEMO.administrador.password);
  const hashCliente = await hashearContrasena(CREDENCIALES_DEMO.cliente.password);

  db.exec('BEGIN IMMEDIATE');
  try {
    const insertarUsuario = db.prepare(`INSERT INTO usuarios (tipo, nombre, email, password_hash, direccion, telefono, creado_en)
      VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`);
    insertarUsuario.get('ADMINISTRADOR', 'Administración Lately (demo)', CREDENCIALES_DEMO.administrador.email, hashAdmin, null, null, iso(ahora));
    const clientePrincipal = insertarUsuario.get('CLIENTE', 'Lucía Demo', CREDENCIALES_DEMO.cliente.email, hashCliente,
      'Calle Ficticia 123 (dato de demostración)', '11 5555-0000', iso(ahora)).id;
    const otrosClientes = [];
    for (let i = 2; i <= 9; i += 1) {
      otrosClientes.push(insertarUsuario.get('CLIENTE', `Cliente demo ${i}`, `cliente${i}@lately.demo`, hashCliente, null, null, iso(ahora)).id);
    }

    const insertarProducto = db.prepare(`INSERT INTO productos (nombre, descripcion, precio, categoria, imagen, disponible, creado_en, actualizado_en)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`);
    const productos = new Map();
    for (const [nombre, descripcion, precio, categoria, imagen, disponible] of PRODUCTOS) {
      const { id } = insertarProducto.get(nombre, descripcion, precio, categoria, `/img/productos/${imagen}`, disponible, iso(ahora), iso(ahora));
      productos.set(nombre, { id, precio });
    }

    // Pedidos de ejemplo distribuidos en los últimos 45 días.
    const insertarPedido = db.prepare(`INSERT INTO pedidos (cliente_id, fecha, estado, importe_total, clave_idempotencia, cliente_nombre, cliente_email, cliente_telefono, cliente_direccion)
      VALUES (?, ?, 'RECIBIDO', ?, ?, ?, ?, ?, ?) RETURNING id`);
    const insertarLinea = db.prepare('INSERT INTO pedido_lineas (pedido_id, producto_id, nombre_producto, cantidad, precio_unitario) VALUES (?, ?, ?, ?, ?)');
    const pedidosDemo = [
      { cliente: clientePrincipal, dias: 40, items: [['Cappuccino', 2], ['Medialuna de manteca', 3]], anteriores: true },
      { cliente: clientePrincipal, dias: 18, items: [['Latte', 1], ['Cookie con chips', 1]], anteriores: true },
      { cliente: clientePrincipal, dias: 3, items: [['Flat white', 1], ['Cold brew', 1], ['Torta de chocolate', 1]] },
      { cliente: otrosClientes[0], dias: 25, items: [['Cortado', 2], ['Medialuna de manteca', 2]], anteriores: true },
      { cliente: otrosClientes[1], dias: 12, items: [['Cappuccino', 1], ['Medialuna de manteca', 1]] },
      { cliente: otrosClientes[2], dias: 9, items: [['Americano', 2], ['Cookie con chips', 2]] },
      { cliente: otrosClientes[3], dias: 6, items: [['Iced latte', 2]] },
      { cliente: otrosClientes[4], dias: 2, items: [['Cappuccino', 2], ['Cortado', 1], ['Medialuna de manteca', 4]] },
      { cliente: otrosClientes[5], dias: 1, items: [['Filtrado V60', 1], ['Cookie con chips', 1]] },
    ];
    const datosCliente = db.prepare('SELECT nombre, email, telefono, direccion FROM usuarios WHERE id = ?');
    pedidosDemo.forEach((pedido, indice) => {
      const lineas = pedido.items.map(([nombre, cantidad]) => {
        const producto = productos.get(nombre);
        const precio = pedido.anteriores && PRECIOS_ANTERIORES[nombre] ? PRECIOS_ANTERIORES[nombre] : producto.precio;
        return { id: producto.id, nombre, cantidad, precio };
      });
      const total = lineas.reduce((suma, l) => suma + l.cantidad * l.precio, 0);
      const fecha = new Date(enArgentina(new Date(ahora.getTime() - pedido.dias * 86400_000), '09:30').getTime() + indice * 37 * 60_000);
      const c = datosCliente.get(pedido.cliente);
      const { id } = insertarPedido.get(pedido.cliente, iso(fecha), total, `demo-${indice + 1}-pedido`, c.nombre, c.email, c.telefono, c.direccion);
      for (const l of lineas) insertarLinea.run(id, l.id, l.nombre, l.cantidad, l.precio);
    });

    // Clases relativas a la fecha de carga; inscripciones de ejemplo.
    const insertarClase = db.prepare(`INSERT INTO clases (nombre, descripcion, docente, inicio, duracion_min, cupo, imagen, creado_en)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`);
    const insertarInscripcion = db.prepare(`INSERT INTO inscripciones (clase_id, cliente_id, creada_en) VALUES (?, ?, ?)`);
    const clases = CLASES.map((clase) => {
      const inicio = enArgentina(new Date(ahora.getTime() + clase.dias * 86400_000), clase.hora);
      return insertarClase.get(clase.nombre, clase.descripcion, clase.docente, iso(inicio), clase.duracion, clase.cupo,
        `/img/clases/${clase.imagen}`, iso(ahora)).id;
    });
    const [espresso, latteArt, filtrado] = clases;
    insertarInscripcion.run(espresso, clientePrincipal, iso(ahora));
    insertarInscripcion.run(espresso, otrosClientes[0], iso(ahora));
    insertarInscripcion.run(latteArt, clientePrincipal, iso(ahora));
    insertarInscripcion.run(latteArt, otrosClientes[1], iso(ahora));
    insertarInscripcion.run(latteArt, otrosClientes[2], iso(ahora));
    for (const cliente of otrosClientes) insertarInscripcion.run(filtrado, cliente, iso(ahora));

    // Carrito de ejemplo del cliente principal.
    db.prepare('INSERT INTO carrito_lineas (cliente_id, producto_id, cantidad, agregado_en) VALUES (?, ?, ?, ?)')
      .run(clientePrincipal, productos.get('Cappuccino').id, 1, iso(ahora));

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function borrarDatos(db) {
  db.exec(`BEGIN IMMEDIATE;
    DELETE FROM sesiones; DELETE FROM carrito_lineas; DELETE FROM pedido_lineas; DELETE FROM pedidos;
    DELETE FROM inscripciones; DELETE FROM clases; DELETE FROM productos; DELETE FROM usuarios;
    DELETE FROM sqlite_sequence;
    COMMIT;`);
}

// Ejecución directa: npm run db:demo
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { config } = await import('../config.js');
  const { abrirBaseDatos, migrar } = await import('./baseDatos.js');
  // Este comando borra todo: en producción exige confirmación explícita.
  if (config.produccion && !process.argv.includes('--borrar-produccion')) {
    console.error('Bloqueado: NODE_ENV=production. `npm run db:demo` BORRA todos los datos reales.');
    console.error('Si de verdad querés hacerlo: npm run db:demo -- --borrar-produccion');
    process.exit(1);
  }
  const db = abrirBaseDatos(config.rutaBaseDatos);
  migrar(db);
  borrarDatos(db);
  await cargarDatosDemo(db);
  db.close();
  console.log('Datos de demostración cargados.');
  console.log(`  Administrador: ${CREDENCIALES_DEMO.administrador.email} / ${CREDENCIALES_DEMO.administrador.password}`);
  console.log(`  Cliente:       ${CREDENCIALES_DEMO.cliente.email} / ${CREDENCIALES_DEMO.cliente.password}`);
  console.log('Si el servidor está en marcha, reinicialo para que cargue los datos nuevos.');
}
