# Pruebas

## 1. Pruebas automáticas (ejecutadas)

```bash
npm test
```

Usan `node:test` (incluido en Node.js) y levantan el servidor real con una base SQLite **en memoria** cargada con los datos demo. No modifican `data/lately.db`.

Resultado de la última ejecución (01/11/2026, Node.js 22.19, Windows 11): **31 pruebas, 31 aprobadas**, incluidas las de producción (`tests/produccion.test.js`): configuración para Render, base nueva sin cuentas demo, datos conservados tras un reinicio (pedidos y carrito) y bloqueo de `db:demo` en producción. Una prueba de la API verifica que cada cambio (carrito, precio, inscripción y cancelación) queda en la base en el momento, sin esperar a `guardarTodo()`.

### Verificaciones exigidas por la consigna

| Verificación | Prueba | Resultado |
| --- | --- | --- |
| Un visitante no puede administrar | `Un visitante no puede administrar; un cliente tampoco` (401 para visitante y 403 para cliente en productos, clases, pedidos y estadísticas) | ✅ |
| Un producto agotado no puede agregarse | `Un producto agotado no puede agregarse al carrito` y prueba unitaria de `Carrito` | ✅ |
| Una clase no supera su cupo | `Una clase no supera su cupo ante inscripciones simultáneas`: 14 clientes se inscriben **a la vez** en una clase de 8 → exactamente 8 aceptados y 6 rechazados con `CUPO_COMPLETO` | ✅ |
| La cancelación respeta las 48 horas | API: clase a 47 h → rechazada; a 50 h → aceptada. Unitaria: exactamente 48 h → permitida; 48 h menos 1 minuto → rechazada | ✅ |
| Los pedidos conservan precios históricos | `Los pedidos conservan sus precios históricos y evitan duplicados`: se confirma, el admin cambia el precio y el pedido conserva el precio original | ✅ |

### Otras verificaciones

- El registro público ignora `rol: "ADMINISTRADOR"` y la contraseña se guarda como hash `scrypt`.
- Correo duplicado, datos inválidos (errores por campo) y credenciales incorrectas.
- Protección CSRF: sin la cabecera, la solicitud se rechaza.
- Carrito: cantidades 0, negativas, decimales, mayores a 99 y no numéricas → rechazadas. Los totales se recalculan.
- 5 clics simultáneos en “Confirmar pedido” → un único pedido.
- Resumen desactualizado → rechazo **sin** vaciar el carrito.
- Carrito vacío o con productos agotados → no se confirma.
- Un cliente no ve pedidos ajenos ni cancela inscripciones ajenas (404).
- Sin inscripciones duplicadas. No se puede reducir el cupo por debajo de las inscripciones activas.
- Eliminar una clase cancela sus inscripciones (`CANCELADA_POR_CLASE`).
- Estadísticas: desde > hasta → error en el campo; período sin ventas → ceros; período mayor a 3 años → error.
- Menú público con búsqueda y `/menu` servido por el servidor (URL del QR).

### Pruebas manuales de la API (ejecutadas)

Con `curl` contra el servidor local:

- Subida de foto de perfil y de imagen de producto.
- Archivo falso con extensión `.jpg` → rechazado.
- Teléfono inválido → error en el campo.
- Nombres con tildes y ñ guardados en UTF-8.
- Rutas inexistentes → 404.
- Cabeceras de seguridad (CSP, `X-Frame-Options`).

## 2. Requisito de rendimiento: 50 usuarios concurrentes

### Cómo se comprueba

`scripts/prueba-carga.js` simula usuarios virtuales concurrentes. Cada uno se registra y repite el recorrido de un cliente: menú, búsqueda, clases, agregar al carrito, ver carrito y, cada tres vueltas, confirmar un pedido y ver “Mis pedidos”. Al final informa p50, p95 y máximo por operación, el total de solicitudes por segundo y la tasa de errores.

```bash
npm start                                         # en una terminal
npm run prueba:carga -- http://localhost:3000 50 60   # en otra: URL, usuarios, segundos
npm run db:demo                                   # después: restablecer los datos
```

Criterio de aprobación: **p95 ≤ 2000 ms** y **errores ≤ 1 %** (ajustable con `UMBRAL_P95_MS`). La Entrega 2 menciona que el RNF-01 tiene “tiempos y condiciones medibles” sin fijar valores. Este umbral es una propuesta que el equipo debe validar.

> En producción (`NODE_ENV=production`) el registro admite 10 intentos por IP cada 15 minutos. Para medir en un entorno publicado, usá cuentas creadas de antemano o subí ese límite temporalmente.

### Resultado ejecutado (entorno local)

01/11/2026 · Windows 11 · Node.js 22.19 · servidor y generador de carga en la misma máquina · 50 usuarios · 20 s · versión con las listas en el `Gestor` y guardado inmediato en SQLite:

| Operación | Solicitudes | p50 | p95 | Máx. |
| --- | ---: | ---: | ---: | ---: |
| Registro (hash scrypt) | 50 | 893 ms | 1 523 ms | 1 558 ms |
| Menú | 6 546 | 22 ms | 49 ms | 219 ms |
| Búsqueda | 6 546 | 22 ms | 51 ms | 219 ms |
| Clases | 6 546 | 22 ms | 43 ms | 219 ms |
| Agregar al carrito | 6 546 | 22 ms | 50 ms | 220 ms |
| Carrito | 6 546 | 22 ms | 47 ms | 219 ms |
| Confirmar pedido | 2 167 | 22 ms | 48 ms | 218 ms |
| Mis pedidos | 2 167 | 22 ms | 53 ms | 219 ms |

**Total:** 37 114 solicitudes (≈ 1 849 por segundo), **p95 global 50 ms, 0 errores → APROBADA**.

El registro es la operación más lenta porque calcula el hash de la contraseña, y los 50 usuarios se registran a la vez al empezar.

Hay que leer este resultado con cuidado. Los usuarios virtuales no hacen pausas entre acciones, así que la carga es mucho mayor que la de 50 personas reales. Pero no hay latencia de red, y cliente y servidor comparten la máquina.

### Pendiente

- [ ] Repetir la prueba contra el entorno publicado (con red real y HTTPS), desde otra máquina.
- [ ] Medir con pausas realistas (por ejemplo, 2 a 5 s entre acciones) durante 10 minutos o más.
- [ ] Medir la carga de páginas en el navegador (Lighthouse) con conexión móvil simulada.

## 3. Pruebas de interfaz en navegador (ejecutadas)

```bash
npm run db:demo          # datos limpios (la prueba crea cuentas, pedidos e inscripciones)
npm start                # en una terminal
npm run prueba:navegador -- http://localhost:3000   # en otra (usa Edge; NAVEGADOR=chrome para Chrome)
```

`scripts/prueba-navegador.js` maneja un navegador real con Playwright, sin ventana. Recorre cada flujo en **computadora (1280 × 860)** y en **celular (390 × 844)**. También revisa los errores de consola y de página, y el desplazamiento horizontal. Guarda capturas en `tmp/capturas/`.

Resultado (01/11/2026, Microsoft Edge en Windows 11): **81 de 81 verificaciones aprobadas, sin errores de consola ni de página**, en dos ejecuciones seguidas. Además se recorrieron y revisaron visualmente todas las pantallas de visitante, cliente y administrador en los dos tamaños.

| Flujo | Qué se verificó (en computadora y en celular) |
| --- | --- |
| Registro, ingreso y perfil | Registro vacío con errores en cada campo; registro exitoso; cerrar sesión e ingresar; teléfono inválido marcado; perfil guardado con foto. |
| Menú y carrito | Búsqueda “latte” → 2 resultados; Iced latte agotado con botón deshabilitado; agregar 2 unidades (el contador se actualiza); búsqueda sin coincidencias → estado vacío; sumar una unidad recalcula el total; cantidad 0 rechazada. |
| Pedido | El resumen muestra los datos del cliente; la confirmación pide un diálogo; el pedido `LC-…` queda “Recibido”; el carrito queda vacío. |
| Precio histórico | El administrador sube el precio de Latte; el detalle del pedido conserva el precio de la compra y el menú muestra el nuevo. |
| Clases | Inscripción a “Cata”; la clase completa no admite inscripción; la clase que empieza en menos de 48 h no se puede cancelar y explica el motivo; la que empieza en más de 48 h se cancela. |
| Administración | Producto: errores en cada campo, alta, paso a “agotado” y baja con confirmación. Clase: cupo 9 rechazado, alta, cupo menor a los inscriptos rechazado. Inscriptos muestra al cliente. Al eliminar la clase se avisa la cancelación y el cliente la ve “cancelada por Lately Café”. |
| Estadísticas | Últimos 90 días (indicadores y productos más vendidos); “desde” posterior a “hasta” marcado como error; período sin ventas. |
| Permisos | Un cliente que entra a `/admin` ve “Acceso restringido”. |
| Teclado | El primer Tab enfoca “Saltar al contenido”; el foco es siempre visible; se ingresa con Enter; el diálogo abre con foco en “Volver” y cierra con Esc; el menú móvil abre con Enter y cierra con Esc. |
| Diseño adaptable | Sin desplazamiento horizontal en ninguna pantalla recorrida, en ningún tamaño. |

### Problemas encontrados y corregidos en esta verificación

1. **Comas sueltas entre tarjetas** (inicio, filtros del menú). Al convertir listas de elementos en texto aparecían comas, que además desarmaban la grilla de destacados. Corregido en `pintar()` (`public/js/ui.js`).
2. **Atributos ARIA vacíos.** `aria-checked`, `aria-pressed`, `aria-expanded` y `aria-current` quedaban vacíos cuando el valor era `false`, y los lectores de pantalla no anunciaban bien interruptores, filtros ni el menú. Corregido: ahora se escriben `"true"` o `"false"`.
3. **Foco en la carga inicial.** El foco saltaba al título y el primer Tab salteaba “Saltar al contenido”. Ahora el foco solo se mueve al título al navegar entre páginas (`public/js/router.js`), y el título enfocado ya no muestra contorno.
4. **Contenido pegado al borde en celular.** La clase `.seccion` anulaba el margen lateral de `.contenedor` en carrito, pedidos, perfil, mis clases, etc. Corregido con `padding-block`.
5. **Fila “Total” desalineada** en las tablas apiladas en celular. Corregida.

### Pendiente

- [ ] Revisar con un lector de pantalla real (NVDA o Narrador): avisos, diálogos y errores de formulario.
- [ ] Probar en Firefox y en Safari (iOS) y en teléfonos físicos. La prueba automática usa el motor de Chromium (Edge).
- [ ] Auditoría con Lighthouse o axe DevTools (contraste y etiquetas). La paleta se eligió con contraste AA, pero no se midió con herramientas.
