const express = require('express');
const router = express.Router();
// Antes había un solo academicoController con las 8 entidades mezcladas.
// Ahora cada controlador agrupa una parte del dominio académico.
const academicoController = require('../controllers/academico.controller');
const alumnosController = require('../controllers/alumnos.controller');
const actividadesController = require('../controllers/actividades.controller');
const horariosController = require('../controllers/horarios.controller');
const { requireAuth } = require('../config/auth');

// Rutas protegidas por rol (Admin y Docente)
router.get('/niveles', academicoController.getNiveles);
router.post('/niveles', requireAuth(['admin']), academicoController.createNivel);
router.put('/niveles/:id', requireAuth(['admin']), academicoController.updateNivel);
router.delete('/niveles/:id', requireAuth(['admin']), academicoController.deleteNivel);
router.get('/aulas', academicoController.getAulas);
router.post('/aulas', requireAuth(['admin']), academicoController.createAula);
router.delete('/aulas/:id', requireAuth(['admin']), academicoController.deleteAula);

router.get('/cursos', academicoController.getCursos);
router.post('/cursos', requireAuth(['admin']), academicoController.createCurso);
router.delete('/cursos/:id', requireAuth(['admin']), academicoController.deleteCurso);

router.get('/alumnos', requireAuth(['admin', 'docente']), alumnosController.getAlumnos);
router.post('/alumnos', requireAuth(['admin']), alumnosController.createAlumno);
router.put('/alumnos/:id', requireAuth(['admin']), alumnosController.updateAlumno);
router.delete('/alumnos/:id', requireAuth(['admin']), alumnosController.deleteAlumno);

router.get('/materias', requireAuth(['admin', 'docente']), academicoController.getMaterias);
router.post('/materias', requireAuth(['admin']), academicoController.createMateria);
router.put('/materias/:id', requireAuth(['admin']), academicoController.updateMateria);
router.delete('/materias/:id', requireAuth(['admin']), academicoController.deleteMateria);

// Actividades extracurriculares (deportivas/culturales)
router.get('/actividades', requireAuth(['admin', 'alumno', 'docente']), actividadesController.getActividades);
router.post('/actividades', requireAuth(['admin']), actividadesController.createActividad);
router.put('/actividades/:id', requireAuth(['admin']), actividadesController.updateActividad);
router.delete('/actividades/:id', requireAuth(['admin']), actividadesController.deleteActividad);
router.get('/mis-inscripciones', requireAuth(['alumno']), actividadesController.getMisInscripciones);
router.post('/inscribir-actividad', requireAuth(['alumno']), actividadesController.inscribirActividad);
router.delete('/desinscribir-actividad/:actividad_id', requireAuth(['alumno']), actividadesController.desinscribirActividad);
router.get('/mis-hijos', requireAuth(['padre']), alumnosController.getMisHijos);
router.get('/mis-hijos/:alumno_id/resumen', requireAuth(['padre']), alumnosController.getResumenHijo);
router.get('/alumnos-disponibles', requireAuth(['padre']), alumnosController.getAlumnosDisponibles);
router.post('/vincular-hijo', requireAuth(['padre']), alumnosController.vincularHijo);
router.delete('/desvincular-hijo/:id', requireAuth(['padre']), alumnosController.desvincularHijo);

router.post('/asistencias', requireAuth(['docente']), horariosController.registrarAsistencia);
router.post('/calificaciones', requireAuth(['docente']), horariosController.cargarCalificacion);

// Docentes y Horarios (asignación docente↔materia con validación de superposición)
router.get('/docentes', requireAuth(['admin', 'docente']), horariosController.getDocentes);
router.get('/horarios', requireAuth(['admin', 'docente']), horariosController.getHorarios);
router.post('/horarios', requireAuth(['admin']), horariosController.createHorario);
router.delete('/horarios/:id', requireAuth(['admin']), horariosController.deleteHorario);

// Asistencia y notas de actividades extracurriculares (profesores de actividades/idiomas)
router.get('/actividades/:actividad_id/inscriptos', requireAuth(['admin', 'docente']), actividadesController.getInscriptosActividad);
router.post('/actividades/asistencia', requireAuth(['docente']), actividadesController.registrarAsistenciaActividad);
router.post('/actividades/calificacion', requireAuth(['docente']), actividadesController.cargarCalificacionActividad);

module.exports = router;
