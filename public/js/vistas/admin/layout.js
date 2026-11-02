// VistaPanelAdmin (Entrega 7): pestañas «Productos», «Clases» y «Estadísticas» (transiciones A1 a A3).
import { html, pintar } from '../../ui.js';

const SECCIONES = [
  ['/admin/productos', 'Productos'],
  ['/admin/clases', 'Clases'],
  ['/admin/estadisticas', 'Estadísticas'],
];

export function layoutAdmin(main, { activa, titulo, descripcion }) {
  pintar(main, html`
    <section class="admin-cabecera">
      <div class="contenedor">
        <span class="antetitulo">Panel de administración</span>
        <h1>${titulo}</h1>
        <p>${descripcion}</p>
        <nav class="admin-nav" aria-label="Secciones de administración">
          ${SECCIONES.map(([href, texto]) => html`<a href="${href}" aria-current="${href === activa ? 'page' : 'false'}">${texto}</a>`)}
        </nav>
      </div>
    </section>
    <div class="contenedor seccion--compacta" data-admin></div>`);
  return main.querySelector('[data-admin]');
}
