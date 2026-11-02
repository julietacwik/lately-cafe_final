// Construye la aplicación Express. Separado de index.js para poder usarlo en las pruebas.
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import { RAIZ } from './config.js';
import { abrirBaseDatos, migrar } from './persistencia/baseDatos.js';
import { Persistencia } from './persistencia/Persistencia.js';
import { cargarDatosDemo, baseVacia } from './persistencia/datosDemo.js';
import { Gestor } from './Gestor.js';
import { crearRutas } from './http/rutas.js';
import { cabecerasSeguridad, cargarSesion, exigirCabeceraAjax, manejarErrores } from './http/middlewares.js';

const DIRECTORIO_PUBLICO = path.join(RAIZ, 'public');

export async function crearAplicacion(config, { reloj } = {}) {
  const db = abrirBaseDatos(config.rutaBaseDatos);
  migrar(db);
  const persistencia = new Persistencia(db, config.rutaBaseDatos);
  if (config.cargarDemoSiVacia && baseVacia(db)) await cargarDatosDemo(db);

  const gestor = new Gestor(persistencia, { diasSesion: config.diasSesion, reloj });
  gestor.limpiarSesionesVencidas();

  const app = express();
  app.disable('x-powered-by');
  if (config.confiarProxy) app.set('trust proxy', 1);

  app.use(cabecerasSeguridad);
  app.use('/api', express.json({ limit: '100kb' }), exigirCabeceraAjax, cargarSesion(gestor), crearRutas({ gestor, config }));

  fs.mkdirSync(config.directorioSubidas, { recursive: true });
  app.use('/uploads', express.static(config.directorioSubidas, { maxAge: '7d', fallthrough: false }));
  app.use(express.static(DIRECTORIO_PUBLICO, { maxAge: config.produccion ? '1h' : 0, index: false }));

  // Las rutas de la interfaz (por ejemplo /menu, que se usa en el código QR) devuelven la SPA.
  // Las rutas con extensión (archivos inexistentes) responden 404 en lugar de la SPA.
  app.get(/^\/(?!api\/|uploads\/)(?!.*\.[a-z0-9]+$).*/i, (_req, res) => res.sendFile(path.join(DIRECTORIO_PUBLICO, 'index.html')));
  app.use((_req, res) => res.status(404).type('text/plain').send('No encontrado'));

  app.use(manejarErrores);
  return { app, db, gestor };
}
