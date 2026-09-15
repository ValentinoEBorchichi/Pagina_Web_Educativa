const { sql, getPool } = require('../config/db');
const { manejarErrorMssql } = require('../utils/dbErrors');

// Registro docente (Sprint 2: RF-05) sobre SQL Server.
// Dos operaciones, ambas reservadas al administrador:
//   1) Alta del legajo docente (tabla Profesores) a partir de una cuenta de
//      usuario con rol 'docente'. La FK compuesta (usuario_id, usuario_rol)
//      garantiza que la cuenta exista y tenga dicho rol.
//   2) Asignación del profesor a una materia y, opcionalmente, a un curso
//      (tabla Profesores_Materias). curso_id NULL habilita la materia sin curso.

const error = (res, status, codigo, message, extra = {}) =>
    res.status(status).json({ message, codigo, ...extra });

const esIdValido = (valor) => Number.isInteger(valor) && valor > 0;

const limpiarTexto = (valor) => String(valor || '').trim().replace(/\s+/g, ' ');

const esDuplicado = (err) => err.number === 2627 || err.number === 2601; // UNIQUE / índice único

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
        const { recordset } = await pool.request()
            .input('usuario', sql.Int, usuarioId)
            .input('dni', sql.VarChar(8), dni)
            .input('especialidad', sql.NVarChar(100), especialidad)
            .input('telefono', sql.VarChar(20), telefono)
            .query(`INSERT INTO Profesores (usuario_id, dni, especialidad, telefono)
                    OUTPUT INSERTED.id, INSERTED.fecha_alta
                    VALUES (@usuario, @dni, @especialidad, @telefono)`);

        res.status(201).json({
            message: 'Legajo docente creado con éxito',
            profesor: {
                id: recordset[0].id,
                usuario_id: usuarioId,
                dni,
                especialidad,
                telefono,
                fecha_alta: recordset[0].fecha_alta
            }
        });
    } catch (err) {
        if (esDuplicado(err)) {
            return error(res, 409, 'YA_EXISTE', 'Ya existe un profesor con ese usuario o DNI');
        }
        // La FK compuesta (usuario_id, 'docente') falla si la cuenta no existe
        // o no tiene rol docente.
        if (err.number === 547) {
            return error(res, 409, 'USUARIO_INVALIDO', 'El usuario no existe o no tiene rol docente');
        }
        manejarErrorMssql(res, err);
    }
};

// POST /api/profesores/asignar   body: { profesor_id, materia_id, curso_id? }
// Vincula un profesor a una materia y, opcionalmente, a un curso (RF-05).
exports.asignar = async (req, res) => {
    const profesorId = Number(req.body.profesor_id);
    if (!esIdValido(profesorId)) {
        return error(res, 400, 'DATOS_INVALIDOS', 'profesor_id es obligatorio y debe ser un número entero positivo');
    }

    const materiaId = Number(req.body.materia_id);
    if (!esIdValido(materiaId)) {
        return error(res, 400, 'DATOS_INVALIDOS', 'materia_id es obligatorio y debe ser un número entero positivo');
    }

    // curso_id es opcional: NULL habilita la materia sin curso asignado.
    const cursoBruto = req.body.curso_id;
    let cursoId = null;
    if (cursoBruto != null && cursoBruto !== '') {
        cursoId = Number(cursoBruto);
        if (!esIdValido(cursoId)) {
            return error(res, 400, 'DATOS_INVALIDOS', 'curso_id debe ser un número entero positivo');
        }
    }

    try {
        const pool = await getPool();
        const { recordset } = await pool.request()
            .input('profesor', sql.Int, profesorId)
            .input('materia', sql.Int, materiaId)
            .input('curso', sql.Int, cursoId)
            .query(`INSERT INTO Profesores_Materias (profesor_id, materia_id, curso_id)
                    OUTPUT INSERTED.id, INSERTED.fecha_asignacion
                    VALUES (@profesor, @materia, @curso)`);

        res.status(201).json({
            message: 'Asignación registrada con éxito',
            asignacion: {
                id: recordset[0].id,
                profesor_id: profesorId,
                materia_id: materiaId,
                curso_id: cursoId,
                fecha_asignacion: recordset[0].fecha_asignacion
            }
        });
    } catch (err) {
        // UNIQUE (profesor, materia, curso) o índice filtrado (materia, curso):
        // en cada curso, una materia la dicta un solo profesor.
        if (esDuplicado(err)) {
            return error(res, 409, 'YA_ASIGNADO',
                'La asignación ya existe o esa materia ya está asignada a otro profesor en ese curso');
        }
        if (err.number === 547) {
            return error(res, 409, 'RELACION_INEXISTENTE', 'El profesor, la materia o el curso indicado no existe');
        }
        manejarErrorMssql(res, err);
    }
};
