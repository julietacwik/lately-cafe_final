# Decisiones técnicas y supuestos

## 1. Fuentes

La aplicación implementa los entregables **corregidos** del trabajo práctico de Lately Café (Ingeniería de Software II, Universidad de Belgrano):

| Entregable | Qué se toma |
| --- | --- |
| **Entrega 1** | Objetivo, actores, alcance (menú en QR, carrito, clases, estadísticas), funciones fuera de alcance y entorno web con base de datos centralizada. |
| **Entrega 2** | RF-01 a RF-28, RNF-01, RN-01 a RN-03 y CU-01 a CU-24 (numeración final). |
| **Entregas 4 y 8** | Diagrama de clases **vigente** (versión de la Entrega 8, que reemplaza a las anteriores): `Gestor`, `Persistencia`, `Usuario`, `Cliente`, `Administrador`, `Menu`, `Producto`, `Carrito`, `Linea`, `Pedido`, `Estadisticas`, `ClaseBarista` e `Inscripcion`. Arquitectura en capas y paquetes. |
| **Entregas 6 y 8** | Diagramas de secuencia de los 24 CU: cada método del `Gestor` sigue el mismo orden de mensajes. |
| **Entrega 7** | Pantallas, navegación (transiciones 1 a 24 y A1 a A15), clases de la Vista y diseño relacional. |
| **Entrega 5** | Métricas de calidad: tiempo de respuesta y percentil 95 para la prueba de 50 usuarios (RNF-01). |

La correspondencia completa RF / CU → pantalla → método → secuencia está en [TRAZABILIDAD.md](TRAZABILIDAD.md). Los diagramas están en [docs/diagramas](diagramas/).

## 2. Correspondencia con el diagrama de clases y las secuencias

- **Capas (Entrega 4):** Presentación (`public/`, vistas de la Entrega 7) → Lógica de negocio (`server/Gestor.js` y `server/dominio/`) → Acceso a datos (`server/persistencia/Persistencia.js`) → Almacenamiento (archivo SQLite).
- **Controlador y fachada:** `Gestor` tiene un método por cada CU con el **mismo nombre del diagrama** (`registrarCliente`, `iniciarSesion`, `confirmarPedido`, `inscribir`, `cancelarInscripcion`, `consultarEstadisticas`…). La capa HTTP (`server/http/rutas.js`) solo traduce cada evento de una vista a esa llamada. Es el patrón GoF **Facade** de la Entrega 8.
- **Experto en información:** las reglas viven en la clase que tiene los datos: `Inscripcion.puedeCancelarse()` (RN-01), `ClaseBarista.hayCupo()` (RN-02), `Carrito.calcularTotal()`, `Usuario.verificarClave()`, `Producto.cambiarDisponibilidad()`.
- **Creador:** `Cliente` crea su `Carrito`; `Carrito` crea sus `Linea`; el `Pedido` crea sus propias `Linea` con el precio vigente (RN-03).
- **Administrador sin operaciones propias:** como en el diagrama vigente, las tareas de administración las ejecuta el `Gestor`, que verifica `tienePermisoAdmin` y delega en `Menu`, `Producto` y `ClaseBarista`.
- **Métodos auxiliares:** el código tiene algunos métodos que no aparecen en el diagrama porque son detalles de implementación (por ejemplo `exigirSesion`, `obtenerProducto`, `obtenerLinea`, `periodo`, `aJSON`, sesiones con cookie). No agregan casos de uso.

### Parámetros que llegan desde la interfaz

El navegador envía identificadores (`productoId`, `id` de clase o inscripción). La ruta los convierte en los objetos del diagrama con `gestor.obtenerProducto(id)`, `gestor.obtenerLinea(cliente, productoId)`, `gestor.obtenerClase(id)` u `obtenerInscripcion`, y recién entonces llama al método del CU con la firma del diagrama (`agregarAlCarrito(cliente, prod, cant)`, `modificarCarrito(cliente, linea, cant)`, `cancelarInscripcion(insc)`, etc.).

### Carrito y pedido no comparten líneas

El carrito muestra siempre el precio vigente del producto. Al confirmar, el pedido crea una `Linea` nueva por producto con `producto.getPrecio()` (mensajes 2.2.1 y 2.2.2 de la secuencia del CU-16), de modo que un cambio de precio posterior no lo afecta (RN-03).

### “Precio aceptado”

La pantalla Resumen de compra envía lo que el cliente vio (RF-17). Si mientras tanto cambió un precio o la cantidad, el pedido se rechaza y se pide revisar el resumen.

## 3. Persistencia

La Entrega 4 deja abierto «archivo o base de datos» y la Entrega 7 define el diseño relacional. La clase `Persistencia` conserva su responsabilidad (guardar y recuperar las listas del `Gestor`) y usa una base **SQLite**, que se guarda en un único archivo (`rutaArchivo`):

| Diagrama (Entrega 4) | Aplicación web |
| --- | --- |
| `Persistencia` lee y escribe archivos | `Persistencia` usa un único archivo **SQLite** en el servidor (`data/lately.db`). |
| Un archivo por tipo de dato | Una tabla por clase o asociación (`usuarios`, `productos`, `carrito_lineas`, `pedidos`, `pedido_lineas`, `clases`, `inscripciones`, `sesiones`). |
| Herencia `Usuario` → `Cliente` / `Administrador` | Una tabla `usuarios` con columna `tipo`; `Persistencia.usuarioDesdeFila()` instancia la subclase. |
| Escritura secuencial de archivos | Transacciones `BEGIN IMMEDIATE`: lecturas y escrituras de una operación son atómicas y no se mezclan con otras. |
| `guardarUsuarios(lista)` / `cargarUsuarios()` y equivalentes para productos, pedidos y clases | Los mismos métodos. `guardarUsuarios`, `guardarProductos` y `guardarPedidos` insertan o actualizan los elementos que reciben. `guardarClases(clases)` recibe la lista completa, como en las secuencias, y deja la base igual a ella: borra las clases eliminadas (CU-23) y las inscripciones canceladas (CU-20). |
| `Gestor.cargarTodo()` con listas en memoria (`usuarios`, `clases`, `pedidos`, `menu`) | Igual: al arrancar, `cargarTodo()` llena las listas desde la base y vincula los objetos (carritos con productos del menú, clientes con sus pedidos e inscripciones). Las consultas leen de las listas. |
| `Gestor.guardarTodo()` | Existe y guarda todas las listas; se ejecuta al apagar el servidor como resguardo final. Pero **no se depende de él**: cada cambio se aplica en la lista y se guarda en la base en el mismo momento, dentro de una transacción. Si la base rechaza la escritura, el `Gestor` recarga las listas para que coincidan con lo guardado. Así un corte o un reinicio no pierden datos. |

**Por qué las listas en el Gestor y guardado inmediato.** Es el diseño del diagrama de clases: el `Gestor` conoce y administra los objetos del sistema, y `Persistencia` solo los guarda y los carga. Guardar cada cambio en el momento evita la desventaja clásica de ese diseño (perder lo hecho desde el último `guardarTodo()`).

**Límite conocido.** Las listas viven en la memoria del proceso del servidor, así que la aplicación debe correr en **una sola instancia** (como en Render con un disco). Con varias instancias, cada una tendría su propia copia de las listas. Por el mismo motivo, los comandos que escriben directo en la base (`npm run crear-admin` y `npm run db:demo`) requieren reiniciar el servidor para que el `Gestor` vuelva a cargar las listas.

**Concurrencia (RN-02).** Node.js ejecuta cada operación del `Gestor` completa antes de atender la siguiente: entre la verificación del cupo y el alta de la inscripción no se intercala ninguna otra solicitud. Además, un trigger de la base rechaza cualquier inscripción que supere el cupo.

Por qué SQLite:

- **Es centralizado.** Vive en el servidor; los navegadores nunca acceden directamente. Cumple la Entrega 1.
- **Sigue siendo un archivo.** Mantiene el espíritu de la Entrega 4 y se respalda copiando un archivo.
- **No requiere servicios externos.** Se ejecuta con `npm start` en cualquier computadora con Node.js 22.13+.
- **Garantiza concurrencia correcta.** Usa transacciones ACID, índices únicos y triggers.

**Migrar a PostgreSQL o MySQL** implica reescribir solo `Persistencia.js` y el SQL de `migraciones/`; `Gestor` y el dominio no cambian. Para usar varias instancias del servidor, además, el `Gestor` tendría que dejar de mantener las listas en memoria y consultar la base en cada operación.

El almacenamiento local del navegador **no** se usa para autenticación, carrito ni datos de negocio. Todo vive en el servidor.

## 4. Seguridad

| Aspecto | Implementación |
| --- | --- |
| Contraseñas | `scrypt` (N=16384, r=8, p=1) con sal aleatoria por usuario. Nunca se guardan ni se devuelven en claro. |
| Sesión | Token aleatorio de 256 bits en cookie `httpOnly`, `SameSite=Lax` y `Secure` en producción. En la base se guarda solo su hash SHA-256. Vence a los 7 días. Cerrar sesión la invalida en el servidor. |
| Roles | El registro público crea siempre `CLIENTE` (cualquier campo `rol` se ignora). Los administradores se crean con `npm run crear-admin`. Las rutas `/api/admin/*` pasan por `requiereAdministrador`, y además cada método del `Gestor` vuelve a verificar el rol. |
| Pertenencia | Pedidos, carrito e inscripciones se consultan con el id del cliente de la sesión. Si un recurso es de otro cliente, la respuesta es 404 (no se revela que existe). |
| CSRF | Las operaciones que modifican datos exigen la cabecera `X-Requested-With: LatelyCafe`, que otro sitio no puede enviar sin CORS. Se suma `SameSite=Lax`. |
| XSS | La interfaz escapa todo dato dinámico (`html\`\`` en `ui.js`). La CSP prohíbe scripts y estilos en línea. |
| SQL | Todas las consultas usan parámetros (`?`). |
| Imágenes | Hasta 2 MB. Se verifica la firma real del archivo (JPG, PNG o WEBP) y se guarda con un nombre aleatorio. |
| Fuerza bruta | Límite de intentos por IP en registro e ingreso (10 cada 15 minutos en producción). |
| Datos demo | En producción hay que usar `SEED_DEMO=false`: las cuentas demo tienen contraseñas públicas. |

## 5. Concurrencia (RN-02 y pedidos duplicados)

- **Cupos.** `Gestor.inscribir` abre una transacción `BEGIN IMMEDIATE`, que toma el bloqueo de escritura antes de leer. Dentro de ella vuelve a validar el cupo con `ClaseBarista.hayCupo()`. Como defensa adicional, el trigger `trg_cupo_inscripcion` rechaza en la propia base cualquier inscripción que supere el cupo. La restricción `UNIQUE(clase_id, cliente_id)` impide inscripciones duplicadas.
- **Cupo mínimo.** El trigger `trg_cupo_minimo` impide reducir el cupo por debajo de los inscriptos.
- **Pedidos.** Cada pantalla de confirmación genera una clave de idempotencia. Varios clics o reintentos con la misma clave devuelven el mismo pedido (restricción `UNIQUE(cliente_id, clave_idempotencia)`). Además, el botón se deshabilita mientras se envía.
- **Vaciado del carrito.** El pedido, sus líneas y el vaciado del carrito ocurren en la misma transacción. Si algo falla, el carrito queda intacto.

## 6. Otros supuestos

- **Zona horaria.** Las clases se cargan y muestran en hora de Argentina (UTC−03:00, sin horario de verano). En la base se guardan en UTC. RN-01 se evalúa con la hora del servidor.
- **Precios.** En pesos argentinos enteros, sin centavos.
- **Estado del pedido.** Al confirmar, el pedido queda en `RECIBIDO` (CU-16). Ningún CU cambia el estado.
- **Eliminar un producto (CU-12).** Sale del menú y de los carritos; el registro se conserva marcado como eliminado para que los pedidos históricos mantengan su referencia (RN-03), como indica la Entrega 7.
- **Cancelar una inscripción (CU-20) y eliminar una clase (CU-23).** Como en las secuencias: la inscripción se quita de la clase y del cliente y su registro se borra; al eliminar una clase se anulan sus inscripciones y la clase se borra.
- **Fuera del modelo.** Se quitaron funciones que no tienen CU ni figuran en los diagramas (cambio de contraseña, listado de pedidos para el administrador y pantalla de código QR). La URL `/menu` sigue siendo pública y estable, apta para imprimir un QR (Entrega 1).
- **Respaldo.** La Entrega 1 propone “mecanismos de respaldo” sin un CU asociado. Se documenta como procedimiento operativo: copiar `data/lately.db` y la carpeta `uploads/` con el servidor detenido, o ejecutar `sqlite3 data/lately.db ".backup respaldo.db"` en caliente.
- **Fuentes.** Se cargan desde Google Fonts, el único servicio externo, y tienen fuentes del sistema como alternativa.
