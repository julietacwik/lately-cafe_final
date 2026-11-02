// Crea (o promueve) una cuenta de administrador. El registro público nunca crea administradores.
// Uso: npm run crear-admin -- correo@dominio.com "Nombre" "ContraseñaSegura123"
// Escribe directamente en la base: si el servidor está en marcha, hay que reiniciarlo
// para que el Gestor vuelva a cargar sus listas y reconozca la cuenta.
import { config } from '../server/config.js';
import { abrirBaseDatos, migrar } from '../server/persistencia/baseDatos.js';
import { hashearContrasena } from '../server/seguridad.js';
import * as v from '../server/dominio/validaciones.js';

const [email, nombre, password] = process.argv.slice(2);
const errores = [v.email(email), v.texto(nombre, { nombre: 'el nombre', min: 2, max: 80 }), v.contrasena(password)].filter(Boolean);
if (errores.length) {
  console.error('Uso: npm run crear-admin -- correo@dominio.com "Nombre" "Contraseña123"');
  errores.forEach((error) => console.error(`  - ${error}`));
  process.exit(1);
}

const db = abrirBaseDatos(config.rutaBaseDatos);
migrar(db);
const hash = await hashearContrasena(password);
const correo = email.trim().toLowerCase();
const existente = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(correo);
if (existente) {
  db.prepare(`UPDATE usuarios SET tipo = 'ADMINISTRADOR', nombre = ?, password_hash = ? WHERE id = ?`).run(nombre.trim(), hash, existente.id);
  db.prepare('DELETE FROM sesiones WHERE usuario_id = ?').run(existente.id);
  console.log(`La cuenta ${correo} ahora es administradora.`);
} else {
  db.prepare(`INSERT INTO usuarios (tipo, nombre, email, password_hash, creado_en) VALUES ('ADMINISTRADOR', ?, ?, ?, ?)`)
    .run(nombre.trim(), correo, hash, new Date().toISOString());
  console.log(`Administrador ${correo} creado.`);
}
db.close();
console.log('Si el servidor está en marcha, reinicialo para que tome el cambio.');
