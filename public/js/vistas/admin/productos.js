// VistaAdminProductos (Entrega 7) · CU-09 Crear producto · CU-10 Modificar disponibilidad
// · CU-11 Modificar producto · CU-12 Eliminar producto. Transiciones A4 a A7.
import { get, patch, borrar, enviarFormulario } from '../../api.js';
import { html, pintar, precio, vacio, errorCarga, avisar, confirmar, dialogoFormulario, campo, vistaPreviaImagen, crudo } from '../../ui.js';
import { layoutAdmin } from './layout.js';

export default async function productos({ main, esVigente }) {
  const zona = layoutAdmin(main, {
    activa: '/admin/productos',
    titulo: 'Productos',
    descripcion: 'Creá, modificá y eliminá productos del menú, y marcá su disponibilidad.',
  });
  let lista = [];
  let categorias = [];

  async function cargar() {
    try {
      [lista, categorias] = await Promise.all([get('/admin/productos'), get('/categorias')]);
      if (!esVigente()) return;
      render();
    } catch (error) {
      pintar(zona, errorCarga(error.message));
      zona.querySelector('[data-accion="reintentar"]').addEventListener('click', cargar);
    }
  }

  function render() {
    const agotados = lista.filter((p) => !p.disponible).length;
    pintar(zona, html`
      <div class="barra-acciones">
        <div>
          <h2>Listado de productos</h2>
          <p class="texto-suave mb-0">${lista.length} productos · ${agotados} agotados</p>
        </div>
        <button type="button" class="boton" data-nuevo>+ Nuevo producto</button>
      </div>
      ${lista.length ? html`<div class="tabla-envoltura">
        <table class="tabla tabla--responsiva">
          <caption class="solo-lectores">Productos del menú</caption>
          <thead><tr><th scope="col">Producto</th><th scope="col">Categoría</th><th scope="col" class="num">Precio</th><th scope="col">Disponibilidad</th><th scope="col"><span class="solo-lectores">Acciones</span></th></tr></thead>
          <tbody>${lista.map((p) => html`<tr>
            <td class="sin-etiqueta"><div class="celda-producto">
              <img class="miniatura" src="${p.imagen || '/img/menu.jpg'}" alt="" width="56" height="56" loading="lazy">
              <div><strong>${p.nombre}</strong><small>${p.descripcion}</small></div>
            </div></td>
            <td data-etiqueta="Categoría">${p.categoria}</td>
            <td data-etiqueta="Precio" class="num">${precio(p.precio)}</td>
            <td data-etiqueta="Disponibilidad">
              <button type="button" class="interruptor" role="switch" aria-checked="${p.disponible}" data-disponibilidad="${p.id}" aria-label="Disponibilidad de ${p.nombre}">
                <span class="interruptor__pista" aria-hidden="true"></span><span>${p.disponible ? 'Disponible' : 'Agotado'}</span>
              </button>
            </td>
            <td class="sin-etiqueta"><div class="acciones-fila">
              <button type="button" class="boton boton--texto boton--chico" data-editar="${p.id}" aria-label="Editar ${p.nombre}">Editar</button>
              <button type="button" class="boton boton--peligro-texto boton--chico" data-eliminar="${p.id}" aria-label="Eliminar ${p.nombre}">Eliminar</button>
            </div></td>
          </tr>`)}</tbody>
        </table>
      </div>` : vacio({ titulo: 'No hay productos cargados', texto: 'Creá el primer producto del menú.', accion: html`<button type="button" class="boton" data-nuevo>+ Nuevo producto</button>` })}`);
  }

  function abrirFormulario(producto = null) {
    const opciones = categorias.map((c) => html`<option value="${c}" ${producto?.categoria === c ? crudo('selected') : ''}>${c}</option>`);
    dialogoFormulario({
      titulo: producto ? `Editar “${producto.nombre}”` : 'Nuevo producto',
      textoEnviar: producto ? 'Guardar cambios' : 'Crear producto',
      contenido: html`
        ${campo({ nombre: 'nombre', etiqueta: 'Nombre', valor: producto?.nombre, atributos: 'maxlength="80"' })}
        <div class="campo">
          <label for="campo-descripcion">Descripción corta</label>
          <textarea id="campo-descripcion" name="descripcion" maxlength="200" required aria-describedby="error-descripcion">${producto?.descripcion || ''}</textarea>
          <p class="campo__error" id="error-descripcion"></p>
        </div>
        <div class="fila-campos">
          ${campo({ nombre: 'precio', etiqueta: 'Precio (ARS)', tipo: 'number', valor: producto?.precio, ayuda: 'En pesos, sin centavos.', atributos: 'min="1" max="1000000" step="1" inputmode="numeric"' })}
          <div class="campo">
            <label for="campo-categoria">Categoría</label>
            <select id="campo-categoria" name="categoria" required aria-describedby="error-categoria">
              <option value="">Elegí una categoría</option>${opciones}
            </select>
            <p class="campo__error" id="error-categoria"></p>
          </div>
        </div>
        <div class="campo">
          <label for="campo-imagen">Imagen <span class="opcional">(opcional)</span></label>
          <div class="foto-editor">
            <img class="vista-previa-imagen ${producto?.imagen ? '' : 'oculto'}" src="${producto?.imagen || ''}" alt="Vista previa" data-vista-previa>
            <input id="campo-imagen" name="imagen" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="ayuda-imagen error-imagen">
          </div>
          <p class="campo__ayuda" id="ayuda-imagen">JPG, PNG o WEBP de hasta 2 MB.${producto ? ' Si no elegís un archivo, se conserva la imagen actual.' : ''}</p>
          <p class="campo__error" id="error-imagen"></p>
        </div>
        <label class="casilla"><input type="checkbox" name="disponible" value="true" ${producto && !producto.disponible ? '' : crudo('checked')}> Disponible para la venta</label>
        ${producto ? html`<p class="nota">Cambiar el precio no modifica los pedidos ya confirmados: cada pedido conserva el precio aplicado.</p>` : ''}`,
      alAbrir: (formulario) => vistaPreviaImagen(formulario.imagen, formulario.querySelector('[data-vista-previa]')),
      alEnviar: async (formData, formulario) => {
        formData.set('disponible', formulario.disponible.checked ? 'true' : 'false');
        if (!formulario.imagen.files.length) formData.delete('imagen');
        const errores = {};
        if (String(formData.get('nombre')).trim().length < 2) errores.nombre = 'Ingresá el nombre (al menos 2 caracteres).';
        if (String(formData.get('descripcion')).trim().length < 5) errores.descripcion = 'Ingresá una descripción (al menos 5 caracteres).';
        const valorPrecio = Number(formData.get('precio'));
        if (!Number.isInteger(valorPrecio) || valorPrecio < 1 || valorPrecio > 1_000_000) errores.precio = 'Ingresá un precio entero entre 1 y 1.000.000.';
        if (!formData.get('categoria')) errores.categoria = 'Elegí una categoría.';
        if (Object.keys(errores).length) throw { campos: errores };
        if (producto) await enviarFormulario(`/admin/productos/${producto.id}`, formData, 'PUT');
        else await enviarFormulario('/admin/productos', formData);
        avisar(producto ? 'Producto actualizado.' : 'Producto creado y publicado en el menú.', 'exito');
        await cargar();
      },
    });
  }

  zona.addEventListener('click', async (evento) => {
    if (evento.target.closest('[data-nuevo]')) return abrirFormulario();
    const editar = evento.target.closest('[data-editar]');
    if (editar) return abrirFormulario(lista.find((p) => p.id === Number(editar.dataset.editar)));

    const interruptor = evento.target.closest('[data-disponibilidad]');
    if (interruptor) {
      const producto = lista.find((p) => p.id === Number(interruptor.dataset.disponibilidad));
      interruptor.disabled = true;
      try {
        const actualizado = await patch(`/admin/productos/${producto.id}/disponibilidad`, { disponible: !producto.disponible });
        Object.assign(producto, actualizado);
        avisar(`${producto.nombre}: ${producto.disponible ? 'disponible' : 'agotado'}.`, 'exito');
        render();
        zona.querySelector(`[data-disponibilidad="${producto.id}"]`).focus();
      } catch (error) {
        interruptor.disabled = false;
        avisar(error.message, 'error');
      }
      return;
    }

    const eliminar = evento.target.closest('[data-eliminar]');
    if (eliminar) {
      const producto = lista.find((p) => p.id === Number(eliminar.dataset.eliminar));
      const acepta = await confirmar({
        titulo: 'Eliminar producto',
        mensaje: `¿Seguro que querés eliminar “${producto.nombre}” del menú?`,
        detalle: html`<p class="texto-suave">Dejará de mostrarse y se quitará de los carritos. Los pedidos ya confirmados conservan su detalle.</p>`,
        textoConfirmar: 'Eliminar producto',
        textoCancelar: 'Cancelar',
        peligro: true,
      });
      if (!acepta) return;
      try {
        await borrar(`/admin/productos/${producto.id}`);
        avisar(`Eliminaste “${producto.nombre}”.`, 'exito');
        await cargar();
      } catch (error) {
        avisar(error.message, 'error');
      }
    }
  });

  await cargar();
}
