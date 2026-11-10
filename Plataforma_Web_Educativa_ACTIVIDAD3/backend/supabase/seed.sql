/* =============================================================================
   Educar para Transformar - Datos de prueba (PostgreSQL / Supabase)
   -----------------------------------------------------------------------------
   Correr DESPUÉS de schema.sql, una sola vez, en el SQL Editor de Supabase.
   Credenciales (hash bcrypt, 10 rondas - las mismas que ya usaba el demo de
   SQL Server):
       admin    / admin123     Administrador
       padre    / padre123     Padre de los 5 alumnos
       docente  / docente123   Profesora María González (Educación Física)
       docente2 / docente123   Profesor Jorge Pérez (Matemática y Ciencias)
       alumno   / alumno123    Cuenta del alumno Benjamín Fernández

   Escenario para las reglas de inscripción a deportes:
       - Lucía ya tiene 2 deportes -> inscribirla en Hockey falla (RF-06, 50006).
       - Mateo está en Fútbol      -> inscribirlo en Hockey falla (RF-07, 50007):
                                      ambos se dictan el miércoles y se pisan.
       - Benjamín no tiene deportes -> sirve para una inscripción exitosa.

   No se incluyen comprobantes de transferencia de ejemplo: no hay un archivo
   real detrás, así que crealos probando la carga real (mobile o web) contra
   las facturas que este script deja pendientes.
   ============================================================================= */

DO $$
DECLARE
    v_admin INT; v_padre INT; v_docente1 INT; v_docente2 INT; v_cuenta_alumno INT;
    v_prof1 INT; v_prof2 INT;
    v_nivel_inicial INT; v_nivel_primario INT; v_nivel_secundario INT;
    v_aula101 INT; v_aula102 INT; v_lab INT;
    v_curso_inicial INT; v_curso_primario INT; v_curso_secundario INT;
    v_materia_ed_fisica INT; v_materia_matematica INT; v_materia_ciencias INT;
    v_personal_docente1 INT; v_personal_docente2 INT;
    v_futbol INT; v_hockey INT; v_natacion INT;
    v_recorrido_norte INT;
    v_valentina INT; v_lucia INT; v_mateo INT; v_sofia INT; v_benjamin INT;
    v_tarifa_cuota_primario INT; v_tarifa_deporte INT;
    v_periodo DATE := date_trunc('month', CURRENT_DATE)::date;
    v_factura_lucia INT;
BEGIN
    -- Usuarios: admin, padre, los 2 docentes y la cuenta del alumno (los 4 roles de RF-01).
    INSERT INTO usuarios (username, password_hash, nombre, apellido, email, rol) VALUES
        ('alumno',   '$2a$10$2ASbhnPy5B5QBao0s.4sl.aEcaOv5omf9par.2ZWBbqvsEKNnvWni', 'Benjamín',      'Fernández', NULL,                      'alumno'),
        ('admin',    '$2a$10$LLdjHsBFxOMu95F4PHgNWuNhAe98oc29mLLyL.JETFFMFtyjijI1C', 'Administrador', 'Sistema',   'admin@educar.edu.ar',     'admin'),
        ('padre',    '$2a$10$1c5BYLaRSGoaLkz.uA59AuX/a47MSidr8XHOA1.yvL3eo.ge9bjhm', 'Carlos',        'Fernández', 'cfernandez@mail.com',     'padre'),
        ('docente',  '$2a$10$oV.T/HkXnzcCyIvVrtb6iuCii/4j0RKya7lVmGtQTW9BU9NnZDnKm', 'María',         'González',  'mgonzalez@educar.edu.ar', 'docente'),
        ('docente2', '$2a$10$dwhZLHQxB3ioZQMrbjBB4OEqr4ODa4pumfyVcDAIY1ji1MHrodFN6', 'Jorge',         'Pérez',     'jperez@educar.edu.ar',    'docente');

    SELECT id INTO v_admin FROM usuarios WHERE username = 'admin';
    SELECT id INTO v_padre FROM usuarios WHERE username = 'padre';
    SELECT id INTO v_docente1 FROM usuarios WHERE username = 'docente';
    SELECT id INTO v_docente2 FROM usuarios WHERE username = 'docente2';
    SELECT id INTO v_cuenta_alumno FROM usuarios WHERE username = 'alumno';

    -- Profesores (ficha RF-05).
    INSERT INTO profesores (usuario_id, dni, especialidad, telefono)
        VALUES (v_docente1, '20111222', 'Educación Física', '3624111111') RETURNING id INTO v_prof1;
    INSERT INTO profesores (usuario_id, dni, especialidad, telefono)
        VALUES (v_docente2, '20333444', 'Matemática y Ciencias', '3624222222') RETURNING id INTO v_prof2;

    -- personal (horarios.docente_id apunta a personal filtrado por tipo='Docente',
    -- no a `profesores`: ver nota en schema.sql).
    INSERT INTO personal (nombre, apellido, dni, tipo, email) VALUES ('María', 'González', '20111222', 'Docente', 'mgonzalez@educar.edu.ar') RETURNING id INTO v_personal_docente1;
    INSERT INTO personal (nombre, apellido, dni, tipo, email) VALUES ('Jorge', 'Pérez', '20333444', 'Docente', 'jperez@educar.edu.ar') RETURNING id INTO v_personal_docente2;

    -- Niveles y aulas.
    INSERT INTO niveles (nombre) VALUES ('Inicial') RETURNING id INTO v_nivel_inicial;
    INSERT INTO niveles (nombre) VALUES ('Primario') RETURNING id INTO v_nivel_primario;
    INSERT INTO niveles (nombre) VALUES ('Secundario') RETURNING id INTO v_nivel_secundario;

    INSERT INTO aulas (nombre, capacidad) VALUES ('Aula 101', 25) RETURNING id INTO v_aula101;
    INSERT INTO aulas (nombre, capacidad) VALUES ('Aula 102', 25) RETURNING id INTO v_aula102;
    INSERT INTO aulas (nombre, capacidad) VALUES ('Laboratorio', 20) RETURNING id INTO v_lab;

    -- Cursos del ciclo 2026 (RF-04).
    INSERT INTO cursos (nivel_id, division, cupo, grado, turno, ciclo_lectivo, cupo_maximo, profesor_tutor_id)
        VALUES (v_nivel_inicial, 'A', 20, 5, 'Mañana', 2026, 20, NULL) RETURNING id INTO v_curso_inicial;
    INSERT INTO cursos (nivel_id, division, cupo, grado, turno, ciclo_lectivo, cupo_maximo, profesor_tutor_id)
        VALUES (v_nivel_primario, 'A', 25, 3, 'Mañana', 2026, 25, v_prof1) RETURNING id INTO v_curso_primario;
    INSERT INTO cursos (nivel_id, division, cupo, grado, turno, ciclo_lectivo, cupo_maximo, profesor_tutor_id)
        VALUES (v_nivel_secundario, 'A', 30, 1, 'Mañana', 2026, 30, v_prof2) RETURNING id INTO v_curso_secundario;

    -- Materias (RF-05) y horarios de ejemplo.
    INSERT INTO materias (nombre, curso_id, descripcion) VALUES ('Educación Física', v_curso_primario, 'Actividad física, deportes y hábitos saludables') RETURNING id INTO v_materia_ed_fisica;
    INSERT INTO materias (nombre, curso_id, descripcion) VALUES ('Matemática', v_curso_secundario, 'Números, álgebra y geometría') RETURNING id INTO v_materia_matematica;
    INSERT INTO materias (nombre, curso_id, descripcion) VALUES ('Ciencias Naturales', NULL, 'Seres vivos, materia y energía') RETURNING id INTO v_materia_ciencias;

    INSERT INTO horarios (materia_id, docente_id, aula_id, dia_semana, hora_inicio, hora_fin) VALUES
        (v_materia_ed_fisica, v_personal_docente1, v_aula101, 1, '09:00', '10:00'),
        (v_materia_matematica, v_personal_docente2, v_aula102, 2, '10:00', '11:00');

    -- Deportes (3). Fútbol y Hockey coinciden el miércoles de 17:00 a 17:30.
    INSERT INTO deportes (nombre, profesor_id, dias_semana, hora_inicio, hora_fin, cupo_maximo)
        VALUES ('Fútbol', v_prof1, 5, '16:00', '17:30', 20) RETURNING id INTO v_futbol;     -- Lun + Mié
    INSERT INTO deportes (nombre, profesor_id, dias_semana, hora_inicio, hora_fin, cupo_maximo)
        VALUES ('Hockey', v_prof1, 4, '17:00', '18:30', 15) RETURNING id INTO v_hockey;      -- Mié
    INSERT INTO deportes (nombre, profesor_id, dias_semana, hora_inicio, hora_fin, cupo_maximo)
        VALUES ('Natación', v_prof2, 10, '16:00', '17:00', 10) RETURNING id INTO v_natacion; -- Mar + Jue

    SELECT id INTO v_recorrido_norte FROM transportes WHERE numero_recorrido = 1;

    -- Alumnos (5): hermanos Fernández, todos hijos de 'padre' (RF-02).
    INSERT INTO alumnos (dni, nombre, apellido, fecha_nacimiento, curso_id, padre_id, usa_comedor, transporte_id)
        VALUES ('56111222', 'Valentina', 'Fernández', '2020-08-15', v_curso_inicial, v_padre, TRUE, v_recorrido_norte) RETURNING id INTO v_valentina;
    INSERT INTO alumnos (dni, nombre, apellido, fecha_nacimiento, curso_id, padre_id, usa_comedor, transporte_id)
        VALUES ('53111222', 'Lucía', 'Fernández', '2018-05-12', v_curso_primario, v_padre, TRUE, v_recorrido_norte) RETURNING id INTO v_lucia;
    INSERT INTO alumnos (dni, nombre, apellido, fecha_nacimiento, curso_id, padre_id, usa_comedor, transporte_id)
        VALUES ('53111223', 'Mateo', 'Fernández', '2018-05-12', v_curso_primario, v_padre, TRUE, v_recorrido_norte) RETURNING id INTO v_mateo;
    INSERT INTO alumnos (dni, nombre, apellido, fecha_nacimiento, curso_id, padre_id, usa_comedor, transporte_id)
        VALUES ('49111222', 'Sofía', 'Fernández', '2014-03-20', v_curso_secundario, v_padre, FALSE, NULL) RETURNING id INTO v_sofia;
    INSERT INTO alumnos (dni, nombre, apellido, fecha_nacimiento, curso_id, padre_id, usuario_id, usa_comedor, transporte_id)
        VALUES ('49111223', 'Benjamín', 'Fernández', '2014-03-20', v_curso_secundario, v_padre, v_cuenta_alumno, FALSE, NULL) RETURNING id INTO v_benjamin;

    -- Inscripciones iniciales (pasan por el trigger de RF-06 / RF-07 / cupo).
    INSERT INTO inscripciones_deportes (alumno_id, deporte_id) VALUES
        (v_lucia, v_futbol),     -- Lucía: Fútbol
        (v_lucia, v_natacion),   -- Lucía: Natación (llega al máximo de 2)
        (v_mateo, v_futbol),     -- Mateo: Fútbol
        (v_sofia, v_hockey);     -- Sofía: Hockey

    -- Calificaciones y asistencias de ejemplo.
    INSERT INTO calificaciones (alumno_id, materia_id, nota, trimestre) VALUES
        (v_mateo, v_materia_ed_fisica, 9, 1),
        (v_sofia, v_materia_matematica, 7, 1);
    INSERT INTO asistencias (alumno_id, fecha, estado) VALUES
        (v_mateo, CURRENT_DATE, 'Presente'),
        (v_sofia, CURRENT_DATE, 'Ausente');

    -- Financiero (solo el sistema nuevo): tarifas vigentes + una factura de
    -- ejemplo con saldo pendiente, para que las pantallas de Finanzas tengan
    -- datos sin depender de una carga manual previa.
    INSERT INTO tarifa_concepto (tipo_servicio, descripcion, monto, vigencia) VALUES
        ('cuota', 'Cuota mensual Nivel Primario', 45000, v_periodo) RETURNING id INTO v_tarifa_cuota_primario;
    INSERT INTO tarifa_concepto (tipo_servicio, descripcion, monto, vigencia, deporte_id) VALUES
        ('deporte', 'Fútbol', 8000, v_periodo, v_futbol) RETURNING id INTO v_tarifa_deporte;
    INSERT INTO tarifa_concepto (tipo_servicio, descripcion, monto, vigencia, transporte_id) VALUES
        ('transporte', 'Transporte Recorrido Norte', 12000, v_periodo, v_recorrido_norte);
    INSERT INTO tarifa_concepto (tipo_servicio, descripcion, monto, vigencia) VALUES
        ('comedor', 'Comedor mensual', 15000, v_periodo);

    INSERT INTO factura (alumno_id, periodo, fecha_vencimiento, estado, total, saldo)
        VALUES (v_lucia, v_periodo, v_periodo + INTERVAL '10 days', 'Pendiente', 53000, 53000)
        RETURNING id INTO v_factura_lucia;
    INSERT INTO factura_detalle (factura_id, tarifa_concepto_id, descripcion, cantidad, importe_unitario) VALUES
        (v_factura_lucia, v_tarifa_cuota_primario, 'Cuota mensual Nivel Primario', 1, 45000),
        (v_factura_lucia, v_tarifa_deporte, 'Fútbol', 1, 8000);

    INSERT INTO saldos (alumno_id, saldo_pendiente) VALUES
        (v_valentina, 0), (v_lucia, 53000), (v_mateo, 0), (v_sofia, 0), (v_benjamin, 0);

    -- Personal no docente (legajo administrativo, RF aparte de lo financiero).
    INSERT INTO personal (nombre, apellido, dni, tipo, email) VALUES
        ('Marta', 'Gómez', '27111222', 'Administrativo', 'mgomez@educar.edu.ar'),
        ('Rubén', 'Díaz', '28111222', 'Maestranza', NULL),
        ('Laura', 'Sosa', '29111222', 'Directivo', 'lsosa@educar.edu.ar');

    -- Servicios institucionales y comunicación (demo liviano).
    INSERT INTO instalaciones (nombre, descripcion) VALUES
        ('Gimnasio', 'Gimnasio cubierto'), ('Laboratorio de Ciencias', 'Equipado para prácticas de Ciencias Naturales');
    INSERT INTO transporte_rutas (nombre_ruta, chofer_nombre, capacidad_max) VALUES
        ('Ruta Norte', 'Hugo Ramírez', 35);
    INSERT INTO actividades_extra (nombre, tipo, horario, cupo_max) VALUES
        ('Inglés', 'Idioma', 'Lunes y Jueves 14:00-15:00', 20),
        ('Taller de Arte', 'Cultura', 'Viernes 14:00-15:30', 15);
    INSERT INTO notificaciones (titulo, mensaje, rol_destino) VALUES
        ('Inicio de clases', 'El ciclo lectivo 2026 comienza el 2 de marzo.', 'all');
    INSERT INTO preinscripciones (alumno_nombre, alumno_dni, alumno_edad, nivel, turno, tutor_nombre, tutor_telefono, tutor_email) VALUES
        ('Joaquín Álvarez', '61111222', 5, 'Inicial', 'Mañana', 'Patricia Álvarez', '3624555555', 'palvarez@mail.com');
END $$;
