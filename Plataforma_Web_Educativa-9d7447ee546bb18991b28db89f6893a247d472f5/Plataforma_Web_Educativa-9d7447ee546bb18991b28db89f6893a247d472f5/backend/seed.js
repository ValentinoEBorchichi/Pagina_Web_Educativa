const bcrypt = require('bcryptjs');
const db = require('./src/config/database');

async function seed() {
    const salt = await bcrypt.genSalt(10);
    const users = [
        ['admin', await bcrypt.hash('admin123', salt), 'Administrador', 'admin'],
        ['docente', await bcrypt.hash('docente123', salt), 'Juan Docente', 'docente'],
        ['alumno', await bcrypt.hash('alumno123', salt), 'Pepe Alumno', 'alumno'],
        ['padre', await bcrypt.hash('padre123', salt), 'Carlos Padre', 'padre']
    ];

    db.serialize(() => {
        const stmt = db.prepare(`INSERT OR IGNORE INTO users (username, password, nombre, rol) VALUES (?, ?, ?, ?)`);
        users.forEach(user => {
            stmt.run(user);
        });
        stmt.finalize();
        console.log('Usuarios de prueba creados.');

        // Niveles
        const niveles = [['Inicial'], ['Primario'], ['Secundario']];
        const stmtNiv = db.prepare(`INSERT OR IGNORE INTO niveles (nombre) VALUES (?)`);
        niveles.forEach(n => stmtNiv.run(n));
        stmtNiv.finalize();

        // Aulas
        const aulas = [['Aula 101', 30], ['Aula 102', 30], ['Laboratorio de Ciencias', 20]];
        const stmtAul = db.prepare(`INSERT OR IGNORE INTO aulas (nombre, capacidad) VALUES (?, ?)`);
        aulas.forEach(a => stmtAul.run(a));
        stmtAul.finalize();

        // Instalaciones agendables (pileta, gimnasio, laboratorios).
        // Se siembran solo si la tabla está vacía para no duplicar en re-ejecuciones.
        db.get("SELECT COUNT(*) as count FROM instalaciones", (err, row) => {
            if (!err && row && row.count === 0) {
                const instalaciones = [
                    ['Pileta', 'Pileta climatizada para clases de natación'],
                    ['Gimnasio', 'Gimnasio cubierto para educación física y deportes'],
                    ['Laboratorio de Ciencias', 'Laboratorio equipado para física, química y biología'],
                    ['Laboratorio de Informática', 'Sala de computación con equipamiento actualizado']
                ];
                const stmtInst = db.prepare(`INSERT INTO instalaciones (nombre, descripcion) VALUES (?, ?)`);
                instalaciones.forEach(i => stmtInst.run(i));
                stmtInst.finalize();
                console.log('Instalaciones iniciales creadas.');
            }
        });

        // Datos de prueba (legajos, cursos, materias, cuotas, etc.).
        // Solo se cargan si todavía no hay alumnos, para no duplicar al re-ejecutar.
        db.get("SELECT COUNT(*) as count FROM alumnos", (err, row) => {
            if (!err && row && row.count === 0) {
                seedDatosPrueba();
            }
        });

        console.log('Datos académicos iniciales creados.');
    });
}

// Carga un set chico de datos de ejemplo para poder probar el sistema de inmediato.
function seedDatosPrueba() {
    // Personal docente y no docente
    const personal = [
        ['María', 'González', '20111222', 'Docente', 'mgonzalez@educar.edu.ar'],
        ['Jorge', 'Pérez', '20333444', 'Docente', 'jperez@educar.edu.ar'],
        ['Laura', 'Méndez', '20555666', 'Administrativo', 'lmendez@educar.edu.ar']
    ];
    const stmtP = db.prepare(`INSERT OR IGNORE INTO personal (nombre, apellido, dni, tipo, email) VALUES (?, ?, ?, ?, ?)`);
    personal.forEach(p => stmtP.run(p));
    stmtP.finalize();

    db.all("SELECT id, nombre FROM niveles", (err, niveles) => {
        if (err || !niveles) return;
        const nivelId = (n) => (niveles.find(x => x.nombre === n) || {}).id;

        const crearCurso = (nivel, division, cupo, materias, alumnos) => {
            db.run("INSERT INTO cursos (nivel_id, division, cupo) VALUES (?, ?, ?)", [nivelId(nivel), division, cupo], function() {
                const curso_id = this.lastID;
                const stmtM = db.prepare(`INSERT INTO materias (nombre, curso_id) VALUES (?, ?)`);
                materias.forEach(m => stmtM.run([m, curso_id]));
                stmtM.finalize();
                const stmtA = db.prepare(`INSERT OR IGNORE INTO alumnos (nombre, apellido, dni, fecha_nacimiento, curso_id) VALUES (?, ?, ?, ?, ?)`);
                alumnos.forEach(a => stmtA.run([a[0], a[1], a[2], a[3], curso_id]));
                stmtA.finalize();
            });
        };

        crearCurso('Primario', 'A', 25, ['Matemática', 'Lengua', 'Ciencias Naturales'], [
            ['Lucía', 'Fernández', '45111222', '2015-03-10'],
            ['Mateo', 'Ramírez', '45333444', '2015-07-22']
        ]);
        crearCurso('Secundario', 'A', 30, ['Historia', 'Biología', 'Matemática'], [
            ['Sofía', 'Torres', '44555666', '2010-01-15'],
            ['Benjamín', 'Díaz', '44777888', '2010-09-05']
        ]);

        // Configuración de cuotas por nivel
        const stmtC = db.prepare(`INSERT INTO cuotas_config (nivel_id, monto, mes, anio, vencimiento) VALUES (?, ?, ?, ?, ?)`);
        stmtC.run([nivelId('Primario'), 15000, 3, 2026, '2026-03-10']);
        stmtC.run([nivelId('Secundario'), 18000, 3, 2026, '2026-03-10']);
        stmtC.finalize();
    });

    // Actividades extracurriculares
    const stmtAct = db.prepare(`INSERT INTO actividades_extra (nombre, tipo, horario, cupo_max) VALUES (?, ?, ?, ?)`);
    stmtAct.run(['Fútbol', 'Deporte', 'Lun y Mié 16hs', 20]);
    stmtAct.run(['Inglés', 'Idioma', 'Mar y Jue 17hs', 15]);
    stmtAct.run(['Teatro', 'Cultura', 'Vie 15hs', 12]);
    stmtAct.finalize();

    // Ruta de transporte
    db.run("INSERT INTO transporte_rutas (nombre_ruta, chofer_nombre, capacidad_max) VALUES (?, ?, ?)", ['Ruta Centro', 'Carlos Suárez', 18]);

    // Preinscripción de ejemplo (pendiente)
    db.run(
        `INSERT INTO preinscripciones (alumno_nombre, alumno_dni, alumno_edad, nivel, turno, tutor_nombre, tutor_telefono, tutor_email, observaciones)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['Valentina Ruiz', '46999000', 6, 'Primario', 'Mañana', 'Marcela Ruiz', '3624111222', 'mruiz@mail.com', 'Hermana de alumno actual']
    );

    console.log('Datos de prueba creados.');
}

// Exportamos seed para poder llamarlo desde el arranque del servidor (index.js)
// sin disparar la siembra solo por importar el módulo.
module.exports = seed;

// Si se ejecuta directamente (`node seed.js`), sembrar.
// Esperar a que la DB se inicialice (config/database.js lo hace al importar).
if (require.main === module) {
    setTimeout(seed, 1000);
}
