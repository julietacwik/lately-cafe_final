// Gestor: controlador y fachada del sistema (diagrama de clases vigente, Entrega 8).
// Tiene un método por cada caso de uso de la Entrega 2, con los mismos nombres del diagrama,
// y cada uno sigue la secuencia de mensajes de las Entregas 6 y 8. Los métodos auxiliares
// (exigirSesion, obtenerX, periodo, abrirSesion...) son detalles de implementación.
// Es la única puerta de entrada de la capa HTTP al dominio. Cada operación verifica
// sesión, rol y pertenencia de los datos aquí, en el servidor.
//
// Como en el diagrama de clases, el Gestor tiene las listas de usuarios, clases y pedidos,
// y el menú. cargarTodo() las llena desde Persistencia al arrancar; las consultas leen de
// estas listas. Cada cambio se aplica en la lista y se guarda en la base en ese mismo
// momento (ver guardar()), así que un reinicio o un corte no pierden datos.
// Los métodos devuelven objetos del dominio; la capa HTTP los convierte a JSON.
import { Menu } from './dominio/Menu.js';
import { Cliente } from './dominio/Cliente.js';
import { Producto } from './dominio/Producto.js';
import { Pedido } from './dominio/Pedido.js';
import { ClaseBarista } from './dominio/ClaseBarista.js';
import { Inscripcion } from './dominio/Inscripcion.js';
import { Estadisticas } from './dominio/Estadisticas.js';
import { errores, ErrorNegocio } from './dominio/errores.js';
import * as v from './dominio/validaciones.js';
import { hashearContrasena, verificarContrasena, generarToken, hashToken, HASH_FICTICIO } from './seguridad.js';
import { DESFASE_ARGENTINA } from './config.js';

const MS_POR_DIA = 24 * 60 * 60 * 1000;
const MAX_DIAS_ESTADISTICAS = 366 * 3;

export class Gestor {
  constructor(persistencia, { diasSesion = 7, reloj = () => new Date() } = {}) {
    this.persistencia = persistencia;
    this.diasSesion = diasSesion;
    this.ahora = reloj;
    this.usuarios = [];
    this.clases = [];
    this.pedidos = [];
    this.menu = new Menu([]);
    this.cargarTodo();
  }

  // ---------- Listas y guardado ----------

  // Llena las listas desde la base y vincula los objetos entre sí: las líneas de cada
  // carrito apuntan a los productos del menú, y pedidos e inscripciones a su Cliente.
  cargarTodo() {
    this.menu = new Menu(this.persistencia.cargarProductos());
    this.usuarios = this.persistencia.cargarUsuarios();
    this.clases = this.persistencia.cargarClases();
    this.pedidos = this.persistencia.cargarPedidos();

    const clientes = new Map(this.clientes().map((cliente) => [cliente.id, cliente]));
    for (const cliente of clientes.values()) {
      for (const linea of cliente.carrito.lineas) linea.producto = this.menu.buscarPorId(linea.producto.id) ?? linea.producto;
    }
    for (const pedido of this.pedidos) {
      const cliente = clientes.get(pedido.cliente.id);
      if (!cliente) continue;
      pedido.cliente = cliente;
      cliente.pedidos.push(pedido);
    }
    for (const clase of this.clases) {
      for (const inscripcion of clase.inscripciones) {
        const cliente = clientes.get(inscripcion.cliente.id);
        if (!cliente) continue;
        inscripcion.cliente = cliente;
        cliente.inscripciones.push(inscripcion);
      }
    }
  }

  // Guarda las listas completas. Cada operación ya guarda lo que cambia; esto se usa
  // al apagar el servidor como resguardo final.
  guardarTodo() {
    this.persistencia.enTransaccion(() => {
      this.persistencia.guardarUsuarios(this.usuarios);
      this.persistencia.guardarProductos(this.menu.consultar());
      this.persistencia.guardarPedidos(this.pedidos);
      this.persistencia.guardarClases(this.clases);
    });
  }

  // Aplica un cambio en las listas y lo guarda en la base dentro de una misma transacción.
  // Si algo falla (una regla del dominio o la base), la transacción se deshace y las
  // listas se recargan, así memoria y base vuelven a coincidir.
  guardar(operacion) {
    try {
      return this.persistencia.enTransaccion(operacion);
    } catch (error) {
      this.cargarTodo();
      throw error;
    }
  }

  clientes() {
    return this.usuarios.filter((usuario) => usuario.esCliente());
  }

  buscarUsuario(id) {
    return this.usuarios.find((usuario) => usuario.id === id) ?? null;
  }

  buscarUsuarioPorEmail(email) {
    return this.usuarios.find((usuario) => usuario.email.toLowerCase() === email) ?? null;
  }

  // ---------- Control de acceso ----------

  exigirSesion(usuario) {
    if (!usuario) throw errores.noAutenticado();
    return usuario;
  }

  exigirCliente(usuario) {
    this.exigirSesion(usuario);
    if (!usuario.esCliente()) throw errores.prohibido('Esta función es para clientes. Las cuentas de administración no realizan pedidos ni inscripciones.');
    return usuario;
  }

  tienePermisoAdmin(usuario) {
    return Boolean(usuario?.esAdministrador());
  }

  // ======================================================================================
  // Un método por caso de uso. Cada uno sigue, en orden, los mensajes de su diagrama de
  // secuencia de la Entrega 8 (CU-16 y CU-20 también en la Entrega 6). El número entre
  // paréntesis es el número del mensaje en el diagrama. Lo marcado como «validación»
  // corresponde a las alternativas de datos inválidos del CU (Entrega 2).
  // ======================================================================================

  // ---------- CU-01 Registro de usuario (secuencia 4.1) ----------
  async registrarCliente(nombre, email, clave, confirmacion) {
    // alt «datos inválidos» (4a)
    const campos = v.soloErrores({
      nombre: v.texto(nombre, { nombre: 'tu nombre', min: 2, max: 80 }),
      email: v.email(email),
      password: v.contrasena(clave),
      confirmacion: clave && confirmacion !== clave ? 'Las contraseñas no coinciden.' : null,
    });
    if (Object.keys(campos).length) throw errores.validacion(campos);
    const correo = v.limpiar(email).toLowerCase();

    // 1.1: buscarUsuarioPorEmail(email) → alt «email ya registrado» (4b)
    if (this.buscarUsuarioPorEmail(correo)) throw emailRegistrado();

    // 1.2: «create» Cliente(nombre, email, clave). La clave se guarda como hash (claveHash).
    //      1.2.1: el Cliente crea su Carrito en su constructor (patrón Creador).
    const claveHash = await hashearContrasena(clave);
    if (this.buscarUsuarioPorEmail(correo)) throw emailRegistrado(); // por si se registró mientras se calculaba el hash
    const cliente = new Cliente({ nombre: v.limpiar(nombre), email: correo, claveHash });

    this.guardar(() => {
      this.usuarios.push(cliente);
      // 1.3: guardarUsuarios(usuarios)
      this.persistencia.guardarUsuarios([cliente]);
    });
    return cliente;
  }

  // ---------- CU-02 Inicio de sesión (secuencia 4.2) ----------
  async iniciarSesion(email, clave) {
    const campos = v.soloErrores({
      email: v.email(email),
      password: typeof clave === 'string' && clave ? null : 'Ingresá tu contraseña.',
    });
    if (Object.keys(campos).length) throw errores.validacion(campos);

    // 1.1: buscarUsuarioPorEmail(email)
    const usuario = this.buscarUsuarioPorEmail(v.limpiar(email).toLowerCase());

    // opt [existe un usuario con ese email] 1.2: usuario.verificarClave(clave)
    // (si no existe se verifica contra un hash ficticio, para no revelar qué correos están registrados)
    const valida = usuario ? await usuario.verificarClave(clave) : await verificarContrasena(clave, HASH_FICTICIO);

    // alt «credenciales inválidas» (4a)
    if (!usuario || !valida) {
      throw new ErrorNegocio(401, 'CREDENCIALES_INCORRECTAS', 'El correo o la contraseña no son correctos.');
    }
    // 2: tienePermisoAdmin(usuario) lo pregunta la vista para decidir si abre el panel administrativo.
    return usuario;
  }

  // Devuelve el token de la cookie; en la base se guarda solo su hash.
  abrirSesion(usuario) {
    const token = generarToken();
    const creadaEn = this.ahora();
    this.persistencia.guardarSesion({
      tokenHash: hashToken(token),
      usuarioId: usuario.id,
      creadaEn,
      expiraEn: new Date(creadaEn.getTime() + this.diasSesion * MS_POR_DIA),
    });
    return token;
  }

  usuarioDeSesion(token) {
    if (!token) return null;
    return this.buscarUsuario(this.persistencia.buscarUsuarioIdDeSesion(hashToken(token), this.ahora()));
  }

  // ---------- CU-03 Cerrar sesión (secuencia 4.3) ----------
  // 1: cerrarSesion(usuario). Cierra la sesión de este dispositivo ("token").
  cerrarSesion(usuario, token) {
    if (usuario && token) this.persistencia.eliminarSesion(hashToken(token));
  }

  limpiarSesionesVencidas() {
    this.persistencia.eliminarSesionesVencidas(this.ahora());
  }

  // ---------- CU-04 Consultar perfil (secuencia 4.4) ----------
  consultarPerfil(usuario) {
    // 1.1: usuario.consultarPerfil()
    return this.exigirSesion(usuario).consultarPerfil();
  }

  // ---------- CU-05 Modificar perfil (secuencia 4.5) ----------
  modificarPerfil(usuario, nombre, foto, direccion, telefono) {
    this.exigirSesion(usuario);
    this.guardar(() => {
      // 1.1: usuario.modificarPerfil(nombre, foto, direccion, telefono) — valida los datos (alt 4a)
      usuario.modificarPerfil(nombre, foto, direccion, telefono);
      // 1.2: guardarUsuarios(usuarios)
      this.persistencia.guardarUsuarios([usuario]);
    });
    return usuario.consultarPerfil();
  }

  // ---------- CU-06 Consultar historial de pedidos (secuencia 4.6) ----------
  consultarHistorial(cliente) {
    // 1.1: cliente.consultarHistorial() → lista vacía si no tiene pedidos (2a)
    return this.exigirCliente(cliente).consultarHistorial();
  }

  // ---------- CU-07 Consultar menú (secuencia 4.7) ----------
  consultarMenu() {
    // 1.1: menu.consultar()
    return this.menu.consultar();
  }

  // ---------- CU-08 Buscar productos del menú (secuencia 4.8) ----------
  buscarProducto(texto) {
    // 1.1: menu.buscarPorNombre(texto) → lista vacía si no hay coincidencias (3a)
    return this.menu.buscarPorNombre(texto);
  }

  consultarCategorias() {
    return this.menu.categorias();
  }

  obtenerProducto(id) {
    const producto = this.menu.buscarPorId(Number(id));
    if (!producto) throw errores.noEncontrado('El producto no existe o fue retirado del menú.');
    return producto;
  }

  // ---------- CU-13 Agregar producto al carrito (secuencia 4.13) ----------
  agregarAlCarrito(cliente, prod, cant = 1) {
    this.exigirCliente(cliente);

    // 1.1: prod.estaDisponible() → alt «producto agotado»: informa que no puede agregarse (3a)
    if (!prod.estaDisponible()) throw productoAgotado(prod);

    // 1.2: cliente.getCarrito()
    const carrito = cliente.getCarrito();
    return this.guardar(() => {
      // 1.3: carrito.agregar(prod, cant) — 1.3.1: «create» Linea(prod, cant)
      carrito.agregar(prod, cant);
      // 1.4: carrito.calcularTotal()
      const total = carrito.calcularTotal();
      // 1.5: guardarUsuarios(usuarios)
      this.persistencia.guardarUsuarios([cliente]);
      return { carrito, total }; // carrito con el total actualizado
    });
  }

  // ---------- CU-14 Consultar carrito (secuencia 4.14) ----------
  consultarCarrito(cliente) {
    // 1.1: cliente.getCarrito()
    const carrito = this.exigirCliente(cliente).getCarrito();
    carrito.actualizarPrecios(); // toma el precio vigente de cada producto y quita los dados de baja
    // 1.2: carrito.calcularTotal() — loop: 1.2.1 linea.subtotal() de cada línea
    const total = carrito.calcularTotal();
    // alt «carrito vacío» (2a): la vista muestra «no hay productos agregados»
    return { carrito, total };
  }

  // ---------- CU-15 Modificar carrito (secuencia 4.15) ----------
  modificarCarrito(cliente, linea, cant) {
    // 1.1: cliente.getCarrito()
    const carrito = this.exigirCliente(cliente).getCarrito();
    carrito.exigirLinea(linea);

    // 1.2: linea.estaDisponible() — 1.2.1: producto.estaDisponible()
    //      alt «agotado o cantidad inválida»: informa el error y no modifica (3a)
    if (!linea.estaDisponible()) {
      throw new ErrorNegocio(409, 'PRODUCTO_AGOTADO', `${linea.producto.nombre} está agotado: quitalo del carrito.`);
    }
    return this.guardar(() => {
      // 1.3: carrito.modificarCantidad(linea, cant) — valida que la cantidad sea mayor que 0
      carrito.modificarCantidad(linea, cant);
      // 1.4: carrito.calcularTotal()
      const total = carrito.calcularTotal();
      // 1.5: guardarUsuarios(usuarios)
      this.persistencia.guardarUsuarios([cliente]);
      return { carrito, total };
    });
  }

  // CU-15, segunda parte: 2: eliminarDelCarrito(cliente, linea)
  eliminarDelCarrito(cliente, linea) {
    const carrito = this.exigirCliente(cliente).getCarrito();
    return this.guardar(() => {
      // 2.1: carrito.eliminar(linea)
      carrito.eliminar(linea);
      // 2.2: carrito.calcularTotal()
      const total = carrito.calcularTotal();
      // 2.3: guardarUsuarios(usuarios)
      this.persistencia.guardarUsuarios([cliente]);
      return { carrito, total };
    });
  }

  // La vista envía el id del producto; el Gestor obtiene la Linea del carrito del cliente.
  obtenerLinea(cliente, productoId) {
    return this.exigirCliente(cliente).getCarrito().buscarLinea(Number(productoId));
  }

  // ---------- CU-16 Realizar pedido (secuencia 4.16, igual a la de la Entrega 6) ----------
  // El mensaje 1, consultarCarrito(cliente), es el resumen de compra (CU-14, RF-17).
  // "claveIdempotencia" evita duplicar el pedido ante varios clics; "lineasAceptadas" es lo
  // que el cliente vio en el resumen.

  // Pedido ya confirmado con esa clave.
  buscarPedidoConfirmado(cliente, claveIdempotencia) {
    if (!cliente?.esCliente()) return null;
    return cliente.pedidos.find((pedido) => pedido.claveIdempotencia === claveIdempotencia) ?? null;
  }

  // 2: confirmarPedido(cliente)
  confirmarPedido(cliente, claveIdempotencia, lineasAceptadas) {
    this.exigirCliente(cliente);
    if (typeof claveIdempotencia !== 'string' || !/^[\w-]{8,64}$/.test(claveIdempotencia)) {
      throw errores.validacion({ claveIdempotencia: 'Falta el identificador de la confirmación.' }, 'No pudimos identificar la confirmación. Recargá la página.');
    }
    const existente = this.buscarPedidoConfirmado(cliente, claveIdempotencia);
    if (existente) return existente;

    const carrito = cliente.getCarrito();
    carrito.actualizarPrecios();
    if (carrito.estaVacio()) throw new ErrorNegocio(409, 'CARRITO_VACIO', 'Tu carrito está vacío. Agregá productos desde el menú.');

    // 2.1: carrito.verificarDisponibilidad() — loop: 2.1.1 linea.estaDisponible() → 2.1.1.1 producto.estaDisponible()
    //      alt «algún producto agotado»: informa el producto agotado y el carrito se conserva (4a)
    if (!carrito.verificarDisponibilidad()) {
      const agotados = carrito.lineasNoDisponibles().map((linea) => linea.producto.nombre).join(', ');
      throw new ErrorNegocio(409, 'PRODUCTO_AGOTADO', `Hay productos agotados en tu carrito: ${agotados}. Quitalos para continuar.`);
    }

    return this.guardar(() => {
      // 2.2: «create» Pedido(cliente, carrito.lineas) — loop por línea: 2.2.1 producto.getPrecio() y
      //      2.2.2 «create» Linea(producto, cantidad, precio) con el precio vigente (RN-03);
      //      2.2.3 pedido.calcularTotal(). Estado inicial: "recibido".
      const pedido = Pedido.desdeCarrito({ cliente, carrito, aceptadas: lineasAceptadas, fecha: this.ahora(), claveIdempotencia });
      this.pedidos.unshift(pedido);
      // 2.3: cliente.agregarPedido(pedido)
      cliente.agregarPedido(pedido);
      // 2.4: carrito.vaciar()
      carrito.vaciar();
      // 2.5: guardarPedidos(pedidos)
      this.persistencia.guardarPedidos([pedido]);
      // 2.6: guardarUsuarios(usuarios)
      this.persistencia.guardarUsuarios([cliente]);
      return pedido;
    });
  }

  buscarPedido(id) {
    return this.pedidos.find((pedido) => pedido.id === Number(id)) ?? null;
  }

  // Detalle de un pedido del historial (CU-06): un cliente solo accede a los suyos.
  consultarPedido(cliente, id) {
    this.exigirCliente(cliente);
    const pedido = this.buscarPedido(id);
    if (!pedido || !cliente.esDuenioDe(pedido)) throw errores.noEncontrado('No encontramos ese pedido en tu cuenta.');
    return pedido;
  }

  // ---------- CU-18 Consultar clases disponibles (secuencia 4.18) ----------
  buscarClase(id) {
    return this.clases.find((clase) => clase.id === Number(id)) ?? null;
  }

  obtenerClase(id) {
    const clase = this.buscarClase(id);
    if (!clase) throw errores.noEncontrado('Esta clase ya no está disponible.');
    return clase;
  }

  // Clases que todavía no comenzaron, por fecha. loop: 1.1 clase.cuposDisponibles() de cada clase.
  consultarClases() {
    const ahora = this.ahora();
    return this.clases
      .filter((clase) => !clase.haComenzado(ahora))
      .sort((a, b) => a.inicio - b.inicio)
      .map((clase) => ({ clase, cupos: clase.cuposDisponibles() }));
  }

  // ---------- CU-19 Inscribirse a una clase (secuencia 4.19) ----------
  inscribir(cliente, clase) {
    this.exigirCliente(cliente);
    if (clase.inscripcionDe(cliente)) throw errores.conflicto('INSCRIPCION_DUPLICADA', 'Ya estás inscripto en esta clase.');
    if (clase.haComenzado(this.ahora())) throw new ErrorNegocio(409, 'CLASE_INICIADA', 'La clase ya comenzó; no admite nuevas inscripciones.');

    // 1.1: clase.hayCupo() → alt «sin cupo»: no es posible inscribirse (3a, RN-02)
    if (!clase.hayCupo()) throw cupoCompleto();

    try {
      return this.guardar(() => {
        // 1.2: «create» Inscripcion(cliente, clase)
        const insc = new Inscripcion({ cliente, clase, fechaInscripcion: this.ahora() });
        // 1.3: clase.agregarInscripcion(insc)
        clase.agregarInscripcion(insc);
        // 1.4: cliente.agregarInscripcion(insc)
        cliente.agregarInscripcion(insc);
        // 1.5: guardarClases(clases)
        this.persistencia.guardarClases(this.clases);
        // 1.6: guardarUsuarios(usuarios)
        this.persistencia.guardarUsuarios([cliente]);
        return insc;
      });
    } catch (error) {
      // Si dos personas toman el último cupo a la vez, el trigger de la base rechaza la segunda (RN-02).
      if (String(error.message).includes('CUPO_COMPLETO')) throw cupoCompleto();
      if (String(error.message).includes('UNIQUE')) throw errores.conflicto('INSCRIPCION_DUPLICADA', 'Ya estás inscripto en esta clase.');
      throw error;
    }
  }

  // ---------- CU-20 Cancelar inscripción a una clase (secuencia 4.20, igual a la de la Entrega 6) ----------
  // 1: consultarMisClases(cliente)
  consultarMisClases(cliente) {
    // 1.1: cliente.consultarMisClases()
    return [...this.exigirCliente(cliente).consultarMisClases()].sort((a, b) => a.clase.inicio - b.clase.inicio);
  }

  // Un cliente solo accede a sus inscripciones: si no es suya, se responde "no encontrada".
  obtenerInscripcion(cliente, id) {
    this.exigirCliente(cliente);
    const insc = cliente.inscripciones.find((i) => i.id === Number(id));
    if (!insc) throw errores.noEncontrado('No encontramos esa inscripción en tu cuenta.');
    return insc;
  }

  // 2: cancelarInscripcion(insc)
  cancelarInscripcion(insc) {
    const ahora = this.ahora(); // hora del servidor

    // 2.1: insc.puedeCancelarse() — 2.1.1: clase.getInicio(); inicio − ahora ≥ 48 h (RN-01)
    //      alt [puedeCancelarse = false]: faltan menos de 48 h, no se puede cancelar
    if (!insc.puedeCancelarse(ahora)) {
      throw new ErrorNegocio(409, 'CANCELACION_FUERA_DE_PLAZO', insc.motivoNoCancelable(ahora));
    }
    this.guardar(() => {
      // 2.2: insc.cancelar() — 2.2.1: clase.quitarInscripcion(this) (libera el cupo)
      //                        2.2.2: cliente.quitarInscripcion(this)
      insc.cancelar(ahora);
      // 2.3: guardarClases(clases)
      this.persistencia.guardarClases(this.clases);
      // 2.4: guardarUsuarios(usuarios)
      this.persistencia.guardarUsuarios([insc.cliente]);
    });
    return true;
  }

  // ---------- Administración: productos (CU-09 a CU-12) ----------
  // En todas, el mensaje 1.1 es tienePermisoAdmin(admin): sin permiso, acceso denegado (RF-20).

  // CU-09 Crear producto (secuencia 4.9). La vista arma el Producto con los datos del formulario.
  crearProducto(admin, prod) {
    // 1.1: tienePermisoAdmin(admin)
    if (!this.tienePermisoAdmin(this.exigirSesion(admin))) throw accesoDenegado();
    // alt «datos inválidos o faltantes» (4a)
    exigirSinErrores(Producto.validar(prod));
    this.guardar(() => {
      // 1.2: menu.agregar(prod)
      this.menu.agregar(prod);
      // 1.3: menu.consultar()
      const productos = this.menu.consultar();
      // 1.4: guardarProductos(productos)
      this.persistencia.guardarProductos(productos);
    });
    return prod;
  }

  // CU-10 Modificar disponibilidad (secuencia 4.10): alterna entre disponible y agotado.
  cambiarDisponibilidad(admin, prod) {
    // 1.1: tienePermisoAdmin(admin)
    if (!this.tienePermisoAdmin(this.exigirSesion(admin))) throw accesoDenegado();
    this.guardar(() => {
      // 1.2: prod.cambiarDisponibilidad()
      prod.cambiarDisponibilidad();
      // 1.3: menu.consultar()
      const productos = this.menu.consultar();
      // 1.4: guardarProductos(productos)
      this.persistencia.guardarProductos(productos);
    });
    return prod;
  }

  // CU-11 Modificar producto (secuencia 4.11). RN-03: los pedidos ya hechos conservan su precio.
  modificarProducto(admin, prod, datos) {
    // 1.1: tienePermisoAdmin(admin)
    if (!this.tienePermisoAdmin(this.exigirSesion(admin))) throw accesoDenegado();
    this.guardar(() => {
      // 1.2: prod.actualizarDatos(datos) — alt «datos inválidos o faltantes» (4a): no se guarda nada
      prod.actualizarDatos(datos);
      exigirSinErrores(Producto.validar(prod));
      // 1.3: menu.consultar()
      const productos = this.menu.consultar();
      // 1.4: guardarProductos(productos)
      this.persistencia.guardarProductos(productos);
    });
    return prod;
  }

  // CU-12 Eliminar producto (secuencia 4.12).
  eliminarProducto(admin, prod) {
    // 1.1: tienePermisoAdmin(admin)
    if (!this.tienePermisoAdmin(this.exigirSesion(admin))) throw accesoDenegado();
    this.guardar(() => {
      // 1.2: menu.eliminar(prod)
      this.menu.eliminar(prod);
      // El registro se conserva marcado como eliminado para que los pedidos viejos lo sigan
      // nombrando (RN-03, Entrega 7), y se quita de los carritos.
      prod.eliminar();
      for (const cliente of this.clientes()) cliente.getCarrito().actualizarPrecios();
      // 1.3: menu.consultar()
      const productos = this.menu.consultar();
      // 1.4: guardarProductos(productos)
      this.persistencia.guardarProductos([...productos, prod]);
    });
  }

  // ---------- CU-17 Consultar estadísticas de ventas (secuencia 4.17) ----------
  // 1: consultarEstadisticas(desde, hasta)
  consultarEstadisticas(desde, hasta) {
    // alt «período inválido» (4a): las fechas deben existir, desde ≤ hasta y hasta 3 años
    const periodo = this.periodo(desde, hasta, { obligatorio: true });
    // 1.1: «create» Estadisticas(pedidos)
    const estadisticas = new Estadisticas(this.pedidos);
    // 1.2: estadisticas.calcularIngresos(desde, hasta) — loop 1.2.1 pedido.calcularTotal()
    const ingresos = estadisticas.calcularIngresos(periodo.inicio, periodo.fin);
    // 1.3: estadisticas.cantidadVentas(desde, hasta)
    const ventas = estadisticas.cantidadVentas(periodo.inicio, periodo.fin);
    // 1.4: estadisticas.productosMasVendidos(desde, hasta, 5)
    const masVendidos = estadisticas.productosMasVendidos(periodo.inicio, periodo.fin, 5);
    // alt «sin ventas en el período» (5a): ventas = 0 y la vista muestra «no hay ventas para mostrar»
    return { desde: periodo.desdeTexto, hasta: periodo.hastaTexto, ingresos, ventas, masVendidos };
  }

  // ---------- Administración: clases e inscriptos (CU-21 a CU-24) ----------
  // En todas, el mensaje 1.1 es tienePermisoAdmin(admin): sin permiso, acceso denegado (RF-20).

  // Listado de la pestaña Clases del panel: todas, de la más lejana a la más antigua.
  consultarClasesAdmin(admin) {
    if (!this.tienePermisoAdmin(this.exigirSesion(admin))) throw accesoDenegado();
    return [...this.clases].sort((a, b) => b.inicio - a.inicio);
  }

  // CU-21 Crear clase (secuencia 4.21). La vista arma la ClaseBarista con los datos del formulario.
  crearClase(admin, clase) {
    // 1.1: tienePermisoAdmin(admin)
    if (!this.tienePermisoAdmin(this.exigirSesion(admin))) throw accesoDenegado();
    // alt «datos inválidos o faltantes» (4a)
    exigirSinErrores(ClaseBarista.validar(clase));
    clase.exigirFutura(this.ahora());
    this.guardar(() => {
      this.clases.push(clase);
      // 1.2: guardarClases(clases)
      this.persistencia.guardarClases(this.clases);
    });
    return clase;
  }

  // CU-22 Modificar clase (secuencia 4.22). Solo se exige fecha futura si cambia el horario.
  modificarClase(admin, clase, datos) {
    // 1.1: tienePermisoAdmin(admin)
    if (!this.tienePermisoAdmin(this.exigirSesion(admin))) throw accesoDenegado();
    try {
      this.guardar(() => {
        const inicioAnterior = clase.inicio.getTime();
        // 1.2: clase.actualizarDatos(datos) — alt «datos inválidos o faltantes» (4a): no se guarda nada
        clase.actualizarDatos(datos);
        exigirSinErrores(ClaseBarista.validar(clase));
        if (clase.inicio.getTime() !== inicioAnterior) clase.exigirFutura(this.ahora());
        // 1.3: guardarClases(clases)
        this.persistencia.guardarClases(this.clases);
      });
    } catch (error) {
      if (String(error.message).includes('CUPO_MENOR_A_INSCRIPTOS')) {
        throw errores.validacion({ cupo: 'El cupo no puede ser menor que las inscripciones activas.' });
      }
      throw error;
    }
    return clase;
  }

  // CU-23 Eliminar clase (secuencia 4.23). Devuelve cuántas inscripciones se cancelaron.
  eliminarClase(admin, clase) {
    // 1.1: tienePermisoAdmin(admin)
    if (!this.tienePermisoAdmin(this.exigirSesion(admin))) throw accesoDenegado();
    return this.guardar(() => {
      const clientes = clase.getInscripciones().map((insc) => insc.cliente);
      // 1.2: clase.cancelarInscripciones() — loop: 1.2.1 insc.anular() → 1.2.1.1 cliente.quitarInscripcion(this)
      const canceladas = clase.cancelarInscripciones();
      this.clases = this.clases.filter((c) => c !== clase);
      // 1.3: guardarClases(clases)
      this.persistencia.guardarClases(this.clases);
      // 1.4: guardarUsuarios(usuarios)
      this.persistencia.guardarUsuarios(clientes);
      return canceladas;
    });
  }

  // CU-24 Consultar inscriptos (secuencia 4.24).
  consultarInscriptos(admin, clase) {
    // 1.1: tienePermisoAdmin(admin)
    if (!this.tienePermisoAdmin(this.exigirSesion(admin))) throw accesoDenegado();
    // 1.2: clase.getInscripciones()
    return clase.getInscripciones();
  }

  // ---------- Auxiliares ----------
  // Convierte fechas YYYY-MM-DD (hora de Argentina) en un intervalo [inicio, fin).
  periodo(desde, hasta, { obligatorio = false, porDefectoDias = 30 } = {}) {
    const formato = /^\d{4}-\d{2}-\d{2}$/;
    if (!desde && !hasta && !obligatorio) {
      const hoy = fechaArgentina(this.ahora());
      const inicio = fechaArgentina(new Date(this.ahora().getTime() - (porDefectoDias - 1) * MS_POR_DIA));
      return this.periodo(inicio, hoy, { obligatorio: true });
    }
    const campos = v.soloErrores({
      desde: formato.test(desde || '') && !Number.isNaN(Date.parse(desde)) ? null : 'Ingresá una fecha desde válida.',
      hasta: formato.test(hasta || '') && !Number.isNaN(Date.parse(hasta)) ? null : 'Ingresá una fecha hasta válida.',
    });
    if (Object.keys(campos).length) throw errores.validacion(campos);
    if (desde > hasta) throw errores.validacion({ desde: 'La fecha desde no puede ser posterior a la fecha hasta.' }, 'La fecha desde no puede ser posterior a la fecha hasta.');
    const inicio = new Date(`${desde}T00:00:00${DESFASE_ARGENTINA}`);
    const fin = new Date(new Date(`${hasta}T00:00:00${DESFASE_ARGENTINA}`).getTime() + MS_POR_DIA);
    if ((fin - inicio) / MS_POR_DIA > MAX_DIAS_ESTADISTICAS) {
      throw errores.validacion({ desde: 'El período puede abarcar hasta tres años.' }, 'El período puede abarcar hasta tres años.');
    }
    return { inicio, fin, desdeTexto: desde, hastaTexto: hasta };
  }
}

// Fecha calendario (YYYY-MM-DD) en Argentina para un instante dado.
export function fechaArgentina(instante) {
  return new Date(instante.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const emailRegistrado = () => errores.conflicto('EMAIL_REGISTRADO', 'Ya existe una cuenta con ese correo.', { email: 'Ya existe una cuenta con ese correo. Iniciá sesión o usá otro.' });
const productoAgotado = (prod) => new ErrorNegocio(409, 'PRODUCTO_AGOTADO', `${prod.nombre} está agotado y no puede agregarse al carrito.`);
const cupoCompleto = () => errores.conflicto('CUPO_COMPLETO', 'No quedan cupos disponibles para esta clase.');
const accesoDenegado = () => errores.prohibido('Solo un administrador puede realizar esta acción.');

function exigirSinErrores(campos) {
  if (Object.keys(campos).length) throw errores.validacion(campos);
}
