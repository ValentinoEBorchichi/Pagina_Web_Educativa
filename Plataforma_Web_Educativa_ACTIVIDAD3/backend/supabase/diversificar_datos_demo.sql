/* =============================================================================
   Educar para Transformar - Datos de demo: diversificar estados y academia
   -----------------------------------------------------------------------------
   seed.sql solo le carga factura/calificaciones/asistencia a 1 o 2 de los 5
   hijos del padre de demo, y cada curso tenía como mucho 1 materia. Este
   script agrega datos reales (no hardcodeados en el frontend):

     - 3 docentes más (Lengua, Ciencias/Biología, Arte) y 2 aulas más.
     - 2 materias más por curso (Inicial, Primario, Secundario), con horario.
     - 2 familias más (2 padres, 2 hijos) para no depender de una sola familia
       de demo.
     - Un estado de deuda DISTINTO por cada hijo (Pagada, Pago parcial,
       Vencida, Pendiente - variado, no todos iguales).
     - Una calificación por cada (alumno, materia de su curso) que todavía no
       la tenga: todos los hijos terminan con notas acordes a las materias
       reales de su grado, no una lista fija.
     - Una asistencia para todo alumno que no tenga ninguna.

   Requiere: schema.sql + seed.sql + migracion_cuotas.sql ya corridos.
   Pensado para correr UNA VEZ; usa guardas NOT EXISTS / ON CONFLICT para no
   duplicar si se corre más de una vez por error.
   Ejecución: pegar en el SQL Editor de Supabase y correr.
   ============================================================================= */

BEGIN;

DO $$
DECLARE
    v_valentina   INT; v_lucia INT; v_mateo INT; v_sofia INT; v_benjamin INT;
    v_tomas       INT; v_martina INT;
    v_curso_inicial INT; v_curso_primario INT; v_curso_secundario INT;
    v_periodo        DATE := date_trunc('month', CURRENT_DATE)::date;
    v_periodo_ant    DATE := (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date;
    v_tarifa_cuota    INT; v_tarifa_comedor INT; v_tarifa_transporte INT; v_tarifa_transporte_sur INT;
    v_tarifa_futbol   INT; v_tarifa_hockey   INT; v_tarifa_natacion INT;
    v_recorrido_sur   INT;
    v_padre2 INT; v_padre3 INT; v_docente3 INT; v_docente4 INT; v_docente5 INT;
    v_personal_doc3 INT; v_personal_doc4 INT; v_personal_doc5 INT;
    v_aula103 INT; v_aula_multiuso INT; v_lab INT;
    v_materia_lengua_prim INT; v_materia_ciencias_prim INT;
    v_materia_lengua_sec INT; v_materia_biologia_sec INT;
    v_materia_artistica INT; v_materia_juegos INT;
    v_futbol INT; v_hockey INT; v_natacion INT;
    v_factura INT;
BEGIN
    SELECT id INTO v_valentina FROM alumnos WHERE dni = '56111222';
    SELECT id INTO v_lucia     FROM alumnos WHERE dni = '53111222';
    SELECT id INTO v_mateo     FROM alumnos WHERE dni = '53111223';
    SELECT id INTO v_sofia     FROM alumnos WHERE dni = '49111222';
    SELECT id INTO v_benjamin  FROM alumnos WHERE dni = '49111223';
    SELECT curso_id INTO v_curso_inicial    FROM alumnos WHERE dni = '56111222';
    SELECT curso_id INTO v_curso_primario   FROM alumnos WHERE dni = '53111222';
    SELECT curso_id INTO v_curso_secundario FROM alumnos WHERE dni = '49111222';

    SELECT id INTO v_futbol    FROM deportes WHERE nombre = 'Fútbol';
    SELECT id INTO v_hockey    FROM deportes WHERE nombre = 'Hockey';
    SELECT id INTO v_natacion  FROM deportes WHERE nombre = 'Natación';
    SELECT id INTO v_recorrido_sur FROM transportes WHERE numero_recorrido = 2;
    SELECT id INTO v_lab FROM aulas WHERE nombre = 'Laboratorio';

    SELECT id INTO v_tarifa_cuota       FROM tarifa_concepto WHERE tipo_servicio = 'cuota' ORDER BY vigencia DESC LIMIT 1;
    SELECT id INTO v_tarifa_comedor     FROM tarifa_concepto WHERE tipo_servicio = 'comedor' ORDER BY vigencia DESC LIMIT 1;
    SELECT id INTO v_tarifa_transporte  FROM tarifa_concepto WHERE tipo_servicio = 'transporte' AND descripcion LIKE '%Norte%' LIMIT 1;
    SELECT id INTO v_tarifa_futbol      FROM tarifa_concepto WHERE tipo_servicio = 'deporte' AND descripcion = 'Fútbol' LIMIT 1;

    -- =========================================================================
    -- Tarifas que faltaban (Hockey/Natación/Transporte Sur): seed.sql solo
    -- había cargado Fútbol y el recorrido Norte.
    -- =========================================================================
    INSERT INTO tarifa_concepto (tipo_servicio, descripcion, monto, vigencia, deporte_id)
        SELECT 'deporte', 'Hockey', 9000, v_periodo, v_hockey
        WHERE NOT EXISTS (SELECT 1 FROM tarifa_concepto WHERE descripcion = 'Hockey' AND deporte_id = v_hockey);
    SELECT id INTO v_tarifa_hockey FROM tarifa_concepto WHERE descripcion = 'Hockey' AND deporte_id = v_hockey LIMIT 1;

    INSERT INTO tarifa_concepto (tipo_servicio, descripcion, monto, vigencia, deporte_id)
        SELECT 'deporte', 'Natación', 7000, v_periodo, v_natacion
        WHERE NOT EXISTS (SELECT 1 FROM tarifa_concepto WHERE descripcion = 'Natación' AND deporte_id = v_natacion);
    SELECT id INTO v_tarifa_natacion FROM tarifa_concepto WHERE descripcion = 'Natación' AND deporte_id = v_natacion LIMIT 1;

    INSERT INTO tarifa_concepto (tipo_servicio, descripcion, monto, vigencia, transporte_id)
        SELECT 'transporte', 'Transporte Recorrido Sur', 12000, v_periodo, v_recorrido_sur
        WHERE NOT EXISTS (SELECT 1 FROM tarifa_concepto WHERE transporte_id = v_recorrido_sur);
    SELECT id INTO v_tarifa_transporte_sur FROM tarifa_concepto WHERE transporte_id = v_recorrido_sur LIMIT 1;

    -- =========================================================================
    -- Docentes nuevos (Lengua, Ciencias/Biología, Arte) - mismo patrón que
    -- seed.sql: usuario (login) + profesores (ficha) + personal (horarios).
    -- =========================================================================
    INSERT INTO usuarios (username, password_hash, nombre, apellido, email, rol)
        SELECT 'docente3', '$2a$10$oV.T/HkXnzcCyIvVrtb6iuCii/4j0RKya7lVmGtQTW9BU9NnZDnKm', 'Laura', 'Martínez', 'lmartinez@educar.edu.ar', 'docente'
        WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE username = 'docente3');
    INSERT INTO usuarios (username, password_hash, nombre, apellido, email, rol)
        SELECT 'docente4', '$2a$10$oV.T/HkXnzcCyIvVrtb6iuCii/4j0RKya7lVmGtQTW9BU9NnZDnKm', 'Pedro', 'Álvarez', 'palvarez@educar.edu.ar', 'docente'
        WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE username = 'docente4');
    INSERT INTO usuarios (username, password_hash, nombre, apellido, email, rol)
        SELECT 'docente5', '$2a$10$oV.T/HkXnzcCyIvVrtb6iuCii/4j0RKya7lVmGtQTW9BU9NnZDnKm', 'Carla', 'Sosa', 'csosa@educar.edu.ar', 'docente'
        WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE username = 'docente5');
    SELECT id INTO v_docente3 FROM usuarios WHERE username = 'docente3';
    SELECT id INTO v_docente4 FROM usuarios WHERE username = 'docente4';
    SELECT id INTO v_docente5 FROM usuarios WHERE username = 'docente5';

    INSERT INTO profesores (usuario_id, dni, especialidad, telefono)
        SELECT v_docente3, '20555666', 'Lengua y Literatura', '3624333333'
        WHERE NOT EXISTS (SELECT 1 FROM profesores WHERE dni = '20555666');
    INSERT INTO profesores (usuario_id, dni, especialidad, telefono)
        SELECT v_docente4, '20777888', 'Ciencias Naturales y Biología', '3624444444'
        WHERE NOT EXISTS (SELECT 1 FROM profesores WHERE dni = '20777888');
    INSERT INTO profesores (usuario_id, dni, especialidad, telefono)
        SELECT v_docente5, '20999000', 'Educación Artística', '3624555556'
        WHERE NOT EXISTS (SELECT 1 FROM profesores WHERE dni = '20999000');

    INSERT INTO personal (nombre, apellido, dni, tipo, email)
        SELECT 'Laura', 'Martínez', '20555666', 'Docente', 'lmartinez@educar.edu.ar'
        WHERE NOT EXISTS (SELECT 1 FROM personal WHERE dni = '20555666');
    INSERT INTO personal (nombre, apellido, dni, tipo, email)
        SELECT 'Pedro', 'Álvarez', '20777888', 'Docente', 'palvarez@educar.edu.ar'
        WHERE NOT EXISTS (SELECT 1 FROM personal WHERE dni = '20777888');
    INSERT INTO personal (nombre, apellido, dni, tipo, email)
        SELECT 'Carla', 'Sosa', '20999000', 'Docente', 'csosa@educar.edu.ar'
        WHERE NOT EXISTS (SELECT 1 FROM personal WHERE dni = '20999000');
    SELECT id INTO v_personal_doc3 FROM personal WHERE dni = '20555666';
    SELECT id INTO v_personal_doc4 FROM personal WHERE dni = '20777888';
    SELECT id INTO v_personal_doc5 FROM personal WHERE dni = '20999000';

    -- =========================================================================
    -- Aulas nuevas.
    -- =========================================================================
    INSERT INTO aulas (nombre, capacidad) SELECT 'Aula 103', 25 WHERE NOT EXISTS (SELECT 1 FROM aulas WHERE nombre = 'Aula 103');
    INSERT INTO aulas (nombre, capacidad) SELECT 'Aula Multiuso', 20 WHERE NOT EXISTS (SELECT 1 FROM aulas WHERE nombre = 'Aula Multiuso');
    SELECT id INTO v_aula103 FROM aulas WHERE nombre = 'Aula 103';
    SELECT id INTO v_aula_multiuso FROM aulas WHERE nombre = 'Aula Multiuso';

    -- =========================================================================
    -- Materias nuevas por curso (2 más por curso, además de la que ya tenía)
    -- y su horario con el docente y el aula correspondiente.
    -- =========================================================================

    -- Inicial (Valentina): Expresión Artística + Juegos y Movimiento.
    INSERT INTO materias (nombre, curso_id, descripcion)
        SELECT 'Expresión Artística', v_curso_inicial, 'Música, plástica y juego expresivo'
        WHERE NOT EXISTS (SELECT 1 FROM materias WHERE nombre = 'Expresión Artística' AND curso_id = v_curso_inicial);
    SELECT id INTO v_materia_artistica FROM materias WHERE nombre = 'Expresión Artística' AND curso_id = v_curso_inicial;
    INSERT INTO materias (nombre, curso_id, descripcion)
        SELECT 'Juegos y Movimiento', v_curso_inicial, 'Psicomotricidad y juego dirigido'
        WHERE NOT EXISTS (SELECT 1 FROM materias WHERE nombre = 'Juegos y Movimiento' AND curso_id = v_curso_inicial);
    SELECT id INTO v_materia_juegos FROM materias WHERE nombre = 'Juegos y Movimiento' AND curso_id = v_curso_inicial;

    -- Primario (Lucía/Mateo/Tomás): Lengua + Ciencias Naturales (ya tenían Ed. Física).
    INSERT INTO materias (nombre, curso_id, descripcion)
        SELECT 'Lengua', v_curso_primario, 'Lectoescritura y comprensión de textos'
        WHERE NOT EXISTS (SELECT 1 FROM materias WHERE nombre = 'Lengua' AND curso_id = v_curso_primario);
    SELECT id INTO v_materia_lengua_prim FROM materias WHERE nombre = 'Lengua' AND curso_id = v_curso_primario;
    INSERT INTO materias (nombre, curso_id, descripcion)
        SELECT 'Ciencias Naturales', v_curso_primario, 'Seres vivos, materia y energía'
        WHERE NOT EXISTS (SELECT 1 FROM materias WHERE nombre = 'Ciencias Naturales' AND curso_id = v_curso_primario);
    SELECT id INTO v_materia_ciencias_prim FROM materias WHERE nombre = 'Ciencias Naturales' AND curso_id = v_curso_primario;

    -- Secundario (Sofía/Benjamín/Martina): Lengua y Literatura + Biología (ya tenían Matemática).
    INSERT INTO materias (nombre, curso_id, descripcion)
        SELECT 'Lengua y Literatura', v_curso_secundario, 'Análisis de textos y producción escrita'
        WHERE NOT EXISTS (SELECT 1 FROM materias WHERE nombre = 'Lengua y Literatura' AND curso_id = v_curso_secundario);
    SELECT id INTO v_materia_lengua_sec FROM materias WHERE nombre = 'Lengua y Literatura' AND curso_id = v_curso_secundario;
    INSERT INTO materias (nombre, curso_id, descripcion)
        SELECT 'Biología', v_curso_secundario, 'Célula, genética y ecosistemas'
        WHERE NOT EXISTS (SELECT 1 FROM materias WHERE nombre = 'Biología' AND curso_id = v_curso_secundario);
    SELECT id INTO v_materia_biologia_sec FROM materias WHERE nombre = 'Biología' AND curso_id = v_curso_secundario;

    INSERT INTO horarios (materia_id, docente_id, aula_id, dia_semana, hora_inicio, hora_fin)
        SELECT v_materia_lengua_prim, v_personal_doc3, v_aula103, 2, '09:00', '10:00'
        WHERE NOT EXISTS (SELECT 1 FROM horarios WHERE materia_id = v_materia_lengua_prim);
    INSERT INTO horarios (materia_id, docente_id, aula_id, dia_semana, hora_inicio, hora_fin)
        SELECT v_materia_ciencias_prim, v_personal_doc4, v_lab, 4, '10:00', '11:00'
        WHERE NOT EXISTS (SELECT 1 FROM horarios WHERE materia_id = v_materia_ciencias_prim);
    INSERT INTO horarios (materia_id, docente_id, aula_id, dia_semana, hora_inicio, hora_fin)
        SELECT v_materia_lengua_sec, v_personal_doc3, v_aula103, 3, '09:00', '10:00'
        WHERE NOT EXISTS (SELECT 1 FROM horarios WHERE materia_id = v_materia_lengua_sec);
    INSERT INTO horarios (materia_id, docente_id, aula_id, dia_semana, hora_inicio, hora_fin)
        SELECT v_materia_biologia_sec, v_personal_doc4, v_lab, 5, '10:00', '11:00'
        WHERE NOT EXISTS (SELECT 1 FROM horarios WHERE materia_id = v_materia_biologia_sec);
    INSERT INTO horarios (materia_id, docente_id, aula_id, dia_semana, hora_inicio, hora_fin)
        SELECT v_materia_artistica, v_personal_doc5, v_aula_multiuso, 1, '11:00', '12:00'
        WHERE NOT EXISTS (SELECT 1 FROM horarios WHERE materia_id = v_materia_artistica);
    INSERT INTO horarios (materia_id, docente_id, aula_id, dia_semana, hora_inicio, hora_fin)
        SELECT v_materia_juegos, v_personal_doc5, v_aula_multiuso, 3, '11:00', '12:00'
        WHERE NOT EXISTS (SELECT 1 FROM horarios WHERE materia_id = v_materia_juegos);

    -- =========================================================================
    -- 2 familias más (2 padres, 1 hijo cada uno), para no depender de una
    -- sola familia de demo.
    -- =========================================================================
    INSERT INTO usuarios (username, password_hash, nombre, apellido, email, rol)
        SELECT 'padre2', '$2a$10$1c5BYLaRSGoaLkz.uA59AuX/a47MSidr8XHOA1.yvL3eo.ge9bjhm', 'Marcos', 'Giménez', 'mgimenez@mail.com', 'padre'
        WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE username = 'padre2');
    INSERT INTO usuarios (username, password_hash, nombre, apellido, email, rol)
        SELECT 'padre3', '$2a$10$1c5BYLaRSGoaLkz.uA59AuX/a47MSidr8XHOA1.yvL3eo.ge9bjhm', 'Ana', 'Rodríguez', 'arodriguez@mail.com', 'padre'
        WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE username = 'padre3');
    SELECT id INTO v_padre2 FROM usuarios WHERE username = 'padre2';
    SELECT id INTO v_padre3 FROM usuarios WHERE username = 'padre3';

    INSERT INTO alumnos (dni, nombre, apellido, fecha_nacimiento, curso_id, padre_id, usa_comedor, transporte_id)
        SELECT '55111224', 'Tomás', 'Giménez', '2018-07-10', v_curso_primario, v_padre2, FALSE, NULL
        WHERE NOT EXISTS (SELECT 1 FROM alumnos WHERE dni = '55111224');
    INSERT INTO alumnos (dni, nombre, apellido, fecha_nacimiento, curso_id, padre_id, usa_comedor, transporte_id)
        SELECT '48111224', 'Martina', 'Rodríguez', '2014-09-05', v_curso_secundario, v_padre3, TRUE, v_recorrido_sur
        WHERE NOT EXISTS (SELECT 1 FROM alumnos WHERE dni = '48111224');
    SELECT id INTO v_tomas   FROM alumnos WHERE dni = '55111224';
    SELECT id INTO v_martina FROM alumnos WHERE dni = '48111224';

    -- Inscripciones a deportes de los nuevos hijos (pasan por el trigger de
    -- RF-06/RF-07/cupo igual que los de seed.sql).
    INSERT INTO inscripciones_deportes (alumno_id, deporte_id)
        SELECT v_tomas, v_hockey WHERE NOT EXISTS (SELECT 1 FROM inscripciones_deportes WHERE alumno_id = v_tomas AND deporte_id = v_hockey);
    INSERT INTO inscripciones_deportes (alumno_id, deporte_id)
        SELECT v_martina, v_natacion WHERE NOT EXISTS (SELECT 1 FROM inscripciones_deportes WHERE alumno_id = v_martina AND deporte_id = v_natacion);

    -- =========================================================================
    -- Facturas: un estado de deuda distinto por hijo (7 hijos en total).
    -- =========================================================================

    -- Valentina: cuota + transporte + comedor, PAGADA (saldo 0).
    INSERT INTO factura (alumno_id, periodo, fecha_emision, fecha_vencimiento, estado, total, saldo)
        VALUES (v_valentina, v_periodo, v_periodo, v_periodo + INTERVAL '10 days', 'Pagada', 72000, 0)
        ON CONFLICT (alumno_id, periodo) DO NOTHING RETURNING id INTO v_factura;
    IF v_factura IS NOT NULL THEN
        INSERT INTO factura_detalle (factura_id, tarifa_concepto_id, descripcion, cantidad, importe_unitario) VALUES
            (v_factura, v_tarifa_cuota, 'Cuota mensual', 1, 45000),
            (v_factura, v_tarifa_transporte, 'Transporte Recorrido Norte', 1, 12000),
            (v_factura, v_tarifa_comedor, 'Comedor mensual', 1, 15000);
    END IF;

    -- Lucía: factura del mes anterior, ya PAGADA (la del mes actual, Pendiente, ya la dejó seed.sql).
    INSERT INTO factura (alumno_id, periodo, fecha_emision, fecha_vencimiento, estado, total, saldo)
        VALUES (v_lucia, v_periodo_ant, v_periodo_ant, v_periodo_ant + INTERVAL '10 days', 'Pagada', 60000, 0)
        ON CONFLICT (alumno_id, periodo) DO NOTHING RETURNING id INTO v_factura;
    IF v_factura IS NOT NULL THEN
        INSERT INTO factura_detalle (factura_id, tarifa_concepto_id, descripcion, cantidad, importe_unitario) VALUES
            (v_factura, v_tarifa_cuota, 'Cuota mensual', 1, 45000),
            (v_factura, v_tarifa_futbol, 'Fútbol', 1, 8000),
            (v_factura, v_tarifa_natacion, 'Natación', 1, 7000);
    END IF;

    -- Mateo: cuota + deporte + transporte + comedor, PAGO PARCIAL.
    INSERT INTO factura (alumno_id, periodo, fecha_emision, fecha_vencimiento, estado, total, saldo)
        VALUES (v_mateo, v_periodo, v_periodo, v_periodo + INTERVAL '10 days', 'Pago parcial', 80000, 30000)
        ON CONFLICT (alumno_id, periodo) DO NOTHING RETURNING id INTO v_factura;
    IF v_factura IS NOT NULL THEN
        INSERT INTO factura_detalle (factura_id, tarifa_concepto_id, descripcion, cantidad, importe_unitario) VALUES
            (v_factura, v_tarifa_cuota, 'Cuota mensual', 1, 45000),
            (v_factura, v_tarifa_futbol, 'Fútbol', 1, 8000),
            (v_factura, v_tarifa_transporte, 'Transporte Recorrido Norte', 1, 12000),
            (v_factura, v_tarifa_comedor, 'Comedor mensual', 1, 15000);
    END IF;

    -- Sofía: cuota + Hockey, VENCIDA (del mes pasado, sigue impaga).
    INSERT INTO factura (alumno_id, periodo, fecha_emision, fecha_vencimiento, estado, total, saldo)
        VALUES (v_sofia, v_periodo_ant, v_periodo_ant, v_periodo_ant + INTERVAL '10 days', 'Vencida', 54000, 54000)
        ON CONFLICT (alumno_id, periodo) DO NOTHING RETURNING id INTO v_factura;
    IF v_factura IS NOT NULL THEN
        INSERT INTO factura_detalle (factura_id, tarifa_concepto_id, descripcion, cantidad, importe_unitario) VALUES
            (v_factura, v_tarifa_cuota, 'Cuota mensual', 1, 45000),
            (v_factura, v_tarifa_hockey, 'Hockey', 1, 9000);
    END IF;

    -- Benjamín: solo cuota, PENDIENTE (recién emitida).
    INSERT INTO factura (alumno_id, periodo, fecha_emision, fecha_vencimiento, estado, total, saldo)
        VALUES (v_benjamin, v_periodo, v_periodo, v_periodo + INTERVAL '10 days', 'Pendiente', 45000, 45000)
        ON CONFLICT (alumno_id, periodo) DO NOTHING RETURNING id INTO v_factura;
    IF v_factura IS NOT NULL THEN
        INSERT INTO factura_detalle (factura_id, tarifa_concepto_id, descripcion, cantidad, importe_unitario) VALUES
            (v_factura, v_tarifa_cuota, 'Cuota mensual', 1, 45000);
    END IF;

    -- Tomás: cuota + Hockey, PENDIENTE (deuda completa).
    INSERT INTO factura (alumno_id, periodo, fecha_emision, fecha_vencimiento, estado, total, saldo)
        VALUES (v_tomas, v_periodo, v_periodo, v_periodo + INTERVAL '10 days', 'Pendiente', 54000, 54000)
        ON CONFLICT (alumno_id, periodo) DO NOTHING RETURNING id INTO v_factura;
    IF v_factura IS NOT NULL THEN
        INSERT INTO factura_detalle (factura_id, tarifa_concepto_id, descripcion, cantidad, importe_unitario) VALUES
            (v_factura, v_tarifa_cuota, 'Cuota mensual', 1, 45000),
            (v_factura, v_tarifa_hockey, 'Hockey', 1, 9000);
    END IF;

    -- Martina: cuota + comedor + transporte Sur, PAGADA.
    INSERT INTO factura (alumno_id, periodo, fecha_emision, fecha_vencimiento, estado, total, saldo)
        VALUES (v_martina, v_periodo, v_periodo, v_periodo + INTERVAL '10 days', 'Pagada', 72000, 0)
        ON CONFLICT (alumno_id, periodo) DO NOTHING RETURNING id INTO v_factura;
    IF v_factura IS NOT NULL THEN
        INSERT INTO factura_detalle (factura_id, tarifa_concepto_id, descripcion, cantidad, importe_unitario) VALUES
            (v_factura, v_tarifa_cuota, 'Cuota mensual', 1, 45000),
            (v_factura, v_tarifa_comedor, 'Comedor mensual', 1, 15000),
            (v_factura, v_tarifa_transporte_sur, 'Transporte Recorrido Sur', 1, 12000);
    END IF;

    -- =========================================================================
    -- Notas: una calificación por cada (alumno, materia de SU curso) que
    -- todavía no la tenga. Cubre a los 5 hijos originales y a los 2 nuevos,
    -- y a cualquier materia que se agregue después (no es una lista fija).
    -- =========================================================================
    INSERT INTO calificaciones (alumno_id, materia_id, nota, trimestre)
    SELECT a.id, m.id, (7 + (a.id + m.id) % 4)::smallint, 1
    FROM alumnos a
    JOIN materias m ON m.curso_id = a.curso_id
    WHERE NOT EXISTS (
        SELECT 1 FROM calificaciones c WHERE c.alumno_id = a.id AND c.materia_id = m.id
    );

    -- =========================================================================
    -- Asistencias: al menos una por alumno que todavía no tenga ninguna.
    -- =========================================================================
    INSERT INTO asistencias (alumno_id, fecha, estado)
    SELECT a.id, CURRENT_DATE, (ARRAY['Presente', 'Ausente', 'Tarde'])[1 + (a.id % 3)]
    FROM alumnos a
    WHERE NOT EXISTS (SELECT 1 FROM asistencias WHERE alumno_id = a.id);

    -- =========================================================================
    -- Saldos: recalculado desde las facturas reales de cada alumno (cubre a
    -- los hijos nuevos automáticamente).
    -- =========================================================================
    INSERT INTO saldos (alumno_id, saldo_pendiente, ultima_actualizacion)
    SELECT a.id, COALESCE((SELECT SUM(f.saldo) FROM factura f WHERE f.alumno_id = a.id AND f.estado <> 'Anulada'), 0), now()
    FROM alumnos a
    ON CONFLICT (alumno_id) DO UPDATE SET saldo_pendiente = EXCLUDED.saldo_pendiente, ultima_actualizacion = now();
END $$;

COMMIT;
