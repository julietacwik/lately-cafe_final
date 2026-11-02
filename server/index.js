import { config } from './config.js';
import { crearAplicacion } from './app.js';

const { app, db, gestor } = await crearAplicacion(config);

if (config.produccion) {
  console.log(`Base de datos: ${config.rutaBaseDatos}`);
  console.log(`Imágenes subidas: ${config.directorioSubidas}`);
  if (config.cargarDemoSiVacia) console.warn('ATENCIÓN: SEED_DEMO=true en producción. Las cuentas de demostración tienen contraseñas públicas.');
  if (config.urlPublica.includes('localhost')) console.warn('ATENCIÓN: PUBLIC_URL apunta a localhost; el código QR del menú no funcionará fuera del servidor.');
}

const servidor = app.listen(config.puerto, config.host, () => {
  console.log(`Lately Café escuchando en ${config.host}:${config.puerto} · ${config.urlPublica}`);
  console.log(`Menú público para el código QR: ${config.urlPublica}/menu`);
});

// Cierre ordenado (Render envía SIGTERM al reiniciar o desplegar): se dejan de aceptar
// conexiones, el Gestor guarda sus listas como resguardo final (cada cambio ya se guardó
// al hacerse) y se cierra la base, que confirma el registro WAL en el archivo principal.
let cerrando = false;
function cerrar(senal) {
  if (cerrando) return;
  cerrando = true;
  console.log(`${senal} recibido: cerrando el servidor…`);
  const terminar = () => {
    try { gestor.guardarTodo(); } catch (error) { console.error('No se pudo completar el guardado final:', error); }
    try { db.close(); } catch { /* ya cerrada */ }
    process.exit(0);
  };
  servidor.close(terminar);
  servidor.closeIdleConnections();
  setTimeout(() => {
    servidor.closeAllConnections();
    terminar();
  }, 10_000).unref();
}
process.on('SIGINT', () => cerrar('SIGINT'));
process.on('SIGTERM', () => cerrar('SIGTERM'));
