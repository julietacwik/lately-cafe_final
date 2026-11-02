// Prueba de interfaz en un navegador real (Playwright) en computadora (1280 px) y celular (390 px).
// Recorre los flujos de cliente y administrador, el teclado, los errores de consola y el desplazamiento horizontal.
// Requisitos: servidor en marcha con datos recién cargados (`npm run db:demo` y `npm start`),
// y Microsoft Edge o Google Chrome instalado.
// Uso: npm run prueba:navegador -- [URL]    (variable NAVEGADOR=msedge | chrome, por defecto msedge)
import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const SALIDA = path.join(RAIZ, 'tmp', 'capturas');
fs.mkdirSync(SALIDA, { recursive: true });
const navegador = await chromium.launch({ channel: process.env.NAVEGADOR || 'msedge', headless: true });
const resultados = [];
const errores = [];
const ok = (nombre, condicion, detalle = '') => resultados.push(`${condicion ? 'OK  ' : 'FALLA'} ${nombre}${detalle ? ` — ${detalle}` : ''}`);

async function pagina(ancho = 1280, alto = 860) {
  const ctx = await navegador.newContext({ viewport: { width: ancho, height: alto }, locale: 'es-AR' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(`[pageerror] ${p.url()} ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error' && !/status of (401|409|400)/.test(m.text())) errores.push(`[console] ${p.url()} ${m.text()}`); });
  return p;
}
const ir = async (p, ruta) => { await p.goto(BASE + ruta, { waitUntil: 'networkidle' }); await p.waitForTimeout(250); };
const esperar = (p, ms = 500) => p.waitForTimeout(ms);
const texto = (p, sel) => p.locator(sel).first().innerText();
const desborde = (p) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

async function ingresar(p, email, clave) {
  await ir(p, '/ingresar');
  await p.fill('#campo-email', email);
  await p.fill('#campo-password', clave);
  await p.click('form [type=submit]');
  await esperar(p, 700);
}

for (const [ancho, alto, disp] of [[1280, 860, 'pc'], [390, 844, 'movil']]) {
  const sufijo = `(${disp})`;
  const email = `flujo-${disp}-${Date.now()}@test.com`;

  // ---------- Registro, ingreso y perfil ----------
  const p = await pagina(ancho, alto);
  await ir(p, '/registrarse');
  await p.click('form [type=submit]');
  await esperar(p, 200);
  ok(`Registro vacío muestra errores por campo ${sufijo}`, (await p.locator('.campo__error:not(:empty)').count()) >= 3);
  await p.fill('#campo-nombre', 'Flor Prueba');
  await p.fill('#campo-email', email);
  await p.fill('#campo-password', 'Clave1234');
  await p.fill('#campo-confirmacion', 'Clave1234');
  await p.click('form [type=submit]');
  await esperar(p, 900);
  ok(`Registro exitoso redirige al menú ${sufijo}`, p.url().endsWith('/menu'), p.url());
  await ir(p, '/perfil');
  await p.click('[data-salir]');
  await esperar(p, 600);
  ok(`Cerrar sesión ${sufijo}`, (await p.locator('a[href="/ingresar"]').count()) > 0);
  await ingresar(p, email, 'Clave1234');
  ok(`Inicio de sesión ${sufijo}`, p.url().endsWith('/menu'));
  await ir(p, '/perfil');
  await p.click('[data-editar]');
  await p.fill('#campo-telefono', 'abc');
  await p.click('[data-form-perfil] [type=submit]');
  await esperar(p, 300);
  ok(`Perfil: teléfono inválido marcado ${sufijo}`, (await texto(p, '#error-telefono')).length > 0);
  await p.fill('#campo-telefono', '11 4000-1234');
  await p.fill('#campo-direccion', 'Av. Siempre Viva 742');
  await p.setInputFiles('#campo-foto', path.join(RAIZ, 'public/img/productos/cookie.jpg'));
  await p.click('[data-form-perfil] [type=submit]');
  await esperar(p, 900);
  ok(`Perfil: guardado con foto ${sufijo}`, (await p.locator('.alerta--exito').count()) > 0 && (await p.locator('img.avatar').count()) > 0);
  await p.screenshot({ path: `${SALIDA}/f-${disp}-perfil.png`, fullPage: true });

  // ---------- Buscar, carrito, pedido ----------
  await ir(p, '/menu');
  await p.fill('#buscar-producto', 'latte');
  await esperar(p, 900);
  const nombres = await p.locator('.producto__nombre').allInnerTexts();
  ok(`Búsqueda "latte" ${sufijo}`, nombres.length === 2 && nombres.every((n) => /latte/i.test(n)), nombres.join(', '));
  const agotado = p.locator('.producto', { hasText: 'Iced latte' }).locator('[data-agregar]');
  ok(`Iced latte agotado y deshabilitado ${sufijo}`, await agotado.isDisabled());
  const latte = p.locator('.producto', { hasText: /^Latte|Latte\n/ }).filter({ hasNotText: 'Iced' });
  await latte.locator('[data-paso="1"]').click();
  await latte.locator('[data-agregar]').click();
  await esperar(p, 700);
  ok(`Agregar 2 Latte al carrito ${sufijo}`, (await texto(p, '.insignia')).trim() === '2');
  await p.fill('#buscar-producto', 'zzzz');
  await esperar(p, 900);
  ok(`Búsqueda sin coincidencias muestra estado vacío ${sufijo}`, (await p.locator('.estado--vacio').count()) === 1);

  await ir(p, '/carrito');
  const precioUnit = Number((await texto(p, '.linea__unitario')).replace(/\D/g, ''));
  const precioTexto = (await texto(p, '.linea__unitario')).replace(' c/u', '').trim();
  await p.click('[data-linea] [data-paso="1"]');
  await esperar(p, 800);
  ok(`Carrito recalcula total (3 × Latte) ${sufijo}`, (await texto(p, '[data-total]')).replace(/\D/g, '') === String(3 * precioUnit), await texto(p, '[data-total]'));
  await p.fill('[data-linea] input[type=number]', '0');
  await p.locator('[data-linea] input[type=number]').dispatchEvent('change');
  await esperar(p, 300);
  ok(`Carrito rechaza cantidad 0 ${sufijo}`, (await texto(p, '[data-linea] .campo__error')).length > 0);
  await ir(p, '/carrito');
  await p.click('a[href="/confirmar-pedido"]');
  await esperar(p, 700);
  ok(`Resumen muestra datos del cliente ${sufijo}`, (await p.content()).includes('11 4000-1234'));
  await p.click('[data-confirmar]');
  await esperar(p, 300);
  await p.click('[data-respuesta="si"]');
  await esperar(p, 1000);
  const numero = await texto(p, 'h1');
  ok(`Pedido confirmado ${sufijo}`, /Pedido LC-\d+/.test(numero) && (await p.content()).includes('Recibido'), numero);
  ok(`Carrito vacío tras confirmar ${sufijo}`, (await texto(p, '.insignia')).trim() === '0');
  const urlPedido = p.url().split('?')[0];
  await p.screenshot({ path: `${SALIDA}/f-${disp}-pedido.png`, fullPage: true });

  // ---------- Inscripción y cancelación ----------
  await ir(p, '/clases');
  const cata = p.locator('.clase', { hasText: 'Cata y perfiles' });
  await cata.locator('[data-inscribir]').click();
  await esperar(p, 300);
  await p.click('[data-respuesta="si"]');
  await esperar(p, 900);
  ok(`Inscripción a "Cata" ${sufijo}`, (await cata.innerText()).includes('Ya estás inscripto'));
  const completa = p.locator('.clase', { hasText: 'Métodos de filtrado' });
  ok(`Clase completa no permite inscribirse ${sufijo}`, await completa.locator('button').isDisabled());
  const latteArt = p.locator('.clase', { hasText: 'Latte art' });
  await latteArt.locator('[data-inscribir]').click();
  await esperar(p, 300);
  await p.click('[data-respuesta="si"]');
  await esperar(p, 900);
  await ir(p, '/mis-clases');
  const tarjetaLA = p.locator('.inscripcion', { hasText: 'Latte art' });
  ok(`Clase en < 48 h no se puede cancelar y explica el motivo ${sufijo}`,
    (await tarjetaLA.locator('button[disabled]').count()) === 1 && (await tarjetaLA.innerText()).includes('48 horas'));
  const tarjetaCata = p.locator('.inscripcion', { hasText: 'Cata y perfiles' });
  await tarjetaCata.locator('[data-cancelar]').click();
  await esperar(p, 300);
  await p.click('[data-respuesta="si"]');
  await esperar(p, 900);
  ok(`Cancelación con más de 48 h ${sufijo}`, (await p.locator('.inscripcion', { hasText: 'Cata y perfiles' }).innerText()).includes('Cancelada'));
  await p.screenshot({ path: `${SALIDA}/f-${disp}-mis-clases.png`, fullPage: true });
  ok(`Sin desplazamiento horizontal en Mis clases ${sufijo}`, (await desborde(p)) <= 0);

  // ---------- Administración ----------
  const a = await pagina(ancho, alto);
  await ingresar(a, 'admin@lately.demo', 'Admin1234');
  ok(`Admin entra al panel ${sufijo}`, a.url().includes('/admin/productos'));
  await ir(a, '/admin/productos');
  await a.click('[data-nuevo]');
  await esperar(a, 300);
  await a.click('dialog [type=submit]');
  await esperar(a, 300);
  ok(`Producto: errores por campo ${sufijo}`, (await a.locator('dialog .campo__error:not(:empty)').count()) >= 3);
  const nombreProd = `Tostado ${disp}`;
  await a.fill('dialog #campo-nombre', nombreProd);
  await a.fill('dialog #campo-descripcion', 'Tostado de pan de campo con manteca.');
  await a.fill('dialog #campo-precio', '2800');
  await a.selectOption('dialog #campo-categoria', 'Salado');
  await a.click('dialog [type=submit]');
  await esperar(a, 900);
  ok(`Producto creado ${sufijo}`, (await a.locator('tr', { hasText: nombreProd }).count()) === 1);
  const fila = a.locator('tr', { hasText: nombreProd });
  await fila.locator('[data-disponibilidad]').click();
  await esperar(a, 700);
  ok(`Producto marcado agotado ${sufijo}`, (await a.locator('tr', { hasText: nombreProd }).locator('[role=switch]').getAttribute('aria-checked')) === 'false');
  await a.locator('tr', { hasText: nombreProd }).locator('[data-eliminar]').click();
  await esperar(a, 300);
  await a.click('[data-respuesta="si"]');
  await esperar(a, 800);
  ok(`Producto eliminado con confirmación ${sufijo}`, (await a.locator('tr', { hasText: nombreProd }).count()) === 0);

  // Precio histórico: subir el precio de Latte y revisar el pedido del cliente.
  const filaLatte = a.locator('tr').filter({ has: a.locator('strong', { hasText: /^Latte$/ }) });
  await filaLatte.locator('[data-editar]').click();
  await esperar(a, 300);
  const nuevoPrecio = disp === 'pc' ? '4500' : '4700';
  await a.fill('dialog #campo-precio', nuevoPrecio);
  await a.click('dialog [type=submit]');
  await esperar(a, 900);
  await p.goto(urlPedido, { waitUntil: 'networkidle' });
  await esperar(p, 300);
  const detalle = await texto(p, 'table');
  ok(`Pedido conserva precio histórico tras cambio a $${nuevoPrecio} ${sufijo}`, detalle.includes(precioTexto.replace('$', '').trim()) && !detalle.includes(nuevoPrecio.replace(/(\d)(\d{3})$/, '$1.$2')));
  await ir(p, '/menu?q=latte');
  ok(`El menú muestra el precio nuevo ${sufijo}`, (await p.content()).includes(nuevoPrecio.replace(/(\d)(\d{3})$/, '$1.$2')));

  // Clases
  await ir(a, '/admin/clases');
  await a.click('[data-nueva]');
  await esperar(a, 300);
  const nombreClase = `Espresso avanzado ${disp}`;
  const fecha = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10);
  await a.fill('dialog #campo-nombre', nombreClase);
  await a.fill('dialog #campo-descripcion', 'Perfiles de extracción y ajuste fino de molienda.');
  await a.fill('dialog #campo-docente', 'Docente de prueba');
  await a.fill('dialog #campo-fecha', fecha);
  await a.fill('dialog #campo-hora', '18:30');
  await a.fill('dialog #campo-cupo', '9');
  await a.click('dialog [type=submit]');
  await esperar(a, 300);
  ok(`Clase con cupo 9 rechazada ${sufijo}`, (await texto(a, 'dialog #error-cupo')).length > 0);
  await a.fill('dialog #campo-cupo', '4');
  await a.click('dialog [type=submit]');
  await esperar(a, 900);
  ok(`Clase creada ${sufijo}`, (await a.content()).includes(nombreClase));
  await a.locator('tr', { hasText: 'Métodos de filtrado' }).locator('[data-editar]').click();
  await esperar(a, 300);
  await a.fill('dialog #campo-cupo', '5');
  await a.click('dialog [type=submit]');
  await esperar(a, 400);
  ok(`No se reduce el cupo bajo los inscriptos ${sufijo}`, (await texto(a, 'dialog #error-cupo')).length > 0);
  await a.keyboard.press('Escape');
  // Cliente se inscribe a la clase nueva; admin la elimina.
  await ir(p, '/clases');
  await p.locator('.clase', { hasText: nombreClase }).locator('[data-inscribir]').click();
  await esperar(p, 300);
  await p.click('[data-respuesta="si"]');
  await esperar(p, 800);
  await ir(a, '/admin/inscriptos');
  await a.locator('.lista-clases-admin a', { hasText: nombreClase }).click();
  await esperar(a, 700);
  ok(`Inscriptos muestra al cliente ${sufijo}`, (await texto(a, '[data-detalle]')).includes('Flor Prueba'));
  await a.screenshot({ path: `${SALIDA}/f-${disp}-inscriptos.png`, fullPage: true });
  await ir(a, '/admin/clases');
  await a.locator('tr', { hasText: nombreClase }).locator('[data-eliminar]').click();
  await esperar(a, 300);
  ok(`Eliminar clase avisa la cancelación ${sufijo}`, (await texto(a, 'dialog')).includes('Se cancelará'));
  await a.click('[data-respuesta="si"]');
  await esperar(a, 800);
  await ir(p, '/mis-clases');
  ok(`El cliente ve la clase cancelada por Lately ${sufijo}`, (await p.locator('.inscripcion', { hasText: nombreClase }).innerText()).includes('cancelada por Lately'));

  // Estadísticas
  await ir(a, '/admin/estadisticas');
  await a.click('[data-rango="90"]');
  await esperar(a, 800);
  ok(`Estadísticas últimos 90 días ${sufijo}`, (await a.locator('.kpi').count()) === 3 && (await a.locator('tbody tr').count()) > 0);
  await a.screenshot({ path: `${SALIDA}/f-${disp}-estadisticas.png`, fullPage: true });
  await a.fill('#campo-desde', '2026-12-31');
  await a.fill('#campo-hasta', '2026-01-01');
  await a.click('[data-filtro] [type=submit]');
  await esperar(a, 300);
  ok(`Estadísticas: desde > hasta marcado ${sufijo}`, (await texto(a, '#error-desde')).length > 0);
  await a.fill('#campo-desde', '2020-01-01');
  await a.fill('#campo-hasta', '2020-01-31');
  await a.click('[data-filtro] [type=submit]');
  await esperar(a, 700);
  ok(`Estadísticas: período sin ventas ${sufijo}`, (await a.content()).includes('Sin ventas en el período'));
  ok(`Sin desplazamiento horizontal en estadísticas ${sufijo}`, (await desborde(a)) <= 0);

  // Permisos desde la interfaz
  await ir(p, '/admin/productos');
  ok(`Cliente ve "Acceso restringido" en /admin ${sufijo}`, (await p.content()).includes('Acceso restringido'));
  await p.context().close();
  await a.context().close();
}

// ---------- Teclado ----------
{
  const k = await pagina(1280, 860);
  await ir(k, '/');
  await k.keyboard.press('Tab');
  ok('Teclado: el primer Tab enfoca "Saltar al contenido"', (await k.evaluate(() => document.activeElement.textContent.trim())) === 'Saltar al contenido');
  const recorridos = [];
  for (let i = 0; i < 12; i++) {
    await k.keyboard.press('Tab');
    recorridos.push(await k.evaluate(() => {
      const e = document.activeElement;
      const estilo = getComputedStyle(e);
      return { texto: (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 25), contorno: estilo.outlineStyle !== 'none' || estilo.boxShadow !== 'none' };
    }));
  }
  ok('Teclado: el foco siempre es visible', recorridos.every((r) => r.contorno), recorridos.filter((r) => !r.contorno).map((r) => r.texto).join(' | '));
  // Ingreso solo con teclado
  await ir(k, '/ingresar');
  await k.focus('#campo-email');
  await k.keyboard.type('cliente@lately.demo');
  await k.keyboard.press('Tab');
  await k.keyboard.type('Cliente1234');
  await k.keyboard.press('Enter');
  await esperar(k, 900);
  ok('Teclado: inicio de sesión con Enter', k.url().endsWith('/menu'));
  // Diálogo: Esc lo cierra y devuelve
  await ir(k, '/carrito');
  await k.focus('[data-quitar]');
  await k.keyboard.press('Enter');
  await esperar(k, 300);
  const abierto = await k.evaluate(() => document.getElementById('dialogo').open);
  const foco = await k.evaluate(() => document.activeElement.textContent.trim());
  await k.keyboard.press('Escape');
  await esperar(k, 300);
  ok('Teclado: diálogo abre con foco en "Volver" y cierra con Esc', abierto && foco === 'Volver' && !(await k.evaluate(() => document.getElementById('dialogo').open)));
  // Menú móvil
  await k.setViewportSize({ width: 390, height: 844 });
  await ir(k, '/');
  await k.focus('.menu-boton');
  await k.keyboard.press('Enter');
  await esperar(k, 200);
  const navVisible = await k.isVisible('#navegacion');
  await k.keyboard.press('Escape');
  await esperar(k, 200);
  ok('Teclado: menú móvil abre con Enter y cierra con Esc', navVisible && !(await k.isVisible('#navegacion')));
  await k.context().close();
}

await navegador.close();
console.log(resultados.join('\n'));
console.log(errores.length ? `\nERRORES:\n${errores.join('\n')}` : '\nSin errores de consola ni de página.');
const fallas = resultados.filter((r) => r.startsWith('FALLA')).length;
console.log(`\n${resultados.length - fallas} de ${resultados.length} verificaciones aprobadas. Capturas en tmp/capturas/.`);
process.exit(fallas || errores.length ? 1 : 0);
