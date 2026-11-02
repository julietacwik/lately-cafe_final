// VistaMenu (Entrega 7) · CU-07 Consultar menú · CU-08 Buscar productos · CU-13 Agregar producto al carrito.
// Transiciones 4, 5 y 6. URL pública y estable: /menu (Menú en QR, Entrega 1). Admite ?q= y ?categoria=
import { get, post } from '../api.js';
import { html, pintar, precio, icono, vacio, errorCarga, avisar, ocupar, selectorCantidad, activarSelectores, errorCantidad } from '../ui.js';
import { usuarioActual, establecerUnidades } from '../sesion.js';

export default async function menu({ main, query, navegar, esVigente }) {
  let busqueda = query.get('q') || '';
  let categoria = query.get('categoria') || '';
  let datos = null;
  let temporizador = null;

  pintar(main, html`
    <section class="banda fondo-menu">
      <div class="contenedor">
        <span class="antetitulo">Lately Café</span>
        <h1>Menú</h1>
        <p class="subtitulo">Cafés de especialidad, bebidas frías y pastelería. Los precios y la disponibilidad se actualizan en el momento.</p>
      </div>
    </section>
    <div class="contenedor">
      <form class="barra-busqueda" role="search" data-busqueda>
        <div class="campo buscador">
          <label for="buscar-producto">Buscar por nombre</label>
          <input id="buscar-producto" type="search" name="q" value="${busqueda}" placeholder="Ej.: cappuccino" autocomplete="off" maxlength="80">
          ${icono('buscar')}
        </div>
        <div class="filtros" data-filtros role="group" aria-label="Filtrar por categoría"></div>
      </form>
      <p class="solo-lectores" aria-live="polite" data-anuncio></p>
      <div data-resultados class="seccion--compacta"></div>
    </div>`);

  const formulario = main.querySelector('[data-busqueda]');
  const resultados = main.querySelector('[data-resultados]');
  const filtros = main.querySelector('[data-filtros]');
  const anuncio = main.querySelector('[data-anuncio]');

  function actualizarUrl() {
    const parametros = new URLSearchParams();
    if (busqueda) parametros.set('q', busqueda);
    if (categoria) parametros.set('categoria', categoria);
    history.replaceState(null, '', `/menu${parametros.size ? `?${parametros}` : ''}`);
  }

  async function cargar() {
    resultados.setAttribute('aria-busy', 'true');
    if (!datos) pintar(resultados, html`<div class="grilla-productos">${Array.from({ length: 6 }, () => html`<div class="esqueleto"></div>`)}</div>`);
    try {
      const respuesta = await get(`/productos?q=${encodeURIComponent(busqueda)}`);
      if (!esVigente()) return;
      datos = respuesta;
      pintarFiltros();
      pintarProductos();
    } catch (error) {
      pintar(resultados, errorCarga(error.message));
      resultados.querySelector('[data-accion="reintentar"]').addEventListener('click', cargar);
    } finally {
      resultados.removeAttribute('aria-busy');
    }
  }

  function pintarFiltros() {
    if (categoria && !datos.categorias.includes(categoria)) categoria = '';
    const chip = (valor, texto) => html`<button type="button" class="chip" data-categoria="${valor}" aria-pressed="${categoria === valor}">${texto}</button>`;
    pintar(filtros, [chip('', 'Todo'), ...datos.categorias.map((c) => chip(c, c))]);
  }

  function pintarProductos() {
    const visibles = datos.productos.filter((p) => !categoria || p.categoria === categoria);
    const total = visibles.length;
    anuncio.textContent = total ? `${total} ${total === 1 ? 'producto encontrado' : 'productos encontrados'}.` : 'No se encontraron productos.';

    if (!total) {
      pintar(resultados, vacio({
        titulo: busqueda ? `No encontramos productos con “${busqueda}”` : 'No hay productos en esta categoría',
        texto: 'Probá con otro nombre o revisá el menú completo.',
        iconoNombre: 'buscar',
        accion: html`<button type="button" class="boton boton--secundario" data-limpiar>Ver todo el menú</button>`,
      }));
      return;
    }

    const grupos = (categoria ? [categoria] : datos.categorias)
      .map((nombre) => ({ nombre, productos: visibles.filter((p) => p.categoria === nombre) }))
      .filter((grupo) => grupo.productos.length);

    pintar(resultados, grupos.map((grupo, indice) => html`
      <section aria-labelledby="categoria-${indice}">
        <div class="categoria-titulo">
          <h2 id="categoria-${indice}">${grupo.nombre}</h2>
          <span>${grupo.productos.length} ${grupo.productos.length === 1 ? 'producto' : 'productos'}</span>
        </div>
        <div class="grilla-productos">${grupo.productos.map(tarjetaProducto)}</div>
      </section>`));
    activarSelectores(resultados, (input) => {
      const error = errorCantidad(input.value);
      input.closest('.producto').querySelector('.campo__error').textContent = error || '';
      input.setAttribute('aria-invalid', String(Boolean(error)));
    });
  }

  function tarjetaProducto(producto) {
    const usuario = usuarioActual();
    const esAdmin = usuario?.rol === 'ADMINISTRADOR';
    const idCantidad = `cantidad-${producto.id}`;
    return html`<article class="producto ${producto.disponible ? '' : 'producto--agotado'}" data-producto="${producto.id}">
      <div class="producto__imagen">
        <img src="${producto.imagen || '/img/menu.jpg'}" alt="${producto.nombre}" loading="lazy" width="640" height="480">
        <span class="producto__estado etiqueta ${producto.disponible ? 'etiqueta--disponible' : 'etiqueta--agotado'}">${producto.disponible ? 'Disponible' : 'Agotado'}</span>
      </div>
      <div class="producto__cuerpo">
        <span class="producto__categoria">${producto.categoria}</span>
        <h3 class="producto__nombre">${producto.nombre}</h3>
        <p class="producto__descripcion">${producto.descripcion}</p>
        <div class="producto__pie">
          <span class="precio">${precio(producto.precio)}</span>
          ${esAdmin ? '' : html`<div class="producto__compra">
            ${selectorCantidad({ nombre: idCantidad, etiqueta: `Cantidad de ${producto.nombre}`, deshabilitado: !producto.disponible })}
            <button type="button" class="boton" data-agregar="${producto.id}" ${producto.disponible ? '' : html`disabled aria-disabled="true"`}>
              ${producto.disponible ? 'Agregar al carrito' : 'Agotado'}
            </button>
          </div>
          <p class="campo__error" aria-live="polite"></p>`}
        </div>
      </div>
    </article>`;
  }

  async function agregar(boton) {
    const producto = datos.productos.find((p) => p.id === Number(boton.dataset.agregar));
    if (!usuarioActual()) {
      avisar('Iniciá sesión para agregar productos al carrito.');
      navegar(`/ingresar?volver=${encodeURIComponent(location.pathname + location.search)}&motivo=carrito`);
      return;
    }
    const tarjeta = boton.closest('.producto');
    const input = tarjeta.querySelector('input[type="number"]');
    const error = errorCantidad(input.value);
    if (error) {
      tarjeta.querySelector('.campo__error').textContent = error;
      input.focus();
      return;
    }
    const cantidad = Number(input.value);
    const restaurar = ocupar(boton, 'Agregando…');
    try {
      const carrito = await post('/carrito/lineas', { productoId: producto.id, cantidad });
      establecerUnidades(carrito.cantidadUnidades);
      avisar(`Agregaste ${cantidad} × ${producto.nombre} al carrito.`, 'exito');
      input.value = 1;
      input.dispatchEvent(new Event('change'));
    } catch (e) {
      avisar(e.message, 'error');
      if (e.codigo === 'PRODUCTO_AGOTADO' || e.estado === 404) { restaurar(); return cargar(); }
    }
    restaurar();
  }

  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    clearTimeout(temporizador);
    busqueda = formulario.q.value.trim();
    actualizarUrl();
    cargar();
  });
  formulario.q.addEventListener('input', () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      busqueda = formulario.q.value.trim();
      actualizarUrl();
      cargar();
    }, 300);
  });
  filtros.addEventListener('click', (evento) => {
    const chip = evento.target.closest('[data-categoria]');
    if (!chip) return;
    categoria = chip.dataset.categoria;
    actualizarUrl();
    pintarFiltros();
    pintarProductos();
  });
  resultados.addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-agregar]');
    if (boton && !boton.disabled) return agregar(boton);
    if (evento.target.closest('[data-limpiar]')) {
      busqueda = '';
      categoria = '';
      formulario.q.value = '';
      actualizarUrl();
      cargar();
      formulario.q.focus();
    }
  });

  await cargar();
}
