// API REST. Cada ruta corresponde a un evento de una vista de la Entrega 7: delega en el
// método del Gestor de ese caso de uso y convierte a JSON los objetos del dominio que devuelve.
// Ninguna accede a la base directamente ni aplica reglas de negocio.
import { Router } from 'express';
import { errores } from '../dominio/errores.js';
import {
  COOKIE_SESION, opcionesCookie, requiereSesion, requiereAdministrador,
  limitarIntentos, subidaImagen, guardarImagen,
} from './middlewares.js';
import { CATEGORIAS } from '../config.js';
import { Producto } from '../dominio/Producto.js';
import { ClaseBarista } from '../dominio/ClaseBarista.js';

const aBooleano = (valor) => (valor === true || valor === 'true' ? true : valor === false || valor === 'false' ? false : undefined);

// ---------- Conversión a JSON ----------

// El Gestor devuelve el carrito con su total (mensaje calcularTotal() de las secuencias).
const carritoConTotal = ({ carrito, total }) => ({ ...carrito.aJSON(), total });

const cantidadProductos = (lineas) => lineas.reduce((suma, linea) => suma + linea.cantidad, 0);

function resumenPedido(pedido) {
  const { lineas, cliente: _datos, ...resumen } = pedido.aJSON();
  return { ...resumen, cantidadProductos: cantidadProductos(lineas) };
}

function inscripto(inscripcion) {
  const { cliente } = inscripcion;
  return { id: inscripcion.id, inscriptoEn: inscripcion.fechaInscripcion, nombre: cliente.nombre, email: cliente.email, telefono: cliente.telefono ?? null };
}

export function crearRutas({ gestor, config }) {
  const api = Router();
  const cookie = opcionesCookie(config);
  const limiteAcceso = limitarIntentos({ maximo: config.produccion ? 10 : 100, ventanaMs: 15 * 60 * 1000 });
  const iniciar = (res, usuario) => {
    res.cookie(COOKIE_SESION, gestor.abrirSesion(usuario), cookie);
    return { usuario: usuario.aJSON() };
  };
  const menu = (productos) => ({ categorias: gestor.consultarCategorias(), productos: productos.map((producto) => producto.aJSON()) });

  api.get('/salud', (_req, res) => res.json({ estado: 'ok', hora: new Date().toISOString() }));

  // ---------- Sesión (CU-01, CU-02, CU-03) ----------
  // CU-01 Registro de usuario (secuencia 4.1) → mensaje 1: gestor.registrarCliente(...)
  api.post('/auth/registro', limiteAcceso, async (req, res) => {
    const { nombre, email, password, confirmacion } = req.body ?? {};
    res.status(201).json(iniciar(res, await gestor.registrarCliente(nombre, email, password, confirmacion)));
  });

  // CU-02 Inicio de sesión (secuencia 4.2) → mensaje 1: gestor.iniciarSesion(email, clave)
  api.post('/auth/ingreso', limiteAcceso, async (req, res) => {
    const { email, password } = req.body ?? {};
    res.json(iniciar(res, await gestor.iniciarSesion(email, password)));
  });

  // CU-03 Cerrar sesión (secuencia 4.3) → mensaje 1: gestor.cerrarSesion(usuario)
  api.post('/auth/salida', (req, res) => {
    gestor.cerrarSesion(req.usuario, req.tokenSesion);
    res.clearCookie(COOKIE_SESION, { ...cookie, maxAge: undefined });
    res.json({ ok: true });
  });

  api.get('/auth/sesion', (req, res) => res.json({ usuario: req.usuario ? req.usuario.aJSON() : null }));

  // ---------- Perfil (CU-04, CU-05) ----------
  // CU-04 Consultar perfil (secuencia 4.4) → mensaje 1: gestor.consultarPerfil(usuario)
  api.get('/perfil', requiereSesion, (req, res) => res.json(gestor.consultarPerfil(req.usuario).aJSON()));

  // CU-05 Modificar perfil (secuencia 4.5) → mensaje 1: gestor.modificarPerfil(usuario, nombre, foto, direccion, telefono)
  api.put('/perfil', requiereSesion, subidaImagen('foto'), (req, res) => {
    const { nombre, direccion, telefono, quitarFoto } = req.body ?? {};
    let foto = guardarImagen(req.file, config.directorioSubidas, 'foto');
    if (foto === undefined && aBooleano(quitarFoto)) foto = null;
    res.json(gestor.modificarPerfil(req.usuario, nombre, foto, direccion, telefono).aJSON());
  });

  // ---------- Menú, público (CU-07, CU-08) ----------
  // CU-07 Consultar menú (secuencia 4.7) → mensaje 1: gestor.consultarMenu()
  // CU-08 Buscar productos (secuencia 4.8) → mensaje 1: gestor.buscarProducto(texto), si hay texto de búsqueda
  api.get('/productos', (req, res) => {
    const texto = String(req.query.q ?? '').trim().slice(0, 80);
    res.json(menu(texto ? gestor.buscarProducto(texto) : gestor.consultarMenu()));
  });
  api.get('/categorias', (_req, res) => res.json(CATEGORIAS));

  // ---------- Carrito (CU-13, CU-14, CU-15) ----------
  // CU-14 Consultar carrito (secuencia 4.14) y mensaje 1 del CU-16 → gestor.consultarCarrito(cliente)
  api.get('/carrito', (req, res) => res.json(carritoConTotal(gestor.consultarCarrito(req.usuario))));
  // CU-13 Agregar producto al carrito (secuencia 4.13) → mensaje 1: gestor.agregarAlCarrito(cliente, prod, cant)
  api.post('/carrito/lineas', (req, res) => {
    const { productoId, cantidad } = req.body ?? {};
    gestor.exigirCliente(req.usuario);
    res.status(201).json(carritoConTotal(gestor.agregarAlCarrito(req.usuario, gestor.obtenerProducto(productoId), cantidad)));
  });
  // CU-15 Modificar carrito (secuencia 4.15) → mensaje 1: gestor.modificarCarrito(cliente, linea, cant)
  api.patch('/carrito/lineas/:productoId', (req, res) => {
    const linea = gestor.obtenerLinea(req.usuario, req.params.productoId);
    res.json(carritoConTotal(gestor.modificarCarrito(req.usuario, linea, req.body?.cantidad)));
  });
  // CU-15 Modificar carrito (secuencia 4.15) → mensaje 2: gestor.eliminarDelCarrito(cliente, linea)
  api.delete('/carrito/lineas/:productoId', (req, res) => {
    const linea = gestor.obtenerLinea(req.usuario, req.params.productoId);
    res.json(carritoConTotal(gestor.eliminarDelCarrito(req.usuario, linea)));
  });

  // ---------- Pedidos (CU-16, CU-06) ----------
  // CU-16 Realizar pedido (secuencia 4.16) → mensaje 2: gestor.confirmarPedido(cliente)
  api.post('/pedidos', (req, res) => {
    const { claveIdempotencia, lineasAceptadas } = req.body ?? {};
    const repetido = Boolean(gestor.buscarPedidoConfirmado(req.usuario, claveIdempotencia));
    const pedido = gestor.confirmarPedido(req.usuario, claveIdempotencia, lineasAceptadas);
    res.status(repetido ? 200 : 201).json({ pedido: pedido.aJSON(), repetido });
  });
  // CU-06 Consultar historial (secuencia 4.6) → mensaje 1: gestor.consultarHistorial(cliente)
  api.get('/pedidos', (req, res) => res.json(gestor.consultarHistorial(req.usuario).map(resumenPedido)));
  // CU-06: detalle de un pedido del historial
  api.get('/pedidos/:id', (req, res) => res.json(gestor.consultarPedido(req.usuario, req.params.id).aJSON()));

  // ---------- Clases (CU-18, CU-19, CU-20) ----------
  // CU-18 Consultar clases disponibles (secuencia 4.18) → mensaje 1: gestor.consultarClases()
  api.get('/clases', (req, res) => {
    const cliente = req.usuario?.esCliente() ? req.usuario : null;
    res.json(gestor.consultarClases().map(({ clase, cupos }) => ({ ...clase.aJSON(), cuposDisponibles: cupos, inscripto: Boolean(cliente && clase.inscripcionDe(cliente)) })));
  });
  // CU-19 Inscribirse a una clase (secuencia 4.19) → mensaje 1: gestor.inscribir(cliente, clase)
  api.post('/clases/:id/inscripciones', requiereSesion, (req, res) => {
    const inscripcion = gestor.inscribir(req.usuario, gestor.obtenerClase(req.params.id));
    res.status(201).json(inscripcion.aJSON(gestor.ahora()));
  });
  // CU-20 Cancelar inscripción (secuencia 4.20) → mensaje 1: gestor.consultarMisClases(cliente)
  api.get('/inscripciones', (req, res) => {
    const ahora = gestor.ahora();
    res.json(gestor.consultarMisClases(req.usuario).map((inscripcion) => inscripcion.aJSON(ahora)));
  });
  // CU-20 Cancelar inscripción (secuencia 4.20) → mensaje 2: gestor.cancelarInscripcion(insc)
  api.delete('/inscripciones/:id', (req, res) => {
    const inscripcion = gestor.obtenerInscripcion(req.usuario, req.params.id);
    gestor.cancelarInscripcion(inscripcion);
    res.json({ ok: true, cancelada: inscripcion.id });
  });

  // ---------- Administración (pestañas Productos, Clases y Estadísticas de la Entrega 7) ----------
  // requiereAdministrador aplica tienePermisoAdmin a toda la sección (transición A15).
  const admin = Router();
  admin.use(requiereAdministrador);

  // CU-09 a CU-12.
  // Listado de la pestaña Productos del panel (usa consultarMenu, CU-07)
  admin.get('/productos', (req, res) => res.json(gestor.consultarMenu().map((producto) => producto.aJSON())));
  // CU-09 Crear producto (secuencia 4.9) → mensaje 1: gestor.crearProducto(admin, prod)
  admin.post('/productos', subidaImagen('imagen'), (req, res) => {
    const datos = { ...req.body, disponible: aBooleano(req.body?.disponible) ?? true, imagen: guardarImagen(req.file, config.directorioSubidas, 'imagen') };
    // «create» Producto con los datos del formulario; después, mensaje 1 del CU-09.
    const prod = new Producto({});
    prod.actualizarDatos(datos);
    res.status(201).json(gestor.crearProducto(req.usuario, prod).aJSON());
  });
  // CU-11 Modificar producto (secuencia 4.11) → mensaje 1: gestor.modificarProducto(admin, prod, datos)
  admin.put('/productos/:id', subidaImagen('imagen'), (req, res) => {
    const datos = { ...req.body, disponible: aBooleano(req.body?.disponible), imagen: guardarImagen(req.file, config.directorioSubidas, 'imagen') };
    res.json(gestor.modificarProducto(req.usuario, gestor.obtenerProducto(req.params.id), datos).aJSON());
  });
  // CU-10 Modificar disponibilidad (secuencia 4.10) → mensaje 1: gestor.cambiarDisponibilidad(admin, prod)
  // (la pantalla envía el estado elegido; si el producto ya lo tiene, no cambia nada)
  admin.patch('/productos/:id/disponibilidad', (req, res) => {
    const disponible = aBooleano(req.body?.disponible);
    if (typeof disponible !== 'boolean') throw errores.validacion({ disponible: 'Indicá disponible o agotado.' });
    const prod = gestor.obtenerProducto(req.params.id);
    res.json((prod.disponible === disponible ? prod : gestor.cambiarDisponibilidad(req.usuario, prod)).aJSON());
  });
  // CU-12 Eliminar producto (secuencia 4.12) → mensaje 1: gestor.eliminarProducto(admin, prod)
  admin.delete('/productos/:id', (req, res) => {
    gestor.eliminarProducto(req.usuario, gestor.obtenerProducto(req.params.id));
    res.json({ ok: true });
  });

  // CU-21 a CU-24.
  // Listado de la pestaña Clases del panel
  admin.get('/clases', (req, res) => {
    const ahora = gestor.ahora();
    res.json(gestor.consultarClasesAdmin(req.usuario).map((clase) => ({ ...clase.aJSON(), finalizada: clase.haComenzado(ahora) })));
  });
  // CU-21 Crear clase (secuencia 4.21) → mensaje 1: gestor.crearClase(admin, clase)
  admin.post('/clases', subidaImagen('imagen'), (req, res) => {
    const datos = { ...req.body, imagen: guardarImagen(req.file, config.directorioSubidas, 'imagen') };
    // «create» ClaseBarista con los datos del formulario; después, mensaje 1 del CU-21.
    const clase = new ClaseBarista({});
    clase.actualizarDatos(datos);
    res.status(201).json(gestor.crearClase(req.usuario, clase).aJSON());
  });
  // CU-22 Modificar clase (secuencia 4.22) → mensaje 1: gestor.modificarClase(admin, clase, datos)
  admin.put('/clases/:id', subidaImagen('imagen'), (req, res) => {
    const datos = { ...req.body, imagen: guardarImagen(req.file, config.directorioSubidas, 'imagen') };
    res.json(gestor.modificarClase(req.usuario, gestor.obtenerClase(req.params.id), datos).aJSON());
  });
  // CU-23 Eliminar clase (secuencia 4.23) → mensaje 1: gestor.eliminarClase(admin, clase)
  admin.delete('/clases/:id', (req, res) => res.json({ inscripcionesCanceladas: gestor.eliminarClase(req.usuario, gestor.obtenerClase(req.params.id)) }));
  // CU-24 Consultar inscriptos (secuencia 4.24) → mensaje 1: gestor.consultarInscriptos(admin, clase)
  admin.get('/clases/:id/inscriptos', (req, res) => {
    const clase = gestor.obtenerClase(req.params.id);
    const inscriptos = gestor.consultarInscriptos(req.usuario, clase);
    res.json({ clase: clase.aJSON(), inscriptos: inscriptos.map(inscripto) });
  });

  // CU-17.
  // CU-17 Consultar estadísticas (secuencia 4.17) → mensaje 1: gestor.consultarEstadisticas(desde, hasta)
  admin.get('/estadisticas', (req, res) => {
    const { desde, hasta, ingresos, ventas, masVendidos } = gestor.consultarEstadisticas(req.query.desde, req.query.hasta);
    res.json({
      desde, hasta, importeTotal: ingresos, cantidadVentas: ventas,
      ticketPromedio: ventas ? Math.round(ingresos / ventas) : 0, productosMasVendidos: masVendidos,
    });
  });

  api.use('/admin', admin);
  api.use((_req, res) => res.status(404).json({ error: { codigo: 'NO_ENCONTRADO', mensaje: 'Ruta de API inexistente.' } }));
  return api;
}
