// VistaAdminClases (Entrega 7) · CU-21 Crear clase · CU-22 Modificar clase · CU-23 Eliminar clase.
// Eliminar una clase cancela sus inscripciones. El cupo máximo es 8. Transiciones A8 a A11.
import { get, borrar, enviarFormulario } from '../../api.js';
import { html, pintar, fechaLarga, hora, duracion, vacio, errorCarga, avisar, confirmar, dialogoFormulario, campo, partesArgentina, hoyArgentina, vistaPreviaImagen } from '../../ui.js';
import { layoutAdmin } from './layout.js';

export default async function clasesAdmin({ main, esVigente }) {
  const zona = layoutAdmin(main, {
    activa: '/admin/clases',
    titulo: 'Clases de barista',
    descripcion: 'Programá clases, ajustá cupos (máximo 8) y gestioná sus datos.',
  });
  let lista = [];

  async function cargar() {
    try {
      lista = await get('/admin/clases');
      if (!esVigente()) return;
      render();
    } catch (error) {
      pintar(zona, errorCarga(error.message));
      zona.querySelector('[data-accion="reintentar"]').addEventListener('click', cargar);
    }
  }

  function render() {
    const proximas = lista.filter((c) => !c.finalizada).sort((a, b) => a.inicio.localeCompare(b.inicio));
    const finalizadas = lista.filter((c) => c.finalizada);
    const tabla = (clases, caption) => html`<div class="tabla-envoltura">
      <table class="tabla tabla--responsiva">
        <caption class="solo-lectores">${caption}</caption>
        <thead><tr><th scope="col">Clase</th><th scope="col">Fecha y horario</th><th scope="col">Docente</th><th scope="col" class="num">Inscriptos</th><th scope="col"><span class="solo-lectores">Acciones</span></th></tr></thead>
        <tbody>${clases.map((c) => html`<tr>
          <td class="sin-etiqueta"><div class="celda-producto">
            <img class="miniatura" src="${c.imagen || '/img/clases.jpg'}" alt="" width="56" height="56" loading="lazy">
            <div><strong>${c.nombre}</strong><small>${duracion(c.duracionMin)}${c.completa ? ' · Completa' : ''}</small></div>
          </div></td>
          <td data-etiqueta="Fecha">${fechaLarga(c.inicio)} · ${hora(c.inicio)}</td>
          <td data-etiqueta="Docente">${c.docente}</td>
          <td data-etiqueta="Inscriptos" class="num">${c.inscriptos} / ${c.cupo}</td>
          <td class="sin-etiqueta"><div class="acciones-fila">
            <a class="boton boton--texto boton--chico" href="/admin/inscriptos?clase=${c.id}" aria-label="Ver inscriptos de ${c.nombre}">Inscriptos</a>
            <button type="button" class="boton boton--texto boton--chico" data-editar="${c.id}" aria-label="Editar ${c.nombre}">Editar</button>
            <button type="button" class="boton boton--peligro-texto boton--chico" data-eliminar="${c.id}" aria-label="Eliminar ${c.nombre}">Eliminar</button>
          </div></td>
        </tr>`)}</tbody>
      </table>
    </div>`;

    pintar(zona, html`
      <div class="barra-acciones">
        <div><h2>Próximas clases</h2><p class="texto-suave mb-0">${proximas.length} programadas</p></div>
        <button type="button" class="boton" data-nueva>+ Nueva clase</button>
      </div>
      ${proximas.length ? tabla(proximas, 'Próximas clases') : vacio({ titulo: 'No hay clases programadas', texto: 'Creá una clase para que los clientes puedan inscribirse.', iconoNombre: 'calendario', accion: html`<button type="button" class="boton" data-nueva>+ Nueva clase</button>` })}
      ${finalizadas.length ? html`<h2 class="mt-3">Clases finalizadas o en curso</h2>${tabla(finalizadas, 'Clases finalizadas')}` : ''}`);
  }

  function abrirFormulario(clase = null) {
    const partes = clase ? partesArgentina(clase.inicio) : { fecha: '', hora: '' };
    dialogoFormulario({
      titulo: clase ? `Editar “${clase.nombre}”` : 'Nueva clase',
      textoEnviar: clase ? 'Guardar cambios' : 'Crear clase',
      contenido: html`
        ${campo({ nombre: 'nombre', etiqueta: 'Nombre de la clase', valor: clase?.nombre, atributos: 'maxlength="80"' })}
        <div class="campo">
          <label for="campo-descripcion">Descripción</label>
          <textarea id="campo-descripcion" name="descripcion" maxlength="400" required aria-describedby="error-descripcion">${clase?.descripcion || ''}</textarea>
          <p class="campo__error" id="error-descripcion"></p>
        </div>
        ${campo({ nombre: 'docente', etiqueta: 'Docente', valor: clase?.docente, ayuda: 'Es un dato informativo de la clase; no crea una cuenta.', atributos: 'maxlength="80"' })}
        <div class="fila-campos">
          ${campo({ nombre: 'fecha', etiqueta: 'Fecha', tipo: 'date', valor: partes.fecha, atributos: `min="${hoyArgentina()}"` })}
          ${campo({ nombre: 'hora', etiqueta: 'Horario de inicio', tipo: 'time', valor: partes.hora, ayuda: 'Hora de Argentina.' })}
        </div>
        <div class="fila-campos">
          ${campo({ nombre: 'duracionMin', etiqueta: 'Duración (minutos)', tipo: 'number', valor: clase?.duracionMin ?? 120, atributos: 'min="15" max="600" step="5" inputmode="numeric"' })}
          ${campo({ nombre: 'cupo', etiqueta: 'Cupo', tipo: 'number', valor: clase?.cupo ?? 8, ayuda: clase ? `Entre ${Math.max(1, clase.inscriptos)} y 8 (hay ${clase.inscriptos} inscriptos).` : 'Máximo 8 alumnos.', atributos: `min="${Math.max(1, clase?.inscriptos || 1)}" max="8" step="1" inputmode="numeric"` })}
        </div>
        <div class="campo">
          <label for="campo-imagen">Imagen <span class="opcional">(opcional)</span></label>
          <div class="foto-editor">
            <img class="vista-previa-imagen ${clase?.imagen ? '' : 'oculto'}" src="${clase?.imagen || ''}" alt="Vista previa" data-vista-previa>
            <input id="campo-imagen" name="imagen" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="error-imagen">
          </div>
          <p class="campo__error" id="error-imagen"></p>
        </div>`,
      alAbrir: (formulario) => vistaPreviaImagen(formulario.imagen, formulario.querySelector('[data-vista-previa]')),
      alEnviar: async (formData, formulario) => {
        if (!formulario.imagen.files.length) formData.delete('imagen');
        const errores = {};
        if (String(formData.get('nombre')).trim().length < 3) errores.nombre = 'Ingresá el nombre (al menos 3 caracteres).';
        if (String(formData.get('descripcion')).trim().length < 10) errores.descripcion = 'Ingresá una descripción (al menos 10 caracteres).';
        if (String(formData.get('docente')).trim().length < 3) errores.docente = 'Ingresá el nombre del docente.';
        if (!formData.get('fecha')) errores.fecha = 'Elegí la fecha.';
        if (!formData.get('hora')) errores.hora = 'Elegí el horario.';
        const cupo = Number(formData.get('cupo'));
        if (!Number.isInteger(cupo) || cupo < 1 || cupo > 8) errores.cupo = 'El cupo debe ser un entero entre 1 y 8.';
        else if (clase && cupo < clase.inscriptos) errores.cupo = `Hay ${clase.inscriptos} inscripciones activas; el cupo no puede ser menor.`;
        const duracionMin = Number(formData.get('duracionMin'));
        if (!Number.isInteger(duracionMin) || duracionMin < 15 || duracionMin > 600) errores.duracionMin = 'La duración debe estar entre 15 y 600 minutos.';
        if (Object.keys(errores).length) throw { campos: errores };
        if (clase) await enviarFormulario(`/admin/clases/${clase.id}`, formData, 'PUT');
        else await enviarFormulario('/admin/clases', formData);
        avisar(clase ? 'Clase actualizada.' : 'Clase creada y publicada.', 'exito');
        await cargar();
      },
    });
  }

  zona.addEventListener('click', async (evento) => {
    if (evento.target.closest('[data-nueva]')) return abrirFormulario();
    const editar = evento.target.closest('[data-editar]');
    if (editar) return abrirFormulario(lista.find((c) => c.id === Number(editar.dataset.editar)));
    const eliminar = evento.target.closest('[data-eliminar]');
    if (!eliminar) return;
    const clase = lista.find((c) => c.id === Number(eliminar.dataset.eliminar));
    const acepta = await confirmar({
      titulo: 'Eliminar clase',
      mensaje: `¿Seguro que querés eliminar “${clase.nombre}”?`,
      detalle: clase.inscriptos
        ? html`<p><strong>Se cancelarán ${clase.inscriptos} ${clase.inscriptos === 1 ? 'inscripción activa' : 'inscripciones activas'}.</strong> Esas inscripciones se borran y desaparecen de “Mis clases” de cada cliente.</p>`
        : html`<p class="texto-suave">La clase no tiene inscripciones activas.</p>`,
      textoConfirmar: 'Eliminar clase',
      textoCancelar: 'Cancelar',
      peligro: true,
    });
    if (!acepta) return;
    try {
      const { inscripcionesCanceladas } = await borrar(`/admin/clases/${clase.id}`);
      avisar(`Eliminaste “${clase.nombre}”.${inscripcionesCanceladas ? ` Se cancelaron ${inscripcionesCanceladas} inscripciones.` : ''}`, 'exito');
      await cargar();
    } catch (error) {
      avisar(error.message, 'error');
    }
  });

  await cargar();
}
