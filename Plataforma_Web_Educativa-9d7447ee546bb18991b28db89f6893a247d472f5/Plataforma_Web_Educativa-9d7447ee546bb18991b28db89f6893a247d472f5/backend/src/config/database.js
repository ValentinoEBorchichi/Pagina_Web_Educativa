const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const dbPath = path.resolve(__dirname, '../../', process.env.DATABASE_PATH || './database/database.sqlite');

// Asegurar que la carpeta database existe
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error al conectar con SQLite:', err.message);
    } else {
        console.log('Conectado a la base de datos SQLite.');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.serialize(() => {
        // Tabla de Usuarios
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            nombre TEXT NOT NULL,
            rol TEXT CHECK( rol IN ('admin', 'docente', 'alumno', 'padre') ) NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Tabla de Preinscripciones
        db.run(`CREATE TABLE IF NOT EXISTS preinscripciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            alumno_nombre TEXT NOT NULL,
            alumno_dni TEXT,
            alumno_edad INTEGER NOT NULL,
            nivel TEXT NOT NULL,
            turno TEXT NOT NULL,
            tutor_nombre TEXT NOT NULL,
            tutor_telefono TEXT NOT NULL,
            tutor_email TEXT NOT NULL,
            observaciones TEXT,
            estado TEXT DEFAULT 'pendiente',
            fecha DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // --- FASE 2: Núcleo Académico ---

        // Niveles Educativos
        db.run(`CREATE TABLE IF NOT EXISTS niveles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE -- Inicial, Primario, Secundario
        )`);

        // Aulas
        db.run(`CREATE TABLE IF NOT EXISTS aulas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE, -- Aula 101, Laboratorio, etc.
            capacidad INTEGER NOT NULL
        )`);

        // Cursos (Nivel + División)
        db.run(`CREATE TABLE IF NOT EXISTS cursos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nivel_id INTEGER,
            division TEXT NOT NULL, -- A, B, C
            cupo INTEGER NOT NULL,
            FOREIGN KEY(nivel_id) REFERENCES niveles(id)
        )`);

        // Alumnos (Legajos)
        db.run(`CREATE TABLE IF NOT EXISTS alumnos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            apellido TEXT NOT NULL,
            dni TEXT UNIQUE NOT NULL,
            fecha_nacimiento DATE NOT NULL,
            curso_id INTEGER,
            tutor_id INTEGER, -- Relación con la tabla users (rol padre)
            FOREIGN KEY(curso_id) REFERENCES cursos(id),
            FOREIGN KEY(tutor_id) REFERENCES users(id)
        )`);

        // Docentes
        db.run(`CREATE TABLE IF NOT EXISTS docentes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE,
            especialidad TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);

        // Materias
        db.run(`CREATE TABLE IF NOT EXISTS materias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            curso_id INTEGER,
            FOREIGN KEY(curso_id) REFERENCES cursos(id)
        )`);

        // Horarios (Asignación Docente + Materia + Aula + Horario)
        db.run(`CREATE TABLE IF NOT EXISTS horarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            materia_id INTEGER,
            docente_id INTEGER,
            aula_id INTEGER,
            dia_semana INTEGER, -- 1-5 (Lunes-Viernes)
            hora_inicio TEXT, -- HH:MM
            hora_fin TEXT,
            FOREIGN KEY(materia_id) REFERENCES materias(id),
            FOREIGN KEY(docente_id) REFERENCES docentes(id),
            FOREIGN KEY(aula_id) REFERENCES aulas(id)
        )`);

        // Asistencias
        db.run(`CREATE TABLE IF NOT EXISTS asistencias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            alumno_id INTEGER,
            fecha DATE DEFAULT CURRENT_DATE,
            estado TEXT CHECK( estado IN ('Presente', 'Ausente', 'Tarde') ),
            FOREIGN KEY(alumno_id) REFERENCES alumnos(id)
        )`);

        // Calificaciones
        db.run(`CREATE TABLE IF NOT EXISTS calificaciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            alumno_id INTEGER,
            materia_id INTEGER,
            nota INTEGER CHECK( nota >= 1 AND nota <= 10 ),
            trimestre INTEGER,
            FOREIGN KEY(alumno_id) REFERENCES alumnos(id),
            FOREIGN KEY(materia_id) REFERENCES materias(id)
        )`);

        // --- FASE 3: Gestión Administrativa y Financiera ---

        // Personal (Docente y No Docente)
        db.run(`CREATE TABLE IF NOT EXISTS personal (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            apellido TEXT NOT NULL,
            dni TEXT UNIQUE NOT NULL,
            tipo TEXT CHECK( tipo IN ('Docente', 'Administrativo', 'Maestranza', 'Directivo') ),
            email TEXT,
            fecha_alta DATE DEFAULT CURRENT_DATE
        )`);

        // Configuración de Cuotas
        db.run(`CREATE TABLE IF NOT EXISTS cuotas_config (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nivel_id INTEGER,
            monto DECIMAL(10,2) NOT NULL,
            mes INTEGER, -- 1-12
            anio INTEGER,
            vencimiento DATE,
            FOREIGN KEY(nivel_id) REFERENCES niveles(id)
        )`);

        // Pagos de Cuotas
        db.run(`CREATE TABLE IF NOT EXISTS pagos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            alumno_id INTEGER,
            cuota_id INTEGER,
            monto_pagado DECIMAL(10,2) NOT NULL,
            fecha_pago DATETIME DEFAULT CURRENT_TIMESTAMP,
            metodo_pago TEXT,
            comprobante_url TEXT,
            FOREIGN KEY(alumno_id) REFERENCES alumnos(id),
            FOREIGN KEY(cuota_id) REFERENCES cuotas_config(id)
        )`);

        // Estado de Cuenta (Saldos)
        db.run(`CREATE TABLE IF NOT EXISTS saldos_alumnos (
            alumno_id INTEGER PRIMARY KEY,
            saldo_pendiente DECIMAL(10,2) DEFAULT 0,
            ultima_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(alumno_id) REFERENCES alumnos(id)
        )`);

        // --- FASE 4: Servicios Institucionales ---

        // Comedor (Asistencia Diaria)
        db.run(`CREATE TABLE IF NOT EXISTS comedor_asistencias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            alumno_id INTEGER,
            fecha DATE DEFAULT CURRENT_DATE,
            consumio_menu BOOLEAN DEFAULT 1,
            observaciones TEXT,
            FOREIGN KEY(alumno_id) REFERENCES alumnos(id)
        )`);

        // Transporte (Rutas y Asignaciones)
        db.run(`CREATE TABLE IF NOT EXISTS transporte_rutas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre_ruta TEXT NOT NULL, -- Ruta Norte, Ruta Sur, etc.
            chofer_nombre TEXT,
            capacidad_max INTEGER
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS transporte_asignaciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            alumno_id INTEGER,
            ruta_id INTEGER,
            punto_encuentro TEXT,
            FOREIGN KEY(alumno_id) REFERENCES alumnos(id),
            FOREIGN KEY(ruta_id) REFERENCES transporte_rutas(id)
        )`);

        // Instalaciones (Reservas)
        db.run(`CREATE TABLE IF NOT EXISTS instalaciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL, -- Pileta, Gimnasio, Laboratorio
            descripcion TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS instalaciones_reservas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            instalacion_id INTEGER,
            fecha DATE NOT NULL,
            hora_inicio TIME NOT NULL,
            hora_fin TIME NOT NULL,
            reservado_por INTEGER, -- user_id
            motivo TEXT,
            FOREIGN KEY(instalacion_id) REFERENCES instalaciones(id),
            FOREIGN KEY(reservado_por) REFERENCES users(id)
        )`);

        // Enfermería (Incidencias Médicas)
        db.run(`CREATE TABLE IF NOT EXISTS enfermeria_incidencias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            alumno_id INTEGER,
            descripcion TEXT NOT NULL CHECK( length(descripcion) >= 10 ),
            accion_tomada TEXT,
            notificado_padre BOOLEAN DEFAULT 0,
            fecha_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(alumno_id) REFERENCES alumnos(id)
        )`);

        // --- FASE 5: Extracurriculares, Comunicación y Reportes ---

        // Actividades Extra (Idiomas, Deportes, Cultura)
        db.run(`CREATE TABLE IF NOT EXISTS actividades_extra (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            tipo TEXT CHECK( tipo IN ('Deporte', 'Cultura', 'Idioma') ),
            horario TEXT,
            cupo_max INTEGER
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS inscripciones_extra (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            alumno_id INTEGER,
            actividad_id INTEGER,
            fecha_inscripcion DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(alumno_id) REFERENCES alumnos(id),
            FOREIGN KEY(actividad_id) REFERENCES actividades_extra(id)
        )`);

        // Notificaciones e Institucionales
        db.run(`CREATE TABLE IF NOT EXISTS notificaciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            titulo TEXT NOT NULL,
            mensaje TEXT NOT NULL,
            rol_destino TEXT, -- 'padre', 'docente', 'alumno', 'all'
            leido BOOLEAN DEFAULT 0,
            fecha_envio DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Asistencia a actividades extracurriculares (profesores de actividades/idiomas)
        db.run(`CREATE TABLE IF NOT EXISTS actividad_asistencias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            actividad_id INTEGER,
            alumno_id INTEGER,
            fecha DATE DEFAULT CURRENT_DATE,
            estado TEXT CHECK( estado IN ('Presente', 'Ausente', 'Tarde') ),
            FOREIGN KEY(actividad_id) REFERENCES actividades_extra(id),
            FOREIGN KEY(alumno_id) REFERENCES alumnos(id)
        )`);

        // Calificaciones de actividades extracurriculares (1 a 10)
        db.run(`CREATE TABLE IF NOT EXISTS actividad_calificaciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            actividad_id INTEGER,
            alumno_id INTEGER,
            nota INTEGER CHECK( nota >= 1 AND nota <= 10 ),
            fecha DATE DEFAULT CURRENT_DATE,
            FOREIGN KEY(actividad_id) REFERENCES actividades_extra(id),
            FOREIGN KEY(alumno_id) REFERENCES alumnos(id)
        )`);
    });
}

module.exports = db;
