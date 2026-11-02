// VistaCarrito (Entrega 7) · CU-14 Consultar carrito · CU-15 Modificar carrito. Transiciones 7, 8 y 9.
import { get, patch, borrar } from '../api.js';
import { html, pintar, precio, vacio, errorCarga, avisar, alerta, selectorCantidad, activarSelectores, errorCantidad, confirmar } from '../ui.js';
import { establecerUnidades } from '../sesion.js';

export default async function carrito({ main, esVigente }) {
  let datos = null;

  pintar(main, html`<div class="contenedor seccion">
    <span class="antetitulo">Tu selección</span>
    <h1>Carrito</h1>
    <p class="solo-lectores" aria-live="polite" data-anuncio></p>
    <div data-contenido class="mt-2"></div>
  </div>`);
  const contenido = main.querySelector('[data-contenido]');
  const anuncio = main.querySelector('[data-anuncio]');

  async function cargar() {
    try {
      datos = await get('/carrito');
      if (!esVigente()) return;
      establecerUnidades(datos.cantidadUnidades);
      render();
    } catch (error) {
      pintar(contenido, errorCarga(error.message));
      contenido.querySelector('[data-accion="reintentar"]').addEventListener('click', cargar);
    }
  }

  function render() {
    if (!datos.lineas.length) {
      pintar(contenido, vacio({
        titulo: 'Tu carrito está vacío',
        texto: 'Todavía no agregaste productos. Recorré el menú y elegí lo que más te guste.',
        iconoNombre: 'carrito',
        accion: html`<a class="boton" href="/menu">Ver menú</a>`,
      }));
      return;
    }
    pintar(contenido, html`<div class="carrito-grilla">
      <section aria-label="Productos del carrito">
        ${datos.hayNoDisponibles ? html`<div class="pila">${alerta('error', 'Hay productos agotados en tu carrito. Quitalos para poder continuar con el pedido.', 'Productos agotados')}<span></span></div>` : ''}
        <ul class="lineas">${datos.lineas.map(linea)}</ul>
      </section>
      <aside class="panel panel--sombra resumen" aria-labelledby="titulo-resumen">
        <h2 class="panel__titulo" id="titulo-resumen">Resumen</h2>
        <div class="resumen__fila"><span>Productos</span><span>${datos.cantidadUnidades} ${datos.cantidadUnidades === 1 ? 'unidad' : 'unidades'}</span></div>
        <div class="resumen__fila resumen__total"><span>Total</span><span class="precio" data-total>${precio(datos.total)}</span></div>
        ${datos.hayNoDisponibles
          ? html`<button type="button" class="boton boton--bloque" disabled aria-disabled="true">Continuar con la compra</button>`
          : html`<a class="boton boton--bloque" href="/confirmar-pedido">Continuar con la compra</a>`}
        <a class="boton boton--texto boton--bloque" href="/menu">Seguir comprando</a>
        <p class="nota">Los importes usan los precios vigentes del menú. Quedan fijados en tu pedido al confirmarlo.</p>
      </aside>
    </div>`);
    activarSelectores(contenido, cambiarCantidad);
  }

  function linea(l) {
    return html`<li class="linea" data-linea="${l.productoId}">
      <img src="${l.imagen || '/img/menu.jpg'}" alt="" width="96" height="96" loading="lazy">
      <div class="linea__info">
        <span class="linea__nombre">${l.nombre}</span>
        <span class="linea__unitario">${precio(l.precioUnitario)} c/u</span>
        ${l.disponible ? '' : html`<span><span class="etiqueta etiqueta--agotado">Agotado</span></span>`}
      </div>
      <div class="linea__acciones">
        ${selectorCantidad({ nombre: `cantidad-${l.productoId}`, valor: l.cantidad, etiqueta: `Cantidad de ${l.nombre}` })}
        <span class="linea__subtotal" aria-label="Subtotal">${precio(l.subtotal)}</span>
        <button type="button" class="boton boton--peligro-texto boton--chico" data-quitar="${l.productoId}" aria-label="Quitar ${l.nombre} del carrito">Quitar</button>
      </div>
      <p class="campo__error" id="error-linea-${l.productoId}" aria-live="polite"></p>
    </li>`;
  }

  async function cambiarCantidad(input) {
    const fila = input.closest('[data-linea]');
    const productoId = Number(fila.dataset.linea);
    const original = datos.lineas.find((l) => l.productoId === productoId);
    const error = errorCantidad(input.value);
    const nodoError = fila.querySelector('.campo__error');
    if (error) {
      nodoError.textContent = `${error} No se guardó el cambio.`;
      input.setAttribute('aria-invalid', 'true');
      return;
    }
    const cantidad = Number(input.value);
    if (cantidad === original.cantidad) return;
    fila.classList.add('linea--ocupada');
    try {
      datos = await patch(`/carrito/lineas/${productoId}`, { cantidad });
      establecerUnidades(datos.cantidadUnidades);
      render();
      anuncio.textContent = `Cantidad actualizada. Nuevo total: ${precio(datos.total)}.`;
      contenido.querySelector(`[data-linea="${productoId}"] input`)?.focus();
    } catch (e) {
      fila.classList.remove('linea--ocupada');
      input.value = original.cantidad;
      nodoError.textContent = e.message;
    }
  }

  contenido.addEventListener('click', async (evento) => {
    const boton = evento.target.closest('[data-quitar]');
    if (!boton) return;
    const productoId = Number(boton.dataset.quitar);
    const nombre = datos.lineas.find((l) => l.productoId === productoId)?.nombre;
    const acepta = await confirmar({ titulo: 'Quitar producto', mensaje: `¿Querés quitar ${nombre} del carrito?`, textoConfirmar: 'Quitar', peligro: true });
    if (!acepta) return;
    try {
      datos = await borrar(`/carrito/lineas/${productoId}`);
      establecerUnidades(datos.cantidadUnidades);
      render();
      avisar(`Quitaste ${nombre} del carrito.`, 'exito');
      (contenido.querySelector('[data-quitar]') || contenido.querySelector('a, button'))?.focus();
    } catch (e) {
      avisar(e.message, 'error');
      cargar();
    }
  });

  await cargar();
}
