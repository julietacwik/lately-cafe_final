# Trazabilidad: casos de uso ↔ pantallas ↔ código ↔ diagramas

Fuentes: **Entrega 2** (RF-01 a RF-28, RNF-01, RN-01 a RN-03, CU-01 a CU-24), **Entrega 7** (pantallas, vistas y transiciones de navegación), diagrama de clases **vigente de la Entrega 8** y secuencias de las **Entregas 6 y 8**.

Cada caso de uso tiene una pantalla (vista de la Entrega 7), una ruta de la API y un método del `Gestor` con el mismo nombre del diagrama. Ese método sigue el orden de mensajes de su diagrama de secuencia.

## Casos de uso

| CU | Caso de uso | Actor | Pantalla (vista, E7) | Transición | API | Método del `Gestor` | Secuencia |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CU-01 | Registro de usuario | Visitante | `/registrarse` (VistaRegistro) | 16 | `POST /api/auth/registro` | `registrarCliente(nombre, email, clave)` | E8 4.1 |
| CU-02 | Inicio de sesión | Visitante | `/ingresar` (VistaLogin) | 17, 18 | `POST /api/auth/ingreso` | `iniciarSesion(email, clave)` → `usuario.verificarClave(clave)` | E8 4.2 |
| CU-03 | Cerrar sesión | Usuario | «Cerrar sesión» (VistaPerfil, encabezado) | 23 | `POST /api/auth/salida` | `cerrarSesion(usuario)` | E8 4.3 |
| CU-04 | Consultar perfil | Usuario | `/perfil` (VistaPerfil) | — | `GET /api/perfil` | `consultarPerfil(usuario)` | E8 4.4 |
| CU-05 | Modificar perfil | Usuario | `/perfil` → «Editar perfil» | 19, 20 | `PUT /api/perfil` | `modificarPerfil(usuario, nombre, foto, direccion, telefono)` | E8 4.5 |
| CU-06 | Consultar historial de pedidos | Cliente | `/mis-pedidos` (VistaMisPedidos) | 21 | `GET /api/pedidos` | `consultarHistorial(cliente)` | E8 4.6 |
| CU-07 | Consultar menú | Visitante | `/menu` (VistaMenu) | 1, 7 | `GET /api/productos` | `consultarMenu()` → `menu.consultar()` | E8 4.7 |
| CU-08 | Buscar productos del menú | Visitante | `/menu?q=` (VistaMenu) | — | `GET /api/productos?q=` | `buscarProducto(texto)` → `menu.buscarPorNombre(texto)` | E8 4.8 |
| CU-09 | Crear producto | Administrador | Gestión de productos → «Nuevo producto» | A4, A5 | `POST /api/admin/productos` | `crearProducto(admin, prod)` | E8 4.9 |
| CU-10 | Modificar disponibilidad | Administrador | Gestión de productos (interruptor) | A6 | `PATCH /api/admin/productos/:id/disponibilidad` | `cambiarDisponibilidad(admin, prod)` → `prod.cambiarDisponibilidad()` | E8 4.10 |
| CU-11 | Modificar producto | Administrador | Gestión de productos → «Editar» | A4, A5 | `PUT /api/admin/productos/:id` | `modificarProducto(admin, prod, datos)` → `prod.actualizarDatos(datos)` | E8 4.11 |
| CU-12 | Eliminar producto | Administrador | Gestión de productos → «Eliminar» + confirmación | A7 | `DELETE /api/admin/productos/:id` | `eliminarProducto(admin, prod)` → `menu.eliminar(prod)` | E8 4.12 |
| CU-13 | Agregar producto al carrito | Cliente | `/menu` → «Agregar al carrito» | 4, 5 | `POST /api/carrito/lineas` | `agregarAlCarrito(cliente, prod, cant)` → `carrito.agregar(prod, cant)` | E8 4.13 |
| CU-14 | Consultar carrito | Cliente | `/carrito` (VistaCarrito) | 6 | `GET /api/carrito` | `consultarCarrito(cliente)` → `carrito.calcularTotal()` | E8 4.14 |
| CU-15 | Modificar carrito | Cliente | `/carrito` («– / +», «Quitar») | 8 | `PATCH` / `DELETE /api/carrito/lineas/:productoId` | `modificarCarrito(cliente, linea, cant)`, `eliminarDelCarrito(cliente, linea)` | E8 4.15 |
| CU-16 | Realizar pedido | Cliente | `/confirmar-pedido` (VistaResumenCompra) | 9, 11 | `GET /api/carrito`, `POST /api/pedidos` | `consultarCarrito(cliente)`, `confirmarPedido(cliente)` | E6 4.3 / E8 4.16 |
| CU-17 | Consultar estadísticas de ventas | Administrador | Estadísticas (VistaEstadisticas) | A13 | `GET /api/admin/estadisticas` | `consultarEstadisticas(desde, hasta)` → `new Estadisticas(pedidos)` | E8 4.17 |
| CU-18 | Consultar clases disponibles | Visitante | `/clases` (VistaClases) | 2 | `GET /api/clases` | `consultarClases()` → `clase.cuposDisponibles()` | E8 4.18 |
| CU-19 | Inscribirse a una clase | Cliente | `/clases` → «Inscribirme» | 12, 13 | `POST /api/clases/:id/inscripciones` | `inscribir(cliente, clase)` → `clase.hayCupo()` | E8 4.19 |
| CU-20 | Cancelar inscripción a una clase | Cliente | `/mis-clases` (VistaMisClases) | 14 | `GET /api/inscripciones`, `DELETE /api/inscripciones/:id` | `consultarMisClases(cliente)`, `cancelarInscripcion(insc)` → `insc.puedeCancelarse()`, `insc.cancelar()` | E6 3.3 / E8 4.20 |
| CU-21 | Crear clase | Administrador | Gestión de clases → «Nueva clase» | A8, A9 | `POST /api/admin/clases` | `crearClase(admin, clase)` | E8 4.21 |
| CU-22 | Modificar clase | Administrador | Gestión de clases → «Editar» | A8, A9 | `PUT /api/admin/clases/:id` | `modificarClase(admin, clase, datos)` → `clase.actualizarDatos(datos)` | E8 4.22 |
| CU-23 | Eliminar clase | Administrador | Gestión de clases → «Eliminar» + confirmación | A10 | `DELETE /api/admin/clases/:id` | `eliminarClase(admin, clase)` → `clase.cancelarInscripciones()` | E8 4.23 |
| CU-24 | Consultar inscriptos | Administrador | Inscriptos de la clase | A11, A12 | `GET /api/admin/clases/:id/inscriptos` | `consultarInscriptos(admin, clase)` → `clase.getInscripciones()` | E8 4.24 |

Las transiciones 3, 15, 22 y 24, y A1 a A3, A14 y A15, son navegación sin caso de uso propio: abrir Iniciar sesión, Registrarse o Mis clases, las pestañas del panel, cerrar sesión desde el panel y la redirección por falta de sesión o de rol.

## Requerimientos funcionales

| RF | Requerimiento | CU | Pantalla |
| --- | --- | --- | --- |
| RF-01 | Registro de usuario | CU-01 | Registrarse |
| RF-02 | Inicio de sesión | CU-02 | Iniciar sesión |
| RF-03 | Cerrar sesión | CU-03 | Mi cuenta |
| RF-04 | Gestión de roles | CU-02 | Cliente o Panel administrativo según el rol (transiciones 17 y 18) |
| RF-05 | Consulta del perfil | CU-04 | Mi perfil |
| RF-06 | Modificación de perfil | CU-05 | Editar perfil |
| RF-07 | Historial de pedidos | CU-06 | Mis pedidos |
| RF-08 | Consulta de menú | CU-07 | Menú |
| RF-09 | Búsqueda de productos | CU-08 | Menú (buscador) |
| RF-10 | Creación de productos | CU-09 | Gestión de productos |
| RF-11 | Modificación de disponibilidad | CU-10 | Gestión de productos |
| RF-12 | Modificación de productos | CU-11 | Gestión de productos |
| RF-13 | Eliminación de productos | CU-12 | Gestión de productos |
| RF-14 | Agregar productos al carrito | CU-13 | Menú |
| RF-15 | Consultar carrito | CU-14 | Carrito |
| RF-16 | Modificar carrito | CU-15 | Carrito |
| RF-17 | Verificación de información | CU-16 | Resumen de compra |
| RF-18 | Realización del pedido | CU-16 | Resumen de compra |
| RF-19 | Consulta de estadísticas | CU-17 | Estadísticas |
| RF-20 | Control de acceso | todos los de administrador | `tienePermisoAdmin` (transición A15) |
| RF-21 | Adaptación de la presentación | — | Todas (diseño adaptable a celular) |
| RF-22 | Consulta de clases | CU-18 | Clases |
| RF-23 | Inscripción a una clase | CU-19 | Clases |
| RF-24 | Cancelación de inscripción | CU-20 | Mis clases |
| RF-25 | Creación de clases | CU-21 | Gestión de clases |
| RF-26 | Modificación de clases | CU-22 | Gestión de clases |
| RF-27 | Eliminación de clases | CU-23 | Gestión de clases |
| RF-28 | Consulta de inscriptos | CU-24 | Inscriptos de la clase |

## Requerimiento no funcional y reglas de negocio

| ID | Descripción | Dónde se cumple | Verificación |
| --- | --- | --- | --- |
| RNF-01 | 50 usuarios concurrentes sin degradación | Listas del `Gestor` en memoria, SQLite (WAL), transacciones cortas e índices | `npm run prueba:carga -- http://localhost:3000 50 60` (métricas de la Entrega 5: tiempo medio y percentil 95) |
| RN-01 | Cancelar hasta 48 h antes del inicio | `Inscripcion.puedeCancelarse()` con `ClaseBarista.getInicio()` y la hora del servidor | Prueba unitaria (48 h exactas sí, un minuto menos no) y de API |
| RN-02 | Cupo máximo de 8 alumnos | `ClaseBarista.validar()` y `hayCupo()`, transacción y trigger en la base | Prueba de API: 14 inscripciones simultáneas, 8 aceptadas |
| RN-03 | Un cambio de precio no afecta pedidos confirmados | `Pedido.desdeCarrito()` crea líneas propias con `producto.getPrecio()` | Pruebas unitaria y de API |

## Fuera del modelo

No se implementan funciones sin caso de uso. Las pantallas de administración son las tres pestañas de la Entrega 7: Productos, Clases y Estadísticas. La URL `/menu` es pública y estable, para imprimirla como código QR («Menú en QR», Entrega 1).
