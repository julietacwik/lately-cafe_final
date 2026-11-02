// VistaEstadisticas (Entrega 7) · CU-17 Consultar estadísticas de ventas por período: ingresos, cantidad
// de ventas y productos más vendidos. Usa precios históricos (RN-03); no son pagos verificados. Transición A13.
import { get } from '../../api.js';
import { html, pintar, precio, vacio, alerta, hoyArgentina, sumarDias, limpiarErrores, marcarError, mostrarErrores, fecha } from '../../ui.js';
import { layoutAdmin } from './layout.js';

export default async function estadisticas({ main, query, esVigente }) {
  const zona = layoutAdmin(main, {
    activa: '/admin/estadisticas',
    titulo: 'Estadísticas de ventas',
    descripcion: 'Elegí un período para ver el importe de los pedidos, la cantidad de ventas y los productos más vendidos.',
  });
  const hoy = hoyArgentina();
  const desde = query.get('desde') || `${hoy.slice(0, 8)}01`;
  const hasta = query.get('hasta') || hoy;

  pintar(zona, html`
    <form class="panel" novalidate data-filtro>
      <div data-alerta tabindex="-1"></div>
      <div class="filtro-fechas">
        <div class="campo"><label for="campo-desde">Fecha desde</label><input id="campo-desde" type="date" name="desde" value="${desde}" required aria-describedby="error-desde"><p class="campo__error" id="error-desde"></p></div>
        <div class="campo"><label for="campo-hasta">Fecha hasta</label><input id="campo-hasta" type="date" name="hasta" value="${hasta}" required aria-describedby="error-hasta"><p class="campo__error" id="error-hasta"></p></div>
        <button type="submit" class="boton boton--cafe">Consultar</button>
      </div>
      <div class="rangos" role="group" aria-label="Períodos rápidos">
        <button type="button" class="chip" data-rango="7">Últimos 7 días</button>
        <button type="button" class="chip" data-rango="30">Últimos 30 días</button>
        <button type="button" class="chip" data-rango="mes">Este mes</button>
        <button type="button" class="chip" data-rango="90">Últimos 90 días</button>
      </div>
    </form>
    <div data-resultado class="mt-3" aria-live="polite"></div>`);
  const formulario = zona.querySelector('[data-filtro]');
  const resultado = zona.querySelector('[data-resultado]');

  async function consultar() {
    limpiarErrores(formulario);
    const d = formulario.desde.value;
    const h = formulario.hasta.value;
    if (!d) return marcarError(formulario, 'desde', 'Elegí la fecha desde.');
    if (!h) return marcarError(formulario, 'hasta', 'Elegí la fecha hasta.');
    if (d > h) {
      marcarError(formulario, 'desde', 'La fecha desde no puede ser posterior a la fecha hasta.');
      pintar(resultado, '');
      return formulario.desde.focus();
    }
    history.replaceState(null, '', `/admin/estadisticas?desde=${d}&hasta=${h}`);
    pintar(resultado, html`<div class="kpis"><div class="esqueleto"></div><div class="esqueleto"></div><div class="esqueleto"></div></div>`);
    try {
      const datos = await get(`/admin/estadisticas?desde=${d}&hasta=${h}`);
      if (!esVigente()) return;
      render(datos);
    } catch (error) {
      pintar(resultado, '');
      mostrarErrores(formulario, error);
    }
  }

  function render(datos) {
    const periodo = `${fecha(`${datos.desde}T12:00:00-03:00`)} al ${fecha(`${datos.hasta}T12:00:00-03:00`)}`;
    if (!datos.cantidadVentas) {
      pintar(resultado, vacio({ titulo: 'Sin ventas en el período', texto: `No hay pedidos registrados del ${periodo}. Probá con otro rango.`, iconoNombre: 'recibo' }));
      return;
    }
    const maximo = Math.max(...datos.productosMasVendidos.map((p) => p.unidades));
    pintar(resultado, html`
      <p class="texto-suave">Período: ${periodo}</p>
      <div class="kpis">
        <div class="kpi"><p class="kpi__etiqueta">Importe total de pedidos</p><p class="kpi__valor">${precio(datos.importeTotal)}</p><p class="kpi__nota">Según precios registrados en cada pedido</p></div>
        <div class="kpi"><p class="kpi__etiqueta">Cantidad de ventas</p><p class="kpi__valor">${datos.cantidadVentas}</p><p class="kpi__nota">Pedidos confirmados</p></div>
        <div class="kpi"><p class="kpi__etiqueta">Ticket promedio</p><p class="kpi__valor">${precio(datos.ticketPromedio)}</p><p class="kpi__nota">Importe total ÷ ventas</p></div>
      </div>
      <h2>Productos más vendidos</h2>
      <div class="tabla-envoltura">
        <table class="tabla tabla--responsiva">
          <caption class="solo-lectores">Productos más vendidos del período</caption>
          <thead><tr><th scope="col">#</th><th scope="col">Producto</th><th scope="col">Unidades</th><th scope="col" class="num">Importe</th></tr></thead>
          <tbody>${datos.productosMasVendidos.map((p, i) => html`<tr>
            <td data-etiqueta="Puesto">${i + 1}</td>
            <td data-etiqueta="Producto"><strong>${p.nombre}</strong></td>
            <td data-etiqueta="Unidades"><div class="barra-dato">
              <div class="barra-dato__pista" aria-hidden="true"><div class="barra-dato__relleno" data-ancho="${Math.round((p.unidades / maximo) * 100)}"></div></div>
              <span>${p.unidades}</span>
            </div></td>
            <td data-etiqueta="Importe" class="num">${precio(p.importe)}</td>
          </tr>`)}</tbody>
        </table>
      </div>
      <div class="mt-3">${alerta('info', 'Los importes se calculan con los precios históricos guardados en cada pedido. Representan pedidos registrados, no pagos bancarios verificados.')}</div>`);
  }

  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    consultar();
  });
  formulario.addEventListener('click', (evento) => {
    const rango = evento.target.closest('[data-rango]')?.dataset.rango;
    if (!rango) return;
    formulario.hasta.value = hoy;
    formulario.desde.value = rango === 'mes' ? `${hoy.slice(0, 8)}01` : sumarDias(hoy, -(Number(rango) - 1));
    consultar();
  });

  await consultar();
}
