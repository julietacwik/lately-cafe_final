// VistaLogin y VistaRegistro (Entrega 7) · CU-01 Registro de usuario · CU-02 Inicio de sesión.
// Transiciones 15 a 18: al ingresar, el cliente vuelve a la pantalla de origen y el administrador va al panel.
// El registro público crea solo clientes: el formulario no ofrece elegir rol.
import { post } from '../api.js';
import { html, pintar, alerta, avisar, ocupar, limpiarErrores, marcarError, mostrarErrores, textoDe } from '../ui.js';
import { establecerUsuario } from '../sesion.js';

const MOTIVOS = {
  carrito: 'Iniciá sesión o creá una cuenta para agregar productos al carrito.',
  clase: 'Iniciá sesión o creá una cuenta para inscribirte a una clase.',
  sesion: 'Iniciá sesión para continuar.',
};

function volverSeguro(query) {
  const destino = query.get('volver') || '';
  return destino.startsWith('/') && !destino.startsWith('//') ? destino : null;
}

function enlaceConVolver(ruta, query) {
  const volver = volverSeguro(query);
  return volver ? `${ruta}?volver=${encodeURIComponent(volver)}` : ruta;
}

function campoClave({ nombre, etiqueta, autocompletar, ayuda = '' }) {
  return html`<div class="campo">
    <label for="campo-${nombre}">${etiqueta}</label>
    <div class="campo-clave">
      <input id="campo-${nombre}" name="${nombre}" type="password" autocomplete="${autocompletar}" required maxlength="72"
        aria-describedby="error-${nombre}${ayuda ? ` ayuda-${nombre}` : ''}">
      <button type="button" data-ver-clave aria-pressed="false" aria-label="Mostrar contraseña">Mostrar</button>
    </div>
    ${ayuda ? html`<p class="campo__ayuda" id="ayuda-${nombre}">${ayuda}</p>` : ''}
    <p class="campo__error" id="error-${nombre}"></p>
  </div>`;
}

function estructura(main, { titulo, subtitulo, formulario, pie, cita, query, fondo }) {
  const motivo = MOTIVOS[query.get('motivo')];
  pintar(main, html`<section class="auth">
    <div class="auth__imagen ${fondo}" role="img" aria-label="Fotografía de café de especialidad">
      <p class="auth__cita">${cita}</p>
    </div>
    <div class="auth__contenido">
      <div class="auth__caja">
        <span class="antetitulo">Lately Café</span>
        <h1>${titulo}</h1>
        <p class="subtitulo">${subtitulo}</p>
        ${motivo ? html`<div class="mt-0">${alerta('info', motivo)}</div><br>` : ''}
        ${formulario}
        <p class="auth__pie">${pie}</p>
      </div>
    </div>
  </section>`);

  main.querySelectorAll('[data-ver-clave]').forEach((boton) => boton.addEventListener('click', () => {
    const input = boton.previousElementSibling;
    const visible = input.type === 'text';
    input.type = visible ? 'password' : 'text';
    boton.textContent = visible ? 'Mostrar' : 'Ocultar';
    boton.setAttribute('aria-pressed', String(!visible));
    boton.setAttribute('aria-label', visible ? 'Mostrar contraseña' : 'Ocultar contraseña');
  }));
}

const correoValido = (valor) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor);

export async function ingresar({ main, query, navegar }) {
  estructura(main, {
    titulo: 'Iniciar sesión',
    subtitulo: 'Ingresá para hacer pedidos, inscribirte a clases y ver tu historial.',
    cita: 'Un buen café se disfruta mejor sin apuros.',
    fondo: 'fondo-granos',
    query,
    formulario: html`<form class="formulario" novalidate data-formulario>
      <div data-alerta tabindex="-1"></div>
      <div class="campo">
        <label for="campo-email">Correo electrónico</label>
        <input id="campo-email" name="email" type="email" autocomplete="email" required maxlength="120" aria-describedby="error-email">
        <p class="campo__error" id="error-email"></p>
      </div>
      ${campoClave({ nombre: 'password', etiqueta: 'Contraseña', autocompletar: 'current-password' })}
      <button type="submit" class="boton boton--bloque">Iniciar sesión</button>
    </form>
    <div class="alerta alerta--aviso demo-credenciales">
      <div><strong>Cuentas de demostración</strong>
      <p>Cliente: <code>cliente@lately.demo</code> / <code>Cliente1234</code><br>Administrador: <code>admin@lately.demo</code> / <code>Admin1234</code></p></div>
    </div>`,
    pie: html`¿Todavía no tenés cuenta? <a href="${enlaceConVolver('/registrarse', query)}">Creá una gratis</a>`,
  });

  const formulario = main.querySelector('[data-formulario]');
  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    limpiarErrores(formulario);
    const datos = new FormData(formulario);
    const email = textoDe(datos, 'email');
    const password = String(datos.get('password') || '');
    let valido = true;
    if (!email) valido = !marcarError(formulario, 'email', 'Ingresá tu correo electrónico.');
    else if (!correoValido(email)) valido = !marcarError(formulario, 'email', 'Ingresá un correo válido, por ejemplo nombre@correo.com.');
    if (!password) valido = !marcarError(formulario, 'password', 'Ingresá tu contraseña.') && valido;
    if (!valido) return formulario.querySelector('[aria-invalid="true"]').focus();

    const restaurar = ocupar(formulario.querySelector('[type="submit"]'), 'Ingresando…');
    try {
      const { usuario } = await post('/auth/ingreso', { email, password }, { silenciar401: true });
      establecerUsuario(usuario);
      avisar(`¡Hola, ${usuario.nombre.split(' ')[0]}!`, 'exito');
      navegar(volverSeguro(query) || (usuario.rol === 'ADMINISTRADOR' ? '/admin' : '/menu'), { reemplazar: true });
    } catch (error) {
      restaurar();
      formulario.password.value = '';
      mostrarErrores(formulario, error);
    }
  });
}

export async function registrarse({ main, query, navegar }) {
  estructura(main, {
    titulo: 'Crear cuenta',
    subtitulo: 'Registrate en menos de un minuto. Tu cuenta es de cliente.',
    cita: 'Pedí, aprendé y descubrí nuevos sabores.',
    fondo: 'fondo-salon',
    query,
    formulario: html`<form class="formulario" novalidate data-formulario>
      <div data-alerta tabindex="-1"></div>
      <div class="campo">
        <label for="campo-nombre">Nombre y apellido</label>
        <input id="campo-nombre" name="nombre" type="text" autocomplete="name" required minlength="2" maxlength="80" aria-describedby="error-nombre">
        <p class="campo__error" id="error-nombre"></p>
      </div>
      <div class="campo">
        <label for="campo-email">Correo electrónico</label>
        <input id="campo-email" name="email" type="email" autocomplete="email" required maxlength="120" aria-describedby="error-email">
        <p class="campo__error" id="error-email"></p>
      </div>
      ${campoClave({ nombre: 'password', etiqueta: 'Contraseña', autocompletar: 'new-password', ayuda: 'Mínimo 8 caracteres, combinando letras y números.' })}
      ${campoClave({ nombre: 'confirmacion', etiqueta: 'Repetí la contraseña', autocompletar: 'new-password' })}
      <button type="submit" class="boton boton--bloque">Crear cuenta</button>
    </form>`,
    pie: html`¿Ya tenés cuenta? <a href="${enlaceConVolver('/ingresar', query)}">Iniciá sesión</a>`,
  });

  const formulario = main.querySelector('[data-formulario]');
  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    limpiarErrores(formulario);
    const datos = new FormData(formulario);
    const nombre = textoDe(datos, 'nombre');
    const email = textoDe(datos, 'email');
    const password = String(datos.get('password') || '');
    const confirmacion = String(datos.get('confirmacion') || '');

    const errores = {};
    if (nombre.length < 2) errores.nombre = 'Ingresá tu nombre (al menos 2 caracteres).';
    if (!email) errores.email = 'Ingresá tu correo electrónico.';
    else if (!correoValido(email)) errores.email = 'Ingresá un correo válido, por ejemplo nombre@correo.com.';
    if (password.length < 8) errores.password = 'La contraseña debe tener al menos 8 caracteres.';
    else if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(password) || !/\d/.test(password)) errores.password = 'La contraseña debe combinar letras y números.';
    if (!errores.password && confirmacion !== password) errores.confirmacion = 'Las contraseñas no coinciden.';
    if (Object.keys(errores).length) return mostrarErrores(formulario, { campos: errores });

    const restaurar = ocupar(formulario.querySelector('[type="submit"]'), 'Creando cuenta…');
    try {
      const { usuario } = await post('/auth/registro', { nombre, email, password, confirmacion });
      establecerUsuario(usuario);
      avisar('¡Tu cuenta está lista! Ya podés hacer pedidos e inscribirte a clases.', 'exito');
      navegar(volverSeguro(query) || '/menu', { reemplazar: true });
    } catch (error) {
      restaurar();
      mostrarErrores(formulario, error);
    }
  });
}
