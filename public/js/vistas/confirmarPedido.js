// VistaResumenCompra (Entrega 7) · CU-16 Realizar pedido: resumen (RF-17), confirmación explícita
// y registro como RECIBIDO (RF-18). Transiciones 10 y 11; sigue la secuencia del CU-16 (Entrega 6).
import { get, post } from '../api.js';
import { html, pintar, precio, errorCarga, alerta, confirmar, ocupar, avisar } from '../ui.js';
import { establecerUnidades } from '../sesion.js';

function nuevaClave() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export default async function confirmarPedido({ main, navegar, esVigente }) {
  // Una clave por resumen mostrado: reintentos o doble clic devuelven el mismo pedido.
  const clave = nuevaClave();
  let carrito;
  let perfil;
  let enviando = false;

  async function cargar(mensaje = null) {
    try {
      [carrito, perfil] = await Promise.all([get('/carrito'), get('/perfil')]);
    } catch (error) {
      pintar(main, html`<div class="contenedor seccion">${errorCarga(error.message)}</div>`);
      main.querySelector('[data-accion="reintentar"]').addEventListener('click', () => cargar());
      return;
    }
    if (!esVigente()) return;
    if (!carrito.lineas.length) {
      avisar('Tu carrito está vacío.');
      return navegar('/carrito', { reemplazar: true });
    }
    render(mensaje);
  }

  function render(mensaje) {
    const bloqueado = carrito.hayNoDisponibles;
    pintar(main, html`<div class="contenedor seccion">
      <a href="/carrito" class="boton boton--texto">← Volver al carrito</a>
      <span class="antetitulo">Paso final</span>
      <h1>Resumen de compra</h1>
      <p class="subtitulo">Revisá los productos, los importes y tus datos antes de confirmar.</p>
      <div data-alerta tabindex="-1">${mensaje ? alerta('aviso', mensaje, 'Actualizamos el resumen') : ''}</div>
      <div class="carrito-grilla mt-2">
        <div class="pila">
          <section aria-labelledby="titulo-productos">
            <h2 id="titulo-productos" class="panel__titulo">Productos</h2>
            <div class="tabla-envoltura">
              <table class="tabla tabla--responsiva">
                <caption class="solo-lectores">Detalle de productos del pedido</caption>
                <thead><tr><th scope="col">Producto</th><th scope="col" class="num">Cantidad</th><th scope="col" class="num">Precio unitario</th><th scope="col" class="num">Subtotal</th></tr></thead>
                <tbody>${carrito.lineas.map((l) => html`<tr>
                  <td data-etiqueta="Producto" class="sin-etiqueta"><strong>${l.nombre}</strong>${l.disponible ? '' : html` <span class="etiqueta etiqueta--agotado">Agotado</span>`}</td>
                  <td data-etiqueta="Cantidad" class="num">${l.cantidad}</td>
                  <td data-etiqueta="Precio unitario" class="num">${precio(l.precioUnitario)}</td>
                  <td data-etiqueta="Subtotal" class="num">${precio(l.subtotal)}</td>
                </tr>`)}</tbody>
              </table>
            </div>
          </section>
          <section class="panel" aria-labelledby="titulo-cliente">
            <div class="barra-acciones">
              <h2 id="titulo-cliente" class="panel__titulo mb-0">Tus datos</h2>
              <a class="boton boton--texto boton--chico" href="/perfil">Editar mis datos</a>
            </div>
            <dl class="datos datos--en-linea">
              <div><dt>Nombre</dt><dd>${perfil.nombre}</dd></div>
              <div><dt>Correo</dt><dd>${perfil.email}</dd></div>
              <div><dt>Teléfono</dt><dd>${perfil.telefono || html`<span class="texto-suave">Sin cargar</span>`}</dd></div>
              <div><dt>Dirección</dt><dd>${perfil.direccion || html`<span class="texto-suave">Sin cargar</span>`}</dd></div>
            </dl>
          </section>
        </div>
        <aside class="panel panel--sombra resumen" aria-labelledby="titulo-total">
          <h2 class="panel__titulo" id="titulo-total">Total del pedido</h2>
          <div class="resumen__fila"><span>Productos</span><span>${carrito.cantidadUnidades} ${carrito.cantidadUnidades === 1 ? 'unidad' : 'unidades'}</span></div>
          <div class="resumen__fila resumen__total"><span>Total</span><span class="precio">${precio(carrito.total)}</span></div>
          ${bloqueado ? alerta('error', 'Hay productos agotados. Volvé al carrito y quitalos para continuar.') : ''}
          <button type="button" class="boton boton--bloque" data-confirmar ${bloqueado ? html`disabled aria-disabled="true"` : ''}>Confirmar compra</button>
          <p class="nota">Al confirmar, tu pedido queda registrado con estado <strong>Recibido</strong>. Esta aplicación no procesa pagos: el pago se coordina con Lately Café.</p>
        </aside>
      </div>
    </div>`);
    if (mensaje) main.querySelector('[data-alerta]').focus();
    main.querySelector('[data-confirmar]').addEventListener('click', enviar);
  }

  async function enviar(evento) {
    if (enviando) return;
    const boton = evento.currentTarget;
    const acepta = await confirmar({
      titulo: '¿Confirmás tu pedido?',
      mensaje: `Vas a registrar un pedido de ${carrito.cantidadUnidades} ${carrito.cantidadUnidades === 1 ? 'unidad' : 'unidades'} por un total de ${precio(carrito.total)}.`,
      detalle: html`<p class="texto-suave">Se registra como recibido con los precios que ves ahora.</p>`,
      textoConfirmar: 'Sí, confirmar pedido',
    });
    if (!acepta) return;

    enviando = true;
    const restaurar = ocupar(boton, 'Confirmando…');
    const lineasAceptadas = carrito.lineas.map(({ productoId, cantidad, precioUnitario }) => ({ productoId, cantidad, precioUnitario }));
    try {
      const { pedido } = await post('/pedidos', { claveIdempotencia: clave, lineasAceptadas });
      establecerUnidades(0);
      navegar(`/mis-pedidos/${pedido.id}?nuevo=1`, { reemplazar: true });
    } catch (error) {
      enviando = false;
      restaurar();
      if (['RESUMEN_DESACTUALIZADO', 'PRODUCTO_AGOTADO'].includes(error.codigo)) return cargar(error.message);
      if (error.codigo === 'CARRITO_VACIO') return navegar('/carrito', { reemplazar: true });
      pintar(main.querySelector('[data-alerta]'), alerta('error', error.message, 'No pudimos registrar el pedido'));
      main.querySelector('[data-alerta]').focus();
    }
  }

  await cargar();
}
