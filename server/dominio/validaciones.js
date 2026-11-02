// Validaciones de formato reutilizadas por las clases del dominio.
// Cada función devuelve un mensaje de error o null.

export function texto(valor, { nombre, min = 1, max = 200, opcional = false }) {
  const limpio = typeof valor === 'string' ? valor.trim() : '';
  if (!limpio) return opcional ? null : `Ingresá ${nombre}.`;
  if (limpio.length < min) return `${capitalizar(nombre)} debe tener al menos ${min} caracteres.`;
  if (limpio.length > max) return `${capitalizar(nombre)} puede tener hasta ${max} caracteres.`;
  return null;
}

export function email(valor) {
  const limpio = typeof valor === 'string' ? valor.trim() : '';
  if (!limpio) return 'Ingresá tu correo electrónico.';
  if (limpio.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(limpio)) return 'Ingresá un correo válido, por ejemplo nombre@correo.com.';
  return null;
}

export function contrasena(valor) {
  if (typeof valor !== 'string' || !valor) return 'Ingresá una contraseña.';
  if (valor.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (valor.length > 72) return 'La contraseña puede tener hasta 72 caracteres.';
  if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(valor) || !/\d/.test(valor)) return 'La contraseña debe combinar letras y números.';
  return null;
}

export function telefono(valor) {
  const limpio = typeof valor === 'string' ? valor.trim() : '';
  if (!limpio) return null;
  if (!/^\+?[\d\s()-]{6,20}$/.test(limpio) || (limpio.match(/\d/g) || []).length < 6) {
    return 'Ingresá un teléfono válido (solo números, espacios, guiones o +).';
  }
  return null;
}

export function entero(valor, { nombre, min, max }) {
  const numero = typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : valor;
  if (typeof numero !== 'number' || !Number.isInteger(numero)) return `${capitalizar(nombre)} debe ser un número entero.`;
  if (numero < min || numero > max) return `${capitalizar(nombre)} debe estar entre ${min} y ${max}.`;
  return null;
}

export function limpiar(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

// Convierte el texto de un formulario en número; si no es un número, lo deja como está
// para que entero() muestre el mensaje adecuado.
export function aNumero(valor) {
  return typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : valor;
}

export function sinErrores(campos) {
  return Object.values(campos).every((mensaje) => !mensaje);
}

export function soloErrores(campos) {
  return Object.fromEntries(Object.entries(campos).filter(([, mensaje]) => mensaje));
}

function capitalizar(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
