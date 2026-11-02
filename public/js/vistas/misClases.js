// VistaMisClases (Entrega 7) · CU-20 Cancelar inscripción (RN-01: hasta 48 h antes, hora del servidor).
// Transición 14; sigue la secuencia del CU-20 (Entrega 6).
import { get, borrar } from '../api.js';
import { html, pintar, fechaLarga, hora, duracion, fechaHora, vacio, errorCarga, avisar, confirmar, ocupar, alerta } from '../ui.js';

export default async function misClases({ main, esVigente }) {
  let inscripciones = [];
  pintar(main, html`<div class="contenedor seccion">
    <span class="antetitulo">Mi cuenta</span>
    <h1>Mis clases</h1>
    <p class="subtitulo">Tus inscripciones a clases de barista. Podés cancelar hasta 48 horas antes del inicio.</p>
    <div data-contenido class="mt-2"></div>
  </div>`);
  const contenido = main.querySelector('[data-contenido]');

  async function cargar() {
    try {
      inscripciones = await get('/inscripciones');
      if (!esVigente()) return;
      render();
    } catch (error) {
      pintar(contenido, errorCarga(error.message));
      contenido.querySelector('[data-accion="reintentar"]').addEventListener('click', cargar);
    }
  }

  function render() {
    if (!inscripciones.length) {
      pintar(contenido, vacio({
        titulo: 'Todavía no te inscribiste a ninguna clase',
        texto: 'Elegí una clase de barista y reservá tu lugar.',
        iconoNombre: 'calendario',
        accion: html`<a class="boton" href="/clases">Ver clases</a>`,
      }));
      return;
    }
    const ahora = Date.now();
    const activas = inscripciones.filter((i) => new Date(i.clase.inicio) > ahora);
    const historial = inscripciones.filter((i) => !activas.includes(i));
    pintar(contenido, html`
      <section aria-labelledby="titulo-proximas">
        <h2 id="titulo-proximas">Próximas clases</h2>
        ${activas.length ? html`<div class="pila">${activas.map(tarjeta)}</div>`
          : html`<p class="texto-suave">No tenés clases próximas. <a href="/clases">Ver clases disponibles</a>.</p>`}
      </section>
      ${historial.length ? html`<section class="mt-3" aria-labelledby="titulo-historial">
        <h2 id="titulo-historial">Clases realizadas</h2>
        <div class="pila">${historial.map(tarjeta)}</div>
      </section>` : ''}`);
  }

  function tarjeta(inscripcion) {
    const { clase } = inscripcion;
    const activa = true;
    const yaPaso = new Date(clase.inicio) <= Date.now();
    let acciones;
    if (activa && inscripcion.puedeCancelar) {
      acciones = html`<button type="button" class="boton boton--peligro-texto" data-cancelar="${inscripcion.id}">Cancelar inscripción</button>
        <p class="inscripcion__motivo">Podés cancelar hasta el ${fechaHora(inscripcion.limiteCancelacion)}.</p>`;
    } else if (activa && !yaPaso) {
      acciones = html`<button type="button" class="boton boton--secundario" disabled aria-disabled="true" aria-describedby="motivo-${inscripcion.id}">Cancelación no disponible</button>
        <p class="inscripcion__motivo" id="motivo-${inscripcion.id}">${inscripcion.motivoNoCancelable} El límite era el ${fechaHora(inscripcion.limiteCancelacion)}.</p>`;
    } else {
      acciones = html`<p class="inscripcion__motivo">Clase finalizada.</p>`;
    }
    return html`<article class="inscripcion ${activa && !yaPaso ? '' : 'inscripcion--inactiva'}">
      <img src="${clase.imagen || '/img/clases.jpg'}" alt="" loading="lazy" width="320" height="200">
      <div class="pila">
        <div class="acciones">${yaPaso ? html`<span class="etiqueta etiqueta--neutra">Finalizada</span>` : html`<span class="etiqueta etiqueta--disponible">Inscripto</span>`}</div>
        <h3 class="mb-0">${clase.nombre}</h3>
        <dl class="clase__datos">
          <div><dt>Fecha</dt><dd>${fechaLarga(clase.inicio)}</dd></div>
          <div><dt>Horario</dt><dd>${hora(clase.inicio)} · ${duracion(clase.duracionMin)}</dd></div>
          <div><dt>Docente</dt><dd>${clase.docente}</dd></div>
          <div><dt>Cupos</dt><dd>${clase.inscriptos} de ${clase.cupo} ocupados</dd></div>
        </dl>
      </div>
      <div class="inscripcion__acciones">${acciones}</div>
    </article>`;
  }

  contenido.addEventListener('click', async (evento) => {
    const boton = evento.target.closest('[data-cancelar]');
    if (!boton) return;
    const inscripcion = inscripciones.find((i) => i.id === Number(boton.dataset.cancelar));
    const acepta = await confirmar({
      titulo: 'Cancelar inscripción',
      mensaje: `¿Querés cancelar tu inscripción a “${inscripcion.clase.nombre}” del ${fechaLarga(inscripcion.clase.inicio).toLowerCase()}?`,
      detalle: html`<p class="texto-suave">Tu lugar quedará libre para otra persona.</p>`,
      textoConfirmar: 'Sí, cancelar inscripción',
      textoCancelar: 'Mantener inscripción',
      peligro: true,
    });
    if (!acepta) return;
    const restaurar = ocupar(boton, 'Cancelando…');
    try {
      await borrar(`/inscripciones/${inscripcion.id}`);
      avisar('Cancelaste tu inscripción.', 'exito');
    } catch (error) {
      restaurar();
      pintar(contenido.insertBefore(document.createElement('div'), contenido.firstChild), alerta('error', error.message, 'No se pudo cancelar'));
      return;
    }
    await cargar();
  });

  await cargar();
}
