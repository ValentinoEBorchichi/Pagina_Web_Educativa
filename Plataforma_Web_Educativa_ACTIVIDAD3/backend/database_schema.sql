/* =============================================================================
   Educar para Transformar - Esquema de Base de Datos (Microsoft SQL Server)
   -----------------------------------------------------------------------------
   Tablas: Usuarios, Profesores, Cursos, Materias, Profesores_Materias,
           Transportes, Deportes, Alumnos, Inscripciones_Deportes.
   Al final carga los 4 recorridos de transporte y los datos de prueba (demo).

   ADVERTENCIA: este script BORRA y vuelve a CREAR las tablas (se pierden los
   datos). Usarlo solo para la instalación inicial o en desarrollo.

   Ejecución (desde la carpeta backend/):
     sqlcmd -S localhost -U sa -P "<password>" -C -b -f 65001 -i database_schema.sql
       -C       confía en el certificado autofirmado del servidor local
       -b       corta la ejecución ante el primer error
       -f 65001 lee el archivo como UTF-8 (tildes y ñ en los textos)
   ============================================================================= */

IF DB_ID(N'EducarParaTransformar') IS NULL
    CREATE DATABASE EducarParaTransformar;
GO

USE EducarParaTransformar;
GO

-- Requeridas por los índices filtrados y las columnas calculadas PERSISTED
-- (sqlcmd arranca con QUOTED_IDENTIFIER OFF; el driver mssql ya las usa en ON).
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- Fechas: las columnas DATETIME2 guardan la hora en UTC (SYSUTCDATETIME),
-- porque el driver mssql las devuelve como UTC y el frontend las convierte a
-- la hora local. Las columnas DATE guardan la fecha local del calendario.

-- Limpieza en orden inverso a las dependencias (los triggers se borran con su tabla).
DROP TABLE IF EXISTS dbo.Inscripciones_Deportes;
DROP TABLE IF EXISTS dbo.Alumnos;
DROP TABLE IF EXISTS dbo.Deportes;
DROP TABLE IF EXISTS dbo.Profesores_Materias;
DROP TABLE IF EXISTS dbo.Materias;
DROP TABLE IF EXISTS dbo.Cursos;
DROP TABLE IF EXISTS dbo.Profesores;
DROP TABLE IF EXISTS dbo.Transportes;
DROP TABLE IF EXISTS dbo.Usuarios;
GO


/* -----------------------------------------------------------------------------
   Usuarios (RF-01): cuentas de acceso al sistema, una por persona que inicia
   sesión. El rol determina qué dashboard y qué endpoints puede usar.
   ----------------------------------------------------------------------------- */
CREATE TABLE dbo.Usuarios (
    id              INT IDENTITY(1,1) NOT NULL,
    username        VARCHAR(50)       NOT NULL,
    password_hash   VARCHAR(100)      NOT NULL,   -- hash bcrypt, nunca la clave en texto plano
    nombre          NVARCHAR(100)     NOT NULL,
    apellido        NVARCHAR(100)     NOT NULL,
    email           VARCHAR(150)      NULL,
    rol             VARCHAR(20)       NOT NULL,
    activo          BIT               NOT NULL CONSTRAINT DF_Usuarios_activo DEFAULT (1),
    fecha_creacion  DATETIME2(0)      NOT NULL CONSTRAINT DF_Usuarios_fecha_creacion DEFAULT (SYSUTCDATETIME()),  -- UTC

    CONSTRAINT PK_Usuarios PRIMARY KEY (id),
    CONSTRAINT UQ_Usuarios_username UNIQUE (username),
    -- Clave (id, rol): destino de las FK que además de la existencia validan el
    -- rol del usuario referenciado (ver Profesores y Alumnos).
    CONSTRAINT UQ_Usuarios_id_rol UNIQUE (id, rol),
    CONSTRAINT CK_Usuarios_rol CHECK (rol IN ('admin', 'docente', 'alumno', 'padre')),
    CONSTRAINT CK_Usuarios_email CHECK (email IS NULL OR email LIKE '%_@_%._%')
);

-- Email único solo cuando está cargado (un UNIQUE común admitiría un único NULL).
CREATE UNIQUE INDEX UX_Usuarios_email ON dbo.Usuarios (email) WHERE email IS NOT NULL;
GO


/* -----------------------------------------------------------------------------
   Profesores (RF-05): legajo docente. Cada profesor tiene su cuenta en Usuarios
   y esa cuenta DEBE tener rol 'docente' (garantizado por la FK compuesta).
   ----------------------------------------------------------------------------- */
CREATE TABLE dbo.Profesores (
    id            INT IDENTITY(1,1) NOT NULL,
    usuario_id    INT               NOT NULL,
    usuario_rol   AS CAST('docente' AS VARCHAR(20)) PERSISTED,
    dni           VARCHAR(8)        NOT NULL,
    especialidad  NVARCHAR(100)     NULL,
    telefono      VARCHAR(20)       NULL,
    fecha_alta    DATE              NOT NULL CONSTRAINT DF_Profesores_fecha_alta DEFAULT (CAST(SYSDATETIME() AS DATE)),

    CONSTRAINT PK_Profesores PRIMARY KEY (id),
    CONSTRAINT UQ_Profesores_usuario UNIQUE (usuario_id),
    CONSTRAINT UQ_Profesores_dni UNIQUE (dni),
    CONSTRAINT CK_Profesores_dni CHECK (LEN(dni) BETWEEN 7 AND 8 AND dni NOT LIKE '%[^0-9]%'),
    CONSTRAINT FK_Profesores_Usuarios FOREIGN KEY (usuario_id, usuario_rol)
        REFERENCES dbo.Usuarios (id, rol)
);
GO


/* -----------------------------------------------------------------------------
   Cursos: nivel + grado + división por ciclo lectivo. Opcionalmente tiene un
   profesor tutor (asignación de profesor a curso, RF-05).
   ----------------------------------------------------------------------------- */
CREATE TABLE dbo.Cursos (
    id                 INT IDENTITY(1,1) NOT NULL,
    nivel              VARCHAR(20)       NOT NULL,
    grado              TINYINT           NOT NULL,   -- sala (Inicial), grado (Primario) o año (Secundario)
    division           CHAR(1)           NOT NULL,   -- A, B, C...
    turno              NVARCHAR(10)      NOT NULL,
    ciclo_lectivo      SMALLINT          NOT NULL,
    cupo_maximo        SMALLINT          NOT NULL,
    profesor_tutor_id  INT               NULL,

    CONSTRAINT PK_Cursos PRIMARY KEY (id),
    CONSTRAINT UQ_Cursos_nivel_grado_division UNIQUE (nivel, grado, division, ciclo_lectivo),
    CONSTRAINT CK_Cursos_nivel CHECK (nivel IN ('Inicial', 'Primario', 'Secundario')),
    CONSTRAINT CK_Cursos_grado CHECK (grado BETWEEN 1 AND 7),
    CONSTRAINT CK_Cursos_division CHECK (division LIKE '[A-Z]'),
    CONSTRAINT CK_Cursos_turno CHECK (turno IN (N'Mañana', N'Tarde')),
    CONSTRAINT CK_Cursos_ciclo_lectivo CHECK (ciclo_lectivo BETWEEN 2000 AND 2100),
    CONSTRAINT CK_Cursos_cupo CHECK (cupo_maximo > 0),
    -- Si se da de baja al profesor, el curso queda sin tutor (no se borra).
    CONSTRAINT FK_Cursos_Profesores FOREIGN KEY (profesor_tutor_id)
        REFERENCES dbo.Profesores (id) ON DELETE SET NULL
);

CREATE INDEX IX_Cursos_profesor_tutor_id ON dbo.Cursos (profesor_tutor_id);
GO


/* -----------------------------------------------------------------------------
   Materias (RF-05): catálogo de materias/asignaturas de la institución.
   Una materia en uso no se borra: se desactiva con activo = 0.
   ----------------------------------------------------------------------------- */
CREATE TABLE dbo.Materias (
    id           INT IDENTITY(1,1) NOT NULL,
    nombre       NVARCHAR(100)     NOT NULL,
    descripcion  NVARCHAR(300)     NULL,
    activo       BIT               NOT NULL CONSTRAINT DF_Materias_activo DEFAULT (1),

    CONSTRAINT PK_Materias PRIMARY KEY (id),
    CONSTRAINT UQ_Materias_nombre UNIQUE (nombre)
);
GO


/* -----------------------------------------------------------------------------
   Profesores_Materias (RF-05): asignación de profesores a materias, relación
   N a N. curso_id indica en qué curso dicta la materia; NULL significa que el
   profesor está habilitado para la materia pero todavía no tiene curso.
     - Un profesor no repite la misma materia en el mismo curso (UNIQUE; en
       SQL Server los NULL cuentan como iguales, así que tampoco puede tener
       dos asignaciones "sin curso" de la misma materia).
     - En cada curso, una materia la dicta un solo profesor (índice filtrado).
   Si se borra el profesor, se borran sus asignaciones. Un curso o una materia
   con profesores asignados no se pueden borrar.
   ----------------------------------------------------------------------------- */
CREATE TABLE dbo.Profesores_Materias (
    id                INT IDENTITY(1,1) NOT NULL,
    profesor_id       INT               NOT NULL,
    materia_id        INT               NOT NULL,
    curso_id          INT               NULL,
    fecha_asignacion  DATE              NOT NULL CONSTRAINT DF_Profesores_Materias_fecha DEFAULT (CAST(SYSDATETIME() AS DATE)),

    CONSTRAINT PK_Profesores_Materias PRIMARY KEY (id),
    CONSTRAINT UQ_Profesores_Materias_profesor_materia_curso UNIQUE (profesor_id, materia_id, curso_id),
    CONSTRAINT FK_Profesores_Materias_Profesores FOREIGN KEY (profesor_id)
        REFERENCES dbo.Profesores (id) ON DELETE CASCADE,
    CONSTRAINT FK_Profesores_Materias_Materias FOREIGN KEY (materia_id)
        REFERENCES dbo.Materias (id),
    CONSTRAINT FK_Profesores_Materias_Cursos FOREIGN KEY (curso_id)
        REFERENCES dbo.Cursos (id)
);

CREATE UNIQUE INDEX UX_Profesores_Materias_materia_curso
    ON dbo.Profesores_Materias (materia_id, curso_id) WHERE curso_id IS NOT NULL;
CREATE INDEX IX_Profesores_Materias_curso_id ON dbo.Profesores_Materias (curso_id);
GO


/* -----------------------------------------------------------------------------
   Transportes (RF-09): catálogo de recorridos. El sistema admite exactamente
   4 recorridos, identificados por numero_recorrido del 1 al 4.
   ----------------------------------------------------------------------------- */
CREATE TABLE dbo.Transportes (
    id                INT IDENTITY(1,1) NOT NULL,
    numero_recorrido  TINYINT           NOT NULL,
    nombre            NVARCHAR(100)     NOT NULL,
    zona              NVARCHAR(200)     NULL,        -- barrios / paradas que cubre
    chofer            NVARCHAR(100)     NULL,
    patente           VARCHAR(10)       NULL,
    capacidad         SMALLINT          NOT NULL,
    hora_salida       TIME(0)           NULL,

    CONSTRAINT PK_Transportes PRIMARY KEY (id),
    CONSTRAINT UQ_Transportes_numero_recorrido UNIQUE (numero_recorrido),
    CONSTRAINT CK_Transportes_numero_recorrido CHECK (numero_recorrido BETWEEN 1 AND 4),
    CONSTRAINT CK_Transportes_capacidad CHECK (capacidad > 0)
);
GO


/* -----------------------------------------------------------------------------
   Deportes: actividades deportivas con horario semanal fijo (necesario para
   validar la superposición horaria de RF-07).

   dias_semana es una máscara de bits, así un deporte que se practica varios
   días sigue siendo UNA sola actividad (clave para el límite de RF-06):
       Lun=1  Mar=2  Mié=4  Jue=8  Vie=16  Sáb=32  Dom=64
       Ej.: Lunes y Miércoles = 1 + 4 = 5
   Dos deportes comparten algún día si (d1.dias_semana & d2.dias_semana) <> 0.
   ----------------------------------------------------------------------------- */
CREATE TABLE dbo.Deportes (
    id            INT IDENTITY(1,1) NOT NULL,
    nombre        NVARCHAR(100)     NOT NULL,
    profesor_id   INT               NULL,
    dias_semana   TINYINT           NOT NULL,
    hora_inicio   TIME(0)           NOT NULL,
    hora_fin      TIME(0)           NOT NULL,
    cupo_maximo   SMALLINT          NOT NULL,
    activo        BIT               NOT NULL CONSTRAINT DF_Deportes_activo DEFAULT (1),

    CONSTRAINT PK_Deportes PRIMARY KEY (id),
    CONSTRAINT UQ_Deportes_nombre_horario UNIQUE (nombre, dias_semana, hora_inicio),
    CONSTRAINT CK_Deportes_dias_semana CHECK (dias_semana BETWEEN 1 AND 127),
    CONSTRAINT CK_Deportes_horario CHECK (hora_fin > hora_inicio),
    CONSTRAINT CK_Deportes_cupo CHECK (cupo_maximo > 0),
    -- Si se da de baja al profesor, el deporte queda sin profesor a cargo.
    CONSTRAINT FK_Deportes_Profesores FOREIGN KEY (profesor_id)
        REFERENCES dbo.Profesores (id) ON DELETE SET NULL
);

CREATE INDEX IX_Deportes_profesor_id ON dbo.Deportes (profesor_id);
GO


/* -----------------------------------------------------------------------------
   Alumnos: legajo del estudiante.
     - RF-04: pertenece a un único curso (curso_id obligatorio, una sola FK).
     - RF-02: está asociado a un padre/tutor, que DEBE ser un usuario con rol
       'padre'. Un padre puede tener varios hijos.
     - usuario_id: cuenta propia del alumno (opcional, p. ej. Nivel Inicial no
       la tiene). Si existe, debe tener rol 'alumno'.
     - RF-08: usa_comedor indica la inscripción al comedor.
     - RF-09: transporte_id es el recorrido elegido (uno de los 4). NULL = no
       usa transporte escolar.
   ----------------------------------------------------------------------------- */
CREATE TABLE dbo.Alumnos (
    id                INT IDENTITY(1,1) NOT NULL,
    dni               VARCHAR(8)        NOT NULL,
    nombre            NVARCHAR(100)     NOT NULL,
    apellido          NVARCHAR(100)     NOT NULL,
    fecha_nacimiento  DATE              NOT NULL,
    curso_id          INT               NOT NULL,
    padre_id          INT               NOT NULL,
    padre_rol         AS CAST('padre' AS VARCHAR(20)) PERSISTED,
    usuario_id        INT               NULL,
    usuario_rol       AS CAST('alumno' AS VARCHAR(20)) PERSISTED,
    usa_comedor       BIT               NOT NULL CONSTRAINT DF_Alumnos_usa_comedor DEFAULT (0),
    transporte_id     INT               NULL,
    fecha_alta        DATE              NOT NULL CONSTRAINT DF_Alumnos_fecha_alta DEFAULT (CAST(SYSDATETIME() AS DATE)),

    CONSTRAINT PK_Alumnos PRIMARY KEY (id),
    CONSTRAINT UQ_Alumnos_dni UNIQUE (dni),
    CONSTRAINT CK_Alumnos_dni CHECK (LEN(dni) BETWEEN 7 AND 8 AND dni NOT LIKE '%[^0-9]%'),
    CONSTRAINT FK_Alumnos_Cursos FOREIGN KEY (curso_id)
        REFERENCES dbo.Cursos (id),
    CONSTRAINT FK_Alumnos_Padre FOREIGN KEY (padre_id, padre_rol)
        REFERENCES dbo.Usuarios (id, rol),
    CONSTRAINT FK_Alumnos_Usuario FOREIGN KEY (usuario_id, usuario_rol)
        REFERENCES dbo.Usuarios (id, rol),
    CONSTRAINT FK_Alumnos_Transportes FOREIGN KEY (transporte_id)
        REFERENCES dbo.Transportes (id)
);

-- Una cuenta de alumno corresponde a un solo legajo (se permiten varios NULL).
CREATE UNIQUE INDEX UX_Alumnos_usuario_id ON dbo.Alumnos (usuario_id) WHERE usuario_id IS NOT NULL;
CREATE INDEX IX_Alumnos_curso_id      ON dbo.Alumnos (curso_id);
CREATE INDEX IX_Alumnos_padre_id      ON dbo.Alumnos (padre_id);       -- "mis hijos" (RF-02)
CREATE INDEX IX_Alumnos_transporte_id ON dbo.Alumnos (transporte_id);
GO


/* -----------------------------------------------------------------------------
   Inscripciones_Deportes: relación N a N entre Alumnos y Deportes.
   Si se borra el legajo del alumno, se borran sus inscripciones. Un deporte con
   inscriptos no puede borrarse (se desactiva con Deportes.activo = 0).
   ----------------------------------------------------------------------------- */
CREATE TABLE dbo.Inscripciones_Deportes (
    id                 INT IDENTITY(1,1) NOT NULL,
    alumno_id          INT               NOT NULL,
    deporte_id         INT               NOT NULL,
    fecha_inscripcion  DATETIME2(0)      NOT NULL CONSTRAINT DF_Inscripciones_Deportes_fecha DEFAULT (SYSUTCDATETIME()),  -- UTC

    CONSTRAINT PK_Inscripciones_Deportes PRIMARY KEY (id),
    CONSTRAINT UQ_Inscripciones_Deportes_alumno_deporte UNIQUE (alumno_id, deporte_id),
    CONSTRAINT FK_Inscripciones_Deportes_Alumnos FOREIGN KEY (alumno_id)
        REFERENCES dbo.Alumnos (id) ON DELETE CASCADE,
    CONSTRAINT FK_Inscripciones_Deportes_Deportes FOREIGN KEY (deporte_id)
        REFERENCES dbo.Deportes (id)
);

CREATE INDEX IX_Inscripciones_Deportes_deporte_id ON dbo.Inscripciones_Deportes (deporte_id);
GO


/* -----------------------------------------------------------------------------
   Reglas de negocio en la base (última línea de defensa: la API debe validar
   lo mismo antes para devolver mensajes amigables).
     50006  RF-06: máximo 2 deportes por alumno.
     50007  RF-07: los horarios de los deportes de un alumno no se superponen.
     50008  El deporte no tiene cupo disponible.
   Desde Node (mssql), el código llega en err.number.

   READCOMMITTEDLOCK fuerza lecturas con bloqueo aunque la base use
   READ_COMMITTED_SNAPSHOT, para que dos inscripciones simultáneas del mismo
   alumno no puedan saltearse las reglas.
   ----------------------------------------------------------------------------- */
CREATE TRIGGER dbo.trg_Inscripciones_Deportes_Reglas
ON dbo.Inscripciones_Deportes
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM inserted)
        RETURN;

    -- RF-06: límite de 2 deportes por alumno.
    IF EXISTS (
        SELECT 1
        FROM dbo.Inscripciones_Deportes AS i WITH (READCOMMITTEDLOCK)
        WHERE i.alumno_id IN (SELECT alumno_id FROM inserted)
        GROUP BY i.alumno_id
        HAVING COUNT(*) > 2
    )
        THROW 50006, N'RF-06: un alumno no puede inscribirse en más de 2 deportes.', 1;

    -- RF-07: superposición horaria (comparten al menos un día y los rangos se pisan).
    IF EXISTS (
        SELECT 1
        FROM inserted AS nueva
        JOIN dbo.Deportes AS d_nuevo
            ON d_nuevo.id = nueva.deporte_id
        JOIN dbo.Inscripciones_Deportes AS otra WITH (READCOMMITTEDLOCK)
            ON otra.alumno_id = nueva.alumno_id
           AND otra.id <> nueva.id
        JOIN dbo.Deportes AS d_otro
            ON d_otro.id = otra.deporte_id
        WHERE (d_nuevo.dias_semana & d_otro.dias_semana) <> 0
          AND d_nuevo.hora_inicio < d_otro.hora_fin
          AND d_otro.hora_inicio  < d_nuevo.hora_fin
    )
        THROW 50007, N'RF-07: el horario del deporte se superpone con otro deporte en el que el alumno ya está inscripto.', 1;

    -- Cupo máximo del deporte.
    IF EXISTS (
        SELECT 1
        FROM dbo.Deportes AS d
        JOIN dbo.Inscripciones_Deportes AS i WITH (READCOMMITTEDLOCK)
            ON i.deporte_id = d.id
        WHERE d.id IN (SELECT deporte_id FROM inserted)
        GROUP BY d.id, d.cupo_maximo
        HAVING COUNT(*) > d.cupo_maximo
    )
        THROW 50008, N'El deporte no tiene cupo disponible.', 1;
END;
GO


/* -----------------------------------------------------------------------------
   Datos de catálogo: los 4 recorridos de transporte (RF-09).
   Nombres, zonas y capacidades son de ejemplo: ajustarlos a los reales.
   ----------------------------------------------------------------------------- */
INSERT INTO dbo.Transportes (numero_recorrido, nombre, capacidad) VALUES
    (1, N'Recorrido Norte', 30),
    (2, N'Recorrido Sur',   30),
    (3, N'Recorrido Este',  30),
    (4, N'Recorrido Oeste', 30);
GO


/* -----------------------------------------------------------------------------
   Datos de prueba (demo). Credenciales (hash bcrypt, 10 rondas):
       admin    / admin123     Administrador
       padre    / padre123     Padre de los 5 alumnos
       docente  / docente123   Profesora María González (Educación Física)
       docente2 / docente123   Profesor Jorge Pérez (Matemática y Ciencias Naturales)
       alumno   / alumno123    Cuenta del alumno Benjamín Fernández

   Escenario para mostrar las reglas de inscripción a deportes:
       - Lucía ya tiene 2 deportes    -> inscribirla en Hockey falla con 50006 (RF-06).
       - Mateo está en Fútbol         -> inscribirlo en Hockey falla con 50007 (RF-07):
                                         ambos se dictan el miércoles y los horarios se pisan.
       - Benjamín no tiene deportes   -> sirve para mostrar una inscripción exitosa
                                         (puede hacerla él mismo con la cuenta 'alumno').
   ----------------------------------------------------------------------------- */
SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @padre INT, @docente1 INT, @docente2 INT, @cuenta_alumno INT,
        @prof1 INT, @prof2 INT,
        @curso_inicial INT, @curso_primario INT, @curso_secundario INT,
        @futbol INT, @hockey INT, @natacion INT,
        @recorrido_norte INT;

-- Usuarios: 1 administrador, 1 padre, las cuentas de los 2 profesores y la de
-- un alumno (así los 4 roles de RF-01 pueden iniciar sesión).
INSERT INTO dbo.Usuarios (username, password_hash, nombre, apellido, email, rol) VALUES
    ('alumno',   '$2a$10$2ASbhnPy5B5QBao0s.4sl.aEcaOv5omf9par.2ZWBbqvsEKNnvWni', N'Benjamín',      N'Fernández', NULL,                      'alumno'),
    ('admin',    '$2a$10$LLdjHsBFxOMu95F4PHgNWuNhAe98oc29mLLyL.JETFFMFtyjijI1C', N'Administrador', N'Sistema',   'admin@educar.edu.ar',     'admin'),
    ('padre',    '$2a$10$1c5BYLaRSGoaLkz.uA59AuX/a47MSidr8XHOA1.yvL3eo.ge9bjhm', N'Carlos',        N'Fernández', 'cfernandez@mail.com',     'padre'),
    ('docente',  '$2a$10$oV.T/HkXnzcCyIvVrtb6iuCii/4j0RKya7lVmGtQTW9BU9NnZDnKm', N'María',         N'González',  'mgonzalez@educar.edu.ar', 'docente'),
    ('docente2', '$2a$10$dwhZLHQxB3ioZQMrbjBB4OEqr4ODa4pumfyVcDAIY1ji1MHrodFN6', N'Jorge',         N'Pérez',     'jperez@educar.edu.ar',    'docente');

SELECT @padre    = id FROM dbo.Usuarios WHERE username = 'padre';
SELECT @docente1 = id FROM dbo.Usuarios WHERE username = 'docente';
SELECT @docente2 = id FROM dbo.Usuarios WHERE username = 'docente2';
SELECT @cuenta_alumno = id FROM dbo.Usuarios WHERE username = 'alumno';

-- Profesores (2).
INSERT INTO dbo.Profesores (usuario_id, dni, especialidad, telefono)
VALUES (@docente1, '20111222', N'Educación Física', '3624111111');
SET @prof1 = SCOPE_IDENTITY();

INSERT INTO dbo.Profesores (usuario_id, dni, especialidad, telefono)
VALUES (@docente2, '20333444', N'Matemática y Ciencias', '3624222222');
SET @prof2 = SCOPE_IDENTITY();

-- Cursos del ciclo 2026 (necesarios: todo alumno pertenece a un curso, RF-04).
INSERT INTO dbo.Cursos (nivel, grado, division, turno, ciclo_lectivo, cupo_maximo, profesor_tutor_id)
VALUES ('Inicial', 5, 'A', N'Mañana', 2026, 20, NULL);           -- Sala de 5
SET @curso_inicial = SCOPE_IDENTITY();

INSERT INTO dbo.Cursos (nivel, grado, division, turno, ciclo_lectivo, cupo_maximo, profesor_tutor_id)
VALUES ('Primario', 3, 'A', N'Mañana', 2026, 25, @prof1);
SET @curso_primario = SCOPE_IDENTITY();

INSERT INTO dbo.Cursos (nivel, grado, division, turno, ciclo_lectivo, cupo_maximo, profesor_tutor_id)
VALUES ('Secundario', 1, 'A', N'Mañana', 2026, 30, @prof2);
SET @curso_secundario = SCOPE_IDENTITY();

-- Materias (3) y su asignación a profesores y cursos (RF-05).
INSERT INTO dbo.Materias (nombre, descripcion) VALUES
    (N'Educación Física',   N'Actividad física, deportes y hábitos saludables'),
    (N'Matemática',         N'Números, álgebra y geometría'),
    (N'Ciencias Naturales', N'Seres vivos, materia y energía');

INSERT INTO dbo.Profesores_Materias (profesor_id, materia_id, curso_id)
SELECT v.profesor_id, m.id, v.curso_id
FROM (VALUES (@prof1, N'Educación Física',   @curso_primario),     -- María: Ed. Física en 3° A
             (@prof1, N'Educación Física',   @curso_secundario),   -- María: Ed. Física en 1° A (Secundario)
             (@prof2, N'Matemática',         @curso_secundario),   -- Jorge: Matemática en 1° A (Secundario)
             (@prof2, N'Ciencias Naturales', NULL)                 -- Jorge: habilitado, todavía sin curso
     ) AS v (profesor_id, materia, curso_id)
JOIN dbo.Materias AS m ON m.nombre = v.materia;

-- Deportes (3). Fútbol y Hockey coinciden el miércoles de 17:00 a 17:30.
INSERT INTO dbo.Deportes (nombre, profesor_id, dias_semana, hora_inicio, hora_fin, cupo_maximo)
VALUES (N'Fútbol', @prof1, 5, '16:00', '17:30', 20);             -- Lun + Mié
SET @futbol = SCOPE_IDENTITY();

INSERT INTO dbo.Deportes (nombre, profesor_id, dias_semana, hora_inicio, hora_fin, cupo_maximo)
VALUES (N'Hockey', @prof1, 4, '17:00', '18:30', 15);             -- Mié
SET @hockey = SCOPE_IDENTITY();

INSERT INTO dbo.Deportes (nombre, profesor_id, dias_semana, hora_inicio, hora_fin, cupo_maximo)
VALUES (N'Natación', @prof2, 10, '16:00', '17:00', 10);          -- Mar + Jue
SET @natacion = SCOPE_IDENTITY();

-- Alumnos (5): hermanos Fernández, todos hijos del usuario 'padre' (RF-02).
SELECT @recorrido_norte = id FROM dbo.Transportes WHERE numero_recorrido = 1;

INSERT INTO dbo.Alumnos (dni, nombre, apellido, fecha_nacimiento, curso_id, padre_id, usa_comedor, transporte_id) VALUES
    ('56111222', N'Valentina', N'Fernández', '2020-08-15', @curso_inicial,    @padre, 1, @recorrido_norte),
    ('53111222', N'Lucía',     N'Fernández', '2018-05-12', @curso_primario,   @padre, 1, @recorrido_norte),
    ('53111223', N'Mateo',     N'Fernández', '2018-05-12', @curso_primario,   @padre, 1, @recorrido_norte),
    ('49111222', N'Sofía',     N'Fernández', '2014-03-20', @curso_secundario, @padre, 0, NULL),
    ('49111223', N'Benjamín',  N'Fernández', '2014-03-20', @curso_secundario, @padre, 0, NULL);

-- Benjamín tiene cuenta propia (rol 'alumno').
UPDATE dbo.Alumnos SET usuario_id = @cuenta_alumno WHERE dni = '49111223';

-- Inscripciones iniciales (pasan por el trigger de RF-06 / RF-07 / cupo).
INSERT INTO dbo.Inscripciones_Deportes (alumno_id, deporte_id)
SELECT a.id, d.id
FROM (VALUES ('53111222', @futbol),     -- Lucía: Fútbol
             ('53111222', @natacion),   -- Lucía: Natación (llega al máximo de 2)
             ('53111223', @futbol),     -- Mateo: Fútbol
             ('49111222', @hockey)      -- Sofía: Hockey
     ) AS v (dni, deporte_id)
JOIN dbo.Alumnos  AS a ON a.dni = v.dni
JOIN dbo.Deportes AS d ON d.id  = v.deporte_id;

COMMIT TRANSACTION;
GO
