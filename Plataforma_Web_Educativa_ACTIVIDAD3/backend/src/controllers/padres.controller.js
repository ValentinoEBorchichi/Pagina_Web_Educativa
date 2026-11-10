const { getPool } = require('../config/db');
const { manejarErrorPg } = require('../utils/dbErrors');

// Vista de padres (Sprint 2: RF-02) sobre Postgres.
// Un padre solo puede ver a sus propios hijos: el id del padre se toma del
// token JWT (req.user.id, que es el usuarios.id con rol 'padre') y NUNCA del
// cliente, de modo que la consulta queda filtrada por alumnos.padre_id y no
// existe forma de solicitar los hijos de otro padre.

// GET /api/padres/mis-hijos
// Devuelve el listado de alumnos vinculados al padre autenticado, con su curso
// y el recorrido de transporte (si utiliza el servicio).
exports.misHijos = async (req, res) => {
    try {
        const pool = await getPool();
        const { rows } = await pool.query(
            `SELECT a.id, a.dni, a.nombre, a.apellido,
                    to_char(a.fecha_nacimiento, 'YYYY-MM-DD') AS fecha_nacimiento,
                    a.usa_comedor,
                    c.id AS curso_id, n.nombre AS nivel, c.grado, c.division, c.turno, c.ciclo_lectivo,
                    t.id AS transporte_id, t.numero_recorrido, t.nombre AS transporte_nombre
             FROM alumnos a
             JOIN cursos c ON c.id = a.curso_id
             LEFT JOIN niveles n ON n.id = c.nivel_id
             LEFT JOIN transportes t ON t.id = a.transporte_id
             WHERE a.padre_id = $1
             ORDER BY a.apellido, a.nombre`,
            [req.user.id]
        );

        const hijos = rows.map((a) => ({
            id: a.id,
            dni: a.dni,
            nombre: a.nombre,
            apellido: a.apellido,
            fecha_nacimiento: a.fecha_nacimiento,
            usa_comedor: !!a.usa_comedor,
            curso: {
                id: a.curso_id,
                nivel: a.nivel,
                grado: a.grado,
                division: a.division,
                turno: a.turno,
                ciclo_lectivo: a.ciclo_lectivo
            },
            transporte: a.transporte_id
                ? { id: a.transporte_id, numero_recorrido: a.numero_recorrido, nombre: a.transporte_nombre }
                : null
        }));

        res.json({ total: hijos.length, hijos });
    } catch (err) {
        manejarErrorPg(res, err);
    }
};
