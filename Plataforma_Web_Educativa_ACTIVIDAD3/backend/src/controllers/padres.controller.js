const { sql, getPool } = require('../config/db');
const { manejarErrorMssql } = require('../utils/dbErrors');

// Vista de padres (Sprint 2: RF-02) sobre SQL Server.
// Un padre solo puede ver a sus propios hijos: el id del padre se toma del
// token JWT (req.user.id, que es el Usuarios.id con rol 'padre') y NUNCA del
// cliente, de modo que la consulta queda filtrada por Alumnos.padre_id y no
// existe forma de solicitar los hijos de otro padre.

// GET /api/padres/mis-hijos
// Devuelve el listado de alumnos vinculados al padre autenticado, con su curso
// y el recorrido de transporte (si utiliza el servicio).
exports.misHijos = async (req, res) => {
    try {
        const pool = await getPool();
        const { recordset } = await pool.request()
            .input('padre', sql.Int, req.user.id)
            .query(`SELECT a.id, a.dni, a.nombre, a.apellido,
                           CONVERT(char(10), a.fecha_nacimiento, 23) AS fecha_nacimiento,
                           a.usa_comedor,
                           c.id AS curso_id, c.nivel, c.grado, c.division, c.turno, c.ciclo_lectivo,
                           t.id AS transporte_id, t.numero_recorrido, t.nombre AS transporte_nombre
                    FROM Alumnos a
                    JOIN Cursos c ON c.id = a.curso_id
                    LEFT JOIN Transportes t ON t.id = a.transporte_id
                    WHERE a.padre_id = @padre
                    ORDER BY a.apellido, a.nombre`);

        const hijos = recordset.map((a) => ({
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
        manejarErrorMssql(res, err);
    }
};
