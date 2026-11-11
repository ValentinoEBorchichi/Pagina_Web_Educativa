/* =============================================================================
   Datos de prueba rápidos para probar en la app móvil (Home del padre):
   una factura con deuda, un par de notas y un par de inasistencias.
   -----------------------------------------------------------------------------
   Corré esto en el SQL Editor de Supabase, DESPUÉS de schema.sql y seed.sql.
   Es idempotente para notas/asistencias (podés correrlo varias veces: cada
   corrida agrega otra tanda), pero la factura usa ON CONFLICT DO NOTHING por
   el UNIQUE(alumno_id, periodo), así que si ya existe una factura para ese
   alumno en ese período, no duplica.

   Para probar con OTRO alumno: cambiá v_dni más abajo por su DNI (lo ves en
   el panel de Admin o en la tabla alumnos).
   ============================================================================= */

DO $$
DECLARE
    v_dni VARCHAR(8) := '53111223';  -- <<< cambiá esto por el DNI del alumno que quieras probar
    v_alumno_id INT;
    v_materia_id INT;
    v_tarifa_id INT;
    v_periodo DATE := date_trunc('month', CURRENT_DATE - INTERVAL '2 months')::date; -- evita chocar con la factura del mes actual
    v_factura_id INT;
BEGIN
    SELECT id INTO v_alumno_id FROM alumnos WHERE dni = v_dni;
    IF v_alumno_id IS NULL THEN
        RAISE EXCEPTION 'No existe ningún alumno con DNI %', v_dni;
    END IF;

    -- Cualquier materia y tarifa ya existentes (las crea seed.sql).
    SELECT id INTO v_materia_id FROM materias ORDER BY id LIMIT 1;
    SELECT id INTO v_tarifa_id FROM tarifa_concepto WHERE tipo_servicio = 'cuota' ORDER BY id LIMIT 1;

    -- 1) Factura con deuda (saldo > 0). fecha_emision se fija al propio
    -- período (no al default CURRENT_DATE): si no, con un período pasado la
    -- fecha_vencimiento quedaba antes que la emisión y violaba
    -- ck_factura_fechas.
    INSERT INTO factura (alumno_id, periodo, fecha_emision, fecha_vencimiento, estado, total, saldo)
    VALUES (v_alumno_id, v_periodo, v_periodo, v_periodo + INTERVAL '10 days', 'Vencida', 45000, 45000)
    ON CONFLICT (alumno_id, periodo) DO NOTHING
    RETURNING id INTO v_factura_id;

    IF v_factura_id IS NOT NULL AND v_tarifa_id IS NOT NULL THEN
        INSERT INTO factura_detalle (factura_id, tarifa_concepto_id, descripcion, cantidad, importe_unitario)
        VALUES (v_factura_id, v_tarifa_id, 'Cuota mensual (prueba)', 1, 45000)
        ON CONFLICT (factura_id, tarifa_concepto_id) DO NOTHING;
    END IF;

    -- 2) Un par de notas.
    IF v_materia_id IS NOT NULL THEN
        INSERT INTO calificaciones (alumno_id, materia_id, nota, trimestre) VALUES
            (v_alumno_id, v_materia_id, 8, 2),
            (v_alumno_id, v_materia_id, 6, 3);
    END IF;

    -- 3) Un par de inasistencias (y algunas presentes, para que el % de
    -- asistencia se vea realista en vez de 0%).
    INSERT INTO asistencias (alumno_id, fecha, estado) VALUES
        (v_alumno_id, CURRENT_DATE - INTERVAL '1 day', 'Ausente'),
        (v_alumno_id, CURRENT_DATE - INTERVAL '2 days', 'Ausente'),
        (v_alumno_id, CURRENT_DATE - INTERVAL '3 days', 'Tarde'),
        (v_alumno_id, CURRENT_DATE - INTERVAL '4 days', 'Presente'),
        (v_alumno_id, CURRENT_DATE - INTERVAL '5 days', 'Presente');

    RAISE NOTICE 'Listo: alumno_id=%, factura_id=%', v_alumno_id, v_factura_id;
END $$;
