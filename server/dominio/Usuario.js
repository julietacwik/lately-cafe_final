import * as v from './validaciones.js';
import { errores } from './errores.js';
import { verificarContrasena } from '../seguridad.js';

// Clase abstracta con los datos comunes del perfil.
// "claveHash" nunca sale del servidor: aJSON() no la incluye.
export class Usuario {
  constructor({ id = null, nombre, email, claveHash = null, fotoPerfil = null, direccion = null, telefono = null }) {
    if (new.target === Usuario) throw new TypeError('Usuario es una clase abstracta.');
    this.id = id;
    this.nombre = nombre;
    this.email = email;
    this.claveHash = claveHash;
    this.fotoPerfil = fotoPerfil;
    this.direccion = direccion;
    this.telefono = telefono;
  }

  get rol() {
    throw new Error('Cada especialización de Usuario define su rol.');
  }

  esAdministrador() {
    return false;
  }

  esCliente() {
    return false;
  }

  static validarPerfil({ nombre, direccion, telefono }) {
    return v.soloErrores({
      nombre: v.texto(nombre, { nombre: 'tu nombre', min: 2, max: 80 }),
      direccion: v.texto(direccion, { nombre: 'la dirección', min: 5, max: 120, opcional: true }),
      telefono: v.telefono(telefono),
    });
  }

  consultarPerfil() {
    return this;
  }

  // CU-02 (Experto en información): el usuario conoce su claveHash y verifica la clave.
  verificarClave(clave) {
    return verificarContrasena(clave, this.claveHash);
  }

  // CU-05 (mensaje 1.1): el correo no se modifica; sí nombre, foto, dirección y teléfono.
  // Si "foto" es undefined, se conserva la actual.
  modificarPerfil(nombre, foto, direccion, telefono) {
    const campos = Usuario.validarPerfil({ nombre, direccion, telefono });
    if (Object.keys(campos).length) throw errores.validacion(campos);
    this.nombre = v.limpiar(nombre);
    this.direccion = v.limpiar(direccion) || null;
    this.telefono = v.limpiar(telefono) || null;
    if (foto !== undefined) this.fotoPerfil = foto;
  }

  aJSON() {
    return {
      id: this.id,
      nombre: this.nombre,
      email: this.email,
      foto: this.fotoPerfil,
      direccion: this.direccion,
      telefono: this.telefono,
      rol: this.rol,
    };
  }
}
