// Error de regla de negocio o validación. "estado" es el código HTTP sugerido.
export class ErrorNegocio extends Error {
  constructor(estado, codigo, mensaje, campos = undefined) {
    super(mensaje);
    this.estado = estado;
    this.codigo = codigo;
    this.campos = campos;
  }
}

export const errores = {
  validacion: (campos, mensaje = 'Revisá los datos marcados.') => new ErrorNegocio(400, 'DATOS_INVALIDOS', mensaje, campos),
  noAutenticado: () => new ErrorNegocio(401, 'SESION_REQUERIDA', 'Iniciá sesión para continuar.'),
  prohibido: (mensaje = 'No tenés permisos para realizar esta acción.') => new ErrorNegocio(403, 'SIN_PERMISO', mensaje),
  noEncontrado: (mensaje = 'No encontramos lo que buscabas.') => new ErrorNegocio(404, 'NO_ENCONTRADO', mensaje),
  conflicto: (codigo, mensaje, campos) => new ErrorNegocio(409, codigo, mensaje, campos),
};
