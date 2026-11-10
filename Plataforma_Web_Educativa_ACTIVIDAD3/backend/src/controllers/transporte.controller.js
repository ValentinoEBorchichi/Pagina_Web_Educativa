const { getPool } = require('../config/db');
const { manejarErrorPg } = require('../utils/dbErrors');

// Logística de transporte escolar (Sprint 2: RF-09) sobre Postgres.
// La inscripción asocia a un alumno con uno de los 4 recorridos habilitados
// (transportes.numero_recorrido del 1 al 4) guardando alumnos.transporte_id.
// La restricción CHECK del esquema es la última línea de defensa; acá se valida
// el recorrido de antemano para responder con un mensaje claro (HTTP 400).

const RECORRIDOS_PERMITIDOS = [1, 2, 3, 4]; // RF-09: selección obligatoria entre 4

const error = (res, status, codigo, message, extra = {}) =>
    res.status(status).json({ message, codigo, ...extra });

// GET /api/transporte — catálogo de los 4 recorridos fijos (para selectores,
// p. ej. el alta de tarifas del admin).
exports.listar = async (req, res) => {
    try {
        const pool = await getPool();
        const { rows } = await pool.query(
            `SELECT id, numero_recorrido, nombre, zona, capacidad,
                    (SELECT COUNT(*) FROM alumnos a WHERE a.transporte_id = t.id) AS inscriptos
             FROM transportes t ORDER BY numero_recorrido`
        );
        res.json(rows);
    } catch (err) {
        manejarErrorPg(res, err);
    }
};

const esIdValido = (valor) => Number.isInteger(valor) && valor > 0;

// Devuelve el alumno sobre el que se inscribe, o responde el error y devuelve null.
// - alumno: solo puede inscribirse a sí mismo (su cuenta está en alumnos.usuario_id).
// - padre:  solo a sus hijos (RF-02).
// - admin:  a cualquier alumno.
async function resolverAlumno(pool, req, res) {
    const { id: usuarioId, rol } = req.user;
    const pedido = req.body.alumno_id;

    if (rol === 'alumno') {
        const { rows } = await pool.query('SELECT id, nombre FROM alumnos WHERE usuario_id = $1', [usuarioId]);
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

// POST /api/transporte/inscribir   body: { alumno_id, numero_recorrido }
// (con rol alumno, alumno_id es opcional: se usa su propio legajo)
exports.inscribir = async (req, res) => {
    // RF-09: el recorrido debe ser exactamente uno de los 4 permitidos.
    const numeroRecorrido = Number(req.body.numero_recorrido);
    if (!RECORRIDOS_PERMITIDOS.includes(numeroRecorrido)) {
        return error(res, 400, 'RECORRIDO_INVALIDO',
            `El recorrido es obligatorio y debe ser uno de los permitidos (${RECORRIDOS_PERMITIDOS.join(', ')})`,
            { recorridos_permitidos: RECORRIDOS_PERMITIDOS });
    }

    try {
        const pool = await getPool();

        const alumno = await resolverAlumno(pool, req, res);
        if (!alumno) return;

        const { rows: transportes } = await pool.query(
            `SELECT id, numero_recorrido, nombre, capacidad,
                    (SELECT COUNT(*) FROM alumnos a WHERE a.transporte_id = t.id) AS inscriptos
             FROM transportes t WHERE t.numero_recorrido = $1`,
            [numeroRecorrido]
        );
        const transporte = transportes[0];
        if (!transporte) {
            return error(res, 404, 'RECORRIDO_NO_ENCONTRADO', `El recorrido ${numeroRecorrido} no está disponible`);
        }

        // Idempotencia: si ya viaja en ese recorrido no se reserva un cupo extra.
        const { rows: actuales } = await pool.query('SELECT transporte_id FROM alumnos WHERE id = $1', [alumno.id]);
        if (actuales[0].transporte_id === transporte.id) {
            return error(res, 409, 'YA_INSCRIPTO', `${alumno.nombre} ya viaja en ${transporte.nombre}`);
        }

        if (transporte.inscriptos >= transporte.capacidad) {
            return error(res, 409, 'SIN_CUPO', `${transporte.nombre} no tiene cupo disponible`);
        }

        await pool.query('UPDATE alumnos SET transporte_id = $1 WHERE id = $2', [transporte.id, alumno.id]);

        res.status(201).json({
            message: `Inscripción al transporte confirmada: ${alumno.nombre} en ${transporte.nombre}`,
            inscripcion: {
                alumno_id: alumno.id,
                transporte_id: transporte.id,
                numero_recorrido: transporte.numero_recorrido,
                recorrido: transporte.nombre
            }
        });
    } catch (err) {
        manejarErrorPg(res, err);
    }
};
