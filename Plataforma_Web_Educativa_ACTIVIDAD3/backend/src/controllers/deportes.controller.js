const { sql, getPool } = require('../config/db');
const { manejarErrorMssql } = require('../utils/dbErrors');

// Inscripción de alumnos a deportes (Sprint 1: RF-06 y RF-07) sobre SQL Server.
// Las reglas se validan acá para responder con mensajes claros; el trigger
// trg_Inscripciones_Deportes_Reglas vuelve a validarlas al insertar, lo que
// cubre dos inscripciones simultáneas del mismo alumno.

const MAX_DEPORTES_POR_ALUMNO = 2; // RF-06

// Deportes.dias_semana es una máscara de bits (ver database_schema.sql).
const DIAS = [[1, 'Lun'], [2, 'Mar'], [4, 'Mié'], [8, 'Jue'], [16, 'Vie'], [32, 'Sáb'], [64, 'Dom']];
const diasATexto = (mascara) => DIAS.filter(([bit]) => mascara & bit).map(([, dia]) => dia).join(' y ');
const horarioATexto = (d) => `${diasATexto(d.dias_semana)} ${d.hora_inicio} a ${d.hora_fin}`;

// Dos deportes se superponen si comparten algún día y sus rangos horarios se pisan
// (las horas llegan como 'HH:MM', que se comparan bien como texto).
const seSuperponen = (a, b) =>
    (a.dias_semana & b.dias_semana) !== 0 && a.hora_inicio < b.hora_fin && b.hora_inicio < a.hora_fin;

const COLUMNAS_DEPORTE = `d.id, d.nombre, d.dias_semana,
    CONVERT(char(5), d.hora_inicio, 108) AS hora_inicio,
    CONVERT(char(5), d.hora_fin, 108) AS hora_fin`;

const error = (res, status, codigo, message, extra = {}) =>
    res.status(status).json({ message, codigo, ...extra });

const esIdValido = (valor) => Number.isInteger(valor) && valor > 0;

// Devuelve el legajo sobre el que se inscribe, o responde el error y devuelve null.
// - alumno: solo puede inscribirse a sí mismo (su cuenta está en Alumnos.usuario_id).
// - padre:  solo a sus hijos (RF-02).
// - admin:  a cualquier alumno.
async function resolverAlumno(pool, req, res) {
    const { id: usuarioId, rol } = req.user;
    const pedido = req.body.alumno_id;

    if (rol === 'alumno') {
        const { recordset } = await pool.request()
            .input('usuario', sql.Int, usuarioId)
            .query('SELECT id, nombre, padre_id FROM Alumnos WHERE usuario_id = @usuario');
        const alumno = recordset[0];
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
    const { recordset } = await pool.request()
        .input('id', sql.Int, alumnoId)
        .query('SELECT id, nombre, padre_id FROM Alumnos WHERE id = @id');
    const alumno = recordset[0];
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

        const { recordset: deportes } = await pool.request()
            .input('id', sql.Int, deporteId)
            .query(`SELECT ${COLUMNAS_DEPORTE}, d.cupo_maximo, d.activo,
                           (SELECT COUNT(*) FROM Inscripciones_Deportes i WHERE i.deporte_id = d.id) AS inscriptos
                    FROM Deportes d WHERE d.id = @id`);
        const deporte = deportes[0];
        if (!deporte) {
            return error(res, 404, 'DEPORTE_NO_ENCONTRADO', 'El deporte no existe');
        }
        if (!deporte.activo) {
            return error(res, 409, 'DEPORTE_INACTIVO', `${deporte.nombre} no está disponible para inscripciones`);
        }

        const { recordset: actuales } = await pool.request()
            .input('alumno', sql.Int, alumno.id)
            .query(`SELECT ${COLUMNAS_DEPORTE}
                    FROM Inscripciones_Deportes i JOIN Deportes d ON d.id = i.deporte_id
                    WHERE i.alumno_id = @alumno`);

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

        // La tabla tiene un trigger, y SQL Server no admite OUTPUT sin INTO en
        // ese caso (error 334): los datos insertados pasan por @nueva.
        const { recordset: insertada } = await pool.request()
            .input('alumno', sql.Int, alumno.id)
            .input('deporte', sql.Int, deporte.id)
            .query(`DECLARE @nueva TABLE (id INT, fecha_inscripcion DATETIME2(0));
                    INSERT INTO Inscripciones_Deportes (alumno_id, deporte_id)
                    OUTPUT INSERTED.id, INSERTED.fecha_inscripcion INTO @nueva
                    VALUES (@alumno, @deporte);
                    SELECT id, fecha_inscripcion FROM @nueva;`);

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
        manejarErrorMssql(res, err);
    }
};
