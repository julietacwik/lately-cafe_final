// VistaMisPedidos (Entrega 7) · CU-06 Consultar historial de pedidos y detalle de cada pedido.
import { get } from '../api.js';
import { html, pintar, precio, fechaHora, vacio, errorCarga, alerta, ESTADOS_PEDIDO } from '../ui.js';

export const etiquetaEstado = (estado) => html`<span class="etiqueta etiqueta--disponible">${ESTADOS_PEDIDO[estado] || estado}</span>`;

export function tablaLineas(pedido) {
  return html`<div class="tabla-envoltura">
    <table class="tabla tabla--responsiva">
      <caption class="solo-lectores">Productos del pedido ${pedido.numero}</caption>
      <thead><tr><th scope="col">Producto</th><th scope="col" class="num">Cantidad</th><th scope="col" class="num">Precio unitario</th><th scope="col" class="num">Subtotal</th></tr></thead>
      <tbody>${pedido.lineas.map((l) => html`<tr>
        <td data-etiqueta="Producto" class="sin-etiqueta"><strong>${l.nombre}</strong></td>
        <td data-etiqueta="Cantidad" class="num">${l.cantidad}</td>
        <td data-etiqueta="Precio unitario" class="num">${precio(l.precioUnitario)}</td>
        <td data-etiqueta="Subtotal" class="num">${precio(l.subtotal)}</td>
      </tr>`)}</tbody>
      <tfoot><tr><td colspan="3">Total</td><td class="num">${precio(pedido.total)}</td></tr></tfoot>
    </table>
  </div>`;
}

export async function lista({ main, esVigente }) {
  pintar(main, html`<div class="contenedor seccion">
    <span class="antetitulo">Mi cuenta</span>
    <h1>Mis pedidos</h1>
    <div data-contenido class="mt-2"></div>
  </div>`);
  const contenido = main.querySelector('[data-contenido]');

  async function cargar() {
    try {
      const pedidos = await get('/pedidos');
      if (!esVigente()) return;
      if (!pedidos.length) {
        pintar(contenido, vacio({
          titulo: 'Todavía no hiciste pedidos',
          texto: 'Cuando confirmes tu primer pedido, lo vas a ver acá con su número, estado y detalle.',
          iconoNombre: 'recibo',
          accion: html`<a class="boton" href="/menu">Ver menú</a>`,
        }));
        return;
      }
      pintar(contenido, html`<ul class="lista-pedidos">${pedidos.map((p) => html`<li class="pedido-fila">
        <div>
          <div class="pedido-fila__numero">Pedido ${p.numero}</div>
          <div class="pedido-fila__meta">${fechaHora(p.fecha)}</div>
        </div>
        <div class="pedido-fila__meta">${p.cantidadProductos} ${p.cantidadProductos === 1 ? 'producto' : 'productos'}</div>
        <div class="pedido-fila__total">${precio(p.total)}</div>
        <div class="pedido-fila__acciones">
          ${etiquetaEstado(p.estado)}
          <a class="boton boton--secundario boton--chico" href="/mis-pedidos/${p.id}" aria-label="Ver detalle del pedido ${p.numero}">Ver detalle</a>
        </div>
      </li>`)}</ul>`);
    } catch (error) {
      pintar(contenido, errorCarga(error.message));
      contenido.querySelector('[data-accion="reintentar"]').addEventListener('click', cargar);
    }
  }
  await cargar();
}

export async function detalle({ main, params, query, esVigente }) {
  let pedido;
  try {
    pedido = await get(`/pedidos/${encodeURIComponent(params.id)}`);
  } catch (error) {
    if (!esVigente()) return;
    pintar(main, html`<div class="contenedor seccion">
      <h1 class="solo-lectores">Detalle del pedido</h1>
      ${error.estado === 404
        ? vacio({ titulo: 'No encontramos ese pedido', texto: 'Puede que el número sea incorrecto o que el pedido no pertenezca a tu cuenta.', iconoNombre: 'recibo', accion: html`<a class="boton boton--secundario" href="/mis-pedidos">Ver mis pedidos</a>` })
        : errorCarga(error.message, { reintentar: false })}
    </div>`);
    return;
  }
  if (!esVigente()) return;
  const nuevo = query.get('nuevo') === '1';
  pintar(main, html`<div class="contenedor seccion">
    <a href="/mis-pedidos" class="boton boton--texto">← Mis pedidos</a>
    ${nuevo ? html`<div class="mt-2">${alerta('exito', `Registramos tu pedido ${pedido.numero} con estado “Recibido”. Podés seguirlo desde “Mis pedidos”.`, '¡Pedido confirmado!')}</div>` : ''}
    <div class="barra-acciones mt-3">
      <div>
        <span class="antetitulo">Detalle del pedido</span>
        <h1 class="mb-0">Pedido ${pedido.numero}</h1>
        <p class="texto-suave mb-0">${fechaHora(pedido.fecha)}</p>
      </div>
      ${etiquetaEstado(pedido.estado)}
    </div>
    <div class="carrito-grilla">
      <section aria-label="Productos">${tablaLineas(pedido)}
        <p class="nota">Los precios son los vigentes al momento de confirmar el pedido y no cambian aunque se actualice el menú.</p>
      </section>
      <aside class="panel" aria-labelledby="titulo-datos-pedido">
        <h2 class="panel__titulo" id="titulo-datos-pedido">Datos del pedido</h2>
        <dl class="datos">
          <div><dt>Estado</dt><dd>${ESTADOS_PEDIDO[pedido.estado] || pedido.estado}</dd></div>
          <div><dt>Cliente</dt><dd>${pedido.cliente.nombre}</dd></div>
          <div><dt>Correo</dt><dd>${pedido.cliente.email}</dd></div>
          ${pedido.cliente.telefono ? html`<div><dt>Teléfono</dt><dd>${pedido.cliente.telefono}</dd></div>` : ''}
          ${pedido.cliente.direccion ? html`<div><dt>Dirección</dt><dd>${pedido.cliente.direccion}</dd></div>` : ''}
          <div><dt>Total</dt><dd class="precio">${precio(pedido.total)}</dd></div>
        </dl>
        <a class="boton boton--secundario boton--bloque mt-3" href="/menu">Volver al menú</a>
      </aside>
    </div>
  </div>`);
}
