// Persistencia: único punto de acceso a los datos.
// Carga y guarda las listas del Gestor (usuarios, productos, pedidos y clases), como en el
// diagrama de clases. La base es SQLite y se guarda en un único archivo (rutaArchivo),
// como prevé la Entrega 4 («archivo o base de datos») y documenta la Entrega 7. Las demás clases
// nunca ejecutan SQL.
//
// guardarUsuarios, guardarProductos y guardarPedidos insertan o actualizan los elementos recibidos.
// guardarClases recibe la lista completa y sincroniza la base (borra clases e inscripciones quitadas).
import { Cliente } from '../dominio/Cliente.js';
import { Administrador } from '../dominio/Administrador.js';
import { Producto } from '../dominio/Producto.js';
import { Linea } from '../dominio/Linea.js';
import { Pedido } from '../dominio/Pedido.js';
import { ClaseBarista } from '../dominio/ClaseBarista.js';
import { Inscripcion } from '../dominio/Inscripcion.js';

const iso = (fecha) => new Date(fecha).toISOString();

export class Persistencia {
  constructor(db, rutaArchivo = null) {
    this.db = db;
    // Equivale a "rutaArchivo" del diagrama: ubicación del archivo SQLite.
    this.rutaArchivo = rutaArchivo;
  }

  // Ejecuta "operacion" en una transacción con bloqueo de escritura inmediato:
  // o se guarda todo lo que hace, o nada.
  enTransaccion(operacion) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const resultado = operacion();
      this.db.exec('COMMIT');
      return resultado;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  // ---------- Usuarios (con el carrito de cada cliente) ----------

  static usuarioDesdeFila(fila) {
    const datos = {
      id: fila.id,
      nombre: fila.nombre,
      email: fila.email,
      claveHash: fila.password_hash,
      fotoPerfil: fila.foto,
      direccion: fila.direccion,
      telefono: fila.telefono,
    };
    return fila.tipo === 'ADMINISTRADOR' ? new Administrador(datos) : new Cliente(datos);
  }

  // Las líneas del carrito traen su producto; el Gestor las vincula con los productos del menú.
  cargarUsuarios() {
    const usuarios = this.db.prepare('SELECT * FROM usuarios ORDER BY id').all().map(Persistencia.usuarioDesdeFila);
    const clientes = new Map(usuarios.filter((usuario) => usuario.esCliente()).map((cliente) => [cliente.id, cliente]));
    const filas = this.db.prepare(`
      SELECT cl.cliente_id, cl.cantidad, p.* FROM carrito_lineas cl
      JOIN productos p ON p.id = cl.producto_id
      WHERE p.eliminado = 0
      ORDER BY cl.agregado_en, p.id`).all();
    for (const fila of filas) {
      const producto = Persistencia.productoDesdeFila(fila);
      clientes.get(fila.cliente_id)?.carrito.lineas.push(new Linea({ producto, cantidad: fila.cantidad, precioUnitario: producto.precio }));
    }
    return usuarios;
  }

  guardarUsuarios(usuarios) {
    const insertar = this.db.prepare(`INSERT INTO usuarios (tipo, nombre, email, password_hash, foto, direccion, telefono, creado_en)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    const actualizar = this.db.prepare('UPDATE usuarios SET nombre = ?, password_hash = ?, foto = ?, direccion = ?, telefono = ? WHERE id = ?');
    for (const usuario of usuarios) {
      if (usuario.id) {
        actualizar.run(usuario.nombre, usuario.claveHash, usuario.fotoPerfil, usuario.direccion, usuario.telefono, usuario.id);
      } else {
        const { lastInsertRowid } = insertar.run(usuario.rol, usuario.nombre, usuario.email, usuario.claveHash, usuario.fotoPerfil,
          usuario.direccion, usuario.telefono, new Date().toISOString());
        usuario.id = Number(lastInsertRowid);
      }
      if (usuario.carrito) this.guardarCarrito(usuario.id, usuario.carrito);
    }
  }

  // Deja en la base exactamente las líneas que tiene el carrito.
  guardarCarrito(clienteId, carrito) {
    const actuales = new Set(carrito.lineas.map((linea) => linea.producto.id));
    const borrar = this.db.prepare('DELETE FROM carrito_lineas WHERE cliente_id = ? AND producto_id = ?');
    for (const { producto_id: productoId } of this.db.prepare('SELECT producto_id FROM carrito_lineas WHERE cliente_id = ?').all(clienteId)) {
      if (!actuales.has(productoId)) borrar.run(clienteId, productoId);
    }
    const upsert = this.db.prepare(`INSERT INTO carrito_lineas (cliente_id, producto_id, cantidad, agregado_en)
      VALUES (?, ?, ?, ?) ON CONFLICT (cliente_id, producto_id) DO UPDATE SET cantidad = excluded.cantidad`);
    const ahora = new Date().toISOString();
    for (const linea of carrito.lineas) upsert.run(clienteId, linea.producto.id, linea.cantidad, ahora);
  }

  // ---------- Sesiones ----------
  // No forman parte del diagrama: son un mecanismo de seguridad y se consultan siempre en la base.

  guardarSesion({ tokenHash, usuarioId, creadaEn, expiraEn }) {
    this.db.prepare('INSERT INTO sesiones (token_hash, usuario_id, creada_en, expira_en) VALUES (?, ?, ?, ?)')
      .run(tokenHash, usuarioId, creadaEn.toISOString(), expiraEn.toISOString());
  }

  buscarUsuarioIdDeSesion(tokenHash, ahora) {
    return this.db.prepare('SELECT usuario_id FROM sesiones WHERE token_hash = ? AND expira_en > ?')
      .get(tokenHash, ahora.toISOString())?.usuario_id ?? null;
  }

  eliminarSesion(tokenHash) {
    this.db.prepare('DELETE FROM sesiones WHERE token_hash = ?').run(tokenHash);
  }

  eliminarOtrasSesiones(usuarioId, tokenHashActual) {
    this.db.prepare('DELETE FROM sesiones WHERE usuario_id = ? AND token_hash <> ?').run(usuarioId, tokenHashActual ?? '');
  }

  eliminarSesionesVencidas(ahora) {
    this.db.prepare('DELETE FROM sesiones WHERE expira_en <= ?').run(ahora.toISOString());
  }

  // ---------- Productos ----------

  static productoDesdeFila(fila) {
    return new Producto({
      id: fila.id,
      nombre: fila.nombre,
      descripcion: fila.descripcion,
      precio: fila.precio,
      categoria: fila.categoria,
      imagen: fila.imagen,
      disponible: fila.disponible === 1,
      eliminado: fila.eliminado === 1,
    });
  }

  cargarProductos() {
    return this.db.prepare('SELECT * FROM productos WHERE eliminado = 0 ORDER BY categoria, nombre')
      .all().map(Persistencia.productoDesdeFila);
  }

  // La baja es lógica: los pedidos históricos siguen referenciando el producto.
  // Un producto dado de baja sale de todos los carritos.
  guardarProductos(productos) {
    const insertar = this.db.prepare(`INSERT INTO productos
      (nombre, descripcion, precio, categoria, imagen, disponible, eliminado, creado_en, actualizado_en)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const actualizar = this.db.prepare(`UPDATE productos SET nombre = ?, descripcion = ?, precio = ?, categoria = ?, imagen = ?,
      disponible = ?, eliminado = ?, actualizado_en = ? WHERE id = ?`);
    const quitarDeCarritos = this.db.prepare('DELETE FROM carrito_lineas WHERE producto_id = ?');
    const ahora = new Date().toISOString();
    for (const producto of productos) {
      const valores = [producto.nombre, producto.descripcion, producto.precio, producto.categoria, producto.imagen,
        producto.disponible ? 1 : 0, producto.eliminado ? 1 : 0];
      if (producto.id) {
        actualizar.run(...valores, ahora, producto.id);
      } else {
        producto.id = Number(insertar.run(...valores, ahora, ahora).lastInsertRowid);
      }
      if (producto.eliminado) quitarDeCarritos.run(producto.id);
    }
  }

  // ---------- Pedidos ----------

  // Del más reciente al más antiguo. "cliente" trae solo el id; el Gestor lo vincula con el Cliente.
  cargarPedidos() {
    const filas = this.db.prepare('SELECT * FROM pedidos ORDER BY fecha DESC, id DESC').all();
    const lineasPorPedido = new Map(filas.map((fila) => [fila.id, []]));
    for (const fila of this.db.prepare('SELECT * FROM pedido_lineas ORDER BY id').all()) {
      lineasPorPedido.get(fila.pedido_id)?.push(new Linea({
        producto: { id: fila.producto_id, nombre: fila.nombre_producto },
        cantidad: fila.cantidad,
        precioUnitario: fila.precio_unitario,
      }));
    }
    return filas.map((fila) => new Pedido({
      id: fila.id,
      cliente: { id: fila.cliente_id },
      fecha: fila.fecha,
      estado: fila.estado,
      total: fila.importe_total,
      claveIdempotencia: fila.clave_idempotencia,
      lineas: lineasPorPedido.get(fila.id),
      datosCliente: {
        nombre: fila.cliente_nombre,
        email: fila.cliente_email,
        telefono: fila.cliente_telefono,
        direccion: fila.cliente_direccion,
      },
    }));
  }

  // Un pedido confirmado no cambia sus líneas (RN-03): solo se inserta o se actualiza su estado.
  guardarPedidos(pedidos) {
    const insertar = this.db.prepare(`INSERT INTO pedidos
      (cliente_id, fecha, estado, importe_total, clave_idempotencia, cliente_nombre, cliente_email, cliente_telefono, cliente_direccion)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const insertarLinea = this.db.prepare(`INSERT INTO pedido_lineas
      (pedido_id, producto_id, nombre_producto, cantidad, precio_unitario) VALUES (?, ?, ?, ?, ?)`);
    const actualizar = this.db.prepare('UPDATE pedidos SET estado = ? WHERE id = ?');
    for (const pedido of pedidos) {
      if (pedido.id) {
        actualizar.run(pedido.estado, pedido.id);
        continue;
      }
      const { datosCliente: c } = pedido;
      pedido.id = Number(insertar.run(pedido.cliente.id, iso(pedido.fecha), pedido.estado, pedido.total, pedido.claveIdempotencia,
        c.nombre, c.email, c.telefono ?? null, c.direccion ?? null).lastInsertRowid);
      for (const linea of pedido.lineas) {
        insertarLinea.run(pedido.id, linea.producto.id, linea.producto.nombre, linea.cantidad, linea.precioUnitario);
      }
    }
  }

  // ---------- Clases (con sus inscripciones) ----------

  // La base guarda el instante de inicio; la clase lo separa en fecha y horario.
  // El "cliente" de cada inscripción trae solo el id; el Gestor lo vincula con el Cliente.
  cargarClases() {
    const clases = this.db.prepare('SELECT * FROM clases ORDER BY inicio').all().map((fila) => new ClaseBarista({
      id: fila.id,
      nombre: fila.nombre,
      descripcion: fila.descripcion,
      ...ClaseBarista.desdeInicio(fila.inicio),
      duracion: fila.duracion_min,
      docente: fila.docente,
      cupoMaximo: fila.cupo,
      imagen: fila.imagen,
    }));
    const porId = new Map(clases.map((clase) => [clase.id, clase]));
    for (const fila of this.db.prepare('SELECT * FROM inscripciones ORDER BY creada_en, id').all()) {
      const clase = porId.get(fila.clase_id);
      clase?.inscripciones.push(new Inscripcion({ id: fila.id, cliente: { id: fila.cliente_id }, clase, fechaInscripcion: fila.creada_en }));
    }
    return clases;
  }

  // Recibe la lista completa de clases (como en las secuencias: guardarClases(clases)) y deja la
  // base igual a ella: borra las clases que ya no están (con sus inscripciones, por CASCADE) y las
  // inscripciones canceladas; actualiza las existentes e inserta las nuevas. Primero se borra y
  // después se inserta, para que los triggers de cupo vean el estado correcto.
  guardarClases(clases) {
    const idsClases = new Set(clases.filter((c) => c.id).map((c) => c.id));
    const borrarClase = this.db.prepare('DELETE FROM clases WHERE id = ?');
    for (const { id } of this.db.prepare('SELECT id FROM clases').all()) {
      if (!idsClases.has(id)) borrarClase.run(id);
    }
    const insertarClase = this.db.prepare(`INSERT INTO clases
      (nombre, descripcion, docente, inicio, duracion_min, cupo, imagen, creado_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    const actualizarClase = this.db.prepare(`UPDATE clases SET nombre = ?, descripcion = ?, docente = ?, inicio = ?, duracion_min = ?,
      cupo = ?, imagen = ? WHERE id = ?`);
    const borrarInscripcion = this.db.prepare('DELETE FROM inscripciones WHERE id = ?');
    const insertarInscripcion = this.db.prepare('INSERT INTO inscripciones (clase_id, cliente_id, creada_en) VALUES (?, ?, ?)');
    for (const clase of clases) {
      if (clase.id) {
        const vigentes = new Set(clase.inscripciones.filter((i) => i.id).map((i) => i.id));
        for (const { id } of this.db.prepare('SELECT id FROM inscripciones WHERE clase_id = ?').all(clase.id)) {
          if (!vigentes.has(id)) borrarInscripcion.run(id);
        }
      }
      const valores = [clase.nombre, clase.descripcion, clase.docente, clase.inicio.toISOString(), clase.duracion, clase.cupoMaximo, clase.imagen];
      if (clase.id) {
        actualizarClase.run(...valores, clase.id);
      } else {
        clase.id = Number(insertarClase.run(...valores, new Date().toISOString()).lastInsertRowid);
      }
      for (const inscripcion of clase.inscripciones.filter((i) => !i.id)) {
        inscripcion.id = Number(insertarInscripcion.run(clase.id, inscripcion.cliente.id, iso(inscripcion.fechaInscripcion)).lastInsertRowid);
      }
    }
  }
}
