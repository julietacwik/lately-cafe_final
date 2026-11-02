-- Lately Café · Esquema inicial
-- Cada tabla corresponde a una clase o asociación del diagrama de clases vigente (Entregas 4, 6 y 8).
-- El diseño relacional se documenta en la Entrega 7 (sección 6).

-- Usuario (abstracta) + Cliente / Administrador: herencia en una sola tabla con discriminador "tipo".
CREATE TABLE usuarios (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo          TEXT    NOT NULL CHECK (tipo IN ('CLIENTE', 'ADMINISTRADOR')),
  nombre        TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT    NOT NULL,
  foto          TEXT,
  direccion     TEXT,
  telefono      TEXT,
  creado_en     TEXT    NOT NULL
);

-- Sesiones del servidor. Se guarda el hash del token, nunca el token en claro.
CREATE TABLE sesiones (
  token_hash TEXT    PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  creada_en  TEXT    NOT NULL,
  expira_en  TEXT    NOT NULL
);
CREATE INDEX idx_sesiones_usuario ON sesiones(usuario_id);

-- Producto (Menu = conjunto de productos no eliminados). Precios en pesos enteros.
-- La eliminación es lógica para que los pedidos históricos conserven su referencia.
CREATE TABLE productos (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre         TEXT    NOT NULL,
  descripcion    TEXT    NOT NULL,
  precio         INTEGER NOT NULL CHECK (precio > 0),
  categoria      TEXT    NOT NULL,
  imagen         TEXT,
  disponible     INTEGER NOT NULL DEFAULT 1 CHECK (disponible IN (0, 1)),
  eliminado      INTEGER NOT NULL DEFAULT 0 CHECK (eliminado IN (0, 1)),
  creado_en      TEXT    NOT NULL,
  actualizado_en TEXT    NOT NULL
);
CREATE INDEX idx_productos_visibles ON productos(eliminado, categoria);

-- Carrito del cliente: sus líneas. El precio NO se guarda aquí; se toma el vigente.
CREATE TABLE carrito_lineas (
  cliente_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  producto_id INTEGER NOT NULL REFERENCES productos(id),
  cantidad    INTEGER NOT NULL CHECK (cantidad BETWEEN 1 AND 99),
  agregado_en TEXT    NOT NULL,
  PRIMARY KEY (cliente_id, producto_id)
);

-- Pedido: cliente, fecha, estado, importe y datos del cliente aceptados al confirmar.
-- La clave de idempotencia evita pedidos duplicados por múltiples clics.
CREATE TABLE pedidos (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id         INTEGER NOT NULL REFERENCES usuarios(id),
  fecha              TEXT    NOT NULL,
  estado             TEXT    NOT NULL DEFAULT 'RECIBIDO',
  importe_total      INTEGER NOT NULL CHECK (importe_total > 0),
  clave_idempotencia TEXT    NOT NULL,
  cliente_nombre     TEXT    NOT NULL,
  cliente_email      TEXT    NOT NULL,
  cliente_telefono   TEXT,
  cliente_direccion  TEXT,
  UNIQUE (cliente_id, clave_idempotencia)
);
CREATE INDEX idx_pedidos_cliente ON pedidos(cliente_id, fecha);
CREATE INDEX idx_pedidos_fecha ON pedidos(fecha);

-- Linea de pedido: copia propia con cantidad y precio unitario aplicado (RN-03).
CREATE TABLE pedido_lineas (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id       INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  producto_id     INTEGER NOT NULL REFERENCES productos(id),
  nombre_producto TEXT    NOT NULL,
  cantidad        INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario INTEGER NOT NULL CHECK (precio_unitario > 0)
);
CREATE INDEX idx_pedido_lineas_pedido ON pedido_lineas(pedido_id);

-- ClaseBarista. "docente" es un dato de la clase, no una cuenta (RN-02: cupo máximo 8).
CREATE TABLE clases (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre       TEXT    NOT NULL,
  descripcion  TEXT    NOT NULL,
  docente      TEXT    NOT NULL,
  inicio       TEXT    NOT NULL,
  duracion_min INTEGER NOT NULL CHECK (duracion_min BETWEEN 15 AND 600),
  cupo         INTEGER NOT NULL CHECK (cupo BETWEEN 1 AND 8),
  imagen       TEXT,
  creado_en    TEXT    NOT NULL
);
CREATE INDEX idx_clases_inicio ON clases(inicio);

-- Inscripcion: vincula cliente y clase. Cancelar (CU-20) borra el registro y libera el cupo;
-- eliminar la clase (CU-23) borra sus inscripciones (ON DELETE CASCADE).
CREATE TABLE inscripciones (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  clase_id     INTEGER NOT NULL REFERENCES clases(id) ON DELETE CASCADE,
  cliente_id   INTEGER NOT NULL REFERENCES usuarios(id),
  creada_en    TEXT    NOT NULL,
  UNIQUE (clase_id, cliente_id)
);
CREATE INDEX idx_inscripciones_cliente ON inscripciones(cliente_id);

-- Defensa en profundidad para RN-02: aunque falle la validación de la aplicación,
-- la base rechaza una inscripción activa que supere el cupo configurado.
CREATE TRIGGER trg_cupo_inscripcion
BEFORE INSERT ON inscripciones
BEGIN
  SELECT RAISE(ABORT, 'CUPO_COMPLETO')
  WHERE (SELECT COUNT(*) FROM inscripciones WHERE clase_id = NEW.clase_id)
        >= (SELECT cupo FROM clases WHERE id = NEW.clase_id);
END;

-- No se permite reducir el cupo por debajo de las inscripciones activas.
CREATE TRIGGER trg_cupo_minimo
BEFORE UPDATE OF cupo ON clases
BEGIN
  SELECT RAISE(ABORT, 'CUPO_MENOR_A_INSCRIPTOS')
  WHERE NEW.cupo < (SELECT COUNT(*) FROM inscripciones WHERE clase_id = NEW.id);
END;
