// VistaInicio (Entrega 7). Transiciones 1 («Menú») y 2 («Clases»).
import { get } from '../api.js';
import { html, pintar, precio, fechaLarga, hora } from '../ui.js';
import { usuarioActual } from '../sesion.js';

export default async function inicio({ main, esVigente }) {
  const usuario = usuarioActual();
  pintar(main, html`
    <section class="banda portada fondo-portada">
      <div class="contenedor">
        <span class="antetitulo">Café de especialidad</span>
        <h1>Tu próximo café favorito empieza acá.</h1>
        <p class="subtitulo">Mirá el menú, armá tu pedido para retirar y aprendé el oficio en nuestras clases de barista.</p>
        <div class="acciones">
          <a class="boton boton--claro" href="/menu">Ver menú</a>
          <a class="boton boton--sobre-foto" href="/clases">Conocer las clases</a>
        </div>
      </div>
    </section>

    <section class="contenedor">
      <div class="tarjetas-acceso">
        <a class="tarjeta-acceso" href="/menu">
          <img src="/img/productos/flat-white.jpg" alt="Flat white con arte latte" loading="lazy">
          <div class="tarjeta-acceso__cuerpo">
            <h2 class="mb-0">Menú</h2>
            <p>Cafés, bebidas frías y pastelería, con precios y disponibilidad actualizados.</p>
            <span class="tarjeta-acceso__enlace">Ver menú →</span>
          </div>
        </a>
        <a class="tarjeta-acceso" href="/clases">
          <img src="/img/clases/latte-art.jpg" alt="Barista vertiendo leche sobre un espresso" loading="lazy">
          <div class="tarjeta-acceso__cuerpo">
            <h2 class="mb-0">Clases de barista</h2>
            <p>Grupos reducidos de hasta 8 personas. Inscribite online y gestioná tus lugares.</p>
            <span class="tarjeta-acceso__enlace">Ver clases →</span>
          </div>
        </a>
        <a class="tarjeta-acceso" href="${usuario ? '/perfil' : '/registrarse'}">
          <img src="/img/salon.jpg" alt="Salón de una cafetería con mesas de madera" loading="lazy">
          <div class="tarjeta-acceso__cuerpo">
            <h2 class="mb-0">${usuario ? 'Mi cuenta' : 'Creá tu cuenta'}</h2>
            <p>${usuario ? 'Consultá tus pedidos, tus clases y tus datos.' : 'Registrate para hacer pedidos, inscribirte a clases y ver tu historial.'}</p>
            <span class="tarjeta-acceso__enlace">${usuario ? 'Ir a mi cuenta →' : 'Crear cuenta →'}</span>
          </div>
        </a>
      </div>
    </section>

    <section class="seccion contenedor" aria-labelledby="titulo-destacados">
      <div class="seccion__cabecera">
        <div>
          <span class="antetitulo">Del menú</span>
          <h2 id="titulo-destacados" class="mb-0">Para empezar el día</h2>
        </div>
        <a class="boton boton--secundario" href="/menu">Ver todo el menú</a>
      </div>
      <div class="grilla-productos" data-destacados>
        <div class="esqueleto"></div><div class="esqueleto"></div><div class="esqueleto"></div><div class="esqueleto"></div>
      </div>
    </section>

    <section class="seccion contenedor" aria-labelledby="titulo-clases">
      <div class="dos-columnas">
        <div>
          <span class="antetitulo">Aprendé con nosotros</span>
          <h2 id="titulo-clases">Clases de barista en grupos reducidos</h2>
          <ul class="lista-check">
            <li>Cupo máximo de 8 alumnos por clase.</li>
            <li>Inscripción online con confirmación inmediata.</li>
            <li>Podés cancelar hasta 48 horas antes del inicio.</li>
          </ul>
          <div data-proximas class="pila"></div>
          <a class="boton mt-2" href="/clases">Ver clases e inscribirme</a>
        </div>
        <img class="foto-redondeada" src="/img/clases/espresso.jpg" alt="Tabla con portafiltros, café molido y un capuchino" loading="lazy">
      </div>
    </section>`);

  const [menu, clases] = await Promise.allSettled([get('/productos'), get('/clases')]);
  if (!esVigente()) return;

  const destacados = main.querySelector('[data-destacados]');
  if (menu.status === 'fulfilled') {
    const disponibles = menu.value.productos.filter((p) => p.disponible).slice(0, 4);
    pintar(destacados, disponibles.map((producto) => html`
      <a class="producto tarjeta-acceso" href="/menu">
        <div class="producto__imagen"><img src="${producto.imagen || '/img/menu.jpg'}" alt="" loading="lazy"></div>
        <div class="producto__cuerpo">
          <span class="producto__categoria">${producto.categoria}</span>
          <h3 class="producto__nombre">${producto.nombre}</h3>
          <span class="precio">${precio(producto.precio)}</span>
        </div>
      </a>`));
  } else {
    pintar(destacados, html`<p class="texto-suave">No pudimos cargar los destacados. <a href="/menu">Ir al menú</a>.</p>`);
  }

  const proximas = main.querySelector('[data-proximas]');
  if (clases.status === 'fulfilled' && clases.value.length) {
    pintar(proximas, clases.value.slice(0, 2).map((clase) => html`
      <div class="alerta alerta--info">
        <div><strong>${clase.nombre}</strong>
        <p>${fechaLarga(clase.inicio)} · ${hora(clase.inicio)} · ${clase.completa ? 'Completa' : `${clase.cuposDisponibles} ${clase.cuposDisponibles === 1 ? 'cupo disponible' : 'cupos disponibles'}`}</p></div>
      </div>`));
  }
}
