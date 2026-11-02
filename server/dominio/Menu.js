import { CATEGORIAS } from '../config.js';

// Contiene y permite consultar los productos del catálogo.
export class Menu {
  constructor(productos) {
    this.productos = productos.filter((producto) => !producto.eliminado);
  }

  // Ordenados por categoría y nombre.
  consultar() {
    return [...this.productos].sort((a, b) => a.categoria.localeCompare(b.categoria, 'es') || a.nombre.localeCompare(b.nombre, 'es'));
  }

  // CU-06: búsqueda por nombre, sin distinguir mayúsculas ni tildes.
  buscarPorNombre(texto = '') {
    const consulta = normalizar(texto);
    if (!consulta) return this.consultar();
    return this.consultar().filter((producto) => normalizar(producto.nombre).includes(consulta));
  }

  buscarPorId(id) {
    return this.productos.find((producto) => producto.id === id) ?? null;
  }

  agregar(producto) {
    this.productos.push(producto);
  }

  eliminar(producto) {
    this.productos = this.productos.filter((p) => p !== producto);
  }

  categorias() {
    const presentes = new Set(this.productos.map((producto) => producto.categoria));
    return CATEGORIAS.filter((categoria) => presentes.has(categoria));
  }
}

export function normalizar(texto) {
  return String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
