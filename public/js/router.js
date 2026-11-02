// Enrutador del lado del cliente con URLs reales (History API).
// /menu es una URL pública y estable, apta para un código QR.
import { usuarioActual } from './sesion.js';
import { pintar, cargando, errorCarga, html, vacio } from './ui.js';

let rutas = [];
let principal = null;
let alCambiarRuta = () => {};
let turno = 0;
// En la carga inicial el foco queda al principio ("Saltar al contenido"); solo se mueve
// al título cuando la persona navega a otra página.
let huboNavegacion = false;

function compilar(patron) {
  const nombres = [];
  const expresion = patron.replace(/:(\w+)/g, (_, nombre) => { nombres.push(nombre); return '([^/]+)'; });
  return { expresion: new RegExp(`^${expresion}/?$`), nombres };
}

export function iniciarRouter({ main, definiciones, alCambiar }) {
  principal = main;
  alCambiarRuta = alCambiar;
  rutas = definiciones.map((ruta) => ({ ...ruta, ...compilar(ruta.patron) }));

  document.addEventListener('click', (evento) => {
    const enlace = evento.target.closest('a[href]');
    if (!enlace || evento.defaultPrevented || evento.button !== 0 || evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;
    if (enlace.target || enlace.hasAttribute('download') || enlace.origin !== location.origin) return;
    if (enlace.pathname.startsWith('/api/') || enlace.pathname.startsWith('/uploads/') || enlace.getAttribute('href').startsWith('#')) return;
    evento.preventDefault();
    navegar(enlace.pathname + enlace.search);
  });
  window.addEventListener('popstate', () => { huboNavegacion = true; resolver(); });
  resolver();
}

export function navegar(url, { reemplazar = false } = {}) {
  if (!reemplazar) huboNavegacion = true;
  if (url === location.pathname + location.search && !reemplazar) return resolver({ mantenerScroll: true });
  history[reemplazar ? 'replaceState' : 'pushState'](null, '', url);
  return resolver();
}

export const recargarVista = () => resolver({ mantenerScroll: true });

function urlIngreso(motivo) {
  const volver = encodeURIComponent(location.pathname + location.search);
  return `/ingresar?volver=${volver}${motivo ? `&motivo=${motivo}` : ''}`;
}

async function resolver({ mantenerScroll = false } = {}) {
  const miTurno = ++turno;
  const ruta = location.pathname;
  const encontrada = rutas.find((r) => r.expresion.test(ruta));
  const query = new URLSearchParams(location.search);
  alCambiarRuta(ruta);

  if (!encontrada) return mostrarNoEncontrado();
  if (encontrada.redirigir) return navegar(encontrada.redirigir, { reemplazar: true });

  const usuario = usuarioActual();
  const acceso = encontrada.acceso;
  if (acceso === 'invitado' && usuario) {
    return navegar(query.get('volver') || (usuario.rol === 'ADMINISTRADOR' ? '/admin' : '/perfil'), { reemplazar: true });
  }
  if (['sesion', 'cliente', 'admin'].includes(acceso) && !usuario) return navegar(urlIngreso('sesion'), { reemplazar: true });
  if (acceso === 'cliente' && usuario.rol !== 'CLIENTE') return mostrarSinPermiso('Esta sección es para clientes. Las cuentas de administración no realizan pedidos ni inscripciones.');
  if (acceso === 'admin' && usuario.rol !== 'ADMINISTRADOR') return mostrarSinPermiso('Esta sección es exclusiva del equipo de administración de Lately Café.');

  const valores = encontrada.expresion.exec(ruta).slice(1);
  const params = Object.fromEntries(encontrada.nombres.map((nombre, i) => [nombre, decodeURIComponent(valores[i])]));
  document.title = `${encontrada.titulo} · Lately Café`;
  pintar(principal, cargando());
  if (!mantenerScroll) window.scrollTo(0, 0);

  try {
    const modulo = await encontrada.carga();
    if (miTurno !== turno) return;
    const contenedor = document.createElement('div');
    contenedor.className = 'vista';
    principal.replaceChildren(contenedor);
    await modulo[encontrada.vista || 'default']({ main: contenedor, params, query, navegar, esVigente: () => miTurno === turno });
    if (miTurno !== turno) return;
    if (!mantenerScroll && huboNavegacion) enfocarTitulo();
  } catch (error) {
    if (miTurno !== turno) return;
    console.error(error);
    pintar(principal, html`<div class="contenedor seccion">${errorCarga(error.message || 'Ocurrió un error al abrir la página.')}</div>`);
    principal.querySelector('[data-accion="reintentar"]')?.addEventListener('click', () => resolver());
  }
}

function enfocarTitulo() {
  const titulo = principal.querySelector('h1');
  if (titulo) {
    titulo.setAttribute('tabindex', '-1');
    titulo.focus({ preventScroll: true });
  }
}

function mostrarNoEncontrado() {
  document.title = 'Página no encontrada · Lately Café';
  pintar(principal, html`<section class="contenedor seccion">
    <h1 class="solo-lectores">Página no encontrada</h1>
    ${vacio({ titulo: 'No encontramos esta página', texto: 'Puede que el enlace haya cambiado. Te dejamos un atajo al menú.', accion: html`<a class="boton" href="/menu">Ver menú</a>` })}
  </section>`);
  enfocarTitulo();
}

function mostrarSinPermiso(texto) {
  document.title = 'Acceso restringido · Lately Café';
  pintar(principal, html`<section class="contenedor seccion">
    <h1 class="solo-lectores">Acceso restringido</h1>
    ${vacio({ titulo: 'Acceso restringido', texto, iconoNombre: 'candado', accion: html`<a class="boton boton--secundario" href="/">Ir al inicio</a>` })}
  </section>`);
  enfocarTitulo();
}

