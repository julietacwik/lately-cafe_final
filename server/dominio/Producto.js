import * as v from './validaciones.js';
import { CATEGORIAS } from '../config.js';

export const PRECIO_MAXIMO = 1_000_000;

// Datos del catálogo y disponibilidad.
export class Producto {
  constructor({ id = null, nombre, descripcion, precio, categoria, imagen = null, disponible = true, eliminado = false }) {
    this.id = id;
    this.nombre = nombre;
    this.descripcion = descripcion;
    this.precio = precio;
    this.categoria = categoria;
    this.imagen = imagen;
    this.disponible = Boolean(disponible);
    this.eliminado = Boolean(eliminado);
  }

  static validar({ nombre, descripcion, precio, categoria }) {
    return v.soloErrores({
      nombre: v.texto(nombre, { nombre: 'el nombre', min: 2, max: 80 }),
      descripcion: v.texto(descripcion, { nombre: 'la descripción', min: 5, max: 200 }),
      precio: v.entero(precio, { nombre: 'el precio', min: 1, max: PRECIO_MAXIMO }),
      categoria: CATEGORIAS.includes(categoria) ? null : 'Elegí una categoría de la lista.',
    });
  }

  // CU-11: copia los datos nuevos (los del formulario). La validación la hace el Gestor con
  // Producto.validar() antes de guardar. Imagen y disponibilidad se conservan si no vienen.
  actualizarDatos(datos) {
    this.nombre = v.limpiar(datos.nombre);
    this.descripcion = v.limpiar(datos.descripcion);
    this.precio = v.aNumero(datos.precio);
    this.categoria = datos.categoria;
    if (datos.imagen !== undefined) this.imagen = datos.imagen;
    if (typeof datos.disponible === 'boolean') this.disponible = datos.disponible;
  }

  estaDisponible() {
    return this.disponible && !this.eliminado;
  }

  getPrecio() {
    return this.precio;
  }

  // CU-10: alterna entre disponible y agotado.
  cambiarDisponibilidad() {
    this.disponible = !this.disponible;
  }

  // CU-12: el producto sale del menú, pero el registro se conserva para que los pedidos
  // históricos mantengan su referencia (RN-03).
  eliminar() {
    this.eliminado = true;
  }

  aJSON() {
    return {
      id: this.id,
      nombre: this.nombre,
      descripcion: this.descripcion,
      precio: this.precio,
      categoria: this.categoria,
      imagen: this.imagen,
      disponible: this.disponible,
    };
  }
}
