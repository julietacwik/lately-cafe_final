import { Linea, CANTIDAD_MAXIMA } from './Linea.js';
import { errores, ErrorNegocio } from './errores.js';

// Administra sus líneas y calcula el total con los precios vigentes.
export class Carrito {
  constructor(lineas = []) {
    this.lineas = lineas;
  }

  buscarLinea(productoId) {
    return this.lineas.find((linea) => linea.producto.id === productoId) ?? null;
  }

  // CU-11: un producto agotado no puede incorporarse. Si ya está, se suma la cantidad.
  agregar(prod, cant) {
    if (!prod.estaDisponible()) {
      throw new ErrorNegocio(409, 'PRODUCTO_AGOTADO', `${prod.nombre} está agotado y no puede agregarse al carrito.`);
    }
    Linea.exigirCantidadValida(cant);
    const existente = this.buscarLinea(prod.id);
    if (!existente) {
      this.lineas.push(new Linea({ producto: prod, cantidad: cant, precioUnitario: prod.getPrecio() }));
      return;
    }
    if (existente.cantidad + cant > CANTIDAD_MAXIMA) {
      throw errores.validacion({ cantidad: `Podés pedir hasta ${CANTIDAD_MAXIMA} unidades de un producto.` },
        `Ya tenés ${existente.cantidad} en el carrito; el máximo es ${CANTIDAD_MAXIMA}.`);
    }
    existente.cantidad += cant;
  }

  // CU-13: modificar cantidad. No se confirma una modificación inválida.
  modificarCantidad(linea, cant) {
    this.exigirLinea(linea);
    Linea.exigirCantidadValida(cant);
    if (cant > linea.cantidad && !linea.producto.disponible) {
      throw new ErrorNegocio(409, 'PRODUCTO_AGOTADO', `${linea.producto.nombre} está agotado; solo podés reducir la cantidad o quitarlo.`);
    }
    linea.cantidad = cant;
  }

  eliminar(linea) {
    this.exigirLinea(linea);
    this.lineas = this.lineas.filter((l) => l !== linea);
  }

  exigirLinea(linea) {
    if (!linea || !this.lineas.includes(linea)) throw errores.noEncontrado('Ese producto no está en tu carrito.');
  }

  // El carrito no guarda precios: toma el vigente de cada producto y quita los dados de baja.
  actualizarPrecios() {
    this.lineas = this.lineas.filter((linea) => !linea.producto.eliminado);
    for (const linea of this.lineas) linea.precioUnitario = linea.producto.precio;
  }

  lineasNoDisponibles() {
    return this.lineas.filter((linea) => !linea.estaDisponible());
  }

  getLineas() {
    return this.lineas;
  }

  // CU-16 (mensaje 2.1): recorre sus líneas y cada una consulta a su producto.
  verificarDisponibilidad() {
    return this.lineas.every((linea) => linea.estaDisponible());
  }

  calcularTotal() {
    return this.lineas.reduce((suma, linea) => suma + linea.subtotal(), 0);
  }

  cantidadUnidades() {
    return this.lineas.reduce((suma, linea) => suma + linea.cantidad, 0);
  }

  estaVacio() {
    return this.lineas.length === 0;
  }

  vaciar() {
    this.lineas = [];
  }

  aJSON() {
    return {
      lineas: this.lineas.map((linea) => linea.aJSON()),
      total: this.calcularTotal(),
      cantidadUnidades: this.cantidadUnidades(),
      hayNoDisponibles: this.lineasNoDisponibles().length > 0,
    };
  }
}
