// VistaClases (Entrega 7) · CU-18 Consultar clases · CU-19 Inscribirse (RN-02: cupo máximo 8).
// Transiciones 12 y 13.
import { get, post } from '../api.js';
import { html, pintar, fechaLarga, hora, duracion, vacio, errorCarga, avisar, confirmar, ocupar, alerta } from '../ui.js';
import { usuarioActual } from '../sesion.js';

export function tarjetaClase(clase, { acciones = '' } = {}) {
  const ocupacion = Math.round((clase.inscriptos / clase.cupo) * 100);
  const nivel = clase.completa ? 'cupos--completa' : clase.cuposDisponibles <= 2 ? 'cupos--pocos' : '';
  return html`<article class="clase" data-clase="${clase.id}">
    <div class="clase__imagen">
      <img src="${clase.imagen || '/img/clases.jpg'}" alt="" loading="lazy" width="640" height="360">
      <div class="clase__estado">
        ${clase.completa ? html`<span class="etiqueta etiqueta--agotado">Completa</span>` : html`<span class="etiqueta etiqueta--disponible">Con cupos</span>`}
        ${clase.inscripto ? html`<span class="etiqueta etiqueta--cafe etiqueta--sin-punto">Ya estás inscripto</span>` : ''}
      </div>
    </div>
    <div class="clase__cuerpo">
      <h3>${clase.nombre}</h3>
      <p class="clase__descripcion">${clase.descripcion}</p>
      <dl class="clase__datos">
        <div><dt>Fecha</dt><dd>${fechaLarga(clase.inicio)}</dd></div>
        <div><dt>Horario</dt><dd>${hora(clase.inicio)}</dd></div>
        <div><dt>Duración</dt><dd>${duracion(clase.duracionMin)}</dd></div>
        <div><dt>Docente</dt><dd>${clase.docente}</dd></div>
      </dl>
      <div class="clase__pie">
        <div class="cupos ${nivel}">
          <div class="cupos__texto">
            <span>${clase.completa ? 'Sin cupos disponibles' : `${clase.cuposDisponibles} ${clase.cuposDisponibles === 1 ? 'cupo disponible' : 'cupos disponibles'}`}</span>
            <span class="texto-suave">${clase.inscriptos} de ${clase.cupo}</span>
          </div>
          <div class="cupos__barra" role="progressbar" aria-label="Ocupación de la clase" aria-valuemin="0" aria-valuemax="${clase.cupo}" aria-valuenow="${clase.inscriptos}">
            <div class="cupos__relleno" data-ancho="${ocupacion}"></div>
          </div>
        </div>
        ${acciones}
      </div>
    </div>
  </article>`;
}

export default async function clases({ main, navegar, esVigente }) {
  pintar(main, html`
    <section class="banda fondo-clases">
      <div class="contenedor">
        <span class="antetitulo">Aprendé el oficio</span>
        <h1>Clases de barista</h1>
        <p class="subtitulo">Talleres prácticos en grupos de hasta 8 personas. Elegí tu clase y reservá tu lugar online.</p>
      </div>
    </section>
    <div class="contenedor seccion--compacta">
      <div class="mt-3">${alerta('info', 'Podés cancelar tu inscripción desde “Mis clases” hasta 48 horas antes del inicio. Después de ese plazo ya no es posible cancelarla.', 'Política de cancelación')}</div>
      <div data-lista class="mt-3"></div>
    </div>`);
  const lista = main.querySelector('[data-lista]');

  async function cargar() {
    lista.setAttribute('aria-busy', 'true');
    try {
      const datos = await get('/clases');
      if (!esVigente()) return;
      pintarLista(datos);
    } catch (error) {
      pintar(lista, errorCarga(error.message));
      lista.querySelector('[data-accion="reintentar"]').addEventListener('click', cargar);
    } finally {
      lista.removeAttribute('aria-busy');
    }
  }

  function pintarLista(datos) {
    if (!datos.length) {
      pintar(lista, vacio({ titulo: 'No hay clases programadas por ahora', texto: 'Volvé a consultar pronto: publicamos nuevas fechas periódicamente.', iconoNombre: 'calendario', accion: html`<a class="boton boton--secundario" href="/menu">Ver menú</a>` }));
      return;
    }
    const usuario = usuarioActual();
    pintar(lista, html`<div class="grilla-clases">${datos.map((clase) => tarjetaClase(clase, { acciones: accionesClase(clase, usuario) }))}</div>`);
    lista._clases = datos;
  }

  function accionesClase(clase, usuario) {
    if (usuario?.rol === 'ADMINISTRADOR') return html`<a class="boton boton--secundario" href="/admin/inscriptos?clase=${clase.id}">Ver inscriptos</a>`;
    if (clase.inscripto) return html`<a class="boton boton--secundario" href="/mis-clases">Ver en Mis clases</a>`;
    if (clase.completa) return html`<button type="button" class="boton" disabled aria-disabled="true">Clase completa</button>`;
    return html`<button type="button" class="boton" data-inscribir="${clase.id}">Inscribirme</button>`;
  }

  lista.addEventListener('click', async (evento) => {
    const boton = evento.target.closest('[data-inscribir]');
    if (!boton) return;
    const clase = lista._clases.find((c) => c.id === Number(boton.dataset.inscribir));
    if (!usuarioActual()) {
      avisar('Iniciá sesión para inscribirte a una clase.');
      navegar(`/ingresar?volver=/clases&motivo=clase`);
      return;
    }
    const acepta = await confirmar({
      titulo: 'Confirmar inscripción',
      mensaje: `Vas a inscribirte a “${clase.nombre}”, el ${fechaLarga(clase.inicio).toLowerCase()} a las ${hora(clase.inicio)}.`,
      detalle: html`<p class="texto-suave">Podés cancelarla desde “Mis clases” hasta 48 horas antes del inicio.</p>`,
      textoConfirmar: 'Inscribirme',
    });
    if (!acepta) return;
    const restaurar = ocupar(boton, 'Inscribiendo…');
    try {
      await post(`/clases/${clase.id}/inscripciones`);
      avisar(`¡Listo! Te inscribiste a “${clase.nombre}”.`, 'exito');
    } catch (error) {
      avisar(error.message, 'error');
      restaurar();
    }
    await cargar();
  });

  await cargar();
}
