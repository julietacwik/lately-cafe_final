// VistaPerfil (Entrega 7) · CU-04 Consultar perfil · CU-05 Modificar perfil (nombre, foto, dirección, teléfono)
// · CU-03 Cerrar sesión. Transiciones 19 a 23.
import { get, put, enviarFormulario } from '../api.js';
import { html, pintar, alerta, avisar, ocupar, limpiarErrores, mostrarErrores, campo, iniciales, errorCarga, vistaPreviaImagen, textoDe } from '../ui.js';
import { establecerUsuario, cerrarSesion } from '../sesion.js';

export default async function perfil({ main, navegar, esVigente }) {
  let datos;
  try {
    datos = await get('/perfil');
  } catch (error) {
    pintar(main, html`<div class="contenedor seccion">${errorCarga(error.message)}</div>`);
    main.querySelector('[data-accion="reintentar"]').addEventListener('click', () => perfil({ main, navegar, esVigente }));
    return;
  }
  if (!esVigente()) return;
  let editando = false;
  let exito = false;

  function avatar(clase = '') {
    return datos.foto
      ? html`<img class="avatar ${clase}" src="${datos.foto}" alt="Foto de perfil de ${datos.nombre}">`
      : html`<span class="avatar ${clase}" aria-hidden="true">${iniciales(datos.nombre)}</span>`;
  }

  function render() {
    const esCliente = datos.rol === 'CLIENTE';
    pintar(main, html`<div class="contenedor seccion">
      <span class="antetitulo">${esCliente ? 'Mi cuenta' : 'Cuenta de administración'}</span>
      <h1>Mi perfil</h1>
      <div class="perfil-grilla mt-2">
        <aside class="panel perfil-tarjeta">
          ${avatar()}
          <h2 class="mb-0">${datos.nombre}</h2>
          <p class="texto-suave">${datos.email}</p>
          <span class="etiqueta etiqueta--neutra etiqueta--sin-punto">${esCliente ? 'Cliente' : 'Administrador'}</span>
          <nav class="accesos" aria-label="Accesos de la cuenta">
            ${esCliente ? html`
              <a class="acceso" href="/mis-pedidos"><span>Mis pedidos</span><span aria-hidden="true">→</span></a>
              <a class="acceso" href="/mis-clases"><span>Mis clases</span><span aria-hidden="true">→</span></a>
              <a class="acceso" href="/carrito"><span>Mi carrito</span><span aria-hidden="true">→</span></a>`
              : html`<a class="acceso" href="/admin"><span>Panel de administración</span><span aria-hidden="true">→</span></a>`}
            <button type="button" class="acceso" data-salir><span>Cerrar sesión</span><span aria-hidden="true">↩</span></button>
          </nav>
        </aside>
        <div>
          <section class="panel" aria-labelledby="titulo-datos" data-panel-datos>
            ${exito ? html`${alerta('exito', 'Tus datos se actualizaron correctamente.')}<br>` : ''}
            ${editando ? formularioPerfil() : vistaDatos()}
          </section>
        </div>
      </div>
    </div>`);
    enlazar();
  }

  function vistaDatos() {
    return html`
      <div class="barra-acciones">
        <h2 class="panel__titulo mb-0" id="titulo-datos">Mis datos</h2>
        <button type="button" class="boton boton--secundario boton--chico" data-editar>Editar perfil</button>
      </div>
      <dl class="datos datos--en-linea">
        <div><dt>Nombre</dt><dd>${datos.nombre}</dd></div>
        <div><dt>Correo electrónico</dt><dd>${datos.email}</dd></div>
        <div><dt>Teléfono</dt><dd>${datos.telefono || html`<span class="texto-suave">Sin cargar</span>`}</dd></div>
        <div><dt>Dirección</dt><dd>${datos.direccion || html`<span class="texto-suave">Sin cargar</span>`}</dd></div>
      </dl>`;
  }

  function formularioPerfil() {
    return html`
      <h2 class="panel__titulo" id="titulo-datos">Editar perfil</h2>
      <form class="formulario" novalidate data-form-perfil>
        <div data-alerta tabindex="-1"></div>
        <div class="campo">
          <span class="etiqueta-campo" id="etiqueta-foto">Foto de perfil <span class="opcional">(opcional)</span></span>
          <div class="foto-editor">
            ${avatar('avatar--chico')}
            <img class="avatar avatar--chico oculto" alt="Vista previa de la nueva foto" data-vista-previa>
            <div class="pila">
              <input id="campo-foto" name="foto" type="file" accept="image/jpeg,image/png,image/webp" aria-labelledby="etiqueta-foto" aria-describedby="ayuda-foto error-foto">
              ${datos.foto ? html`<label class="casilla"><input type="checkbox" name="quitarFoto" value="true"> Quitar la foto actual</label>` : ''}
            </div>
          </div>
          <p class="campo__ayuda" id="ayuda-foto">JPG, PNG o WEBP de hasta 2 MB.</p>
          <p class="campo__error" id="error-foto"></p>
        </div>
        ${campo({ nombre: 'nombre', etiqueta: 'Nombre y apellido', valor: datos.nombre, atributos: 'autocomplete="name" maxlength="80"' })}
        <div class="campo">
          <label for="campo-email">Correo electrónico</label>
          <input id="campo-email" type="email" value="${datos.email}" readonly aria-describedby="ayuda-email">
          <p class="campo__ayuda" id="ayuda-email">El correo identifica tu cuenta y no puede modificarse.</p>
        </div>
        <div class="fila-campos">
          ${campo({ nombre: 'telefono', etiqueta: 'Teléfono', tipo: 'tel', valor: datos.telefono || '', opcional: true, atributos: 'autocomplete="tel" maxlength="20"' })}
          ${campo({ nombre: 'direccion', etiqueta: 'Dirección', valor: datos.direccion || '', opcional: true, atributos: 'autocomplete="street-address" maxlength="120"' })}
        </div>
        <div class="acciones">
          <button type="submit" class="boton">Guardar cambios</button>
          <button type="button" class="boton boton--secundario" data-cancelar>Cancelar</button>
        </div>
      </form>`;
  }

  function enlazar() {
    main.querySelector('[data-salir]').addEventListener('click', async () => {
      await cerrarSesion();
      avisar('Cerraste sesión. ¡Hasta pronto!', 'exito');
      navegar('/');
    });
    main.querySelector('[data-editar]')?.addEventListener('click', () => {
      editando = true;
      render();
      main.querySelector('#campo-nombre').focus();
    });
    main.querySelector('[data-cancelar]')?.addEventListener('click', () => {
      editando = false;
      render();
      main.querySelector('[data-editar]').focus();
    });

    const formPerfil = main.querySelector('[data-form-perfil]');
    if (formPerfil) {
      vistaPreviaImagen(formPerfil.foto, formPerfil.querySelector('[data-vista-previa]'));
      formPerfil.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        limpiarErrores(formPerfil);
        const formData = new FormData(formPerfil);
        const errores = {};
        if (textoDe(formData, 'nombre').length < 2) errores.nombre = 'Ingresá tu nombre (al menos 2 caracteres).';
        const telefono = textoDe(formData, 'telefono');
        if (telefono && !/^\+?[\d\s()-]{6,20}$/.test(telefono)) errores.telefono = 'Ingresá un teléfono válido (solo números, espacios, guiones o +).';
        const direccion = textoDe(formData, 'direccion');
        if (direccion && direccion.length < 5) errores.direccion = 'La dirección debe tener al menos 5 caracteres.';
        if (Object.keys(errores).length) return mostrarErrores(formPerfil, { campos: errores });
        if (!formPerfil.foto.files.length) formData.delete('foto');

        const restaurar = ocupar(formPerfil.querySelector('[type="submit"]'), 'Guardando…');
        try {
          datos = await enviarFormulario('/perfil', formData, 'PUT');
          establecerUsuario(datos);
          editando = false;
          exito = true;
          render();
          main.querySelector('[data-editar]').focus();
          exito = false;
        } catch (error) {
          restaurar();
          mostrarErrores(formPerfil, error);
        }
      });
    }

  }

  render();
}
