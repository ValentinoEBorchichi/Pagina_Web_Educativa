/* =============================================================================
   Educar para Transformar - Datos de demo: diversificar estados por hijo
   -----------------------------------------------------------------------------
   seed.sql solo le carga factura, calificaciones y asistencia a 1 o 2 de los
   5 hijos del padre de demo; el resto queda vacío y la app los muestra todos
   "iguales" (sin deuda, sin notas). Este script agrega datos reales (no
   hardcodeados en el frontend) para que cada hijo tenga un estado distinto:

     Valentina (Inicial)    -> cuota+transporte+comedor, factura PAGADA
     Lucía (Primario)       -> ya tenía 1 factura Pendiente (seed.sql); se le
                                agrega una del mes anterior ya PAGADA
     Mateo (Primario)       -> factura con PAGO PARCIAL (deuda a mitad)
     Sofía (Secundario)     -> factura VENCIDA (deuda, fecha de pago pasada)
     Benjamín (Secundario)  -> factura PENDIENTE (recién emitida)

   También completa materias/calificaciones/asistencias para los hijos que
   seed.sql había dejado sin ninguna (Valentina, Lucía, Benjamín).

   Requiere: schema.sql + seed.sql + migracion_cuotas.sql ya corridos.
   Pensado para correr UNA VEZ (como seed.sql); usa guardas NOT EXISTS /
   ON CONFLICT para no duplicar si se corre más de una vez por error.
   Ejecución: pegar en el SQL Editor de Supabase y correr.
   ============================================================================= */

BEGIN;

DO $$
DECLARE
    v_valentina   INT; v_lucia INT; v_mateo INT; v_sofia INT; v_benjamin INT;
    v_curso_inicial INT;
    v_periodo        DATE := date_trunc('month', CURRENT_DATE)::date;
    v_periodo_ant    DATE := (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date;
    v_tarifa_cuota    INT; v_tarifa_comedor INT; v_tarifa_transporte INT; v_tarifa_futbol INT;
    v_tarifa_hockey   INT; v_tarifa_natacion INT;
    v_materia_artistica INT; v_materia_ed_fisica INT; v_materia_matematica INT;
    v_factura INT;
BEGIN
    SELECT id INTO v_valentina FROM alumnos WHERE dni = '56111222';
    SELECT id INTO v_lucia     FROM alumnos WHERE dni = '53111222';
    SELECT id INTO v_mateo     FROM alumnos WHERE dni = '53111223';
    SELECT id INTO v_sofia     FROM alumnos WHERE dni = '49111222';
    SELECT id INTO v_benjamin  FROM alumnos WHERE dni = '49111223';
    SELECT curso_id INTO v_curso_inicial FROM alumnos WHERE dni = '56111222';

    SELECT id INTO v_tarifa_cuota       FROM tarifa_concepto WHERE tipo_servicio = 'cuota' ORDER BY vigencia DESC LIMIT 1;
    SELECT id INTO v_tarifa_comedor     FROM tarifa_concepto WHERE tipo_servicio = 'comedor' ORDER BY vigencia DESC LIMIT 1;
    SELECT id INTO v_tarifa_transporte  FROM tarifa_concepto WHERE tipo_servicio = 'transporte' ORDER BY vigencia DESC LIMIT 1;
    SELECT id INTO v_tarifa_futbol      FROM tarifa_concepto WHERE tipo_servicio = 'deporte' AND descripcion = 'Fútbol' LIMIT 1;

    -- Tarifas de Hockey y Natación: seed.sql creó los deportes pero no su
    -- tarifa_concepto (solo Fútbol la tenía).
    INSERT INTO tarifa_concepto (tipo_servicio, descripcion, monto, vigencia, deporte_id)
        SELECT 'deporte', 'Hockey', 9000, v_periodo, id FROM deportes WHERE nombre = 'Hockey'
        AND NOT EXISTS (SELECT 1 FROM tarifa_concepto WHERE descripcion = 'Hockey')
        RETURNING id INTO v_tarifa_hockey;
    IF v_tarifa_hockey IS NULL THEN
        SELECT id INTO v_tarifa_hockey FROM tarifa_concepto WHERE descripcion = 'Hockey' LIMIT 1;
    END IF;

    INSERT INTO tarifa_concepto (tipo_servicio, descripcion, monto, vigencia, deporte_id)
        SELECT 'deporte', 'Natación', 7000, v_periodo, id FROM deportes WHERE nombre = 'Natación'
        AND NOT EXISTS (SELECT 1 FROM tarifa_concepto WHERE descripcion = 'Natación')
        RETURNING id INTO v_tarifa_natacion;
    IF v_tarifa_natacion IS NULL THEN
        SELECT id INTO v_tarifa_natacion FROM tarifa_concepto WHERE descripcion = 'Natación' LIMIT 1;
    END IF;

    -- =========================================================================
    -- Materia para Nivel Inicial (Valentina no tenía ninguna materia asociada
    -- a su curso).
    -- =========================================================================
    INSERT INTO materias (nombre, curso_id, descripcion)
        SELECT 'Expresión Artística', v_curso_inicial, 'Música, plástica y juego expresivo'
        WHERE NOT EXISTS (SELECT 1 FROM materias WHERE nombre = 'Expresión Artística')
        RETURNING id INTO v_materia_artistica;
    IF v_materia_artistica IS NULL THEN
        SELECT id INTO v_materia_artistica FROM materias WHERE nombre = 'Expresión Artística' LIMIT 1;
    END IF;
    SELECT id INTO v_materia_ed_fisica FROM materias WHERE nombre = 'Educación Física' LIMIT 1;
    SELECT id INTO v_materia_matematica FROM materias WHERE nombre = 'Matemática' LIMIT 1;

    -- =========================================================================
    -- Calificaciones: completar a quienes seed.sql dejó sin ninguna.
    -- =========================================================================
    INSERT INTO calificaciones (alumno_id, materia_id, nota, trimestre)
        SELECT v_valentina, v_materia_artistica, 8, 1
        WHERE NOT EXISTS (SELECT 1 FROM calificaciones WHERE alumno_id = v_valentina);
    INSERT INTO calificaciones (alumno_id, materia_id, nota, trimestre)
        SELECT v_lucia, v_materia_ed_fisica, 10, 1
        WHERE NOT EXISTS (SELECT 1 FROM calificaciones WHERE alumno_id = v_lucia);
    INSERT INTO calificaciones (alumno_id, materia_id, nota, trimestre)
        SELECT v_benjamin, v_materia_matematica, 6, 1
        WHERE NOT EXISTS (SELECT 1 FROM calificaciones WHERE alumno_id = v_benjamin);

    -- =========================================================================
    -- Asistencias: completar a quienes seed.sql dejó sin ninguna.
    -- =========================================================================
    INSERT INTO asistencias (alumno_id, fecha, estado)
        SELECT v_valentina, CURRENT_DATE, 'Presente'
        WHERE NOT EXISTS (SELECT 1 FROM asistencias WHERE alumno_id = v_valentina);
    INSERT INTO asistencias (alumno_id, fecha, estado)
        SELECT v_lucia, CURRENT_DATE, 'Tarde'
        WHERE NOT EXISTS (SELECT 1 FROM asistencias WHERE alumno_id = v_lucia);
    INSERT INTO asistencias (alumno_id, fecha, estado)
        SELECT v_benjamin, CURRENT_DATE, 'Ausente'
        WHERE NOT EXISTS (SELECT 1 FROM asistencias WHERE alumno_id = v_benjamin);

    -- =========================================================================
    -- Facturas: un estado de deuda distinto por hijo (todas con sus
    -- factura_detalle; ON CONFLICT por la UNIQUE (alumno_id, periodo) hace
    -- esto seguro de re-correr).
    -- =========================================================================

    -- Valentina: cuota + transporte + comedor, PAGADA (saldo 0).
    INSERT INTO factura (alumno_id, periodo, fecha_emision, fecha_vencimiento, estado, total, saldo)
        VALUES (v_valentina, v_periodo, v_periodo, v_periodo + INTERVAL '10 days', 'Pagada', 72000, 0)
        ON CONFLICT (alumno_id, periodo) DO NOTHING
        RETURNING id INTO v_factura;
    IF v_factura IS NOT NULL THEN
        INSERT INTO factura_detalle (factura_id, tarifa_concepto_id, descripcion, cantidad, importe_unitario) VALUES
            (v_factura, v_tarifa_cuota, 'Cuota mensual', 1, 45000),
            (v_factura, v_tarifa_transporte, 'Transporte Recorrido Norte', 1, 12000),
            (v_factura, v_tarifa_comedor, 'Comedor mensual', 1, 15000);
    END IF;

    -- Lucía: factura del mes anterior, ya PAGADA (la del mes actual, Pendiente,
    -- ya la dejó seed.sql).
    INSERT INTO factura (alumno_id, periodo, fecha_emision, fecha_vencimiento, estado, total, saldo)
        VALUES (v_lucia, v_periodo_ant, v_periodo_ant, v_periodo_ant + INTERVAL '10 days', 'Pagada', 60000, 0)
        ON CONFLICT (alumno_id, periodo) DO NOTHING
        RETURNING id INTO v_factura;
    IF v_factura IS NOT NULL THEN
        INSERT INTO factura_detalle (factura_id, tarifa_concepto_id, descripcion, cantidad, importe_unitario) VALUES
            (v_factura, v_tarifa_cuota, 'Cuota mensual', 1, 45000),
            (v_factura, v_tarifa_futbol, 'Fútbol', 1, 8000),
            (v_factura, v_tarifa_natacion, 'Natación', 1, 7000);
    END IF;

    -- Mateo: cuota + deporte + transporte + comedor, PAGO PARCIAL (pagó 50000 de 80000).
    INSERT INTO factura (alumno_id, periodo, fecha_emision, fecha_vencimiento, estado, total, saldo)
        VALUES (v_mateo, v_periodo, v_periodo, v_periodo + INTERVAL '10 days', 'Pago parcial', 80000, 30000)
        ON CONFLICT (alumno_id, periodo) DO NOTHING
        RETURNING id INTO v_factura;
    IF v_factura IS NOT NULL THEN
        INSERT INTO factura_detalle (factura_id, tarifa_concepto_id, descripcion, cantidad, importe_unitario) VALUES
            (v_factura, v_tarifa_cuota, 'Cuota mensual', 1, 45000),
            (v_factura, v_tarifa_futbol, 'Fútbol', 1, 8000),
            (v_factura, v_tarifa_transporte, 'Transporte Recorrido Norte', 1, 12000),
            (v_factura, v_tarifa_comedor, 'Comedor mensual', 1, 15000);
    END IF;

    -- Sofía: cuota + deporte (Hockey), VENCIDA (venció el mes pasado y sigue
    -- impaga).
    INSERT INTO factura (alumno_id, periodo, fecha_emision, fecha_vencimiento, estado, total, saldo)
        VALUES (v_sofia, v_periodo_ant, v_periodo_ant, v_periodo_ant + INTERVAL '10 days', 'Vencida', 54000, 54000)
        ON CONFLICT (alumno_id, periodo) DO NOTHING
        RETURNING id INTO v_factura;
    IF v_factura IS NOT NULL THEN
        INSERT INTO factura_detalle (factura_id, tarifa_concepto_id, descripcion, cantidad, importe_unitario) VALUES
            (v_factura, v_tarifa_cuota, 'Cuota mensual', 1, 45000),
            (v_factura, v_tarifa_hockey, 'Hockey', 1, 9000);
    END IF;

    -- Benjamín: solo cuota, PENDIENTE (recién emitida, sin pagos aún).
    INSERT INTO factura (alumno_id, periodo, fecha_emision, fecha_vencimiento, estado, total, saldo)
        VALUES (v_benjamin, v_periodo, v_periodo, v_periodo + INTERVAL '10 days', 'Pendiente', 45000, 45000)
        ON CONFLICT (alumno_id, periodo) DO NOTHING
        RETURNING id INTO v_factura;
    IF v_factura IS NOT NULL THEN
        INSERT INTO factura_detalle (factura_id, tarifa_concepto_id, descripcion, cantidad, importe_unitario) VALUES
            (v_factura, v_tarifa_cuota, 'Cuota mensual', 1, 45000);
    END IF;

    -- Saldos (tabla resumen "estado de cuenta" aparte de factura.saldo).
    UPDATE saldos SET saldo_pendiente = 0      WHERE alumno_id = v_valentina;
    UPDATE saldos SET saldo_pendiente = 30000  WHERE alumno_id = v_mateo;
    UPDATE saldos SET saldo_pendiente = 54000  WHERE alumno_id = v_sofia;
    UPDATE saldos SET saldo_pendiente = 45000  WHERE alumno_id = v_benjamin;
    -- Lucía ya quedó en 53000 por la factura Pendiente de seed.sql.
END $$;

COMMIT;
