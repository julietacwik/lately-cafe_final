import { Usuario } from './Usuario.js';

// Especialización de Usuario. En el diagrama de clases vigente (Entrega 8) no tiene
// operaciones propias: las tareas de administración las ejecuta el Gestor, que verifica
// el permiso con tienePermisoAdmin(usuario) y delega en Menu, Producto y ClaseBarista.
export class Administrador extends Usuario {
  get rol() {
    return 'ADMINISTRADOR';
  }

  esAdministrador() {
    return true;
  }
}
