import * as v from './validaciones.js';
import { errores, ErrorNegocio } from './errores.js';
import { DESFASE_ARGENTINA } from '../config.js';

export const CUPO_MAXIMO = 8;
const MS_DESFASE_ARGENTINA = 3 * 60 * 60 * 1000;

// Información de la clase, cupo e inscripciones (diagrama de clases, Entregas 4, 6 y 8).
// "fecha" es el día (medianoche en Argentina) y "horario" la hora de inicio, "HH:MM".
export class ClaseBarista {
  constructor({ id = null, nombre, descripcion, fecha = null, horario = null, duracion, docente, cupoMaximo, imagen = null }) {
    this.id = id;
    this.nombre = nombre;
    this.descripcion = descripcion;
    this.fecha = fecha;
    this.horario = horario;
    this.duracion = duracion;
    this.docente = docente;
    this.cupoMaximo = cupoMaximo;
    this.imagen = imagen;
    this.inscripciones = [];
  }

  // Fecha y horario se cargan en hora de Argentina (UTC-03:00).
  static fechaDesde(texto) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(texto || '')) return null;
    const fecha = new Date(`${texto}T00:00:00${DESFASE_ARGENTINA}`);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }

  // Separa un instante en fecha y horario de Argentina (para leer la base).
  static desdeInicio(inicio) {
    const local = new Date(new Date(inicio).getTime() - MS_DESFASE_ARGENTINA).toISOString();
    return { fecha: ClaseBarista.fechaDesde(local.slice(0, 10)), horario: local.slice(11, 16) };
  }

  // Instante en que comienza la clase, o null si fecha u horario no son válidos.
  get inicio() {
    if (!this.fecha || !/^\d{2}:\d{2}$/.test(this.horario || '')) return null;
    const [horas, minutos] = this.horario.split(':').map(Number);
    if (horas > 23 || minutos > 59) return null;
    return new Date(this.fecha.getTime() + (horas * 60 + minutos) * 60_000);
  }

  // CU-20 (mensaje 2.1.1): instante de inicio, para la regla de las 48 horas.
  getInicio() {
    return this.inicio;
  }

  // CU-24 (mensaje 1.2).
  getInscripciones() {
    return this.inscripciones;
  }

  get inscriptosActivos() {
    return this.inscripciones.length;
  }

  // CU-19 (mensaje 1.3): ocupa un cupo.
  agregarInscripcion(insc) {
    this.inscripciones.push(insc);
  }

  // CU-20 (mensaje 2.2.1): libera el cupo.
  quitarInscripcion(insc) {
    this.inscripciones = this.inscripciones.filter((i) => i !== insc);
  }

  // CU-23 (mensaje 1.2): anula cada inscripción (sin la regla de 48 h) y queda sin inscriptos.
  cancelarInscripciones() {
    for (const insc of [...this.inscripciones]) insc.anular();
    const canceladas = this.inscripciones.length;
    this.inscripciones = [];
    return canceladas;
  }

  // CU-22: copia los datos nuevos del formulario (fecha, hora, duracionMin y cupo).
  // La validación la hace el Gestor con ClaseBarista.validar() antes de guardar.
  actualizarDatos(datos) {
    this.nombre = v.limpiar(datos.nombre);
    this.descripcion = v.limpiar(datos.descripcion);
    this.docente = v.limpiar(datos.docente);
    this.fecha = ClaseBarista.fechaDesde(datos.fecha);
    this.horario = datos.hora ?? null;
    this.duracion = v.aNumero(datos.duracionMin);
    this.cupoMaximo = v.aNumero(datos.cupo);
    if (datos.imagen !== undefined) this.imagen = datos.imagen;
  }

  // Los nombres de los campos son los del formulario.
  static validar(clase) {
    const campos = {
      nombre: v.texto(clase.nombre, { nombre: 'el nombre', min: 3, max: 80 }),
      descripcion: v.texto(clase.descripcion, { nombre: 'la descripción', min: 10, max: 400 }),
      docente: v.texto(clase.docente, { nombre: 'el nombre del docente', min: 3, max: 80 }),
      fecha: clase.inicio ? null : 'Ingresá una fecha y un horario válidos.',
      duracionMin: v.entero(clase.duracion, { nombre: 'la duración (minutos)', min: 15, max: 600 }),
      cupo: v.entero(clase.cupoMaximo, { nombre: 'el cupo', min: 1, max: CUPO_MAXIMO }),
    };
    if (!campos.cupo && clase.cupoMaximo < clase.inscriptosActivos) {
      campos.cupo = `Hay ${clase.inscriptosActivos} inscripciones activas; el cupo no puede ser menor.`;
    }
    return v.soloErrores(campos);
  }

  exigirFutura(ahora) {
    if (this.inicio && this.inicio <= ahora) throw errores.validacion({ fecha: 'La clase debe comenzar en una fecha futura.' });
  }

  inscripcionDe(cliente) {
    return this.inscripciones.find((inscripcion) => inscripcion.cliente.id === cliente.id) ?? null;
  }

  cuposDisponibles() {
    return Math.max(0, this.cupoMaximo - this.inscriptosActivos);
  }

  hayCupo() {
    return this.cuposDisponibles() > 0;
  }

  estaCompleta() {
    return !this.hayCupo();
  }

  haComenzado(ahora) {
    return this.inicio <= ahora;
  }

  // RN-02: se vuelve a comprobar al confirmar la inscripción.
  exigirInscripcionPosible(ahora) {
    if (this.haComenzado(ahora)) throw new ErrorNegocio(409, 'CLASE_INICIADA', 'La clase ya comenzó; no admite nuevas inscripciones.');
    if (this.estaCompleta()) throw new ErrorNegocio(409, 'CUPO_COMPLETO', 'No quedan cupos disponibles para esta clase.');
  }

  aJSON() {
    return {
      id: this.id,
      nombre: this.nombre,
      descripcion: this.descripcion,
      docente: this.docente,
      inicio: this.inicio.toISOString(),
      duracionMin: this.duracion,
      cupo: this.cupoMaximo,
      inscriptos: this.inscriptosActivos,
      cuposDisponibles: this.cuposDisponibles(),
      completa: this.estaCompleta(),
      imagen: this.imagen,
    };
  }
}
