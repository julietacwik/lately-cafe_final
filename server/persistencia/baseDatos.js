// Apertura de la base SQLite y ejecución de migraciones versionadas.
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const DIRECTORIO_MIGRACIONES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migraciones');

export function abrirBaseDatos(ruta) {
  if (ruta !== ':memory:') fs.mkdirSync(path.dirname(ruta), { recursive: true });
  const db = new DatabaseSync(ruta);
  db.exec('PRAGMA foreign_keys = ON;');
  if (ruta !== ':memory:') {
    // WAL permite lecturas concurrentes mientras se escribe; busy_timeout espera
    // en lugar de fallar si otro proceso tiene el bloqueo de escritura.
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA synchronous = NORMAL;');
  }
  db.exec('PRAGMA busy_timeout = 5000;');
  return db;
}

export function migrar(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS migraciones (
    nombre     TEXT PRIMARY KEY,
    aplicada_en TEXT NOT NULL
  );`);
  const aplicadas = new Set(db.prepare('SELECT nombre FROM migraciones').all().map((f) => f.nombre));
  const pendientes = fs.readdirSync(DIRECTORIO_MIGRACIONES)
    .filter((archivo) => archivo.endsWith('.sql') && !aplicadas.has(archivo))
    .sort();

  for (const archivo of pendientes) {
    const sql = fs.readFileSync(path.join(DIRECTORIO_MIGRACIONES, archivo), 'utf8');
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO migraciones (nombre, aplicada_en) VALUES (?, ?)').run(archivo, new Date().toISOString());
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw new Error(`Falló la migración ${archivo}: ${error.message}`);
    }
  }
  return pendientes;
}
