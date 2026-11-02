import { ErrorNegocio, errores } from './errores.js';

export const ESTADO_RECIBIDO = 'RECIBIDO';
// Ningún caso de uso cambia el estado todavía: todo pedido queda RECIBIDO (CU-14).
export const ESTADOS_PEDIDO = [ESTADO_RECIBIDO, 'EN_PREPARACION', 'LISTO', 'ENTREGADO'];

// Conserva cliente, fecha, estado, líneas e importe.
// Confirmar un pedido lo registra como recibido; no acredita ningún pago.
// "datosCliente" guarda nombre y contacto tal como estaban al confirmar.
export class Pedido {
  constructor({ id = null, fecha, estado = ESTADO_RECIBIDO, total = null, cliente, lineas, datosCliente, claveIdempotencia = null }) {
    this.id = id;
    this.fecha = fecha;
    this.estado = estado;
    this.cliente = cliente;
    this.lineas = lineas;
    this.total = total ?? this.calcularTotal();
    this.datosCliente = datosCliente;
    this.claveIdempotencia = claveIdempotencia;
  }

  // RN-03: el pedido crea líneas propias con los precios aceptados por el cliente.
  // "aceptadas" es lo que el cliente vio en el resumen; si difiere de lo vigente,
  // se rechaza para que revise el resumen otra vez.
  static desdeCarrito({ cliente, carrito, aceptadas, fecha, claveIdempotencia }) {
    if (carrito.estaVacio()) {
      throw new ErrorNegocio(409, 'CARRITO_VACIO', 'Tu carrito está vacío. Agregá productos desde el menú.');
    }
    if (!carrito.verificarDisponibilidad()) {
      const agotados = carrito.lineasNoDisponibles();
      throw new ErrorNegocio(409, 'PRODUCTO_AGOTADO',
        `Hay productos agotados en tu carrito: ${agotados.map((l) => l.producto.nombre).join(', ')}. Quitalos para continuar.`);
    }
    if (!Pedido.coincideConResumen(carrito, aceptadas)) {
      throw new ErrorNegocio(409, 'RESUMEN_DESACTUALIZADO',
        'El carrito o algún precio cambió desde que viste el resumen. Revisalo y volvé a confirmar.');
    }
    return new Pedido({
      cliente,
      fecha,
      // Por cada línea del carrito se crea una Linea propia con el precio vigente (mensajes 2.2.1 y 2.2.2).
      lineas: carrito.getLineas().map((linea) => linea.copiar()),
      datosCliente: {
        nombre: cliente.nombre,
        email: cliente.email,
        telefono: cliente.telefono,
        direccion: cliente.direccion,
      },
      claveIdempotencia,
    });
  }

  static coincideConResumen(carrito, aceptadas) {
    if (!Array.isArray(aceptadas) || aceptadas.length !== carrito.lineas.length) return false;
    return carrito.lineas.every((linea) => aceptadas.some((a) =>
      Number(a.productoId) === linea.producto.id
      && Number(a.cantidad) === linea.cantidad
      && Number(a.precioUnitario) === linea.precioUnitario));
  }

  calcularTotal() {
    return this.lineas.reduce((suma, linea) => suma + linea.subtotal(), 0);
  }

  cambiarEstado(estado) {
    if (!ESTADOS_PEDIDO.includes(estado)) throw errores.validacion({ estado: 'Estado de pedido desconocido.' });
    this.estado = estado;
  }

  aJSON() {
    return {
      id: this.id,
      numero: Pedido.numero(this.id),
      fecha: this.fecha,
      estado: this.estado,
      total: this.total,
      cliente: this.datosCliente,
      lineas: this.lineas.map((linea) => ({
        productoId: linea.producto.id,
        nombre: linea.producto.nombre,
        cantidad: linea.cantidad,
        precioUnitario: linea.precioUnitario,
        subtotal: linea.subtotal(),
      })),
    };
  }

  static numero(id) {
    return `LC-${String(id).padStart(5, '0')}`;
  }
}
