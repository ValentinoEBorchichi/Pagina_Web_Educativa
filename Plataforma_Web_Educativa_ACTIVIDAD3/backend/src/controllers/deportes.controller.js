const { getPool } = require('../config/db');
const { manejarErrorPg } = require('../utils/dbErrors');

// Inscripción de alumnos a deportes (Sprint 1: RF-06 y RF-07) sobre Postgres.
// Las reglas se validan acá para responder con mensajes claros; el trigger
// trg_inscripciones_deportes_reglas (ver supabase/schema.sql) vuelve a
// validarlas al insertar, lo que cubre dos inscripciones simultáneas del
// mismo alumno.

const MAX_DEPORTES_POR_ALUMNO = 2; // RF-06

// deportes.dias_semana es una máscara de bits (ver supabase/schema.sql).
const DIAS = [[1, 'Lun'], [2, 'Mar'], [4, 'Mié'], [8, 'Jue'], [16, 'Vie'], [32, 'Sáb'], [64, 'Dom']];
const diasATexto = (mascara) => DIAS.filter(([bit]) => mascara & bit).map(([, dia]) => dia).join(' y ');
const horarioATexto = (d) => `${diasATexto(d.dias_semana)} ${d.hora_inicio} a ${d.hora_fin}`;

// Dos deportes se superponen si comparten algún día y sus rangos horarios se pisan
// (las horas llegan como 'HH:MM', que se comparan bien como texto).
const seSuperponen = (a, b) =>
    (a.dias_semana & b.dias_semana) !== 0 && a.hora_inicio < b.hora_fin && b.hora_inicio < a.hora_fin;

const COLUMNAS_DEPORTE = `d.id, d.nombre, d.dias_semana,
    to_char(d.hora_inicio, 'HH24:MI') AS hora_inicio,
    to_char(d.hora_fin, 'HH24:MI') AS hora_fin`;

const error = (res, status, codigo, message, extra = {}) =>
    res.status(status).json({ message, codigo, ...extra });

const esIdValido = (valor) => Number.isInteger(valor) && valor > 0;

// Devuelve el legajo sobre el que se inscribe, o responde el error y devuelve null.
// - alumno: solo puede inscribirse a sí mismo (su cuenta está en alumnos.usuario_id).
// - padre:  solo a sus hijos (RF-02).
// - admin:  a cualquier alumno.
async function resolverAlumno(pool, req, res) {
    const { id: usuarioId, rol } = req.user;
    const pedido = req.body.alumno_id;

    if (rol === 'alumno') {
        const { rows } = await pool.query(
            'SELECT id, nombre, padre_id FROM alumnos WHERE usuario_id = $1',
            [usuarioId]
        );
        const alumno = rows[0];
        if (!alumno) {
            error(res, 403, 'SIN_LEGAJO', 'Tu cuenta no está vinculada a un legajo de alumno');
            return null;
        }
        if (pedido != null && pedido !== '' && Number(pedido) !== alumno.id) {
            error(res, 403, 'SIN_PERMISO', 'Solo podés inscribirte a vos mismo');
            return null;
        }
        return alumno;
    }

    const alumnoId = Number(pedido);
    if (!esIdValido(alumnoId)) {
        error(res, 400, 'DATOS_INVALIDOS', 'alumno_id es obligatorio y debe ser un número entero positivo');
        return null;
    }
    const { rows } = await pool.query('SELECT id, nombre, padre_id FROM alumnos WHERE id = $1', [alumnoId]);
    const alumno = rows[0];
    if (!alumno) {
        error(res, 404, 'ALUMNO_NO_ENCONTRADO', 'El alumno no existe');
        return null;
    }
    if (rol === 'padre' && alumno.padre_id !== usuarioId) {
        error(res, 403, 'SIN_PERMISO', 'Solo podés inscribir a tus hijos');
        return null;
    }
    return alumno;
}

// POST /api/deportes/inscribir   body: { alumno_id, deporte_id }
// (con rol alumno, alumno_id es opcional: se usa su propio legajo)
exports.inscribir = async (req, res) => {
    const deporteId = Number(req.body.deporte_id);
    if (!esIdValido(deporteId)) {
        return error(res, 400, 'DATOS_INVALIDOS', 'deporte_id es obligatorio y debe ser un número entero positivo');
    }

    try {
        const pool = await getPool();

        const alumno = await resolverAlumno(pool, req, res);
        if (!alumno) return;

        const { rows: deportes } = await pool.query(
            `SELECT ${COLUMNAS_DEPORTE}, d.cupo_maximo, d.activo,
                    (SELECT COUNT(*) FROM inscripciones_deportes i WHERE i.deporte_id = d.id) AS inscriptos
             FROM deportes d WHERE d.id = $1`,
            [deporteId]
        );
        const deporte = deportes[0];
        if (!deporte) {
            return error(res, 404, 'DEPORTE_NO_ENCONTRADO', 'El deporte no existe');
        }
        if (!deporte.activo) {
            return error(res, 409, 'DEPORTE_INACTIVO', `${deporte.nombre} no está disponible para inscripciones`);
        }

        const { rows: actuales } = await pool.query(
            `SELECT ${COLUMNAS_DEPORTE}
             FROM inscripciones_deportes i JOIN deportes d ON d.id = i.deporte_id
             WHERE i.alumno_id = $1`,
            [alumno.id]
        );

        if (actuales.some((d) => d.id === deporte.id)) {
            return error(res, 409, 'YA_INSCRIPTO', `${alumno.nombre} ya está en ${deporte.nombre}`);
        }

        // RF-06: máximo 2 deportes por alumno.
        if (actuales.length >= MAX_DEPORTES_POR_ALUMNO) {
            const nombres = actuales.map((d) => d.nombre);
            return error(res, 409, 'RF-06',
                `${alumno.nombre} ya tiene ${actuales.length} deportes (${nombres.join(' y ')}), ` +
                `que es el máximo permitido. Para sumar ${deporte.nombre} primero debe darse de baja de uno.`,
                { deportes_actuales: nombres });
        }

        // RF-07: sin superposición horaria con los deportes que ya tiene.
        const choque = actuales.find((d) => seSuperponen(d, deporte));
        if (choque) {
            return error(res, 409, 'RF-07',
                `El horario de ${deporte.nombre} (${horarioATexto(deporte)}) se superpone con ` +
                `${choque.nombre} (${horarioATexto(choque)}), otro deporte de ${alumno.nombre}.`,
                { deporte_en_conflicto: choque.nombre });
        }

        if (deporte.inscriptos >= deporte.cupo_maximo) {
            return error(res, 409, 'SIN_CUPO', `${deporte.nombre} no tiene cupo disponible`);
        }

        // A diferencia de SQL Server, Postgres sí admite RETURNING aunque la
        // tabla tenga un trigger: no hace falta la tabla temporal intermedia.
        const { rows: insertada } = await pool.query(
            `INSERT INTO inscripciones_deportes (alumno_id, deporte_id)
             VALUES ($1, $2)
             RETURNING id, fecha_inscripcion`,
            [alumno.id, deporte.id]
        );

        res.status(201).json({
            message: `Inscripción confirmada: ${alumno.nombre} en ${deporte.nombre}`,
            inscripcion: {
                id: insertada[0].id,
                alumno_id: alumno.id,
                deporte_id: deporte.id,
                deporte: deporte.nombre,
                horario: horarioATexto(deporte),
                fecha_inscripcion: insertada[0].fecha_inscripcion
            }
        });
    } catch (err) {
        // Incluye los errores 50006/50007/50008 del trigger (-> 409) si otra
        // inscripción simultánea ganó la carrera.
        manejarErrorPg(res, err);
    }
};

// GET /api/deportes
// Deportes activos con su horario y cupo. "horario" ya viene en texto legible.
exports.listar = async (req, res) => {
    try {
        const pool = await getPool();
        const { rows } = await pool.query(
            `SELECT ${COLUMNAS_DEPORTE}, d.cupo_maximo,
                    (SELECT COUNT(*) FROM inscripciones_deportes i WHERE i.deporte_id = d.id) AS inscriptos
             FROM deportes d WHERE d.activo = TRUE
             ORDER BY d.nombre, d.hora_inicio`
        );
        res.json(rows.map((d) => ({ ...d, horario: horarioATexto(d) })));
    } catch (err) {
        manejarErrorPg(res, err);
    }
};

// GET /api/deportes/mis-inscripciones
// Deportes a los que está inscripto el alumno del JWT (alumnos.usuario_id).
exports.misInscripciones = async (req, res) => {
    try {
        const pool = await getPool();
        const { rows } = await pool.query(
            `SELECT ${COLUMNAS_DEPORTE}, i.fecha_inscripcion
             FROM alumnos a
             JOIN inscripciones_deportes i ON i.alumno_id = a.id
             JOIN deportes d ON d.id = i.deporte_id
             WHERE a.usuario_id = $1
             ORDER BY d.nombre`,
            [req.user.id]
        );
        res.json(rows.map((d) => ({ ...d, horario: horarioATexto(d) })));
    } catch (err) {
        manejarErrorPg(res, err);
    }
};

// DELETE /api/deportes/desinscribir/:deporte_id
// Un alumno solo puede cancelar sus propias inscripciones.
exports.desinscribir = async (req, res) => {
    const deporteId = Number(req.params.deporte_id);
    if (!esIdValido(deporteId)) {
        return error(res, 400, 'DATOS_INVALIDOS', 'deporte_id debe ser un número entero positivo');
    }

    try {
        const pool = await getPool();
        const { rowCount } = await pool.query(
            `DELETE FROM inscripciones_deportes
             WHERE alumno_id = (SELECT id FROM alumnos WHERE usuario_id = $1)
               AND deporte_id = $2`,
            [req.user.id, deporteId]
        );

        if (!rowCount) {
            return error(res, 404, 'INSCRIPCION_NO_ENCONTRADA', 'No estás inscripto en ese deporte');
        }

        res.json({ message: 'Te diste de baja del deporte correctamente' });
    } catch (err) {
        manejarErrorPg(res, err);
    }
};
