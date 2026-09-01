const express = require('express');
const router = express.Router();
// Antes había un solo academicoController con las 8 entidades mezcladas.
// Ahora cada controlador agrupa una parte del dominio académico.
const academicoController = require('../controllers/academico.controller');
const alumnosController = require('../controllers/alumnos.controller');
const actividadesController = require('../controllers/actividades.controller');
const horariosController = require('../controllers/horarios.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// Rutas protegidas por rol (Admin y Docente)
router.get('/niveles', academicoController.getNiveles);
router.post('/niveles', authMiddleware(['admin']), academicoController.createNivel);
router.put('/niveles/:id', authMiddleware(['admin']), academicoController.updateNivel);
router.delete('/niveles/:id', authMiddleware(['admin']), academicoController.deleteNivel);
router.get('/aulas', academicoController.getAulas);
router.post('/aulas', authMiddleware(['admin']), academicoController.createAula);
router.delete('/aulas/:id', authMiddleware(['admin']), academicoController.deleteAula);

router.get('/cursos', academicoController.getCursos);
router.post('/cursos', authMiddleware(['admin']), academicoController.createCurso);
router.delete('/cursos/:id', authMiddleware(['admin']), academicoController.deleteCurso);

router.get('/alumnos', authMiddleware(['admin', 'docente']), alumnosController.getAlumnos);
router.post('/alumnos', authMiddleware(['admin']), alumnosController.createAlumno);
router.put('/alumnos/:id', authMiddleware(['admin']), alumnosController.updateAlumno);
router.delete('/alumnos/:id', authMiddleware(['admin']), alumnosController.deleteAlumno);

router.get('/materias', authMiddleware(['admin', 'docente']), academicoController.getMaterias);
router.post('/materias', authMiddleware(['admin']), academicoController.createMateria);
router.put('/materias/:id', authMiddleware(['admin']), academicoController.updateMateria);
router.delete('/materias/:id', authMiddleware(['admin']), academicoController.deleteMateria);

// Actividades extracurriculares (deportivas/culturales)
router.get('/actividades', authMiddleware(['admin', 'alumno', 'docente']), actividadesController.getActividades);
router.post('/actividades', authMiddleware(['admin']), actividadesController.createActividad);
router.put('/actividades/:id', authMiddleware(['admin']), actividadesController.updateActividad);
router.delete('/actividades/:id', authMiddleware(['admin']), actividadesController.deleteActividad);
router.get('/mis-inscripciones', authMiddleware(['alumno']), actividadesController.getMisInscripciones);
router.post('/inscribir-actividad', authMiddleware(['alumno']), actividadesController.inscribirActividad);
router.delete('/desinscribir-actividad/:actividad_id', authMiddleware(['alumno']), actividadesController.desinscribirActividad);
router.get('/mis-hijos', authMiddleware(['padre']), alumnosController.getMisHijos);
router.get('/mis-hijos/:alumno_id/resumen', authMiddleware(['padre']), alumnosController.getResumenHijo);
router.get('/alumnos-disponibles', authMiddleware(['padre']), alumnosController.getAlumnosDisponibles);
router.post('/vincular-hijo', authMiddleware(['padre']), alumnosController.vincularHijo);
router.delete('/desvincular-hijo/:id', authMiddleware(['padre']), alumnosController.desvincularHijo);

router.post('/asistencias', authMiddleware(['docente']), horariosController.registrarAsistencia);
router.post('/calificaciones', authMiddleware(['docente']), horariosController.cargarCalificacion);

// Docentes y Horarios (asignación docente↔materia con validación de superposición)
router.get('/docentes', authMiddleware(['admin', 'docente']), horariosController.getDocentes);
router.get('/horarios', authMiddleware(['admin', 'docente']), horariosController.getHorarios);
router.post('/horarios', authMiddleware(['admin']), horariosController.createHorario);
router.delete('/horarios/:id', authMiddleware(['admin']), horariosController.deleteHorario);

// Asistencia y notas de actividades extracurriculares (profesores de actividades/idiomas)
router.get('/actividades/:actividad_id/inscriptos', authMiddleware(['admin', 'docente']), actividadesController.getInscriptosActividad);
router.post('/actividades/asistencia', authMiddleware(['docente']), actividadesController.registrarAsistenciaActividad);
router.post('/actividades/calificacion', authMiddleware(['docente']), actividadesController.cargarCalificacionActividad);

module.exports = router;
