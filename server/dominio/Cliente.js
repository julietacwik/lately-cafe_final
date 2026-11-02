import { Usuario } from './Usuario.js';
import { Carrito } from './Carrito.js';

// Especialización de Usuario (diagrama de clases, Entregas 4, 6 y 8).
// Al crearse, el cliente crea su propio carrito (CU-01, patrón Creador).
// Conoce sus pedidos e inscripciones; el Gestor los vincula al cargar las listas.
export class Cliente extends Usuario {
  constructor(datos) {
    super(datos);
    this.carrito = new Carrito();
    this.pedidos = [];
    this.inscripciones = [];
  }

  get rol() {
    return 'CLIENTE';
  }

  esCliente() {
    return true;
  }

  consultarHistorial() {
    return this.pedidos;
  }

  consultarMisClases() {
    return this.inscripciones;
  }

  getCarrito() {
    return this.carrito;
  }

  // CU-16 (mensaje 2.3 de la secuencia).
  agregarPedido(pedido) {
    this.pedidos.unshift(pedido);
  }

  // CU-19 (mensaje 1.4).
  agregarInscripcion(insc) {
    this.inscripciones.push(insc);
  }

  // CU-20 (mensaje 2.2.2) y CU-23 (mensaje 1.2.1.1).
  quitarInscripcion(insc) {
    this.inscripciones = this.inscripciones.filter((i) => i !== insc);
  }

  // Un cliente solo puede ver lo que le pertenece (sus pedidos e inscripciones).
  esDuenioDe(entidad) {
    return entidad?.cliente?.id === this.id;
  }
}
