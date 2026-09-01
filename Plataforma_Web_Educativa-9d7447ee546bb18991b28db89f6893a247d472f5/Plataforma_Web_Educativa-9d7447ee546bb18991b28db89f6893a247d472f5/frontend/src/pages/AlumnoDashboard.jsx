import { API_URL } from '../config';
import React, { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';

const AlumnoDashboard = () => {
    const { apiFetch } = useAuth();
    const [notificaciones, setNotificaciones] = useState([]);
    const [actividades, setActividades] = useState([]);
    const [misInscripciones, setMisInscripciones] = useState([]);

    const materias = [
        { nombre: 'Matemáticas', docente: 'Prof. Gómez', nota: '9' },
        { nombre: 'Lengua y Literatura', docente: 'Prof. Rodríguez', nota: '8' },
        { nombre: 'Ciencias Naturales', docente: 'Prof. Martínez', nota: '10' },
        { nombre: 'Historia', docente: 'Prof. López', nota: '7' }
    ];

    const horarios = [
        { dia: 'Lunes', materia: 'Matemáticas', hora: '08:00 - 09:30' },
        { dia: 'Martes', materia: 'Lengua', hora: '10:00 - 11:30' },
        { dia: 'Miércoles', materia: 'Ciencias', hora: '08:00 - 09:30' }
    ];

    useEffect(() => {
        const fetchNotificaciones = async () => {
            try {
                const response = await apiFetch(`${API_URL}/api/comunicacion/notificaciones`);
                if (response.ok) setNotificaciones(await response.json());
            } catch (error) {
                console.error('Error al cargar notificaciones:', error);
            }
        };
        fetchNotificaciones();
        fetchActividades();
    }, [apiFetch]);

    const fetchActividades = async () => {
        try {
            const [resAct, resMis] = await Promise.all([
                apiFetch(`${API_URL}/api/academico/actividades`),
                apiFetch(`${API_URL}/api/academico/mis-inscripciones`)
            ]);
            if (resAct.ok) setActividades(await resAct.json());
            if (resMis.ok) setMisInscripciones(await resMis.json());
        } catch (error) {
            console.error('Error al cargar actividades:', error);
        }
    };

    const estaInscripto = (actividadId) => misInscripciones.some(a => a.id === actividadId);

    const inscribirse = async (actividadId) => {
        const response = await apiFetch(`${API_URL}/api/academico/inscribir-actividad`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ actividad_id: actividadId })
        });
        const data = await response.json();
        if (response.ok) fetchActividades();
        else alert(data.message || 'No te pudiste inscribir.');
    };

    const cancelarInscripcion = async (actividadId) => {
        const response = await apiFetch(`${API_URL}/api/academico/desinscribir-actividad/${actividadId}`, { method: 'DELETE' });
        if (response.ok) fetchActividades();
    };

    return (
        <DashboardLayout title="Panel del Alumno">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                {/* Mis Materias y Notas */}
                <div className="dashboard-card" style={cardStyle}>
                    <h3 style={cardTitleStyle}>📚 Mis Materias</h3>
                    <div style={{ marginTop: '16px' }}>
                        {materias.map((m, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: i < materias.length -1 ? '1px solid #f1f5f9' : 'none' }}>
                                <div>
                                    <p style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text)' }}>{m.nombre}</p>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-sm)' }}>{m.docente}</p>
                                </div>
                                <span style={{ 
                                    background: 'var(--blue)', color: 'white', padding: '4px 12px', borderRadius: '50px', fontSize: '0.85rem', fontWeight: 800, alignSelf: 'center'
                                }}>{m.nota}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Horarios */}
                <div className="dashboard-card" style={cardStyle}>
                    <h3 style={cardTitleStyle}>⏰ Horarios de Clase</h3>
                    <div style={{ marginTop: '16px' }}>
                        {horarios.map((h, i) => (
                            <div key={i} style={{ padding: '12px 0', borderBottom: i < horarios.length -1 ? '1px solid #f1f5f9' : 'none' }}>
                                <p style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text)' }}>{h.dia}</p>
                                <p style={{ fontSize: '0.85rem', color: 'var(--blue)', fontWeight: 600 }}>{h.materia} <span style={{ color: 'var(--text-sm)', fontWeight: 400 }}>({h.hora})</span></p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Actividades Extracurriculares */}
                <div className="dashboard-card" style={{ ...cardStyle, gridColumn: '1 / -1' }}>
                    <h3 style={cardTitleStyle}>🎭 Actividades Extracurriculares</h3>
                    <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
                        {actividades.length === 0 ? (
                            <p style={{ fontSize: '0.9rem', color: '#64748b' }}>No hay actividades disponibles por el momento.</p>
                        ) : (
                            actividades.map(a => {
                                const inscripto = estaInscripto(a.id);
                                const lleno = a.inscriptos >= a.cupo_max;
                                return (
                                    <div key={a.id} style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 800, color: 'white', background: a.tipo === 'Deporte' ? 'var(--green)' : a.tipo === 'Cultura' ? 'var(--violet)' : 'var(--orange)', padding: '3px 8px', borderRadius: '6px' }}>{a.tipo}</span>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: lleno ? '#dc2626' : '#64748b' }}>{a.inscriptos}/{a.cupo_max}</span>
                                        </div>
                                        <p style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text)', marginTop: '10px' }}>{a.nombre}</p>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-sm)', marginBottom: '12px' }}>{a.horario || 'Horario a confirmar'}</p>
                                        {inscripto ? (
                                            <button onClick={() => cancelarInscripcion(a.id)} className="btn btn-hero-outline" style={{ width: '100%', fontSize: '0.8rem', color: '#dc2626', borderColor: '#dc2626' }}>
                                                ✓ Inscripto — Cancelar
                                            </button>
                                        ) : (
                                            <button onClick={() => inscribirse(a.id)} disabled={lleno} className="btn btn-violet" style={{ width: '100%', fontSize: '0.8rem', opacity: lleno ? 0.5 : 1, cursor: lleno ? 'not-allowed' : 'pointer' }}>
                                                {lleno ? 'Sin cupo' : 'Inscribirme'}
                                            </button>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Comunicados */}
                <div className="dashboard-card" style={{ ...cardStyle, gridColumn: '1 / -1' }}>
                    <h3 style={cardTitleStyle}>📢 Comunicados Recientes</h3>
                    <div style={{ marginTop: '16px' }}>
                        {notificaciones.length === 0 ? (
                            <p style={{ fontSize: '0.9rem', color: '#64748b', padding: '12px 0' }}>No hay comunicados nuevos por el momento.</p>
                        ) : (
                            notificaciones.map((n) => (
                                <div key={n.id} style={comunicadoStyle}>
                                    <p style={{ fontWeight: 800, color: 'var(--orange)' }}>{n.titulo}</p>
                                    <p style={{ fontSize: '0.9rem', marginTop: '4px', lineHeight: '1.5' }}>{n.mensaje}</p>
                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginTop: '8px', fontWeight: 700 }}>
                                        {new Date(n.fecha_envio).toLocaleString()}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

const cardStyle = {
    background: 'var(--white)',
    padding: '24px',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow-sm)'
};

const cardTitleStyle = {
    fontSize: '1.1rem',
    color: 'var(--blue)',
    borderBottom: '2px solid #f1f5f9',
    paddingBottom: '12px'
};

const comunicadoStyle = {
    padding: '16px',
    background: '#f8fafc',
    borderRadius: '12px',
    marginBottom: '12px'
};

export default AlumnoDashboard;
