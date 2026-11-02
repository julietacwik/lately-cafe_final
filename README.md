# Lately Café

Aplicación web de **Lately Café**, una cafetería de especialidad: menú público con búsqueda, carrito y pedidos para clientes registrados, inscripción a clases de barista y panel de administración con estadísticas de ventas.

Proyecto académico de Ingeniería de Software II (Universidad de Belgrano). Implementa los entregables corregidos del trabajo: los **24 casos de uso** y **28 requerimientos** de la Entrega 2, el **diagrama de clases vigente** (Entregas 4, 6 y 8), los **diagramas de secuencia** de las Entregas 6 y 8 y las **pantallas y la navegación** de la Entrega 7. La correspondencia completa está en [docs/TRAZABILIDAD.md](docs/TRAZABILIDAD.md) y los diagramas en [docs/diagramas](docs/diagramas/).

> Los productos, precios, docentes, clientes y pedidos incluidos son **datos de demostración**. La aplicación no procesa pagos: confirmar un pedido lo registra con estado “Recibido”.

## Funcionalidades

| Área | Qué permite |
| --- | --- |
| **Visitante** | Ver y buscar productos del menú (`/menu`, URL estable para código QR), ver clases de barista, registrarse e iniciar sesión. Si intenta comprar o inscribirse, se le pide iniciar sesión. |
| **Cliente** | Perfil editable (nombre, foto, dirección y teléfono), carrito, resumen de compra y confirmación del pedido, historial de pedidos, inscripción a clases y cancelación con la regla de 48 horas. |
| **Administrador** | Panel con tres pestañas, como en la Entrega 7: **Productos** (alta, edición, baja, disponible/agotado), **Clases** (alta, edición, baja con cancelación de inscripciones e inscriptos por clase) y **Estadísticas** por período. |

Reglas de negocio aplicadas en el servidor:

- **RN-01**: una inscripción se cancela solo si faltan 48 horas o más (hora del servidor).
- **RN-02**: máximo 8 alumnos por clase; se vuelve a comprobar dentro de una transacción y un trigger de la base impide el sobrecupo ante solicitudes simultáneas.
- **RN-03**: cada línea de pedido guarda su cantidad y precio unitario; cambiar un precio no altera pedidos confirmados.
- Sin inscripciones duplicadas, sin reducir el cupo por debajo de los inscriptos, sin pedidos duplicados por varios clics.

## Tecnología

- **Backend**: Node.js 22.13+ con Express 5. Base de datos **SQLite** mediante el módulo nativo `node:sqlite` (no requiere compilar ni instalar un motor aparte).
- **Frontend**: HTML, CSS y JavaScript (módulos ES) sin paso de compilación. Ruteo con URLs reales.
- **Seguridad**: contraseñas con `scrypt`, sesión en cookie `httpOnly` con token guardado como hash, verificación de rol y de pertenencia en el servidor, protección CSRF, CSP y validación del contenido de las imágenes.
- **Dependencias**: `express` y `multer` (subida de imágenes).

## Correspondencia con el diseño

| Diseño (entregas) | Código |
| --- | --- |
| Clase `Gestor` (controlador y fachada) | `server/Gestor.js`: un método por caso de uso, con los nombres del diagrama de clases |
| Clases del modelo | `server/dominio/`: `Usuario`, `Cliente`, `Administrador`, `Menu`, `Producto`, `Carrito`, `Linea`, `Pedido`, `Estadisticas`, `ClaseBarista`, `Inscripcion` |
| Clase `Persistencia` y diseño relacional (Entrega 7) | `server/persistencia/Persistencia.js` y `migraciones/001_esquema_inicial.sql` |
| Vistas de la Entrega 7 (`VistaMenu`, `VistaCarrito`, `VistaMisClases`…) | `public/js/vistas/`: cada archivo indica su vista, sus CU y sus transiciones |
| Diagramas de secuencia (Entregas 6 y 8) | Cada método del `Gestor` comenta el orden de mensajes que sigue |

## Requisitos

- [Node.js](https://nodejs.org/) **22.13 o superior, menor a 25** (recomendado: 24 LTS). Comprobalo con `node -v`.
- npm (viene con Node.js).
- Git y Visual Studio Code (opcionales, recomendados).

No hace falta instalar ninguna base de datos ni contratar servicios externos. Las fuentes tipográficas se cargan desde Google Fonts; si no hay conexión, se usan fuentes del sistema.

## Instalación y ejecución

```bash
# 1. Instalar dependencias
npm install

# 2. (Opcional) Crear el archivo de configuración
cp .env.example .env        # En Windows PowerShell: Copy-Item .env.example .env

# 3. Iniciar la aplicación
npm start
```

Abrí <http://localhost:3000>. En el primer inicio se crean las tablas (migraciones) y, si la base está vacía, se cargan los datos de demostración.

### Cuentas de demostración

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Cliente | `cliente@lately.demo` | `Cliente1234` |
| Administrador | `admin@lately.demo` | `Admin1234` |

También existen `cliente2@lately.demo` … `cliente9@lately.demo` (contraseña `Cliente1234`), usados para completar una clase.

Los datos demo incluyen productos disponibles y agotados, pedidos con precios anteriores a los actuales (para ver RN-03), una clase con cupos, una clase completa y una inscripción que ya no puede cancelarse porque la clase empieza en menos de 48 horas. Las fechas de las clases se calculan en relación con el momento de la carga; si pasan varios días, recargá la demostración con `npm run db:demo`.

### Comandos

| Comando | Para qué sirve |
| --- | --- |
| `npm start` | Inicia el servidor. |
| `npm run dev` | Inicia el servidor y lo reinicia al guardar cambios. |
| `npm test` | Ejecuta las pruebas automáticas (dominio + API). |
| `npm run db:migrar` | Aplica migraciones pendientes. |
| `npm run db:demo` | **Borra todos los datos** y vuelve a cargar la demostración. Si el servidor está en marcha, reinicialo después. |
| `npm run crear-admin -- correo@dominio.com "Nombre" "Clave1234"` | Crea o promueve una cuenta de administrador. Si el servidor está en marcha, reinicialo después. |
| `npm run prueba:carga -- http://localhost:3000 50 60` | Prueba de carga con 50 usuarios durante 60 segundos (crea datos de prueba). |
| `npm run prueba:navegador -- http://localhost:3000` | Recorrido automático en navegador (Edge o Chrome), en computadora y en celular. Usar con datos recién cargados. |

En VS Code también podés usar **Ejecutar y depurar → “Lately Café: servidor”**.

### Variables de entorno

Todas son opcionales en desarrollo. Ver [.env.example](.env.example).

| Variable | Valor por defecto | Descripción |
| --- | --- | --- |
| `PORT` | `3000` | Puerto HTTP. |
| `HOST` | `0.0.0.0` | Interfaz de red donde escucha el servidor. |
| `PUBLIC_URL` | `RENDER_EXTERNAL_URL` o `http://localhost:PORT` | URL pública del sitio (el menú queda en `PUBLIC_URL/menu`, apto para imprimir como QR). |
| `DATABASE_PATH` | `./data/lately.db` | Archivo SQLite. |
| `UPLOADS_DIR` | `./uploads` | Carpeta de imágenes subidas. |
| `SEED_DEMO` | `true` en desarrollo, `false` en producción | Carga la demostración si la base está vacía. **Nunca `true` en producción real.** |
| `COOKIE_SECURE` | `true` si `NODE_ENV=production` | Cookie de sesión solo por HTTPS. |
| `SESSION_DAYS` | `7` | Duración de la sesión. |
| `TRUST_PROXY` | `false` | `true` detrás de un proxy (Render, Railway, Nginx). |

## Estructura del proyecto

```
├── server/
│   ├── index.js                 Arranque del servidor
│   ├── app.js                   Armado de Express (usado también por las pruebas)
│   ├── config.js                Configuración y variables de entorno
│   ├── Gestor.js                Coordinador de casos de uso (clase Gestor)
│   ├── seguridad.js             Hash de contraseñas y tokens
│   ├── dominio/                 Clases del modelo: Usuario, Cliente, Administrador, Menu,
│   │                            Producto, Carrito, Linea, Pedido, ClaseBarista,
│   │                            Inscripcion, Estadisticas
│   ├── persistencia/
│   │   ├── Persistencia.js      Clase Persistencia: único acceso a los datos
│   │   ├── baseDatos.js         Conexión SQLite y ejecución de migraciones
│   │   ├── migraciones/         Esquema versionado (SQL)
│   │   └── datosDemo.js         Datos de demostración
│   └── http/                    Rutas REST y middlewares (sesión, roles, CSRF, imágenes)
├── public/                      Frontend (index.html, css/, js/, img/)
├── tests/                       Pruebas automáticas (node:test)
├── scripts/                     crear-admin y prueba de carga
├── docs/                        Decisiones, trazabilidad, diagramas, pruebas, GitHub y despliegue
├── data/                        Base SQLite local (ignorada por Git)
└── uploads/                     Imágenes subidas (ignoradas por Git)
```

## Documentación

- [Decisiones técnicas y supuestos](docs/DECISIONES.md): modelo de clases, adaptación de `Persistencia`, seguridad, concurrencia y diferencias entre entregas.
- [Trazabilidad](docs/TRAZABILIDAD.md): RF-01 a RF-28 y CU-01 a CU-24 → pantalla, transición, ruta, método del `Gestor` y diagrama de secuencia.
- [Diagramas](docs/diagramas/): clases, navegación y relacional.
- [Pruebas](docs/PRUEBAS.md): pruebas ejecutadas, pendientes y plan para los 50 usuarios concurrentes.
- [GitHub y despliegue](docs/GITHUB_Y_DESPLIEGUE.md): cómo subir el proyecto a tu repositorio y publicarlo.
- [Publicar en Render](docs/RENDER.md): servicio con SQLite y disco persistente, administrador real, respaldos y costos.

## Qué no incluye

Por definición del alcance no hay pagos con tarjeta ni pasarelas, verificación de transferencias, proveedores, inventario, sueldos, contabilidad, dictado de clases online, cuentas de docentes, delivery ni reservas de mesas.

Todos los RF (RF-01 a RF-28) y CU (CU-01 a CU-24) de la Entrega 2 están implementados (ver [Trazabilidad](docs/TRAZABILIDAD.md)). No se agregaron funciones sin caso de uso. El respaldo de datos que menciona la Entrega 1 se hace con un procedimiento manual documentado; no hay pantalla para eso.

## Créditos

Fotografías de [Unsplash](https://unsplash.com/) (Licencia Unsplash), guardadas en `public/img/`. Tipografías Fraunces e Inter (Google Fonts, SIL Open Font License).
