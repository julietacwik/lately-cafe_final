// Uso: npm run db:migrar
import { config } from '../config.js';
import { abrirBaseDatos, migrar } from './baseDatos.js';

const db = abrirBaseDatos(config.rutaBaseDatos);
const aplicadas = migrar(db);
console.log(aplicadas.length
  ? `Migraciones aplicadas: ${aplicadas.join(', ')}`
  : 'La base ya estaba actualizada.');
db.close();
