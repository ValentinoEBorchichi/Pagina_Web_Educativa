import { API_URL } from '../config';
import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';

const DocenteDashboard = () => {
    const { apiFetch } = useAuth();
    const [alumnos, setAlumnos] = useState([]);
    const [materias, setMaterias] = useState([]);
    const [materiaSel, setMateriaSel] = useState('');
    const [, setLoading] = useState(true);
    const [aviso, setAviso] = useState('');
    const [avisoDestino, setAvisoDestino] = useState('all');
    const [instalaciones, setInstalaciones] = useState([]);
    const [actividades, setActividades] = useState([]);
    const [actividadSel, setActividadSel] = useState('');
    const [inscriptos, setInscriptos] = useState([]);

    // Modales servicios
    const [modal, setModal] = useState(null); // 'incidencia' | 'comedor' | 'reserva' | null

    useEffect(() => {
        fetchAlumnos();
        fetchMaterias();
        fetchInstalaciones();
        fetchActividades();
    }, []);

    useEffect(() => {
        if (actividadSel) fetchInscriptos(actividadSel);
        else setInscriptos([]);
    }, [actividadSel]);

    const fetchActividades = async () => {
        try {
            const response = await apiFetch(`${API_URL}/api/academico/actividades`);
            if (response.ok) {
                const data = await response.json();
                setActividades(data);
                if (data.length > 0) setActividadSel(String(data[0].id));
            }
        } catch (error) {
            console.error('Error actividades:', error);
        }
    };

    const fetchInscriptos = async (actId) => {
        try {
            const response = await apiFetch(`${API_URL}/api/academico/actividades/${actId}/inscriptos`);
            if (response.ok) {
                const data = await response.json();
                setInscriptos(data.map(i => ({ ...i, asistencia: 'Presente', notaTmp: '' })));
            }
        } catch (error) {
            console.error('Error inscriptos:', error);
        }
    };

    const handleAsistActChange = (alumnoId, estado) => {
        setInscriptos(inscriptos.map(i => i.alumno_id === alumnoId ? { ...i, asistencia: estado } : i));
    };

    const handleNotaActChange = (alumnoId, nota) => {
        // Se permite escribir libremente; la validación (entero 1-10) se aplica al guardar,
        // para poder mostrar el mensaje de error también ante texto o decimales (CP-015).
        setInscriptos(inscriptos.map(i => i.alumno_id === alumnoId ? { ...i, notaTmp: nota } : i));
    };

    const saveAsistenciaActividad = async (alumnoId, estado) => {
        try {
            const r = await apiFetch(`${API_URL}/api/academico/actividades/asistencia`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ actividad_id: parseInt(actividadSel), alumno_id: alumnoId, estado })
            });
            if (r.ok) alert('Asistencia registrada');
            else { const d = await r.json().catch(() => ({})); alert(d.message || 'Error al registrar asistencia'); }
        } catch (err) { console.error(err); alert('Error de conexión'); }
    };

    const saveNotaActividad = async (alumnoId, nota) => {
        if (nota === '' || nota === undefined) return alert('Ingrese una nota');
        if (!notaValida(nota)) return alert('La nota debe ser un número entero entre 1 y 10 (sin decimales ni texto).');
        try {
            const r = await apiFetch(`${API_URL}/api/academico/actividades/calificacion`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ actividad_id: parseInt(actividadSel), alumno_id: alumnoId, nota })
            });
            if (r.ok) { alert('Calificación guardada'); fetchInscriptos(actividadSel); }
            else { const d = await r.json().catch(() => ({})); alert(d.message || 'Error al guardar la calificación'); }
        } catch (err) { console.error(err); alert('Error de conexión'); }
    };

    const fetchAlumnos = async () => {
        try {
            const response = await apiFetch(`${API_URL}/api/academico/alumnos`);
            const data = await response.json();
            if (response.ok) {
                setAlumnos(data.map(a => ({ ...a, asistencia: 'Presente', notaTmp: '' })));
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMaterias = async () => {
        try {
            const response = await apiFetch(`${API_URL}/api/academico/materias`);
            if (response.ok) {
                const data = await response.json();
                setMaterias(data);
                if (data.length > 0) setMateriaSel(String(data[0].id));
            }
        } catch (error) {
            console.error('Error materias:', error);
        }
    };

    const fetchInstalaciones = async () => {
        try {
            const response = await apiFetch(`${API_URL}/api/servicios/instalaciones`);
            if (response.ok) setInstalaciones(await response.json());
        } catch (error) {
            console.error('Error instalaciones:', error);
        }
    };

    const handleAsistenciaChange = (id, nuevoEstado) => {
        setAlumnos(alumnos.map(a => a.id === id ? { ...a, asistencia: nuevoEstado } : a));
    };

    const markAllPresent = () => {
        setAlumnos(alumnos.map(a => ({ ...a, asistencia: 'Presente' })));
    };

    const getNotaColor = (nota) => {
        if (!nota) return '#e2e8f0';
        const val = parseInt(nota);
        if (val >= 7) return '#dcfce7'; // Verde
        if (val >= 4) return '#fef9c3'; // Amarillo
        return '#fef2f2'; // Rojo
    };

    const saveAsistencia = async () => {
        if (alumnos.length === 0) return alert('No hay alumnos para registrar.');
        try {
            const results = await Promise.all(alumnos.map(a =>
                apiFetch(`${API_URL}/api/academico/asistencias`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        alumno_id: a.id,
                        fecha: new Date().toISOString().split('T')[0],
                        estado: a.asistencia
                    })
                }).then(r => r.ok).catch(() => false)
            ));
            const fallidos = results.filter(ok => !ok).length;
            if (fallidos === 0) alert('Asistencia guardada correctamente');
            else alert(`Asistencia guardada parcialmente: ${fallidos} registro(s) fallaron.`);
        } catch (error) {
            console.error(error);
            alert('Error al guardar asistencia');
        }
    };

    // Valida que la nota sea un entero estricto de 1 a 10 (sin decimales, texto ni negativos).
    const notaValida = (nota) => /^\d+$/.test(String(nota).trim()) && Number(nota) >= 1 && Number(nota) <= 10;

    const saveNota = async (alumnoId, nota) => {
        if (nota === '' || nota === undefined) return alert('Ingrese una nota');
        if (!notaValida(nota)) return alert('La nota debe ser un número entero entre 1 y 10 (sin decimales ni texto).');
        try {
            const response = await apiFetch(`${API_URL}/api/academico/calificaciones`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    alumno_id: alumnoId,
                    materia_id: materiaSel ? parseInt(materiaSel) : 1,
                    nota: nota,
                    trimestre: 1
                })
            });
            if (response.ok) alert('Calificación guardada');
            else {
                const data = await response.json().catch(() => ({}));
                alert(data.message || 'Error al guardar la calificación');
            }
        } catch (error) {
            console.error(error);
        }
    };

    const publicarAviso = async () => {
        if (!aviso) return;
        try {
            const response = await apiFetch(`${API_URL}/api/comunicacion/notificaciones`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    titulo: 'Aviso del Docente',
                    mensaje: aviso,
                    rol_destino: avisoDestino
                })
            });
            if (response.ok) {
                alert('Aviso publicado');
                setAviso('');
                setAvisoDestino('all');
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleNotaChange = (id, nuevaNota) => {
        // Entrada libre; la validación estricta (entero 1-10) se aplica al guardar,
        // así también se muestra el error ante texto o decimales (CP-015).
        setAlumnos(alumnos.map(a => a.id === id ? { ...a, notaTmp: nuevaNota } : a));
    };

    const finalizarTrimestre = () => {
        const cargadas = alumnos.filter(a => a.notaTmp !== '').length;
        if (cargadas === 0) {
            alert('Aún no se cargaron notas en esta sesión.');
            return;
        }
        alert(`Carga finalizada. ${cargadas} calificación(es) confirmada(s) para el trimestre actual.`);
    };

    const handleIncidenciaSubmit = async (e) => {
        e.preventDefault();
        const form = e.target;
        const data = {
            alumno_id: parseInt(form.alumno_id.value),
            descripcion: form.descripcion.value,
            accion_tomada: form.accion_tomada.value,
            notificado_padre: form.notificado_padre.checked ? 1 : 0
        };
        if (data.descripcion.length < 10) return alert('La descripción debe tener al menos 10 caracteres.');
        try {
            const r = await apiFetch(`${API_URL}/api/servicios/enfermeria/incidencia`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (r.ok) { alert('Incidencia registrada'); setModal(null); }
            else { const d = await r.json().catch(() => ({})); alert(d.message || 'Error al registrar incidencia'); }
        } catch (err) { console.error(err); alert('Error de conexión'); }
    };

    const handleComedorSubmit = async (e) => {
        e.preventDefault();
        const form = e.target;
        const data = {
            alumno_id: parseInt(form.alumno_id.value),
            consumio_menu: form.consumio_menu.checked ? 1 : 0,
            observaciones: form.observaciones.value
        };
        try {
            const r = await apiFetch(`${API_URL}/api/servicios/comedor/asistencia`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (r.ok) { alert('Asistencia al comedor registrada'); setModal(null); }
            else { const d = await r.json().catch(() => ({})); alert(d.message || 'Error al registrar'); }
        } catch (err) { console.error(err); alert('Error de conexión'); }
    };

    const handleReservaLabSubmit = async (e) => {
        e.preventDefault();
        const form = e.target;
        const data = {
            instalacion_id: parseInt(form.instalacion_id.value),
            fecha: form.fecha.value,
            hora_inicio: form.hora_inicio.value,
            hora_fin: form.hora_fin.value,
            motivo: form.motivo.value,
            reservado_por: JSON.parse(localStorage.getItem('user') || '{}').id || null
        };
        try {
            const r = await apiFetch(`${API_URL}/api/servicios/instalaciones/reservar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (r.ok) { alert('Reserva realizada'); setModal(null); }
            else { const d = await r.json().catch(() => ({})); alert(d.message || 'Error al reservar'); }
        } catch (err) { console.error(err); alert('Error de conexión'); }
    };

    return (
        <DashboardLayout title="Panel Docente">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
                {/* Asistencia Diaria */}
                <div className="dashboard-card" style={cardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #f1f5f9', paddingBottom: '12px' }}>
                        <h3 style={{ fontSize: '1.1rem', color: 'var(--blue)', fontWeight: 800 }}>📋 Toma de Asistencia</h3>
                        <button 
                            onClick={markAllPresent}
                            style={{ background: 'none', border: 'none', color: 'var(--green)', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer' }}
                        >
                            ✓ MARCAR TODOS
                        </button>
                    </div>
                    <div style={{ marginTop: '20px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ textAlign: 'left', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>
                                    <th style={{ padding: '10px 0' }}>Alumno</th>
                                    <th>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {alumnos.map((a) => (
                                    <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '12px 0', fontWeight: 700, fontSize: '0.9rem' }}>{a.nombre}</td>
                                        <td>
                                            <select 
                                                value={a.asistencia} 
                                                onChange={(e) => handleAsistenciaChange(a.id, e.target.value)}
                                                style={{ padding: '6px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.85rem', background: a.asistencia === 'Presente' ? '#f0fdf4' : '#fef2f2' }}
                                            >
                                                <option value="Presente">Presente</option>
                                                <option value="Ausente">Ausente</option>
                                                <option value="Tarde">Tarde</option>
                                            </select>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <button onClick={saveAsistencia} className="btn btn-green" style={{ width: '100%', marginTop: '20px', fontSize: '0.85rem' }}>Guardar Asistencia del Día</button>
                    </div>
                </div>

                {/* Carga de Notas */}
                <div className="dashboard-card" style={cardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #f1f5f9', paddingBottom: '12px' }}>
                        <h3 style={{ fontSize: '1.1rem', color: 'var(--blue)', fontWeight: 800 }}>📝 Calificaciones</h3>
                        <span style={{ fontSize: '0.75rem', background: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: '50px', fontWeight: 800 }}>4° Año - Div. A</span>
                    </div>

                    <div style={{ marginTop: '16px' }}>
                        <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Materia</label>
                        <select
                            value={materiaSel}
                            onChange={(e) => setMateriaSel(e.target.value)}
                            style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem' }}
                        >
                            {materias.length === 0 ? (
                                <option value="">Materia General (sin configurar)</option>
                            ) : (
                                materias.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)
                            )}
                        </select>
                    </div>

                    <div style={{ marginTop: '20px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ textAlign: 'left', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>
                                    <th style={{ padding: '10px 0' }}>Estudiante</th>
                                    <th>Nota</th>
                                    <th style={{ textAlign: 'right' }}>Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {alumnos.map((a) => (
                                    <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '14px 0', fontWeight: 700, fontSize: '0.9rem' }}>{a.apellido}, {a.nombre}</td>
                                        <td>
                                            <input
                                                type="text"
                                                inputMode="numeric" maxLength={4}
                                                placeholder="1-10"
                                                value={a.notaTmp}
                                                onChange={(e) => handleNotaChange(a.id, e.target.value)}
                                                style={{ 
                                                    width: '50px', padding: '6px', borderRadius: '6px', border: '1px solid #e2e8f0', 
                                                    textAlign: 'center', fontWeight: 700,
                                                    backgroundColor: getNotaColor(a.notaTmp)
                                                }}
                                            />
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <button 
                                                onClick={() => saveNota(a.id, a.notaTmp)}
                                                style={{ background: 'none', border: 'none', color: 'var(--blue)', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                                            >
                                                Guardar
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <button onClick={finalizarTrimestre} className="btn btn-hero-orange" style={{ width: '100%', marginTop: '20px', fontSize: '0.85rem' }}>Finalizar Carga Trimestral</button>
                    </div>
                </div>

                {/* Agenda y Tareas */}
                <div className="dashboard-card" style={cardStyle}>
                    <h3 style={cardTitleStyle}>🗓️ Mi Agenda</h3>
                    <div style={{ marginTop: '16px' }}>
                        <div style={itemTarea}>
                            <div style={dotStyle}></div>
                            <div style={{ flex: 1 }}>
                                <p style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text)' }}>Examen de Historia</p>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-sm)' }}>Viernes 15 - 08:30hs | Aula 12</p>
                            </div>
                            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--orange)' }}>PRÓXIMO</span>
                        </div>
                        <div style={itemTarea}>
                            <div style={{ ...dotStyle, background: 'var(--orange)' }}></div>
                            <div style={{ flex: 1 }}>
                                <p style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text)' }}>Entrega de Planificaciones</p>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-sm)' }}>Lunes 18 - Todo el día</p>
                            </div>
                        </div>
                        <div style={itemTarea}>
                            <div style={{ ...dotStyle, background: 'var(--violet)' }}></div>
                            <div style={{ flex: 1 }}>
                                <p style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text)' }}>Capacitación Docente</p>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-sm)' }}>Miércoles 20 - 14:00hs (Virtual)</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Comunicados a Alumnos */}
                <div className="dashboard-card" style={{ ...cardStyle, gridColumn: '1 / -1' }}>
                    <h3 style={cardTitleStyle}>📣 Comunicado Institucional</h3>
                    <div style={{ marginTop: '16px', display: 'flex', gap: '16px', flexDirection: 'column' }}>
                        <textarea
                            value={aviso}
                            onChange={(e) => setAviso(e.target.value)}
                            placeholder="Escribe el mensaje para tus alumnos o colegas..."
                            style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', resize: 'none', height: '100px', fontFamily: 'inherit', outline: 'none' }}
                        ></textarea>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Destinatario:</label>
                                <select
                                    value={avisoDestino}
                                    onChange={(e) => setAvisoDestino(e.target.value)}
                                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem', fontWeight: 700 }}
                                >
                                    <option value="all">Todos los perfiles</option>
                                    <option value="alumno">Solo Alumnos</option>
                                    <option value="padre">Solo Padres/Tutores</option>
                                    <option value="docente">Solo Docentes</option>
                                </select>
                            </div>
                            <button onClick={publicarAviso} className="btn btn-violet" style={{ padding: '12px 28px' }}>Publicar Aviso →</button>
                        </div>
                    </div>
                </div>

                {/* Actividades Extracurriculares / Idiomas */}
                <div className="dashboard-card" style={{ ...cardStyle, gridColumn: '1 / -1' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #f1f5f9', paddingBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
                        <h3 style={{ fontSize: '1.1rem', color: 'var(--blue)', fontWeight: 800 }}>🎯 Actividades / Idiomas</h3>
                        <select
                            value={actividadSel}
                            onChange={(e) => setActividadSel(e.target.value)}
                            style={{ padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}
                        >
                            {actividades.length === 0 ? (
                                <option value="">No hay actividades</option>
                            ) : (
                                actividades.map(a => <option key={a.id} value={a.id}>{a.nombre} ({a.tipo})</option>)
                            )}
                        </select>
                    </div>

                    <div style={{ marginTop: '20px' }}>
                        {inscriptos.length === 0 ? (
                            <p style={{ fontSize: '0.85rem', color: '#64748b', padding: '12px 0' }}>
                                No hay inscriptos en esta actividad todavía.
                            </p>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>
                                        <th style={{ padding: '10px 0' }}>Inscripto</th>
                                        <th>Asistencia</th>
                                        <th>Nota (1-10)</th>
                                        <th style={{ textAlign: 'right' }}>Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {inscriptos.map((i) => (
                                        <tr key={i.alumno_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '12px 0', fontWeight: 700, fontSize: '0.9rem' }}>
                                                {i.alumno_nombre}
                                                {i.ultima_nota != null && (
                                                    <span style={{ marginLeft: '8px', fontSize: '0.7rem', background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '50px', fontWeight: 800 }}>Última: {i.ultima_nota}</span>
                                                )}
                                            </td>
                                            <td>
                                                <select
                                                    value={i.asistencia}
                                                    onChange={(e) => handleAsistActChange(i.alumno_id, e.target.value)}
                                                    style={{ padding: '6px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.85rem', background: i.asistencia === 'Presente' ? '#f0fdf4' : '#fef2f2' }}
                                                >
                                                    <option value="Presente">Presente</option>
                                                    <option value="Ausente">Ausente</option>
                                                    <option value="Tarde">Tarde</option>
                                                </select>
                                            </td>
                                            <td>
                                                <input
                                                    type="text" inputMode="numeric" maxLength={4}
                                                    placeholder="1-10"
                                                    value={i.notaTmp}
                                                    onChange={(e) => handleNotaActChange(i.alumno_id, e.target.value)}
                                                    style={{ width: '50px', padding: '6px', borderRadius: '6px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 700, backgroundColor: getNotaColor(i.notaTmp) }}
                                                />
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <button onClick={() => saveAsistenciaActividad(i.alumno_id, i.asistencia)} style={{ background: 'none', border: 'none', color: 'var(--green)', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', marginRight: '10px' }}>Asist.</button>
                                                <button onClick={() => saveNotaActividad(i.alumno_id, i.notaTmp)} style={{ background: 'none', border: 'none', color: 'var(--blue)', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}>Nota</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Servicios Extra (Comedor / Enfermería) */}
                <div className="dashboard-card" style={cardStyle}>
                    <h3 style={cardTitleStyle}>🏥 Servicios Especiales</h3>
                    <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <button onClick={() => setModal('incidencia')} className="btn" style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fee2e2', fontSize: '0.85rem' }}>
                            🚑 Reportar Incidencia Médica
                        </button>
                        <button onClick={() => setModal('comedor')} className="btn" style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #dcfce7', fontSize: '0.85rem' }}>
                            🍎 Asistencia Comedor
                        </button>
                        <button onClick={() => setModal('reserva')} className="btn" style={{ background: '#eff6ff', color: '#1e40af', border: '1px solid #dbeafe', fontSize: '0.85rem' }}>
                            🧪 Reservar Laboratorio
                        </button>
                    </div>
                </div>
            </div>

            {modal === 'incidencia' && (
                <div style={modalOverlay} onClick={() => setModal(null)}>
                    <div style={modalContent} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h2 style={{ color: 'var(--blue)' }}>🚑 Reportar Incidencia Médica</h2>
                            <button onClick={() => setModal(null)} style={closeBtn}>✕</button>
                        </div>
                        <form onSubmit={handleIncidenciaSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <select name="alumno_id" required style={inputStyle}>
                                <option value="">Seleccionar Alumno</option>
                                {alumnos.map(a => <option key={a.id} value={a.id}>{a.apellido}, {a.nombre}</option>)}
                            </select>
                            <textarea name="descripcion" required minLength={10} placeholder="Descripción (mín. 10 caracteres)" style={{ ...inputStyle, height: '90px', resize: 'none', fontFamily: 'inherit' }} />
                            <input name="accion_tomada" placeholder="Acción tomada (opcional)" style={inputStyle} />
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                                <input type="checkbox" name="notificado_padre" /> Notificar al tutor
                            </label>
                            <button type="submit" className="btn btn-violet">Registrar</button>
                        </form>
                    </div>
                </div>
            )}

            {modal === 'comedor' && (
                <div style={modalOverlay} onClick={() => setModal(null)}>
                    <div style={modalContent} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h2 style={{ color: 'var(--blue)' }}>🍎 Asistencia al Comedor</h2>
                            <button onClick={() => setModal(null)} style={closeBtn}>✕</button>
                        </div>
                        <form onSubmit={handleComedorSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <select name="alumno_id" required style={inputStyle}>
                                <option value="">Seleccionar Alumno</option>
                                {alumnos.map(a => <option key={a.id} value={a.id}>{a.apellido}, {a.nombre}</option>)}
                            </select>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                                <input type="checkbox" name="consumio_menu" defaultChecked /> Consumió el menú
                            </label>
                            <input name="observaciones" placeholder="Observaciones (opcional)" style={inputStyle} />
                            <button type="submit" className="btn btn-green">Registrar</button>
                        </form>
                    </div>
                </div>
            )}

            {modal === 'reserva' && (
                <div style={modalOverlay} onClick={() => setModal(null)}>
                    <div style={modalContent} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h2 style={{ color: 'var(--blue)' }}>🧪 Reservar Instalación</h2>
                            <button onClick={() => setModal(null)} style={closeBtn}>✕</button>
                        </div>
                        <form onSubmit={handleReservaLabSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <select name="instalacion_id" required style={inputStyle}>
                                <option value="">Seleccionar Instalación</option>
                                {instalaciones.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
                            </select>
                            {instalaciones.length === 0 && (
                                <p style={{ fontSize: '0.75rem', color: '#991b1b' }}>No hay instalaciones cargadas. Solicite a Administración que las dé de alta.</p>
                            )}
                            <input type="date" name="fecha" required style={inputStyle} />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <input type="time" name="hora_inicio" required style={inputStyle} />
                                <input type="time" name="hora_fin" required style={inputStyle} />
                            </div>
                            <input name="motivo" required placeholder="Motivo de la reserva" style={inputStyle} />
                            <button type="submit" className="btn btn-violet">Reservar</button>
                        </form>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
};

const modalOverlay = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalContent = { background: 'white', padding: '32px', borderRadius: '16px', width: '90%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' };
const closeBtn = { background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' };
const inputStyle = { padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem', outline: 'none', width: '100%' };

const cardStyle = { background: 'var(--white)', padding: '24px', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)' };
const cardTitleStyle = { fontSize: '1.1rem', color: 'var(--blue)', borderBottom: '2px solid #f1f5f9', paddingBottom: '12px' };
const itemTarea = { display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', padding: '8px', borderRadius: '8px', transition: 'background 0.2s' };
const dotStyle = { width: '10px', height: '10px', borderRadius: '50%', background: 'var(--green)' };

export default DocenteDashboard;
