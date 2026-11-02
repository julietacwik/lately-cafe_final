import * as v from './validaciones.js';
import { errores } from './errores.js';

export const CANTIDAD_MAXIMA = 99;

// Referencia un producto y guarda cantidad y precio unitario.
export class Linea {
  constructor({ producto, cantidad, precioUnitario }) {
    Linea.exigirCantidadValida(cantidad);
    this.producto = producto;
    this.cantidad = cantidad;
    this.precioUnitario = precioUnitario;
  }

  static exigirCantidadValida(cantidad) {
    const error = v.entero(cantidad, { nombre: 'la cantidad', min: 1, max: CANTIDAD_MAXIMA });
    if (error) throw errores.validacion({ cantidad: error }, error);
  }

  // En el carrito el precio es el vigente del producto; en el pedido, el copiado al confirmar (RN-03).
  subtotal() {
    return this.cantidad * this.precioUnitario;
  }

  // CU-16 (mensaje 2.1.1.1): la línea le pregunta a su producto.
  estaDisponible() {
    return typeof this.producto.estaDisponible === 'function' ? this.producto.estaDisponible() : true;
  }

  // Copia independiente: el pedido nunca comparte líneas modificables con el carrito.
  copiar() {
    return new Linea({
      producto: { id: this.producto.id, nombre: this.producto.nombre },
      cantidad: this.cantidad,
      // RN-03: se copia el precio vigente del producto en el momento de confirmar.
      precioUnitario: typeof this.producto.getPrecio === 'function' ? this.producto.getPrecio() : this.precioUnitario,
    });
  }

  aJSON() {
    return {
      productoId: this.producto.id,
      nombre: this.producto.nombre,
      imagen: this.producto.imagen ?? null,
      categoria: this.producto.categoria ?? null,
      disponible: this.producto.disponible ?? true,
      cantidad: this.cantidad,
      precioUnitario: this.precioUnitario,
      subtotal: this.subtotal(),
    };
  }
}
