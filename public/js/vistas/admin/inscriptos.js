// VistaAdminClases, pantalla «Inscriptos de la clase» (Entrega 7) · CU-24 Consultar inscriptos. Transición A12.
import { get } from '../../api.js';
import { html, pintar, fecha, fechaLarga, hora, fechaHora, vacio, errorCarga } from '../../ui.js';
import { layoutAdmin } from './layout.js';

export default async function inscriptos({ main, query, navegar, esVigente }) {
  const zona = layoutAdmin(main, {
    activa: '/admin/clases',
    titulo: 'Inscriptos de la clase',
    descripcion: 'Consultá cuántas personas hay inscriptas en cada clase y quiénes son.',
  });

  let clases;
  try {
    clases = await get('/admin/clases');
  } catch (error) {
    pintar(zona, errorCarga(error.message, { reintentar: false }));
    return;
  }
  if (!esVigente()) return;
  if (!clases.length) {
    pintar(zona, vacio({ titulo: 'No hay clases cargadas', texto: 'Cuando crees clases, vas a poder consultar sus inscriptos acá.', iconoNombre: 'calendario', accion: html`<a class="boton" href="/admin/clases">Ir a Clases</a>` }));
    return;
  }
  clases.sort((a, b) => Number(a.finalizada) - Number(b.finalizada) || a.inicio.localeCompare(b.inicio));
  const seleccion = Number(query.get('clase')) || clases[0].id;

  pintar(zona, html`<div class="inscriptos-grilla">
    <nav aria-label="Clases">
      <ul class="lista-clases-admin">${clases.map((c) => html`<li>
        <a href="/admin/inscriptos?clase=${c.id}" aria-current="${c.id === seleccion}">
          <strong>${c.nombre}</strong>
          <small>${fecha(c.inicio)} · ${hora(c.inicio)}${c.finalizada ? ' · Finalizada' : ''}</small>
          <small><strong>${c.inscriptos}</strong> de ${c.cupo} inscriptos</small>
        </a>
      </li>`)}</ul>
    </nav>
    <section data-detalle aria-live="polite"></section>
  </div>`);
  const detalle = zona.querySelector('[data-detalle]');

  try {
    const datos = await get(`/admin/clases/${seleccion}/inscriptos`);
    if (!esVigente()) return;
    const { clase } = datos;
    pintar(detalle, html`
      <div class="panel">
        <h2 class="mb-0">${clase.nombre}</h2>
        <p class="texto-suave">${fechaLarga(clase.inicio)} · ${hora(clase.inicio)} · Docente: ${clase.docente}</p>
        <div class="kpis">
          <div class="kpi"><p class="kpi__etiqueta">Inscriptos</p><p class="kpi__valor">${clase.inscriptos}</p></div>
          <div class="kpi"><p class="kpi__etiqueta">Cupo</p><p class="kpi__valor">${clase.cupo}</p></div>
          <div class="kpi"><p class="kpi__etiqueta">Disponibles</p><p class="kpi__valor">${clase.cuposDisponibles}</p></div>
        </div>
        ${datos.inscriptos.length ? html`<div class="tabla-envoltura">
          <table class="tabla tabla--responsiva">
            <caption class="solo-lectores">Participantes de ${clase.nombre}</caption>
            <thead><tr><th scope="col">#</th><th scope="col">Nombre</th><th scope="col">Correo</th><th scope="col">Teléfono</th><th scope="col">Inscripción</th></tr></thead>
            <tbody>${datos.inscriptos.map((p, i) => html`<tr>
              <td data-etiqueta="#">${i + 1}</td>
              <td data-etiqueta="Nombre"><strong>${p.nombre}</strong></td>
              <td data-etiqueta="Correo">${p.email}</td>
              <td data-etiqueta="Teléfono">${p.telefono || '—'}</td>
              <td data-etiqueta="Inscripción">${fechaHora(p.inscriptoEn)}</td>
            </tr>`)}</tbody>
          </table>
        </div>` : vacio({ titulo: 'Sin inscriptos', texto: 'Esta clase todavía no tiene inscripciones activas.', iconoNombre: 'calendario' })}
      </div>`);
  } catch (error) {
    if (error.estado === 404) return navegar('/admin/inscriptos', { reemplazar: true });
    pintar(detalle, errorCarga(error.message, { reintentar: false }));
  }
}
