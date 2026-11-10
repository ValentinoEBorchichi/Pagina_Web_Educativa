const { getPool } = require('../config/db');
const { manejarErrorPg } = require('../utils/dbErrors');

// Registro docente (Sprint 2: RF-05) sobre Postgres.
//   1) Alta del legajo docente (tabla profesores) a partir de una cuenta de
//      usuario con rol 'docente'. La FK compuesta (usuario_id, usuario_rol)
//      garantiza que la cuenta exista y tenga dicho rol.
//   2) Asignación de profesor a materia/curso: la tabla profesores_materias
//      de SQL Server NO se migró (quedaba redundante con horarios.docente_id
//      del módulo académico unificado, ver supabase/schema.sql). Este
//      endpoint queda desactivado a propósito -ver exports.asignar-.

const error = (res, status, codigo, message, extra = {}) =>
    res.status(status).json({ message, codigo, ...extra });

const esIdValido = (valor) => Number.isInteger(valor) && valor > 0;

const limpiarTexto = (valor) => String(valor || '').trim().replace(/\s+/g, ' ');

const esDuplicado = (err) => err.code === '23505'; // unique_violation

// POST /api/profesores   body: { usuario_id, dni, especialidad?, telefono? }
// Da de alta el legajo docente de una cuenta con rol 'docente'.
exports.crear = async (req, res) => {
    const usuarioId = Number(req.body.usuario_id);
    if (!esIdValido(usuarioId)) {
        return error(res, 400, 'DATOS_INVALIDOS', 'usuario_id es obligatorio y debe ser un número entero positivo');
    }

    const dni = String(req.body.dni || '').trim();
    if (!/^\d{7,8}$/.test(dni)) {
        return error(res, 400, 'DATOS_INVALIDOS', 'El DNI es obligatorio y debe tener 7 u 8 dígitos numéricos');
    }

    const especialidad = limpiarTexto(req.body.especialidad) || null;
    const telefono = limpiarTexto(req.body.telefono) || null;

    try {
        const pool = await getPool();
        const { rows } = await pool.query(
            `INSERT INTO profesores (usuario_id, dni, especialidad, telefono)
             VALUES ($1, $2, $3, $4) RETURNING id, fecha_alta`,
            [usuarioId, dni, especialidad, telefono]
        );

        res.status(201).json({
            message: 'Legajo docente creado con éxito',
            profesor: {
                id: rows[0].id,
                usuario_id: usuarioId,
                dni,
                especialidad,
                telefono,
                fecha_alta: rows[0].fecha_alta
            }
        });
    } catch (err) {
        if (esDuplicado(err)) {
            return error(res, 409, 'YA_EXISTE', 'Ya existe un profesor con ese usuario o DNI');
        }
        // La FK compuesta (usuario_id, 'docente') falla si la cuenta no existe
        // o no tiene rol docente.
        if (err.code === '23503') {
            return error(res, 409, 'USUARIO_INVALIDO', 'El usuario no existe o no tiene rol docente');
        }
        manejarErrorPg(res, err);
    }
};

// POST /api/profesores/asignar   body: { profesor_id, materia_id, curso_id? }
// Retirado en la migración a Postgres: la tabla profesores_materias no se
// migró (ver nota arriba). La asignación de un docente a una materia/curso
// ahora se hace desde el módulo de horarios (horarios.docente_id/materia_id),
// no desde este endpoint.
exports.asignar = async (_req, res) => {
    return error(res, 410, 'FUNCION_RETIRADA',
        'Esta función se retiró al migrar a Postgres: asigná al docente desde el módulo de horarios.');
};
