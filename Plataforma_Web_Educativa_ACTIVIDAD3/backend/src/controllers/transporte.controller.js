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

// Devuelve el alumno sobre el que se opera, o responde el error y devuelve null.
// - alumno: solo puede operar sobre sí mismo (su cuenta está en alumnos.usuario_id).
// - padre:  solo sobre sus hijos (RF-02).
// - admin:  sobre cualquier alumno.
// `pedido` es el alumno_id que mandó el cliente (en el body al inscribir, en el
// query al dar de baja); `baja` solo cambia el texto de los mensajes de error.
async function resolverAlumno(pool, req, res, { pedido = req.body.alumno_id, baja = false } = {}) {
    const { id: usuarioId, rol } = req.user;

    if (rol === 'alumno') {
        const { rows } = await pool.query('SELECT id, nombre FROM alumnos WHERE usuario_id = $1', [usuarioId]);
        const alumno = rows[0];
        if (!alumno) {
            error(res, 403, 'SIN_LEGAJO', 'Tu cuenta no está vinculada a un legajo de alumno');
            return null;
        }
        if (pedido != null && pedido !== '' && Number(pedido) !== alumno.id) {
            error(res, 403, 'SIN_PERMISO', baja ? 'Solo podés darte de baja a vos mismo' : 'Solo podés inscribirte a vos mismo');
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
        error(res, 403, 'SIN_PERMISO', baja ? 'Solo podés dar de baja a tus hijos' : 'Solo podés inscribir a tus hijos');
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

// DELETE /api/transporte/desinscribir?alumno_id=
// Da de baja al alumno del transporte escolar (alumnos.transporte_id = NULL).
// - alumno: solo la suya (alumno_id es opcional; si viene, tiene que ser el suyo).
// - padre:  solo la de sus hijos (alumno_id obligatorio).
// - admin:  la de cualquier alumno (alumno_id obligatorio).
// Es una baja, no un cambio de recorrido: para cambiar se vuelve a inscribir.
exports.desinscribir = async (req, res) => {
    try {
        const pool = await getPool();

        const alumno = await resolverAlumno(pool, req, res, { pedido: req.query.alumno_id, baja: true });
        if (!alumno) return;

        // El join con transportes (la fila que se está dejando) permite
        // informar de qué recorrido se dio de baja; si el alumno no viajaba
        // no matchea nada y no se toca nada.
        const { rows } = await pool.query(
            `UPDATE alumnos a
             SET transporte_id = NULL
             FROM transportes t
             WHERE a.id = $1 AND a.transporte_id = t.id
             RETURNING t.id AS transporte_id, t.numero_recorrido, t.nombre AS recorrido`,
            [alumno.id]
        );

        if (!rows.length) {
            return error(res, 404, 'SIN_TRANSPORTE', `${alumno.nombre} no está inscripto en ningún recorrido de transporte`);
        }

        res.json({
            message: `Baja del transporte confirmada: ${alumno.nombre} ya no viaja en ${rows[0].recorrido}`,
            baja: { alumno_id: alumno.id, ...rows[0] }
        });
    } catch (err) {
        manejarErrorPg(res, err);
    }
};
