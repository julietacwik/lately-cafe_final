// Punto de entrada de la interfaz: encabezado, rutas y sesión.
import { iniciarRouter, navegar } from './router.js';
import { cargarSesion, suscribir, usuarioActual, unidadesCarrito, cerrarSesion, establecerUsuario } from './sesion.js';
import { alVencerSesion } from './api.js';
import { html, pintar, icono, avisar } from './ui.js';

const definiciones = [
  { patron: '/', titulo: 'Inicio', carga: () => import('./vistas/inicio.js') },
  { patron: '/menu', titulo: 'Menú', carga: () => import('./vistas/menu.js') },
  { patron: '/clases', titulo: 'Clases de barista', carga: () => import('./vistas/clases.js') },
  { patron: '/ingresar', titulo: 'Iniciar sesión', acceso: 'invitado', carga: () => import('./vistas/acceso.js'), vista: 'ingresar' },
  { patron: '/registrarse', titulo: 'Crear cuenta', acceso: 'invitado', carga: () => import('./vistas/acceso.js'), vista: 'registrarse' },
  { patron: '/perfil', titulo: 'Mi perfil', acceso: 'sesion', carga: () => import('./vistas/perfil.js') },
  { patron: '/carrito', titulo: 'Carrito', acceso: 'cliente', carga: () => import('./vistas/carrito.js') },
  { patron: '/confirmar-pedido', titulo: 'Resumen de compra', acceso: 'cliente', carga: () => import('./vistas/confirmarPedido.js') },
  { patron: '/mis-pedidos', titulo: 'Mis pedidos', acceso: 'cliente', carga: () => import('./vistas/pedidos.js'), vista: 'lista' },
  { patron: '/mis-pedidos/:id', titulo: 'Detalle del pedido', acceso: 'cliente', carga: () => import('./vistas/pedidos.js'), vista: 'detalle' },
  { patron: '/mis-clases', titulo: 'Mis clases', acceso: 'cliente', carga: () => import('./vistas/misClases.js') },
  { patron: '/admin', redirigir: '/admin/productos' },
  { patron: '/admin/productos', titulo: 'Administración · Productos', acceso: 'admin', carga: () => import('./vistas/admin/productos.js') },
  { patron: '/admin/clases', titulo: 'Administración · Clases', acceso: 'admin', carga: () => import('./vistas/admin/clases.js') },
  { patron: '/admin/inscriptos', titulo: 'Administración · Inscriptos de la clase', acceso: 'admin', carga: () => import('./vistas/admin/inscriptos.js') },
  { patron: '/admin/estadisticas', titulo: 'Administración · Estadísticas', acceso: 'admin', carga: () => import('./vistas/admin/estadisticas.js') },
];

const encabezado = document.getElementById('encabezado');
let rutaActual = location.pathname;
let navAbierta = false;

function actual(ruta, exacta = false) {
  const coincide = exacta ? rutaActual === ruta : rutaActual === ruta || rutaActual.startsWith(`${ruta}/`);
  return coincide ? 'page' : 'false';
}

function pintarEncabezado() {
  const usuario = usuarioActual();
  const enlace = (href, texto, exacta = false) => html`<li><a class="nav__enlace" href="${href}" aria-current="${actual(href, exacta)}">${texto}</a></li>`;
  const unidades = unidadesCarrito();

  let acciones;
  if (!usuario) {
    acciones = html`<a class="boton boton--secundario boton--chico" href="/ingresar">Iniciar sesión</a>
      <a class="boton boton--cafe boton--chico" href="/registrarse">Crear cuenta</a>`;
  } else if (usuario.rol === 'ADMINISTRADOR') {
    acciones = html`<a class="nav__enlace" href="/perfil" aria-current="${actual('/perfil')}">Mi perfil</a>
      <button type="button" class="boton boton--secundario boton--chico" data-salir>Cerrar sesión</button>`;
  } else {
    acciones = html`<a class="nav__enlace carrito-enlace" href="/carrito" aria-current="${actual('/carrito')}">
        ${icono('carrito')}<span>Carrito</span>
        <span class="insignia" aria-label="${unidades} ${unidades === 1 ? 'unidad' : 'unidades'} en el carrito">${unidades}</span>
      </a>
      <a class="nav__enlace" href="/perfil" aria-current="${actual('/perfil')}">Mi cuenta</a>`;
  }

  pintar(encabezado, html`
    ${usuario?.rol === 'ADMINISTRADOR' ? html`<div class="franja-admin"><div class="contenedor">
      <span>Sesión de administración: ${usuario.nombre}</span><a href="/admin">Ir al panel</a></div></div>` : ''}
    <div class="contenedor encabezado__interior">
      <a class="marca" href="/"><img src="/img/logo.png" alt="" width="34" height="34">Lately Café</a>
      <button class="menu-boton" type="button" aria-expanded="${navAbierta}" aria-controls="navegacion" aria-label="${navAbierta ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'}">
        ${icono(navAbierta ? 'cerrar' : 'menu')}
      </button>
      <nav class="nav ${navAbierta ? 'nav--abierta' : ''}" id="navegacion" aria-label="Navegación principal">
        <ul class="nav__lista">
          ${enlace('/', 'Inicio', true)}
          ${enlace('/menu', 'Menú')}
          ${enlace('/clases', 'Clases')}
          ${usuario?.rol === 'CLIENTE' ? [enlace('/mis-pedidos', 'Mis pedidos'), enlace('/mis-clases', 'Mis clases')] : ''}
          ${usuario?.rol === 'ADMINISTRADOR' ? enlace('/admin', 'Panel admin') : ''}
        </ul>
        <div class="nav__acciones">${acciones}</div>
      </nav>
    </div>`);
}

encabezado.addEventListener('click', async (evento) => {
  if (evento.target.closest('.menu-boton')) {
    navAbierta = !navAbierta;
    pintarEncabezado();
    encabezado.querySelector('.menu-boton').focus();
    return;
  }
  if (evento.target.closest('[data-salir]')) {
    await cerrarSesion();
    avisar('Cerraste sesión. ¡Hasta pronto!', 'exito');
    navegar('/');
  }
});

document.addEventListener('keydown', (evento) => {
  if (evento.key === 'Escape' && navAbierta) {
    navAbierta = false;
    pintarEncabezado();
    encabezado.querySelector('.menu-boton')?.focus();
  }
});

// Si el servidor indica que la sesión venció, se vuelve al ingreso.
alVencerSesion(() => {
  if (!usuarioActual()) return;
  establecerUsuario(null);
  avisar('Tu sesión venció. Volvé a iniciar sesión.', 'error');
  navegar(`/ingresar?volver=${encodeURIComponent(location.pathname)}`);
});

suscribir(pintarEncabezado);

await cargarSesion();
iniciarRouter({
  main: document.getElementById('contenido'),
  definiciones,
  alCambiar: (ruta) => {
    rutaActual = ruta;
    navAbierta = false;
    pintarEncabezado();
  },
});
