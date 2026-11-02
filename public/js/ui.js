// Utilidades de interfaz: plantillas seguras, formatos, avisos, diálogos y estados.

// ---------- Plantillas con escape automático ----------
class HtmlSeguro {
  constructor(texto) { this.texto = texto; }
  toString() { return this.texto; }
}

export const crudo = (texto) => new HtmlSeguro(String(texto));

export function escapar(valor) {
  return String(valor)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function convertir(valor) {
  // Los booleanos se escriben como texto para atributos ARIA (aria-checked="false").
  if (valor === null || valor === undefined) return '';
  if (valor instanceof HtmlSeguro) return valor.texto;
  if (Array.isArray(valor)) return valor.map(convertir).join('');
  return escapar(valor);
}

export function html(partes, ...valores) {
  let salida = '';
  partes.forEach((parte, i) => {
    salida += parte;
    if (i < valores.length) salida += convertir(valores[i]);
  });
  return new HtmlSeguro(salida);
}

// La CSP no admite atributos style: los anchos de barras se indican con data-ancho.
export function pintar(elemento, contenido) {
  elemento.innerHTML = convertir(contenido);
  elemento.querySelectorAll('[data-ancho]').forEach((nodo) => { nodo.style.width = `${nodo.dataset.ancho}%`; });
}

// ---------- Formatos (Argentina) ----------
const ZONA = 'America/Argentina/Buenos_Aires';
const formatoPrecio = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const formatoFechaLarga = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: ZONA });
const formatoFecha = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: ZONA });
const formatoHora = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: ZONA });

export const precio = (valor) => formatoPrecio.format(valor);
export const fechaLarga = (iso) => capitalizar(formatoFechaLarga.format(new Date(iso)));
export const fecha = (iso) => formatoFecha.format(new Date(iso));
export const hora = (iso) => `${formatoHora.format(new Date(iso))} h`;
export const fechaHora = (iso) => `${fecha(iso)} · ${hora(iso)}`;

export function duracion(minutos) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

// Fecha y hora de Argentina en formato de inputs (YYYY-MM-DD / HH:MM).
export function partesArgentina(iso) {
  const desplazada = new Date(new Date(iso).getTime() - 3 * 3600_000).toISOString();
  return { fecha: desplazada.slice(0, 10), hora: desplazada.slice(11, 16) };
}

export const hoyArgentina = () => partesArgentina(new Date().toISOString()).fecha;

export function sumarDias(fechaTexto, dias) {
  const base = new Date(`${fechaTexto}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

export const capitalizar = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);

export function iniciales(nombre = '') {
  return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((parte) => parte[0].toUpperCase()).join('') || '?';
}

export const ESTADOS_PEDIDO = { RECIBIDO: 'Recibido' };

// ---------- Íconos ----------
const ICONOS = {
  buscar: '<path d="M11 4a7 7 0 1 0 4.2 12.6l4.1 4.1 1.4-1.4-4.1-4.1A7 7 0 0 0 11 4zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10z" fill="currentColor"/>',
  taza: '<path d="M4 8h13v5a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6zm13 1h1.5a2.5 2.5 0 0 1 0 5H17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 3c-.8 1.2.8 2 0 3.2M12 3c-.8 1.2.8 2 0 3.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  carrito: '<path d="M3 4h2l2.4 10.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="19" r="1.5" fill="currentColor"/><circle cx="17" cy="19" r="1.5" fill="currentColor"/>',
  calendario: '<rect x="3.5" y="5" width="17" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  recibo: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 8h6M9 12h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  alerta: '<path d="M12 3 2 20h20z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 10v4M12 17v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  ok: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m8 12.5 2.5 2.5L16 9.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  info: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 11v5M12 8v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  cerrar: '<path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  candado: '<rect x="5" y="10" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="1.8"/>',
};

export const icono = (nombre, clase = '') => crudo(`<svg class="${clase}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONOS[nombre] || ''}</svg>`);

// ---------- Estados de carga, vacío y error ----------
export const cargando = (texto = 'Cargando…') => html`<div class="estado estado--cargando" role="status"><span class="girador" aria-hidden="true"></span>${texto}</div>`;

export function vacio({ titulo, texto, accion = '', iconoNombre = 'taza' }) {
  return html`<div class="estado estado--vacio">
    <span class="estado__icono">${icono(iconoNombre)}</span>
    <h2 class="estado__titulo">${titulo}</h2>
    ${texto ? html`<p>${texto}</p>` : ''}
    ${accion}
  </div>`;
}

export function errorCarga(mensaje, { reintentar = true } = {}) {
  return html`<div class="estado estado--vacio" role="alert">
    <span class="estado__icono">${icono('alerta')}</span>
    <h2 class="estado__titulo">No pudimos cargar la información</h2>
    <p>${mensaje}</p>
    ${reintentar ? html`<button class="boton boton--secundario" type="button" data-accion="reintentar">Reintentar</button>` : ''}
  </div>`;
}

export function alerta(tipo, contenido, titulo = '') {
  const nombreIcono = { error: 'alerta', exito: 'ok', info: 'info', aviso: 'alerta' }[tipo];
  return html`<div class="alerta alerta--${tipo}" role="${tipo === 'error' ? 'alert' : 'status'}">
    ${icono(nombreIcono, 'alerta__icono')}
    <div>${titulo ? html`<strong>${titulo}</strong>` : ''}<p>${contenido}</p></div>
  </div>`;
}

// ---------- Avisos breves ----------
export function avisar(mensaje, tipo = 'info') {
  const contenedor = document.getElementById('avisos');
  const aviso = document.createElement('div');
  aviso.className = `aviso aviso--${tipo}`;
  aviso.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
  pintar(aviso, html`<p>${mensaje}</p><button type="button" aria-label="Cerrar aviso">×</button>`);
  const cerrar = () => {
    aviso.classList.add('aviso--saliendo');
    setTimeout(() => aviso.remove(), 200);
  };
  aviso.querySelector('button').addEventListener('click', cerrar);
  contenedor.append(aviso);
  setTimeout(cerrar, tipo === 'error' ? 7000 : 4500);
}

// ---------- Diálogos ----------
let resolverDialogo = null;

function prepararDialogo({ ancho = false }) {
  const dialogo = document.getElementById('dialogo');
  if (dialogo.open) dialogo.close();
  dialogo.classList.toggle('dialogo--ancho', ancho);
  return dialogo;
}

// Confirmación explícita. Devuelve una promesa con true / false.
export function confirmar({ titulo, mensaje, detalle = '', textoConfirmar = 'Confirmar', textoCancelar = 'Volver', peligro = false }) {
  const dialogo = prepararDialogo({});
  pintar(dialogo, html`
    <div class="dialogo__cabecera"><h2 id="dialogo-titulo">${titulo}</h2></div>
    <div class="dialogo__cuerpo"><p>${mensaje}</p>${detalle}</div>
    <div class="dialogo__pie">
      <button type="button" class="boton boton--secundario" data-respuesta="no">${textoCancelar}</button>
      <button type="button" class="boton ${peligro ? 'boton--peligro' : ''}" data-respuesta="si">${textoConfirmar}</button>
    </div>`);
  return new Promise((resolver) => {
    resolverDialogo = resolver;
    dialogo.querySelectorAll('[data-respuesta]').forEach((boton) => boton.addEventListener('click', () => {
      resolverDialogo = null;
      dialogo.close();
      resolver(boton.dataset.respuesta === 'si');
    }));
    dialogo.addEventListener('close', () => {
      if (resolverDialogo) { resolverDialogo(false); resolverDialogo = null; }
    }, { once: true });
    dialogo.showModal();
    dialogo.querySelector(peligro ? '[data-respuesta="no"]' : '[data-respuesta="si"]').focus();
  });
}

// Formulario en un diálogo. "alEnviar" recibe FormData; si lanza un ApiError con
// campos, se muestran junto a cada campo y el diálogo queda abierto.
export function dialogoFormulario({ titulo, contenido, textoEnviar = 'Guardar', alEnviar, alAbrir }) {
  const dialogo = prepararDialogo({ ancho: true });
  pintar(dialogo, html`
    <form class="formulario" novalidate>
      <div class="dialogo__cabecera">
        <h2 id="dialogo-titulo">${titulo}</h2>
        <button type="button" class="dialogo__cerrar" data-cerrar aria-label="Cerrar">×</button>
      </div>
      <div class="dialogo__cuerpo pila">
        <div data-alerta></div>
        ${contenido}
      </div>
      <div class="dialogo__pie">
        <button type="button" class="boton boton--secundario" data-cerrar>Cancelar</button>
        <button type="submit" class="boton">${textoEnviar}</button>
      </div>
    </form>`);
  const formulario = dialogo.querySelector('form');
  dialogo.querySelectorAll('[data-cerrar]').forEach((boton) => boton.addEventListener('click', () => dialogo.close()));
  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    limpiarErrores(formulario);
    const boton = formulario.querySelector('[type="submit"]');
    const restaurar = ocupar(boton, 'Guardando…');
    try {
      await alEnviar(new FormData(formulario), formulario);
      dialogo.close();
    } catch (error) {
      mostrarErrores(formulario, error);
    } finally {
      restaurar();
    }
  });
  alAbrir?.(formulario);
  dialogo.showModal();
  formulario.querySelector('input, select, textarea')?.focus();
  return dialogo;
}

// ---------- Formularios ----------
export function campo({ nombre, etiqueta, tipo = 'text', valor = '', ayuda = '', opcional = false, atributos = '', requerido = !opcional }) {
  const idAyuda = ayuda ? `ayuda-${nombre}` : '';
  return html`<div class="campo">
    <label for="campo-${nombre}">${etiqueta}${opcional ? html` <span class="opcional">(opcional)</span>` : ''}</label>
    <input id="campo-${nombre}" name="${nombre}" type="${tipo}" value="${valor ?? ''}" ${requerido ? crudo('required') : ''}
      aria-describedby="error-${nombre} ${idAyuda}" ${crudo(atributos)}>
    ${ayuda ? html`<p class="campo__ayuda" id="${idAyuda}">${ayuda}</p>` : ''}
    <p class="campo__error" id="error-${nombre}"></p>
  </div>`;
}

export function limpiarErrores(formulario) {
  formulario.querySelectorAll('[aria-invalid="true"]').forEach((control) => control.removeAttribute('aria-invalid'));
  formulario.querySelectorAll('.campo__error').forEach((nodo) => { nodo.textContent = ''; });
  const zona = formulario.querySelector('[data-alerta]');
  if (zona) zona.innerHTML = '';
}

export function marcarError(formulario, nombre, mensaje) {
  const control = formulario.querySelector(`[name="${nombre}"]`);
  const nodo = formulario.querySelector(`#error-${nombre}`);
  if (control) control.setAttribute('aria-invalid', 'true');
  if (nodo) nodo.textContent = mensaje;
  return Boolean(nodo);
}

export function mostrarErrores(formulario, error) {
  const campos = error?.campos || {};
  let primero = null;
  let sinUbicar = [];
  for (const [nombre, mensaje] of Object.entries(campos)) {
    if (marcarError(formulario, nombre, mensaje)) primero ||= formulario.querySelector(`[name="${nombre}"]`);
    else sinUbicar.push(mensaje);
  }
  const zona = formulario.querySelector('[data-alerta]');
  const mensajeGeneral = Object.keys(campos).length && !sinUbicar.length
    ? 'Revisá los campos marcados.'
    : [error?.message || 'No pudimos completar la operación.', ...sinUbicar].filter((m, i, a) => a.indexOf(m) === i).join(' ');
  if (zona) pintar(zona, alerta('error', mensajeGeneral));
  (primero || zona)?.focus?.();
  if (primero) primero.focus();
}

// Deshabilita un botón mientras dura una operación. Devuelve la función que lo restaura.
export function ocupar(boton, texto) {
  if (!boton) return () => {};
  const original = boton.innerHTML;
  boton.disabled = true;
  boton.setAttribute('aria-busy', 'true');
  pintar(boton, html`<span class="girador" aria-hidden="true"></span>${texto}`);
  return () => {
    boton.disabled = false;
    boton.removeAttribute('aria-busy');
    boton.innerHTML = original;
  };
}

export function textoDe(formData, nombre) {
  const valor = formData.get(nombre);
  return typeof valor === 'string' ? valor.trim() : '';
}

export function vistaPreviaImagen(input, imagen) {
  input.addEventListener('change', () => {
    const archivo = input.files?.[0];
    if (!archivo) return;
    if (archivo.size > 2 * 1024 * 1024) {
      input.value = '';
      avisar('La imagen puede pesar hasta 2 MB.', 'error');
      return;
    }
    imagen.src = URL.createObjectURL(archivo);
    imagen.classList.remove('oculto');
  });
}

// Selector de cantidad accesible (− número +).
export function selectorCantidad({ nombre, valor = 1, etiqueta, deshabilitado = false }) {
  return html`<div class="cantidad" data-cantidad>
    <button type="button" data-paso="-1" aria-label="Restar una unidad" ${deshabilitado || valor <= 1 ? crudo('disabled') : ''}>−</button>
    <input type="number" inputmode="numeric" min="1" max="99" step="1" name="${nombre}" value="${valor}" aria-label="${etiqueta}" ${deshabilitado ? crudo('disabled') : ''}>
    <button type="button" data-paso="1" aria-label="Sumar una unidad" ${deshabilitado || valor >= 99 ? crudo('disabled') : ''}>+</button>
  </div>`;
}

export function activarSelectores(raiz, alCambiar) {
  raiz.querySelectorAll('[data-cantidad]').forEach((selector) => {
    const input = selector.querySelector('input');
    const [menos, mas] = selector.querySelectorAll('button');
    const actualizarBotones = () => {
      const n = Number(input.value);
      menos.disabled = input.disabled || !(n > 1);
      mas.disabled = input.disabled || !(n < 99);
    };
    selector.querySelectorAll('[data-paso]').forEach((boton) => boton.addEventListener('click', () => {
      const actual = Number.isInteger(Number(input.value)) ? Number(input.value) : 1;
      input.value = Math.min(99, Math.max(1, actual + Number(boton.dataset.paso)));
      actualizarBotones();
      alCambiar?.(input);
    }));
    input.addEventListener('change', () => { actualizarBotones(); alCambiar?.(input); });
    actualizarBotones();
  });
}

// Validación local de cantidades (el servidor vuelve a validar).
export function errorCantidad(valor) {
  const numero = Number(valor);
  if (String(valor).trim() === '' || !Number.isInteger(numero)) return 'Ingresá una cantidad entera.';
  if (numero < 1 || numero > 99) return 'La cantidad debe estar entre 1 y 99.';
  return null;
}
