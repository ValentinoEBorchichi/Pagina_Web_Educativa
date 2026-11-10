/* =============================================================================
   Educar para Transformar - Esquema unificado (PostgreSQL / Supabase)
   -----------------------------------------------------------------------------
   Reemplaza las dos bases que coexistían antes (SQL Server + SQLite) por una
   sola fuente de verdad (RNFM-02). No hay tablas "_legacy": usuarios y
   alumnos están fusionados; el módulo financiero conserva solo el esquema
   nuevo (tarifa_concepto/factura/factura_detalle/comprobante_transferencia/
   saldos); el módulo académico/operativo (niveles, aulas, cursos, materias,
   docentes, horarios, asistencias, calificaciones, comunicación, servicios,
   actividades extracurriculares, preinscripciones) viene del esquema SQLite,
   con sus columnas calculadas/constraints trasladadas donde correspondía.

   Duplicaciones detectadas pero fuera de este alcance (ver plan): profesores
   vs. docentes, y transportes (RF-09, recorridos fijos) vs. transporte_rutas/
   transporte_asignaciones (asignación libre del panel admin). Ambos pares se
   preservan tal cual, sin fusionar, documentados como deuda técnica.

   Ejecución: pegar este archivo completo en el SQL Editor de Supabase y
   correrlo una sola vez (orden de creación ya resuelto por dependencias).
   ============================================================================= */

BEGIN;

-- =============================================================================
-- Identidad
-- =============================================================================

CREATE TABLE usuarios (
    id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username        VARCHAR(50)   NOT NULL UNIQUE,
    password_hash   VARCHAR(100)  NOT NULL,
    nombre          VARCHAR(100)  NOT NULL,
    apellido        VARCHAR(100)  NULL,
    email           VARCHAR(150)  NULL,
    rol             VARCHAR(20)   NOT NULL,
    activo          BOOLEAN       NOT NULL DEFAULT TRUE,
    fecha_creacion  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT ck_usuarios_rol CHECK (rol IN ('admin', 'docente', 'alumno', 'padre')),
    CONSTRAINT ck_usuarios_email CHECK (email IS NULL OR email ~ '^.+@.+\..+$'),
    -- Destino de las FK compuestas que además de la existencia validan el rol
    -- del usuario referenciado (profesores, alumnos.padre_id, alumnos.usuario_id).
    CONSTRAINT uq_usuarios_id_rol UNIQUE (id, rol)
);

CREATE UNIQUE INDEX ux_usuarios_email ON usuarios (email) WHERE email IS NOT NULL;

COMMENT ON TABLE usuarios IS 'Fusión de dbo.Usuarios (SQL Server) + users (SQLite). "padre" sigue siendo un rol, no una tabla aparte.';

-- =============================================================================
-- Académico / operativo (base: esquema SQLite, ampliado con columnas que solo
-- existían en SQL Server para no perder información).
-- =============================================================================

CREATE TABLE niveles (
    id      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre  VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE aulas (
    id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre     VARCHAR(50) NOT NULL UNIQUE,
    capacidad  INTEGER     NOT NULL
);

-- profesores: ficha docente (equivalente a dbo.Profesores). docentes (más
-- abajo) es la tabla histórica de SQLite usada por horarios: se preserva
-- aparte a propósito (ver nota de duplicaciones en el encabezado).
CREATE TABLE profesores (
    id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id    INTEGER       NOT NULL UNIQUE,
    usuario_rol   VARCHAR(20)   GENERATED ALWAYS AS ('docente') STORED,
    dni           VARCHAR(8)    NOT NULL UNIQUE,
    especialidad  VARCHAR(100)  NULL,
    telefono      VARCHAR(20)   NULL,
    fecha_alta    DATE          NOT NULL DEFAULT CURRENT_DATE,
    CONSTRAINT ck_profesores_dni CHECK (dni ~ '^[0-9]{7,8}$'),
    CONSTRAINT fk_profesores_usuarios FOREIGN KEY (usuario_id, usuario_rol)
        REFERENCES usuarios (id, rol)
);

-- cursos: estructura simple de SQLite (nivel_id/division/cupo) + columnas
-- opcionales de dbo.Cursos (grado/turno/ciclo_lectivo/cupo_maximo/tutor).
CREATE TABLE cursos (
    id                 INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nivel_id           INTEGER       NULL REFERENCES niveles (id),
    division           VARCHAR(5)    NOT NULL,
    cupo               INTEGER       NOT NULL,
    grado              SMALLINT      NULL,
    turno              VARCHAR(10)   NULL,
    ciclo_lectivo      SMALLINT      NULL,
    cupo_maximo        SMALLINT      NULL,
    profesor_tutor_id  INTEGER       NULL REFERENCES profesores (id) ON DELETE SET NULL,
    CONSTRAINT ck_cursos_grado CHECK (grado IS NULL OR grado BETWEEN 1 AND 7),
    CONSTRAINT ck_cursos_turno CHECK (turno IS NULL OR turno IN ('Mañana', 'Tarde')),
    CONSTRAINT ck_cursos_ciclo_lectivo CHECK (ciclo_lectivo IS NULL OR ciclo_lectivo BETWEEN 2000 AND 2100),
    CONSTRAINT ck_cursos_cupo_maximo CHECK (cupo_maximo IS NULL OR cupo_maximo > 0)
);

CREATE INDEX ix_cursos_profesor_tutor_id ON cursos (profesor_tutor_id);

-- personal: legajo no docente/administrativo/maestranza/directivo (ver más
-- abajo, junto al resto del módulo financiero/operativo). Se crea ACÁ,
-- antes de `horarios`, porque horarios.docente_id en realidad apunta a
-- `personal` filtrado por tipo='Docente' -así lo usa horarios.controller.js
-- (getDocentes/createHorario), no a una tabla "docentes" separada; esa tabla
-- de SQLite existía en el esquema pero ningún controlador la consultaba
-- (se confirmó al migrar el código), así que no se trajo al esquema nuevo.
CREATE TABLE personal (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre      VARCHAR(100) NOT NULL,
    apellido    VARCHAR(100) NOT NULL,
    dni         VARCHAR(20)  NOT NULL UNIQUE,
    tipo        VARCHAR(20)  NOT NULL,
    email       VARCHAR(150) NULL,
    fecha_alta  DATE         NOT NULL DEFAULT CURRENT_DATE,
    CONSTRAINT ck_personal_tipo CHECK (tipo IN ('Docente', 'Administrativo', 'Maestranza', 'Directivo'))
);

-- materias: estructura de SQLite (nombre/curso_id) + columnas opcionales de
-- dbo.Materias (descripcion/activo).
CREATE TABLE materias (
    id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre       VARCHAR(100)  NOT NULL,
    curso_id     INTEGER       NULL REFERENCES cursos (id),
    descripcion  VARCHAR(300)  NULL,
    activo       BOOLEAN       NOT NULL DEFAULT TRUE
);

CREATE TABLE horarios (
    id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    materia_id   INTEGER  NULL REFERENCES materias (id),
    docente_id   INTEGER  NULL REFERENCES personal (id),
    aula_id      INTEGER  NULL REFERENCES aulas (id),
    dia_semana   INTEGER  NULL,  -- 1-5 (Lunes-Viernes)
    hora_inicio  VARCHAR(5) NULL,  -- HH:MM
    hora_fin     VARCHAR(5) NULL
);

-- =============================================================================
-- Transporte (RF-09, SQL Server): recorridos fijos que elige el alumno desde
-- la app móvil. Ver transporte_rutas/transporte_asignaciones más abajo: es
-- otro sistema de transporte, usado hoy por el panel admin web, que NO se
-- fusiona con este en esta vuelta.
-- =============================================================================

CREATE TABLE transportes (
    id                INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    numero_recorrido  SMALLINT      NOT NULL UNIQUE,
    nombre            VARCHAR(100)  NOT NULL,
    zona              VARCHAR(200)  NULL,
    chofer            VARCHAR(100)  NULL,
    patente           VARCHAR(10)   NULL,
    capacidad         SMALLINT      NOT NULL,
    hora_salida       TIME          NULL,
    CONSTRAINT ck_transportes_numero_recorrido CHECK (numero_recorrido BETWEEN 1 AND 4),
    CONSTRAINT ck_transportes_capacidad CHECK (capacidad > 0)
);

-- =============================================================================
-- Deportes (SQL Server): sin equivalente real en SQLite (actividades_extra es
-- un sistema distinto, más abajo). Mantiene la regla de negocio RF-06/07/cupo
-- como función + trigger de Postgres.
-- =============================================================================

CREATE TABLE deportes (
    id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre        VARCHAR(100)  NOT NULL,
    profesor_id   INTEGER       NULL REFERENCES profesores (id) ON DELETE SET NULL,
    dias_semana   SMALLINT      NOT NULL,  -- máscara de bits: Lun=1 Mar=2 Mié=4 Jue=8 Vie=16 Sáb=32 Dom=64
    hora_inicio   TIME          NOT NULL,
    hora_fin      TIME          NOT NULL,
    cupo_maximo   SMALLINT      NOT NULL,
    activo        BOOLEAN       NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_deportes_nombre_horario UNIQUE (nombre, dias_semana, hora_inicio),
    CONSTRAINT ck_deportes_dias_semana CHECK (dias_semana BETWEEN 1 AND 127),
    CONSTRAINT ck_deportes_horario CHECK (hora_fin > hora_inicio),
    CONSTRAINT ck_deportes_cupo CHECK (cupo_maximo > 0)
);

CREATE INDEX ix_deportes_profesor_id ON deportes (profesor_id);

-- =============================================================================
-- Alumnos (fusión de dbo.Alumnos + alumnos de SQLite, incluye el flujo de
-- "padre vincula/desvincula un hijo disponible": por eso padre_id es NULLABLE
-- -acá SQL Server lo exigía NOT NULL, pero esa función del padre no existía
-- en SQL Server-).
-- =============================================================================

CREATE TABLE alumnos (
    id                INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    dni               VARCHAR(8)    NOT NULL UNIQUE,
    nombre            VARCHAR(100)  NOT NULL,
    apellido          VARCHAR(100)  NOT NULL,
    fecha_nacimiento  DATE          NOT NULL,
    curso_id          INTEGER       NOT NULL REFERENCES cursos (id),
    padre_id          INTEGER       NULL,
    padre_rol         VARCHAR(20)   GENERATED ALWAYS AS ('padre') STORED,
    usuario_id        INTEGER       NULL,
    usuario_rol       VARCHAR(20)   GENERATED ALWAYS AS ('alumno') STORED,
    usa_comedor       BOOLEAN       NOT NULL DEFAULT FALSE,
    transporte_id     INTEGER       NULL REFERENCES transportes (id),
    fecha_alta        DATE          NOT NULL DEFAULT CURRENT_DATE,
    CONSTRAINT ck_alumnos_dni CHECK (dni ~ '^[0-9]{7,8}$'),
    CONSTRAINT fk_alumnos_padre FOREIGN KEY (padre_id, padre_rol) REFERENCES usuarios (id, rol),
    CONSTRAINT fk_alumnos_usuario FOREIGN KEY (usuario_id, usuario_rol) REFERENCES usuarios (id, rol)
);

CREATE UNIQUE INDEX ux_alumnos_usuario_id ON alumnos (usuario_id) WHERE usuario_id IS NOT NULL;
CREATE INDEX ix_alumnos_curso_id ON alumnos (curso_id);
CREATE INDEX ix_alumnos_padre_id ON alumnos (padre_id);
CREATE INDEX ix_alumnos_transporte_id ON alumnos (transporte_id);

CREATE TABLE inscripciones_deportes (
    id                 INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    alumno_id          INTEGER      NOT NULL REFERENCES alumnos (id) ON DELETE CASCADE,
    deporte_id         INTEGER      NOT NULL REFERENCES deportes (id),
    fecha_inscripcion  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_inscripciones_deportes_alumno_deporte UNIQUE (alumno_id, deporte_id)
);

CREATE INDEX ix_inscripciones_deportes_deporte_id ON inscripciones_deportes (deporte_id);

-- Reglas de negocio (última línea de defensa; la API valida lo mismo antes
-- para devolver mensajes amigables). Códigos de error en el SQLSTATE, leídos
-- desde Node como err.code (antes: err.number con mssql):
--   50006  RF-06: máximo 2 deportes por alumno.
--   50007  RF-07: los horarios de los deportes de un alumno no se superponen.
--   50008  El deporte no tiene cupo disponible.
CREATE OR REPLACE FUNCTION fn_inscripciones_deportes_reglas() RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM inserted) THEN
        RETURN NULL;
    END IF;

    -- RF-06: límite de 2 deportes por alumno.
    IF EXISTS (
        SELECT 1 FROM inscripciones_deportes i
        WHERE i.alumno_id IN (SELECT alumno_id FROM inserted)
        GROUP BY i.alumno_id
        HAVING COUNT(*) > 2
    ) THEN
        RAISE EXCEPTION 'RF-06: un alumno no puede inscribirse en más de 2 deportes.' USING ERRCODE = '50006';
    END IF;

    -- RF-07: superposición horaria (comparten al menos un día y los rangos se pisan).
    IF EXISTS (
        SELECT 1
        FROM inserted AS nueva
        JOIN deportes AS d_nuevo ON d_nuevo.id = nueva.deporte_id
        JOIN inscripciones_deportes AS otra
            ON otra.alumno_id = nueva.alumno_id AND otra.id <> nueva.id
        JOIN deportes AS d_otro ON d_otro.id = otra.deporte_id
        WHERE (d_nuevo.dias_semana & d_otro.dias_semana) <> 0
          AND d_nuevo.hora_inicio < d_otro.hora_fin
          AND d_otro.hora_inicio < d_nuevo.hora_fin
    ) THEN
        RAISE EXCEPTION 'RF-07: el horario del deporte se superpone con otro deporte en el que el alumno ya está inscripto.' USING ERRCODE = '50007';
    END IF;

    -- Cupo máximo del deporte.
    IF EXISTS (
        SELECT 1
        FROM deportes d
        JOIN inscripciones_deportes i ON i.deporte_id = d.id
        WHERE d.id IN (SELECT deporte_id FROM inserted)
        GROUP BY d.id, d.cupo_maximo
        HAVING COUNT(*) > d.cupo_maximo
    ) THEN
        RAISE EXCEPTION 'El deporte no tiene cupo disponible.' USING ERRCODE = '50008';
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_inscripciones_deportes_reglas
    AFTER INSERT OR UPDATE ON inscripciones_deportes
    REFERENCING NEW TABLE AS inserted
    FOR EACH STATEMENT
    EXECUTE FUNCTION fn_inscripciones_deportes_reglas();

-- =============================================================================
-- Asistencias / calificaciones (base: SQLite, FK repuntada a la tabla
-- alumnos unificada).
-- =============================================================================

CREATE TABLE asistencias (
    id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    alumno_id  INTEGER NOT NULL REFERENCES alumnos (id) ON DELETE CASCADE,
    fecha      DATE    NOT NULL DEFAULT CURRENT_DATE,
    estado     VARCHAR(10) NOT NULL,
    CONSTRAINT ck_asistencias_estado CHECK (estado IN ('Presente', 'Ausente', 'Tarde'))
);

CREATE INDEX ix_asistencias_alumno_id ON asistencias (alumno_id);

CREATE TABLE calificaciones (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    alumno_id   INTEGER NOT NULL REFERENCES alumnos (id) ON DELETE CASCADE,
    materia_id  INTEGER NULL REFERENCES materias (id),
    nota        SMALLINT NOT NULL,
    trimestre   SMALLINT NULL,
    CONSTRAINT ck_calificaciones_nota CHECK (nota BETWEEN 1 AND 10),
    CONSTRAINT ck_calificaciones_trimestre CHECK (trimestre IS NULL OR trimestre BETWEEN 1 AND 3)
);

CREATE INDEX ix_calificaciones_alumno_id ON calificaciones (alumno_id);

-- =============================================================================
-- Comunicación / preinscripción (solo SQLite, sin cambios de fondo).
-- =============================================================================

CREATE TABLE notificaciones (
    id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    titulo       VARCHAR(200) NOT NULL,
    mensaje      TEXT         NOT NULL,
    rol_destino  VARCHAR(20)  NULL,  -- 'padre' | 'docente' | 'alumno' | 'all'
    leido        BOOLEAN      NOT NULL DEFAULT FALSE,
    fecha_envio  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE preinscripciones (
    id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    alumno_nombre   VARCHAR(150) NOT NULL,
    alumno_dni      VARCHAR(20)  NULL,
    alumno_edad     INTEGER      NOT NULL,
    nivel           VARCHAR(20)  NOT NULL,
    turno           VARCHAR(10)  NOT NULL,
    tutor_nombre    VARCHAR(150) NOT NULL,
    tutor_telefono  VARCHAR(30)  NOT NULL,
    tutor_email     VARCHAR(150) NOT NULL,
    observaciones   TEXT         NULL,
    estado          VARCHAR(20)  NOT NULL DEFAULT 'pendiente',
    fecha           TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- =============================================================================
-- Servicios institucionales (solo SQLite): comedor, transporte "libre" del
-- panel admin (ver nota de duplicación arriba), instalaciones, enfermería.
-- =============================================================================

CREATE TABLE comedor_asistencias (
    id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    alumno_id      INTEGER NOT NULL REFERENCES alumnos (id) ON DELETE CASCADE,
    fecha          DATE    NOT NULL DEFAULT CURRENT_DATE,
    consumio_menu  BOOLEAN NOT NULL DEFAULT TRUE,
    observaciones  TEXT    NULL
);

CREATE TABLE transporte_rutas (
    id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre_ruta     VARCHAR(100) NOT NULL,
    chofer_nombre   VARCHAR(100) NULL,
    capacidad_max   INTEGER      NULL
);

CREATE TABLE transporte_asignaciones (
    id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    alumno_id        INTEGER NOT NULL REFERENCES alumnos (id) ON DELETE CASCADE,
    ruta_id          INTEGER NULL REFERENCES transporte_rutas (id),
    punto_encuentro  VARCHAR(200) NULL
);

CREATE TABLE instalaciones (
    id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre       VARCHAR(100) NOT NULL UNIQUE,
    descripcion  TEXT NULL
);

CREATE TABLE instalaciones_reservas (
    id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    instalacion_id INTEGER     NOT NULL REFERENCES instalaciones (id),
    fecha          DATE        NOT NULL,
    hora_inicio    TIME        NOT NULL,
    hora_fin       TIME        NOT NULL,
    reservado_por  INTEGER     NULL REFERENCES usuarios (id),
    motivo         TEXT        NULL
);

CREATE TABLE enfermeria_incidencias (
    id                INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    alumno_id         INTEGER NOT NULL REFERENCES alumnos (id) ON DELETE CASCADE,
    descripcion       TEXT    NOT NULL,
    accion_tomada     TEXT    NULL,
    notificado_padre  BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_hora        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_enfermeria_descripcion CHECK (length(descripcion) >= 10)
);

-- =============================================================================
-- Actividades extracurriculares (solo SQLite): Idiomas/Deportes/Cultura en
-- sentido amplio -distinto del módulo "deportes" formal de arriba-.
-- =============================================================================

CREATE TABLE actividades_extra (
    id        INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre    VARCHAR(100) NOT NULL,
    tipo      VARCHAR(20)  NOT NULL,
    horario   VARCHAR(100) NULL,
    cupo_max  INTEGER      NULL,
    CONSTRAINT ck_actividades_extra_tipo CHECK (tipo IN ('Deporte', 'Cultura', 'Idioma'))
);

CREATE TABLE inscripciones_extra (
    id                 INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    alumno_id          INTEGER NOT NULL REFERENCES alumnos (id) ON DELETE CASCADE,
    actividad_id       INTEGER NOT NULL REFERENCES actividades_extra (id),
    fecha_inscripcion  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE actividad_asistencias (
    id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actividad_id  INTEGER NOT NULL REFERENCES actividades_extra (id),
    alumno_id     INTEGER NOT NULL REFERENCES alumnos (id) ON DELETE CASCADE,
    fecha         DATE    NOT NULL DEFAULT CURRENT_DATE,
    estado        VARCHAR(10) NOT NULL,
    CONSTRAINT ck_actividad_asistencias_estado CHECK (estado IN ('Presente', 'Ausente', 'Tarde'))
);

CREATE TABLE actividad_calificaciones (
    id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actividad_id  INTEGER NOT NULL REFERENCES actividades_extra (id),
    alumno_id     INTEGER NOT NULL REFERENCES alumnos (id) ON DELETE CASCADE,
    nota          SMALLINT NOT NULL,
    fecha         DATE     NOT NULL DEFAULT CURRENT_DATE,
    CONSTRAINT ck_actividad_calificaciones_nota CHECK (nota BETWEEN 1 AND 10)
);

-- =============================================================================
-- Financiero: SOLO el sistema nuevo (SQL Server). cuotas_config/pagos/
-- saldos_alumnos de SQLite quedan eliminados (RNFM-02).
-- =============================================================================

CREATE TABLE tarifa_concepto (
    id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tipo_servicio   VARCHAR(20)   NOT NULL,
    descripcion     VARCHAR(150)  NULL,
    monto           DECIMAL(12,2) NOT NULL,
    vigencia        DATE          NOT NULL,
    vigencia_hasta  DATE          NULL,
    deporte_id      INTEGER       NULL REFERENCES deportes (id),
    transporte_id   INTEGER       NULL REFERENCES transportes (id),
    activo          BOOLEAN       NOT NULL DEFAULT TRUE,
    CONSTRAINT ck_tarifa_concepto_tipo CHECK (tipo_servicio IN ('cuota', 'deporte', 'transporte', 'comedor')),
    CONSTRAINT ck_tarifa_concepto_monto CHECK (monto > 0)
);

CREATE TABLE factura (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    alumno_id           INTEGER       NOT NULL REFERENCES alumnos (id),
    periodo             DATE          NOT NULL,
    fecha_emision       DATE          NOT NULL DEFAULT CURRENT_DATE,
    fecha_vencimiento   DATE          NOT NULL,
    estado              VARCHAR(20)   NOT NULL DEFAULT 'Pendiente',
    total               DECIMAL(12,2) NOT NULL DEFAULT 0,
    saldo               DECIMAL(12,2) NOT NULL DEFAULT 0,
    observaciones       VARCHAR(500)  NULL,
    CONSTRAINT uq_factura_alumno_periodo UNIQUE (alumno_id, periodo),
    CONSTRAINT ck_factura_estado CHECK (estado IN ('Pendiente', 'Pago parcial', 'Pagada', 'Vencida', 'Anulada')),
    CONSTRAINT ck_factura_total CHECK (total >= 0),
    CONSTRAINT ck_factura_saldo CHECK (saldo >= 0),
    CONSTRAINT ck_factura_periodo CHECK (EXTRACT(DAY FROM periodo) = 1),
    CONSTRAINT ck_factura_fechas CHECK (fecha_vencimiento >= fecha_emision)
);

CREATE TABLE factura_detalle (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    factura_id          INTEGER       NOT NULL REFERENCES factura (id) ON DELETE CASCADE,
    tarifa_concepto_id  INTEGER       NOT NULL REFERENCES tarifa_concepto (id),
    descripcion         VARCHAR(200)  NOT NULL,
    cantidad            DECIMAL(10,2) NOT NULL DEFAULT 1,
    importe_unitario    DECIMAL(12,2) NOT NULL,
    subtotal            DECIMAL(12,2) GENERATED ALWAYS AS (cantidad * importe_unitario) STORED,
    CONSTRAINT uq_factura_detalle_concepto UNIQUE (factura_id, tarifa_concepto_id),
    CONSTRAINT ck_factura_detalle_cantidad CHECK (cantidad > 0),
    CONSTRAINT ck_factura_detalle_importe CHECK (importe_unitario >= 0)
);

CREATE TABLE comprobante_transferencia (
    id                    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    factura_id            INTEGER       NOT NULL REFERENCES factura (id) ON DELETE CASCADE,
    nombre_archivo        VARCHAR(255)  NOT NULL,
    ruta_archivo          VARCHAR(500)  NULL,  -- clave del objeto en Supabase Storage (no más disco local)
    tipo_mime             VARCHAR(100)  NOT NULL,
    tamano_bytes          BIGINT        NOT NULL,
    monto                 DECIMAL(12,2) NOT NULL,
    fecha_transferencia   DATE          NOT NULL,
    hash_archivo          VARCHAR(128)  NOT NULL UNIQUE,
    estado_verificacion   VARCHAR(20)   NOT NULL DEFAULT 'Pendiente',
    observaciones         VARCHAR(500)  NULL,
    fecha_carga           TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT ck_comprobante_monto CHECK (monto > 0),
    CONSTRAINT ck_comprobante_tamano CHECK (tamano_bytes > 0 AND tamano_bytes <= 5242880),
    CONSTRAINT ck_comprobante_estado CHECK (estado_verificacion IN ('Pendiente', 'Aprobado', 'Rechazado'))
);

CREATE TABLE saldos (
    alumno_id             INTEGER       PRIMARY KEY REFERENCES alumnos (id) ON DELETE CASCADE,
    saldo_pendiente       DECIMAL(10,2) NOT NULL DEFAULT 0,
    ultima_actualizacion  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- =============================================================================
-- Autenticación: recuperación de contraseña (antes creada en runtime desde
-- auth.controller.js) y feriados (referenciada por el job de facturación,
-- sin CREATE en ningún .sql del repo original).
-- =============================================================================

CREATE TABLE password_reset_tokens (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id  INTEGER     NOT NULL REFERENCES usuarios (id),
    token_hash  CHAR(64)    NOT NULL,
    vence       TIMESTAMPTZ NOT NULL,
    usado       BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE TABLE feriado (
    id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    fecha        DATE NOT NULL UNIQUE,
    descripcion  VARCHAR(150) NULL
);

-- =============================================================================
-- Catálogo inicial: los 4 recorridos de transporte (RF-09).
-- =============================================================================

INSERT INTO transportes (numero_recorrido, nombre, capacidad) VALUES
    (1, 'Recorrido Norte', 30),
    (2, 'Recorrido Sur',   30),
    (3, 'Recorrido Este',  30),
    (4, 'Recorrido Oeste', 30);

COMMIT;
