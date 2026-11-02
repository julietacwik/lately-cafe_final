import { ErrorNegocio } from './errores.js';

export const HORAS_MINIMAS_CANCELACION = 48;
const MS_POR_HORA = 60 * 60 * 1000;

// Vincula un cliente con una clase (diagrama de clases, Entregas 4, 6 y 8).
// Es la experta en la regla de cancelación (RN-01).
export class Inscripcion {
  constructor({ id = null, cliente, clase, fechaInscripcion = new Date() }) {
    this.id = id;
    this.cliente = cliente;
    this.clase = clase;
    this.fechaInscripcion = fechaInscripcion;
  }

  limiteCancelacion() {
    return new Date(this.clase.getInicio().getTime() - HORAS_MINIMAS_CANCELACION * MS_POR_HORA);
  }

  // Motivo por el que no puede cancelarse, o null si puede.
  motivoNoCancelable(ahora) {
    if (ahora > this.limiteCancelacion()) {
      return `Las inscripciones solo pueden cancelarse hasta ${HORAS_MINIMAS_CANCELACION} horas antes del inicio de la clase. El plazo venció.`;
    }
    return null;
  }

  // CU-20 (mensaje 2.1): le pide el inicio a su clase (2.1.1) y verifica que falten 48 h o más.
  // "ahora" es la hora del servidor.
  puedeCancelarse(ahora = new Date()) {
    return this.motivoNoCancelable(ahora) === null;
  }

  // CU-20 (mensaje 2.2): se quita de la clase, que libera el cupo, y del cliente.
  cancelar(ahora = new Date()) {
    const motivo = this.motivoNoCancelable(ahora);
    if (motivo) throw new ErrorNegocio(409, 'CANCELACION_FUERA_DE_PLAZO', motivo);
    this.clase.quitarInscripcion(this);
    this.cliente.quitarInscripcion(this);
  }

  // CU-23 (mensaje 1.2.1): baja sin la regla de 48 h, cuando se elimina la clase.
  anular() {
    this.cliente.quitarInscripcion(this);
  }

  aJSON(ahora) {
    const motivo = this.motivoNoCancelable(ahora);
    return {
      id: this.id,
      creadaEn: this.fechaInscripcion,
      limiteCancelacion: this.limiteCancelacion().toISOString(),
      puedeCancelar: motivo === null,
      motivoNoCancelable: motivo,
      clase: this.clase.aJSON(),
    };
  }
}
