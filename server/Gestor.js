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

  exigirAdministrador(usuario) {
    this.exigirSesion(usuario);
    if (!this.tienePermisoAdmin(usuario)) throw errores.prohibido('Solo un administrador puede realizar esta acción.');
    return usuario;
  }

  // ---------- Registro y sesiones (CU-01, CU-02) ----------

  // CU-01, secuencia de la Entrega 8: buscarUsuarioPorEmail(email) → «create» Cliente(nombre, email, clave)
  // (el cliente crea su Carrito) → guardarUsuarios. El registro público crea únicamente clientes.
  // "confirmacion" es la clave repetida del formulario; la clave se guarda como hash con sal.
  async registrarCliente(nombre, email, clave, confirmacion) {
    const campos = v.soloErrores({
      nombre: v.texto(nombre, { nombre: 'tu nombre', min: 2, max: 80 }),
      email: v.email(email),
      password: v.contrasena(clave),
      confirmacion: clave && confirmacion !== clave ? 'Las contraseñas no coinciden.' : null,
    });
    if (Object.keys(campos).length) throw errores.validacion(campos);

    const correo = v.limpiar(email).toLowerCase();
    const exigirCorreoLibre = () => {
      if (this.buscarUsuarioPorEmail(correo)) {
        throw errores.conflicto('EMAIL_REGISTRADO', 'Ya existe una cuenta con ese correo.', { email: 'Ya existe una cuenta con ese correo. Iniciá sesión o usá otro.' });
      }
    };
    exigirCorreoLibre();
    const claveHash = await hashearContrasena(clave);
    // Se vuelve a comprobar: mientras se calculaba el hash pudo registrarse el mismo correo.
    exigirCorreoLibre();
    const cliente = new Cliente({ nombre: v.limpiar(nombre), email: correo, claveHash });
    this.guardar(() => {
      this.persistencia.guardarUsuarios([cliente]);
      this.usuarios.push(cliente);
    });
    return cliente;
  }

  // CU-02: buscarUsuarioPorEmail(email) → opt [existe] usuario.verificarClave(clave).
  // Si el correo no existe se verifica igual contra un hash ficticio, para no revelar qué cuentas existen.
  async iniciarSesion(email, clave) {
    const campos = v.soloErrores({
      email: v.email(email),
      password: typeof clave === 'string' && clave ? null : 'Ingresá tu contraseña.',
    });
    if (Object.keys(campos).length) throw errores.validacion(campos);

    const usuario = this.buscarUsuarioPorEmail(v.limpiar(email).toLowerCase());
    const valida = usuario ? await usuario.verificarClave(clave) : await verificarContrasena(clave, HASH_FICTICIO);
    if (!usuario || !valida) {
      throw new ErrorNegocio(401, 'CREDENCIALES_INCORRECTAS', 'El correo o la contraseña no son correctos.');
    }
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

  // CU-03: cierra la sesión de este dispositivo ("token"); las de otros dispositivos siguen abiertas.
  cerrarSesion(usuario, token) {
    if (usuario && token) this.persistencia.eliminarSesion(hashToken(token));
  }

  limpiarSesionesVencidas() {
    this.persistencia.eliminarSesionesVencidas(this.ahora());
  }

  // ---------- Perfil (CU-04, CU-05) ----------

  consultarPerfil(usuario) {
    return this.exigirSesion(usuario).consultarPerfil();
  }

  // CU-05: el Usuario valida y modifica sus datos; después se guardan los usuarios.
  modificarPerfil(usuario, nombre, foto, direccion, telefono) {
    this.exigirSesion(usuario);
    this.guardar(() => {
      usuario.modificarPerfil(nombre, foto, direccion, telefono);
      this.persistencia.guardarUsuarios([usuario]);
    });
    return usuario.consultarPerfil();
  }

  // ---------- Menú (CU-07, CU-08) ----------

  consultarMenu() {
    return this.menu.consultar();
  }

  buscarProducto(texto) {
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

  // ---------- Carrito (CU-13, CU-14, CU-15) ----------

  // CU-14: cliente.getCarrito() y carrito.calcularTotal() con los precios vigentes.
  consultarCarrito(cliente) {
    const carrito = this.exigirCliente(cliente).getCarrito();
    carrito.actualizarPrecios();
    return carrito;
  }

  // CU-13: prod.estaDisponible() → carrito.agregar(prod, cant) → guardarUsuarios.
  agregarAlCarrito(cliente, prod, cant = 1) {
    const carrito = this.consultarCarrito(cliente);
    this.guardar(() => {
      carrito.agregar(prod, cant);
      this.persistencia.guardarUsuarios([cliente]);
    });
    return carrito;
  }

  // CU-15: linea.estaDisponible() (dentro de modificarCantidad) → carrito.modificarCantidad(linea, cant).
  modificarCarrito(cliente, linea, cant) {
    const carrito = this.consultarCarrito(cliente);
    this.guardar(() => {
      carrito.modificarCantidad(linea, cant);
      this.persistencia.guardarUsuarios([cliente]);
    });
    return carrito;
  }

  eliminarDelCarrito(cliente, linea) {
    const carrito = this.consultarCarrito(cliente);
    this.guardar(() => {
      carrito.eliminar(linea);
      this.persistencia.guardarUsuarios([cliente]);
    });
    return carrito;
  }

  // La vista envía el id del producto; el Gestor obtiene la Linea del carrito del cliente.
  obtenerLinea(cliente, productoId) {
    return this.consultarCarrito(cliente).buscarLinea(Number(productoId));
  }

  // ---------- Pedidos (CU-16, CU-06) ----------

  // Pedido ya confirmado con esa clave (para no duplicarlo ante varios clics).
  buscarPedidoConfirmado(cliente, claveIdempotencia) {
    if (!cliente?.esCliente()) return null;
    return cliente.pedidos.find((pedido) => pedido.claveIdempotencia === claveIdempotencia) ?? null;
  }

  // CU-16, secuencia de la Entrega 6: carrito.verificarDisponibilidad() → «create» Pedido
  // (con una Linea propia por producto, al precio vigente: RN-03) → cliente.agregarPedido(pedido)
  // → carrito.vaciar() → guardarPedidos y guardarUsuarios, todo en una transacción.
  // "claveIdempotencia" evita duplicar el pedido ante varios clics; "lineasAceptadas" es lo que
  // el cliente vio en el resumen (RF-17).
  confirmarPedido(cliente, claveIdempotencia, lineasAceptadas) {
    this.exigirCliente(cliente);
    if (typeof claveIdempotencia !== 'string' || !/^[\w-]{8,64}$/.test(claveIdempotencia)) {
      throw errores.validacion({ claveIdempotencia: 'Falta el identificador de la confirmación.' }, 'No pudimos identificar la confirmación. Recargá la página.');
    }
    const existente = this.buscarPedidoConfirmado(cliente, claveIdempotencia);
    if (existente) return existente;

    const carrito = this.consultarCarrito(cliente);
    return this.guardar(() => {
      const pedido = Pedido.desdeCarrito({ cliente, carrito, aceptadas: lineasAceptadas, fecha: this.ahora(), claveIdempotencia });
      cliente.agregarPedido(pedido);
      carrito.vaciar();
      this.pedidos.unshift(pedido);
      this.persistencia.guardarPedidos([pedido]);
      this.persistencia.guardarUsuarios([cliente]);
      return pedido;
    });
  }

  // CU-06.
  consultarHistorial(cliente) {
    return this.exigirCliente(cliente).consultarHistorial();
  }

  buscarPedido(id) {
    return this.pedidos.find((pedido) => pedido.id === Number(id)) ?? null;
  }

  // Detalle de un pedido del historial: un cliente solo accede a los suyos.
  consultarPedido(cliente, id) {
    this.exigirCliente(cliente);
    const pedido = this.buscarPedido(id);
    if (!pedido || !cliente.esDuenioDe(pedido)) throw errores.noEncontrado('No encontramos ese pedido en tu cuenta.');
    return pedido;
  }

  // ---------- Clases e inscripciones (CU-18, CU-19, CU-20) ----------

  buscarClase(id) {
    return this.clases.find((clase) => clase.id === Number(id)) ?? null;
  }

  obtenerClase(id) {
    const clase = this.buscarClase(id);
    if (!clase) throw errores.noEncontrado('Esta clase ya no está disponible.');
    return clase;
  }

  // CU-18: clases que todavía no comenzaron, con sus cupos disponibles.
  consultarClases() {
    const ahora = this.ahora();
    return this.clases
      .filter((clase) => !clase.haComenzado(ahora))
      .sort((a, b) => a.inicio - b.inicio);
  }

  // CU-19: clase.hayCupo() → «create» Inscripcion(cliente, clase) → clase.agregarInscripcion
  // → cliente.agregarInscripcion → guardarClases. RN-02: la verificación y el alta ocurren en
  // la misma transacción y un trigger de la base impide el sobrecupo.
  inscribir(cliente, clase) {
    this.exigirCliente(cliente);
    const ahora = this.ahora();
    if (clase.inscripcionDe(cliente)) throw errores.conflicto('INSCRIPCION_DUPLICADA', 'Ya estás inscripto en esta clase.');
    clase.exigirInscripcionPosible(ahora);
    try {
      return this.guardar(() => {
        const insc = new Inscripcion({ cliente, clase, fechaInscripcion: ahora });
        clase.agregarInscripcion(insc);
        cliente.agregarInscripcion(insc);
        this.persistencia.guardarClases(this.clases);
        return insc;
      });
    } catch (error) {
      if (String(error.message).includes('CUPO_COMPLETO')) throw errores.conflicto('CUPO_COMPLETO', 'No quedan cupos disponibles para esta clase.');
      if (String(error.message).includes('UNIQUE')) throw errores.conflicto('INSCRIPCION_DUPLICADA', 'Ya estás inscripto en esta clase.');
      throw error;
    }
  }

  // CU-20 (mensaje 1): inscripciones del cliente, por fecha de la clase.
  consultarMisClases(cliente) {
    return [...this.exigirCliente(cliente).consultarMisClases()].sort((a, b) => a.clase.inicio - b.clase.inicio);
  }

  // Un cliente solo accede a sus inscripciones: si no es suya, se responde "no encontrada".
  obtenerInscripcion(cliente, id) {
    this.exigirCliente(cliente);
    const insc = cliente.inscripciones.find((i) => i.id === Number(id));
    if (!insc) throw errores.noEncontrado('No encontramos esa inscripción en tu cuenta.');
    return insc;
  }

  // CU-20, secuencia de la Entrega 6: insc.puedeCancelarse() → alt [true] insc.cancelar()
  // (se quita de la clase y del cliente) → guardarClases y guardarUsuarios. RN-01 con la hora del servidor.
  cancelarInscripcion(insc) {
    const ahora = this.ahora();
    if (!insc.puedeCancelarse(ahora)) {
      throw new ErrorNegocio(409, 'CANCELACION_FUERA_DE_PLAZO', insc.motivoNoCancelable(ahora));
    }
    this.guardar(() => {
      insc.cancelar(ahora);
      this.persistencia.guardarClases(this.clases);
      this.persistencia.guardarUsuarios([insc.cliente]);
    });
    return true;
  }

  // ---------- Administración: productos (CU-09 a CU-12) ----------
  // En todas: tienePermisoAdmin(admin) y después se delega en Menu o Producto.

  crearProducto(admin, datos) {
    this.exigirAdministrador(admin);
    const prod = new Producto({});
    prod.actualizarDatos(datos);
    exigirSinErrores(Producto.validar(prod));
    this.guardar(() => {
      this.menu.agregar(prod);
      this.persistencia.guardarProductos(this.menu.consultar());
    });
    return prod;
  }

  // RN-03: cambiar el precio no altera los pedidos, que tienen sus propias líneas.
  modificarProducto(admin, prod, datos) {
    this.exigirAdministrador(admin);
    this.guardar(() => {
      prod.actualizarDatos(datos);
      exigirSinErrores(Producto.validar(prod));
      this.persistencia.guardarProductos(this.menu.consultar());
    });
    return prod;
  }

  // CU-10: alterna entre disponible y agotado.
  cambiarDisponibilidad(admin, prod) {
    this.exigirAdministrador(admin);
    this.guardar(() => {
      prod.cambiarDisponibilidad();
      this.persistencia.guardarProductos(this.menu.consultar());
    });
    return prod;
  }

  // CU-12: el producto sale del menú y de los carritos; el registro se conserva marcado como
  // eliminado para que los pedidos históricos mantengan su referencia (RN-03).
  eliminarProducto(admin, prod) {
    this.exigirAdministrador(admin);
    this.guardar(() => {
      prod.eliminar();
      this.menu.eliminar(prod);
      this.persistencia.guardarProductos([...this.menu.consultar(), prod]);
      for (const cliente of this.clientes()) cliente.getCarrito().actualizarPrecios();
    });
  }

  // ---------- Administración: clases e inscriptos (CU-21 a CU-24) ----------

  // Todas las clases, de la más lejana a la más antigua (la pantalla marca las finalizadas).
  consultarClasesAdmin(admin) {
    this.exigirAdministrador(admin);
    return [...this.clases].sort((a, b) => b.inicio - a.inicio);
  }

  crearClase(admin, datos) {
    this.exigirAdministrador(admin);
    const clase = new ClaseBarista({});
    clase.actualizarDatos(datos);
    exigirSinErrores(ClaseBarista.validar(clase));
    clase.exigirFutura(this.ahora());
    this.guardar(() => {
      this.clases.push(clase);
      this.persistencia.guardarClases(this.clases);
    });
    return clase;
  }

  // Solo se exige fecha futura si cambia el horario de la clase.
  modificarClase(admin, clase, datos) {
    this.exigirAdministrador(admin);
    try {
      this.guardar(() => {
        const inicioAnterior = clase.inicio.getTime();
        clase.actualizarDatos(datos);
        exigirSinErrores(ClaseBarista.validar(clase));
        if (clase.inicio.getTime() !== inicioAnterior) clase.exigirFutura(this.ahora());
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

  // CU-23: clase.cancelarInscripciones() (cada insc.anular() la quita del cliente), se quita la
  // clase de la lista y se guardan clases y usuarios. Devuelve cuántas inscripciones se cancelaron.
  eliminarClase(admin, clase) {
    this.exigirAdministrador(admin);
    return this.guardar(() => {
      const clientes = clase.getInscripciones().map((insc) => insc.cliente);
      const canceladas = clase.cancelarInscripciones();
      this.clases = this.clases.filter((c) => c !== clase);
      this.persistencia.guardarClases(this.clases);
      this.persistencia.guardarUsuarios(clientes);
      return canceladas;
    });
  }

  // CU-24.
  consultarInscriptos(admin, clase) {
    this.exigirAdministrador(admin);
    return clase.getInscripciones();
  }

  // ---------- Administración: estadísticas (CU-17) ----------
  // La ruta verifica antes tienePermisoAdmin (transición A15 de la Entrega 7).

  consultarEstadisticas(desde, hasta) {
    return new Estadisticas(this.pedidos);
  }

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

function exigirSinErrores(campos) {
  if (Object.keys(campos).length) throw errores.validacion(campos);
}
