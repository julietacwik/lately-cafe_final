// Prueba de carga: N usuarios virtuales concurrentes recorren el flujo de cliente.
// Uso: npm run prueba:carga -- [URL] [usuarios] [segundos]
//   npm run prueba:carga -- http://localhost:3000 50 60
// ATENCIÓN: crea cuentas y pedidos de prueba. Ejecutar solo en entornos de prueba
// y luego restablecer la base con `npm run db:demo`.

const [url = 'http://localhost:3000', usuariosTexto = '50', segundosTexto = '30'] = process.argv.slice(2);
const USUARIOS = Number(usuariosTexto);
const DURACION_MS = Number(segundosTexto) * 1000;
const UMBRAL_P95_MS = Number(process.env.UMBRAL_P95_MS) || 2000;
const UMBRAL_ERRORES = 0.01;

const mediciones = new Map();
let errores = 0;
let solicitudes = 0;

function registrar(nombre, ms, ok) {
  if (!mediciones.has(nombre)) mediciones.set(nombre, []);
  mediciones.get(nombre).push(ms);
  solicitudes += 1;
  if (!ok) errores += 1;
}

function crearSesion() {
  let cookie = '';
  return async function solicitud(nombre, metodo, ruta, datos, aceptables = [200, 201]) {
    const inicio = performance.now();
    let estado = 0;
    let cuerpo = null;
    try {
      const respuesta = await fetch(url + ruta, {
        method: metodo,
        headers: { 'X-Requested-With': 'LatelyCafe', 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
        body: datos ? JSON.stringify(datos) : undefined,
      });
      estado = respuesta.status;
      const nueva = respuesta.headers.get('set-cookie');
      if (nueva) cookie = nueva.split(';')[0];
      cuerpo = await respuesta.json().catch(() => null);
    } catch {
      estado = 0;
    }
    registrar(nombre, performance.now() - inicio, aceptables.includes(estado));
    return { estado, cuerpo };
  };
}

async function usuarioVirtual(indice, fin) {
  const solicitud = crearSesion();
  const marca = `${Date.now()}-${indice}`;
  const registro = await solicitud('registro', 'POST', '/api/auth/registro', {
    nombre: `Carga ${indice}`, email: `carga-${marca}@prueba.local`, password: 'Carga12345', confirmacion: 'Carga12345',
  });
  if (registro.estado !== 201) return;
  let vuelta = 0;
  while (performance.now() < fin) {
    vuelta += 1;
    const menu = await solicitud('menú', 'GET', '/api/productos');
    await solicitud('búsqueda', 'GET', '/api/productos?q=caf');
    await solicitud('clases', 'GET', '/api/clases');
    const disponibles = menu.cuerpo?.productos?.filter((p) => p.disponible) ?? [];
    if (!disponibles.length) continue;
    const producto = disponibles[(indice + vuelta) % disponibles.length];
    await solicitud('agregar al carrito', 'POST', '/api/carrito/lineas', { productoId: producto.id, cantidad: 1 });
    const carrito = await solicitud('carrito', 'GET', '/api/carrito');
    if (vuelta % 3 === 0 && carrito.cuerpo?.lineas?.length) {
      const lineasAceptadas = carrito.cuerpo.lineas.map(({ productoId, cantidad, precioUnitario }) => ({ productoId, cantidad, precioUnitario }));
      // 409 es válido si otro usuario cambió el producto entre medio.
      await solicitud('confirmar pedido', 'POST', '/api/pedidos', { claveIdempotencia: `carga-${marca}-${vuelta}`, lineasAceptadas }, [200, 201, 409]);
      await solicitud('mis pedidos', 'GET', '/api/pedidos');
    }
  }
}

function percentil(valores, p) {
  const ordenados = [...valores].sort((a, b) => a - b);
  return ordenados[Math.min(ordenados.length - 1, Math.ceil((p / 100) * ordenados.length) - 1)] ?? 0;
}

console.log(`Prueba de carga contra ${url}: ${USUARIOS} usuarios concurrentes durante ${DURACION_MS / 1000} s…`);
const inicio = performance.now();
const fin = inicio + DURACION_MS;
await Promise.all(Array.from({ length: USUARIOS }, (_, i) => usuarioVirtual(i, fin)));
const segundos = (performance.now() - inicio) / 1000;

const todas = [...mediciones.values()].flat();
const filas = [...mediciones.entries()].map(([nombre, valores]) => ({
  operación: nombre,
  solicitudes: valores.length,
  'p50 ms': Math.round(percentil(valores, 50)),
  'p95 ms': Math.round(percentil(valores, 95)),
  'máx ms': Math.round(Math.max(...valores)),
}));
console.table(filas);
const p95 = percentil(todas, 95);
const tasaErrores = solicitudes ? errores / solicitudes : 1;
console.log(`Total: ${solicitudes} solicitudes en ${segundos.toFixed(1)} s (${(solicitudes / segundos).toFixed(1)} req/s)`);
console.log(`p95 global: ${Math.round(p95)} ms (umbral ${UMBRAL_P95_MS} ms) · errores: ${errores} (${(tasaErrores * 100).toFixed(2)} %, umbral ${UMBRAL_ERRORES * 100} %)`);
const aprobada = p95 <= UMBRAL_P95_MS && tasaErrores <= UMBRAL_ERRORES;
console.log(aprobada ? 'RESULTADO: APROBADA' : 'RESULTADO: NO APROBADA');
process.exit(aprobada ? 0 : 1);
