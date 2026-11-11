import { API_URL } from '../config';
import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';

const hoy = () => new Date().toISOString().slice(0, 10);

const PadreDashboard = () => {
    const { apiFetch } = useAuth();
    const [showMenu, setShowMenu] = useState(false);
    const [showReporte, setShowReporte] = useState(false);
    const [notificaciones, setNotificaciones] = useState([]);
    const [hijosReales, setHijosReales] = useState([]);
    const [saldoTotal, setSaldoTotal] = useState(0);
    const [disponibles, setDisponibles] = useState([]);
    const [alumnoSel, setAlumnoSel] = useState('');
    const [facturas, setFacturas] = useState([]);
    const [comprobantes, setComprobantes] = useState([]);
    const [deportes, setDeportes] = useState([]);
    const [deporteSel, setDeporteSel] = useState({});   // { [hijoId]: deporteId }
    const [msgDeporte, setMsgDeporte] = useState(null); // { tipo: 'error' | 'ok', texto }
    const [planesPago, setPlanesPago] = useState([]);
    const [cuotasPorFactura, setCuotasPorFactura] = useState({}); // { [facturaId]: cuota[] }
    const [eligiendoPlan, setEligiendoPlan] = useState(null); // `${facturaId}-${planId}` en curso
    const [cuotaSubiendo, setCuotaSubiendo] = useState(null); // cuota_id con el formulario de carga abierto
    const [uploadForm, setUploadForm] = useState({ monto: '', fecha: hoy(), archivo: null });
    const [uploadError, setUploadError] = useState('');
    const [subiendoArchivo, setSubiendoArchivo] = useState(false);

    useEffect(() => {
        fetchDeportes();
        fetchNotificaciones();
        fetchHijosYSaldos();
        fetchDisponibles();
        fetchFacturas();
        fetchComprobantes();
        fetchPlanesPago();
    }, []);

    // Las facturas con plan ya elegido necesitan sus cuotas para mostrar el
    // botón "Subir comprobante" por cuota pendiente.
    useEffect(() => {
        facturas.filter(f => f.plan_pago_id).forEach(f => fetchCuotasFactura(f.id));
    }, [facturas]);

    // Facturas y comprobantes de los propios hijos: el backend ya los filtra
    // por el padre autenticado (RNFM-02: una sola fuente de verdad, sin "pagos" sueltos).
    const fetchFacturas = async () => {
        try {
            const response = await apiFetch(`${API_URL}/api/financiero/facturas`);
            if (response.ok) setFacturas(await response.json());
        } catch (error) {
            console.error(error);
        }
    };

    const fetchComprobantes = async () => {
        try {
            const response = await apiFetch(`${API_URL}/api/financiero/comprobantes`);
            if (response.ok) setComprobantes(await response.json());
        } catch (error) {
            console.error(error);
        }
    };

    // Abre el archivo del comprobante subido (imagen o PDF) en una pestaña nueva.
    const verComprobante = async (comprobanteId) => {
        try {
            const response = await apiFetch(`${API_URL}/api/financiero/comprobantes/${comprobanteId}/archivo`);
            const data = await response.json().catch(() => ({}));
            if (!response.ok) return alert(data.message || 'No se pudo abrir el comprobante');
            window.open(data.url, '_blank');
        } catch (error) {
            console.error(error);
            alert('Error al abrir el comprobante');
        }
    };

    // Abre el PDF de una factura (el backend lo genera y devuelve el buffer
    // directo, no una URL firmada, por eso se pide con apiFetch y se abre
    // como blob en vez de un <a href> simple que no llevaría el JWT).
    const verFacturaPdf = async (facturaId) => {
        try {
            const response = await apiFetch(`${API_URL}/api/financiero/facturas/${facturaId}/pdf`);
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                return alert(data.message || 'No se pudo generar el PDF de la factura');
            }
            const blob = await response.blob();
            window.open(window.URL.createObjectURL(blob), '_blank');
        } catch (error) {
            console.error(error);
            alert('Error al abrir la factura');
        }
    };

    // Abre el recibo en PDF de un comprobante ya aprobado.
    const verReciboComprobante = async (comprobanteId) => {
        try {
            const response = await apiFetch(`${API_URL}/api/financiero/comprobantes/${comprobanteId}/recibo`);
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                return alert(data.message || 'No se pudo generar el recibo');
            }
            const blob = await response.blob();
            window.open(window.URL.createObjectURL(blob), '_blank');
        } catch (error) {
            console.error(error);
            alert('Error al abrir el recibo');
        }
    };

    // Catálogo de planes de pago activos (mismo para todas las facturas).
    const fetchPlanesPago = async () => {
        try {
            const response = await apiFetch(`${API_URL}/api/financiero/planes-pago`);
            if (response.ok) {
                const data = await response.json();
                setPlanesPago(data.filter(p => p.activo));
            }
        } catch (error) {
            console.error(error);
        }
    };

    // Cuotas generadas de una factura que ya tiene plan de pago elegido.
    const fetchCuotasFactura = async (facturaId) => {
        try {
            const response = await apiFetch(`${API_URL}/api/financiero/facturas/${facturaId}/cuotas`);
            if (response.ok) {
                const data = await response.json();
                setCuotasPorFactura(prev => ({ ...prev, [facturaId]: data }));
            }
        } catch (error) {
            console.error(error);
        }
    };

    // El padre elige un plan para una factura con saldo: el backend genera las cuotas.
    const elegirPlan = async (facturaId, planPagoId) => {
        setEligiendoPlan(`${facturaId}-${planPagoId}`);
        try {
            const response = await apiFetch(`${API_URL}/api/financiero/facturas/${facturaId}/elegir-plan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan_pago_id: planPagoId })
            });
            const data = await response.json().catch(() => ({}));
            if (response.ok) {
                fetchFacturas(); // trae el plan_pago_id ya asignado; el useEffect de arriba carga las cuotas
            } else {
                alert(data.message || 'No se pudo elegir el plan de pago.');
            }
        } catch (error) {
            console.error(error);
            alert('Error de conexión con el servidor');
        } finally {
            setEligiendoPlan(null);
        }
    };

    const abrirSubirComprobante = (cuota) => {
        setUploadError('');
        setUploadForm({ monto: String(cuota.monto), fecha: hoy(), archivo: null });
        setCuotaSubiendo(cuota.id);
    };

    const cerrarSubirComprobante = () => {
        setCuotaSubiendo(null);
        setUploadError('');
    };

    // Sube el comprobante de una cuota puntual (factura_cuota_id). Reutiliza el
    // mismo endpoint POST /api/financiero/comprobantes que el admin ya consume
    // para revisión, agregando el campo factura_cuota_id.
    const enviarComprobante = async (facturaId) => {
        const montoNormalizado = Number(String(uploadForm.monto).replace(',', '.'));
        if (!Number.isFinite(montoNormalizado) || montoNormalizado <= 0) {
            return setUploadError('Ingresá un monto válido.');
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(uploadForm.fecha)) {
            return setUploadError('Ingresá una fecha válida con formato AAAA-MM-DD.');
        }
        if (!uploadForm.archivo) {
            return setUploadError('Elegí el archivo del comprobante (JPG, PNG o PDF).');
        }

        const datos = new FormData();
        datos.append('factura_cuota_id', String(cuotaSubiendo));
        datos.append('monto', String(montoNormalizado));
        datos.append('fecha_transferencia', uploadForm.fecha);
        datos.append('archivo', uploadForm.archivo);

        setSubiendoArchivo(true);
        setUploadError('');
        try {
            const response = await apiFetch(`${API_URL}/api/financiero/comprobantes`, {
                method: 'POST',
                body: datos
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message || 'No se pudo cargar el comprobante.');
            cerrarSubirComprobante();
            fetchCuotasFactura(facturaId);
            fetchComprobantes();
        } catch (error) {
            setUploadError(error.message || 'Error de conexión con el servidor');
        } finally {
            setSubiendoArchivo(false);
        }
    };

    const fetchDeportes = async () => {
        try {
            const response = await apiFetch(`${API_URL}/api/deportes`);
            if (response.ok) setDeportes(await response.json());
        } catch (error) {
            console.error(error);
        }
    };

    // Inscribe a un hijo en un deporte (RF-06 / RF-07). El JWT lo adjunta apiFetch.
    const inscribirHijo = async (hijo) => {
        const deporteId = deporteSel[hijo.id];
        if (!deporteId) {
            setMsgDeporte({ tipo: 'error', texto: `Elegí un deporte para ${hijo.nombre}.` });
            return;
        }
        setMsgDeporte(null);
        try {
            const response = await apiFetch(`${API_URL}/api/deportes/inscribir`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alumno_id: hijo.id, deporte_id: Number(deporteId) })
            });
            const data = await response.json().catch(() => ({}));
            if (response.ok) {
                setMsgDeporte({ tipo: 'ok', texto: data.message || 'Inscripción confirmada.' });
                setDeporteSel((prev) => ({ ...prev, [hijo.id]: '' }));
                fetchDeportes(); // refresca cupos
            } else if (response.status === 409) {
                // Límite de 2 deportes, horarios superpuestos, sin cupo o ya inscripto.
                setMsgDeporte({ tipo: 'error', texto: data.message || 'La inscripción entra en conflicto con los deportes actuales.' });
            } else if (response.status !== 401) {
                setMsgDeporte({ tipo: 'error', texto: data.message || 'No se pudo inscribir.' });
            }
        } catch {
            setMsgDeporte({ tipo: 'error', texto: 'Error de conexión con el servidor' });
        }
    };

    const fetchDisponibles = async () => {
        try {
            const response = await apiFetch(`${API_URL}/api/academico/alumnos-disponibles`);
            if (response.ok) setDisponibles(await response.json());
        } catch (error) {
            console.error(error);
        }
    };

    const vincularHijo = async () => {
        if (!alumnoSel) return alert('Seleccioná un alumno para vincular.');
        try {
            const response = await apiFetch(`${API_URL}/api/academico/vincular-hijo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alumno_id: alumnoSel })
            });
            const data = await response.json();
            if (response.ok) {
                setAlumnoSel('');
                fetchHijosYSaldos();
                fetchDisponibles();
            } else {
                alert(data.message || 'No se pudo vincular el alumno.');
            }
        } catch (error) {
            console.error(error);
        }
    };

    const desvincularHijo = async (id, nombreCompleto) => {
        if (!window.confirm(`¿Desvincular a ${nombreCompleto} de tu cuenta?`)) return;
        try {
            const response = await apiFetch(`${API_URL}/api/academico/desvincular-hijo/${id}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (response.ok) {
                fetchHijosYSaldos();
                fetchDisponibles();
            } else {
                alert(data.message || 'No se pudo desvincular el alumno.');
            }
        } catch (error) {
            console.error(error);
        }
    };

    const fetchNotificaciones = async () => {
        try {
            const response = await apiFetch(`${API_URL}/api/comunicacion/notificaciones`);
            if (response.ok) setNotificaciones(await response.json());
        } catch (error) {
            console.error(error);
        }
    };

    const fetchHijosYSaldos = async () => {
        try {
            const response = await apiFetch(`${API_URL}/api/padres/mis-hijos`);
            if (!response.ok) return;
            const { hijos } = await response.json();
            // Se conserva el formato que usa la vista (nivel_nombre / division) a partir del curso.
            const lista = hijos.map((h) => ({
                ...h,
                nivel_nombre: h.curso ? `${h.curso.nivel} ${h.curso.grado}°` : null,
                division: h.curso ? h.curso.division : null
            }));
            const saldos = await Promise.all(lista.map(async (h) => {
                // Saldo + resumen académico real (promedio, asistencia, faltas) en paralelo.
                const [rs, rr] = await Promise.all([
                    apiFetch(`${API_URL}/api/financiero/saldo/${h.id}`),
                    apiFetch(`${API_URL}/api/academico/mis-hijos/${h.id}/resumen`)
                ]);
                const s = rs.ok ? await rs.json() : { saldo_pendiente: 0 };
                const resumen = rr.ok ? await rr.json() : {};
                return {
                    ...h,
                    saldo_pendiente: Number(s.saldo_pendiente) || 0,
                    promedio: resumen.promedio ?? null,
                    asistencia_pct: resumen.asistencia_pct ?? null,
                    faltas: resumen.faltas ?? 0,
                    calificaciones: resumen.calificaciones || []
                };
            }));
            setHijosReales(saldos);
            setSaldoTotal(saldos.reduce((acc, h) => acc + h.saldo_pendiente, 0));
        } catch (error) {
            console.error(error);
        }
    };

    const [avisosLeidos, setAvisosLeidos] = useState([]);

    const markAsRead = (id) => {
        if (!avisosLeidos.includes(id)) {
            setAvisosLeidos([...avisosLeidos, id]);
        }
    };

    // Hijo seleccionado para el modal "Ver Reporte Completo".
    const [reporteHijo, setReporteHijo] = useState(null);

    // Agregados reales para las tarjetas de resumen (a partir de los hijos vinculados).
    const conPromedio = hijosReales.filter(h => h.promedio != null);
    const promedioGral = conPromedio.length
        ? (conPromedio.reduce((a, h) => a + h.promedio, 0) / conPromedio.length).toFixed(2)
        : null;
    const conAsistencia = hijosReales.filter(h => h.asistencia_pct != null);
    const asistenciaGral = conAsistencia.length
        ? Math.round(conAsistencia.reduce((a, h) => a + h.asistencia_pct, 0) / conAsistencia.length)
        : null;
    const faltasTotal = hijosReales.reduce((a, h) => a + (h.faltas || 0), 0);

    const menuSemanal = [
        { dia: 'Lunes', plato: 'Tallarines con salsa bolognesa', postre: 'Fruta de estación' },
        { dia: 'Martes', plato: 'Pollo al horno con puré', postre: 'Gelatina' },
        { dia: 'Miércoles', plato: 'Milanesa de carne con ensalada', postre: 'Flan con dulce' },
        { dia: 'Jueves', plato: 'Arroz con pollo y vegetales', postre: 'Yogur' },
        { dia: 'Viernes', plato: 'Pizza artesanal y empanadas', postre: 'Helado' },
    ];

    return (
        <DashboardLayout title="Panel para Padres">
            {/* Modal Menú Semanal */}
            {showMenu && (
                <div style={modalOverlay}>
                    <div style={modalContent}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h2 style={{ color: 'var(--blue)' }}>🍎 Menú Semanal Comedor</h2>
                            <button onClick={() => setShowMenu(false)} style={closeBtn}>✕</button>
                        </div>
                        {menuSemanal.map(m => (
                            <div key={m.dia} style={{ padding: '12px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
                                <div>
                                    <strong style={{ color: 'var(--orange)' }}>{m.dia}</strong>: {m.plato}
                                </div>
                                <em style={{ fontSize: '0.8rem', color: '#64748b' }}>Postre: {m.postre}</em>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Modal Reporte Completo */}
            {showReporte && reporteHijo && (
                <div style={modalOverlay} onClick={() => setShowReporte(false)}>
                    <div style={modalContent} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h2 style={{ color: 'var(--blue)' }}>📊 Reporte de {reporteHijo.nombre}</h2>
                            <button onClick={() => setShowReporte(false)} style={closeBtn}>✕</button>
                        </div>
                        <div style={{ padding: '20px', background: '#f8fafc', borderRadius: '12px' }}>
                            <h3 style={{ fontSize: '1rem', marginBottom: '16px' }}>Calificaciones</h3>
                            {(!reporteHijo.calificaciones || reporteHijo.calificaciones.length === 0) ? (
                                <p style={{ fontSize: '0.9rem', color: '#64748b' }}>Todavía no hay calificaciones cargadas.</p>
                            ) : (
                                <div style={{ display: 'grid', gap: '10px' }}>
                                    {reporteHijo.calificaciones.map((c, idx) => (
                                        <div key={idx} style={notaRow}>
                                            <span>{c.materia_nombre || 'Materia'} {c.trimestre ? `(Trim. ${c.trimestre})` : ''}</span>
                                            <strong>{Number(c.nota).toFixed(2)}</strong>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <hr style={{ margin: '20px 0', border: '0', borderTop: '1px solid #e2e8f0' }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <strong>Promedio General:</strong>
                                <strong style={{ color: 'var(--blue)', fontSize: '1.2rem' }}>{reporteHijo.promedio ?? '—'}</strong>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Resumen Rápido */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                <div className="dashboard-card" style={{ ...cardStyle, textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>📚</div>
                    <span style={labelStyle}>Promedio Gral</span>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--blue)' }}>{promedioGral ?? '—'}</div>
                </div>
                <div className="dashboard-card" style={{ ...cardStyle, textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>✅</div>
                    <span style={labelStyle}>Asistencia</span>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--green)' }}>{asistenciaGral != null ? `${asistenciaGral}%` : '—'}</div>
                </div>
                <div className="dashboard-card" style={{ ...cardStyle, textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>💰</div>
                    <span style={labelStyle}>Estado Cuota</span>
                    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: saldoTotal > 0 ? '#991b1b' : 'var(--blue)', marginTop: '8px' }}>{saldoTotal > 0 ? 'CON DEUDA' : 'AL DÍA'}</div>
                </div>
                <div className="dashboard-card" style={{ ...cardStyle, textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>📅</div>
                    <span style={labelStyle}>Faltas</span>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--orange)' }}>{faltasTotal}</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                {/* Gestión de Hijos Vinculados */}
                <div style={cardStyle}>
                    <h3 style={cardTitleStyle}>🔗 Mis Hijos Vinculados</h3>

                    <div style={{ marginTop: '16px' }}>
                        {hijosReales.length === 0 ? (
                            <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                Todavía no vinculaste ningún alumno. Seleccioná el legajo de tu hijo/a abajo.
                            </p>
                        ) : (
                            hijosReales.map(h => (
                                <div key={h.id} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '12px', background: '#f8fafc', borderRadius: '10px', marginBottom: '10px'
                                }}>
                                    <div>
                                        <p style={{ fontWeight: 800, color: 'var(--blue)' }}>{h.apellido}, {h.nombre}</p>
                                        <p style={{ fontSize: '0.75rem', color: '#64748b' }}>DNI: {h.dni}</p>
                                    </div>
                                    <button
                                        onClick={() => desvincularHijo(h.id, `${h.nombre} ${h.apellido}`)}
                                        style={{ background: 'none', border: 'none', color: '#dc2626', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}
                                    >
                                        Desvincular
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    <div style={{ marginTop: '20px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                        <span style={labelStyle}>Vincular un nuevo alumno</span>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                            <select
                                value={alumnoSel}
                                onChange={(e) => setAlumnoSel(e.target.value)}
                                style={{ flex: 1, minWidth: 0, padding: '10px 8px', borderRadius: '8px', border: '2px solid #e2e8f0', fontSize: '0.8rem' }}
                            >
                                <option value="">Seleccionar alumno...</option>
                                {disponibles.map(a => (
                                    <option key={a.id} value={a.id}>{a.apellido}, {a.nombre} (DNI: {a.dni})</option>
                                ))}
                            </select>
                            <button onClick={vincularHijo} className="btn btn-violet" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                                + Vincular
                            </button>
                        </div>
                        {disponibles.length === 0 && (
                            <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '8px' }}>
                                No hay alumnos disponibles para vincular.
                            </p>
                        )}
                    </div>
                </div>

                {/* Información del Alumno */}
                <div style={cardStyle}>
                    <h3 style={cardTitleStyle}>👨‍👩‍👧 Seguimiento del Alumno</h3>
                    {hijosReales.length === 0 ? (
                        <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '16px' }}>
                            Vinculá el legajo de tu hijo/a para ver su seguimiento académico.
                        </p>
                    ) : (
                        hijosReales.map((h) => (
                            <div key={h.id} style={{ marginTop: '20px', padding: '16px', background: '#f8fafc', borderRadius: '12px' }}>
                                <p style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--blue)' }}>{h.apellido}, {h.nombre}</p>
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-sm)' }}>{h.nivel_nombre ? `${h.nivel_nombre} ${h.division || ''}` : 'Sin curso asignado'}</p>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '16px' }}>
                                    <div style={infoBox}>
                                        <span style={labelStyle}>Promedio</span>
                                        <span style={{ ...valueStyle, color: 'var(--blue)' }}>{h.promedio ?? '—'}</span>
                                    </div>
                                    <div style={infoBox}>
                                        <span style={labelStyle}>Asistencia</span>
                                        <span style={{ ...valueStyle, color: 'var(--green)' }}>{h.asistencia_pct != null ? `${h.asistencia_pct}%` : '—'}</span>
                                    </div>
                                    <div style={infoBox}>
                                        <span style={labelStyle}>Faltas</span>
                                        <span style={{ ...valueStyle, color: 'var(--orange)' }}>{h.faltas || 0}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => { setReporteHijo(h); setShowReporte(true); }}
                                    className="btn btn-violet"
                                    style={{ width: '100%', marginTop: '12px', fontSize: '0.8rem' }}
                                >Ver Reporte Completo</button>
                            </div>
                        ))
                    )}
                </div>

                {/* Inscripción a deportes de los hijos */}
                <div style={cardStyle}>
                    <h3 style={cardTitleStyle}>⚽ Deportes de mis hijos</h3>
                    {msgDeporte && (
                        <div role="alert" style={{
                            marginTop: '16px', padding: '14px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 700,
                            background: msgDeporte.tipo === 'ok' ? '#dcfce7' : '#fee2e2',
                            color: msgDeporte.tipo === 'ok' ? '#166534' : '#dc2626',
                            border: `1px solid ${msgDeporte.tipo === 'ok' ? '#bbf7d0' : '#fecaca'}`
                        }}>
                            {msgDeporte.texto}
                        </div>
                    )}
                    {hijosReales.length === 0 ? (
                        <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '16px' }}>
                            No tenés hijos vinculados para inscribir.
                        </p>
                    ) : (
                        hijosReales.map(h => (
                            <div key={h.id} style={{ marginTop: '16px', padding: '12px', background: '#f8fafc', borderRadius: '10px' }}>
                                <p style={{ fontWeight: 800, color: 'var(--blue)' }}>{h.apellido}, {h.nombre}</p>
                                <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                                    <select
                                        value={deporteSel[h.id] || ''}
                                        onChange={(e) => setDeporteSel((prev) => ({ ...prev, [h.id]: e.target.value }))}
                                        style={{ flex: 1, minWidth: 0, padding: '10px 8px', borderRadius: '8px', border: '2px solid #e2e8f0', fontSize: '0.8rem' }}
                                    >
                                        <option value="">Seleccionar deporte...</option>
                                        {deportes.map(d => (
                                            <option key={d.id} value={d.id} disabled={d.inscriptos >= d.cupo_maximo}>
                                                {d.nombre} — {d.horario} ({d.inscriptos}/{d.cupo_maximo})
                                            </option>
                                        ))}
                                    </select>
                                    <button onClick={() => inscribirHijo(h)} className="btn btn-violet" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                                        Inscribir
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Avisos Institucionales */}
                <div style={cardStyle}>
                    <h3 style={cardTitleStyle}>🔔 Avisos y Citaciones</h3>
                    <div style={{ marginTop: '16px' }}>
                        {notificaciones.length === 0 ? (
                            <p style={{ fontSize: '0.85rem', color: '#64748b' }}>No hay avisos nuevos.</p>
                        ) : (
                            notificaciones.map((a, i) => (
                                <div
                                    key={i}
                                    style={{
                                        ...avisoStyle,
                                        opacity: avisosLeidos.includes(a.id) ? 0.7 : 1,
                                        borderLeftColor: avisosLeidos.includes(a.id) ? '#cbd5e1' : 'var(--orange)',
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => markAsRead(a.id)}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <p style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                                            {a.titulo}
                                            {!avisosLeidos.includes(a.id) && (
                                                <span style={{ marginLeft: '8px', fontSize: '0.6rem', background: 'var(--orange)', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>NUEVO</span>
                                            )}
                                        </p>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-sm)' }}>
                                            {new Date(a.fecha_envio).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <p style={{ fontSize: '0.85rem', marginTop: '4px', color: 'var(--text-sm)' }}>{a.mensaje}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Calendario de Pagos / Comedor */}
                <div className="dashboard-card" style={cardStyle}>
                    <h3 style={cardTitleStyle}>💳 Estado de Cuenta</h3>
                    <div style={{ marginTop: '20px' }}>
                        <div style={{
                            padding: '20px',
                            background: saldoTotal > 0 ? '#fef2f2' : '#f0f9ff',
                            borderRadius: '12px',
                            border: `1px solid ${saldoTotal > 0 ? '#fecaca' : '#bae6fd'}`,
                            textAlign: 'center', marginBottom: '20px'
                        }}>
                            <span style={labelStyle}>Saldo Pendiente Total</span>
                            <div style={{ fontSize: '2rem', fontWeight: 900, color: saldoTotal > 0 ? '#991b1b' : 'var(--blue)', marginTop: '4px' }}>
                                ${saldoTotal.toFixed(2)}
                            </div>
                            <p style={{ fontSize: '0.75rem', color: saldoTotal > 0 ? '#991b1b' : '#0369a1', marginTop: '8px', fontWeight: 700 }}>
                                {saldoTotal > 0 ? '⚠️ Posee saldo pendiente' : '✅ Cuenta al día'}
                            </p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {hijosReales.length === 0 ? (
                                <p style={{ fontSize: '0.8rem', color: '#64748b', padding: '8px 0' }}>
                                    Aún no hay hijos vinculados a su cuenta. Solicite a administración la vinculación de su tutoría con el legajo del alumno.
                                </p>
                            ) : (
                                hijosReales.map(h => (
                                    <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                                        <span>{h.apellido}, {h.nombre}</span>
                                        <span style={{ fontWeight: 800, color: h.saldo_pendiente > 0 ? '#991b1b' : 'var(--green)' }}>
                                            {h.saldo_pendiente > 0 ? `$${h.saldo_pendiente.toFixed(2)}` : 'AL DÍA'}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>

                        <button
                            onClick={() => window.print()}
                            className="btn btn-hero-outline"
                            style={{ width: '100%', marginTop: '20px', fontSize: '0.8rem', color: 'var(--blue)', borderColor: 'var(--blue)' }}
                        >📥 Imprimir / Guardar como PDF</button>

                        <div style={{ marginTop: '24px' }}>
                            <span style={labelStyle}>Facturas</span>
                            {facturas.length === 0 ? (
                                <p style={{ fontSize: '0.8rem', color: '#64748b', padding: '8px 0' }}>
                                    Todavía no hay facturas emitidas.
                                </p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                                    {facturas.map(f => {
                                        const pagable = Number(f.saldo) > 0 && f.estado !== 'Anulada';
                                        const cuotas = cuotasPorFactura[f.id];
                                        return (
                                            <div key={f.id} style={facturaCard}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ fontSize: '0.82rem' }}>
                                                        {f.periodo} · {f.alumno_apellido}, {f.alumno_nombre} · {f.estado} · <strong>${Number(f.saldo).toFixed(2)}</strong> / ${Number(f.total).toFixed(2)}
                                                    </span>
                                                    <button onClick={() => verFacturaPdf(f.id)} style={{ background: 'none', border: 'none', color: 'var(--blue)', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>📄 PDF</button>
                                                </div>

                                                {!pagable ? null : !f.plan_pago_id ? (
                                                    <div style={{ marginTop: '10px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                                                        <span style={{ ...labelStyle, fontSize: '0.65rem' }}>Elegí un plan de pago</span>
                                                        {planesPago.length === 0 ? (
                                                            <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '6px', fontStyle: 'italic' }}>
                                                                No hay planes de pago configurados todavía.
                                                            </p>
                                                        ) : planesPago.map(plan => {
                                                            const totalConRecargo = Number(f.saldo) * (1 + Number(plan.recargo_pct || 0) / 100);
                                                            const porCuota = totalConRecargo / plan.cantidad_cuotas;
                                                            const key = `${f.id}-${plan.id}`;
                                                            return (
                                                                <div key={plan.id} style={planCard}>
                                                                    <div>
                                                                        <strong style={{ fontSize: '0.82rem', color: 'var(--blue)' }}>{plan.nombre}</strong>
                                                                        <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '2px 0' }}>
                                                                            {plan.cantidad_cuotas} cuota{plan.cantidad_cuotas > 1 ? 's' : ''} de ${porCuota.toFixed(2)}
                                                                            {Number(plan.recargo_pct) > 0 ? ` · recargo ${plan.recargo_pct}%` : ' · sin recargo'} · total ${totalConRecargo.toFixed(2)}
                                                                        </p>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => elegirPlan(f.id, plan.id)}
                                                                        disabled={eligiendoPlan === key}
                                                                        className="btn btn-violet"
                                                                        style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                                                                    >{eligiendoPlan === key ? 'Elegiendo...' : 'Elegir'}</button>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <div style={{ marginTop: '10px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                                                        <span style={{ ...labelStyle, fontSize: '0.65rem' }}>Cuotas</span>
                                                        {!cuotas ? (
                                                            <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '6px' }}>Cargando cuotas...</p>
                                                        ) : cuotas.map(cuota => (
                                                            <div key={cuota.id} style={cuotaFila}>
                                                                <span style={{ fontSize: '0.78rem' }}>
                                                                    Cuota {cuota.numero_cuota}/{cuotas.length} · ${Number(cuota.monto).toFixed(2)} · vence {cuota.vencimiento} · <strong>{cuota.estado}</strong>
                                                                </span>
                                                                {cuota.estado === 'Pendiente' && (
                                                                    <button
                                                                        onClick={() => abrirSubirComprobante(cuota)}
                                                                        className="btn btn-hero-outline"
                                                                        style={{ fontSize: '0.72rem', color: 'var(--blue)', borderColor: 'var(--blue)', whiteSpace: 'nowrap' }}
                                                                    >Subir comprobante</button>
                                                                )}
                                                            </div>
                                                        ))}

                                                        {cuotas && cuotas.some(c => c.id === cuotaSubiendo) && (
                                                            <div style={uploadBox}>
                                                                <span style={labelStyle}>Subir comprobante de la cuota</span>
                                                                <label style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '8px', display: 'block' }}>Monto transferido</label>
                                                                <input
                                                                    type="number" step="0.01" value={uploadForm.monto}
                                                                    onChange={e => setUploadForm(prev => ({ ...prev, monto: e.target.value }))}
                                                                    style={inputStyle}
                                                                />
                                                                <label style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '8px', display: 'block' }}>Fecha de transferencia</label>
                                                                <input
                                                                    type="date" value={uploadForm.fecha}
                                                                    onChange={e => setUploadForm(prev => ({ ...prev, fecha: e.target.value }))}
                                                                    style={inputStyle}
                                                                />
                                                                <label style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '8px', display: 'block' }}>Archivo (JPG, PNG o PDF)</label>
                                                                <input
                                                                    type="file" accept="image/jpeg,image/png,application/pdf"
                                                                    onChange={e => setUploadForm(prev => ({ ...prev, archivo: e.target.files[0] || null }))}
                                                                    style={{ marginTop: '4px', fontSize: '0.78rem' }}
                                                                />
                                                                {uploadError && <p style={{ color: '#dc2626', fontSize: '0.78rem', marginTop: '8px' }}>{uploadError}</p>}
                                                                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                                                                    <button onClick={() => enviarComprobante(f.id)} disabled={subiendoArchivo} className="btn btn-violet" style={{ fontSize: '0.78rem' }}>
                                                                        {subiendoArchivo ? 'Enviando...' : 'Enviar comprobante'}
                                                                    </button>
                                                                    <button onClick={cerrarSubirComprobante} className="btn btn-hero-outline" style={{ fontSize: '0.78rem' }}>Cancelar</button>
                                                                </div>
                                                                <p style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '8px' }}>
                                                                    El pago se acredita una vez que administración valide la transferencia.
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div style={{ marginTop: '24px' }}>
                            <span style={labelStyle}>Comprobantes subidos</span>
                            {comprobantes.length === 0 ? (
                                <p style={{ fontSize: '0.8rem', color: '#64748b', padding: '8px 0' }}>
                                    Todavía no subiste ningún comprobante de transferencia.
                                </p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                                    {comprobantes.map(c => (
                                        <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                                            <span>
                                                {new Date(c.fecha_carga).toLocaleDateString('es-AR')} · {c.alumno_apellido}, {c.alumno_nombre} · <strong>${Number(c.monto).toFixed(2)}</strong> ·{' '}
                                                <span style={{
                                                    fontWeight: 700,
                                                    color: c.estado_verificacion === 'Aprobado' ? 'var(--green)' : c.estado_verificacion === 'Rechazado' ? '#dc2626' : 'var(--orange)'
                                                }}>{c.estado_verificacion}</span>
                                            </span>
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <button onClick={() => verComprobante(c.id)} style={{ background: 'none', border: 'none', color: 'var(--blue)', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>📄 Ver</button>
                                                {c.estado_verificacion === 'Aprobado' && (
                                                    <button onClick={() => verReciboComprobante(c.id)} style={{ background: 'none', border: 'none', color: 'var(--green)', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>🧾 Recibo</button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Comedor y Otros */}
                <div className="dashboard-card" style={cardStyle}>
                    <h3 style={cardTitleStyle}>🍎 Servicios Extra</h3>
                    <div style={{ marginTop: '20px' }}>
                        <div style={infoBox}>
                            <span style={labelStyle}>Comedor Escolar</span>
                            <span style={{ ...valueStyle, color: 'var(--blue)' }}>Activo (Menú General)</span>
                        </div>
                        <button onClick={() => setShowMenu(true)} className="btn btn-green" style={{ width: '100%', marginTop: '16px', fontSize: '0.85rem' }}>Ver Menú Semanal</button>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

const modalOverlay = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalContent = { background: 'white', padding: '32px', borderRadius: '16px', width: '90%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' };
const closeBtn = { background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' };
const notaRow = { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9', fontSize: '0.9rem' };

const cardStyle = { background: 'var(--white)', padding: '24px', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)' };
const cardTitleStyle = { fontSize: '1.1rem', color: 'var(--blue)', borderBottom: '2px solid #f1f5f9', paddingBottom: '12px' };
const infoBox = { display: 'flex', flexDirection: 'column', background: 'white', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0' };
const labelStyle = { fontSize: '0.7rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 800 };
const valueStyle = { fontSize: '1rem', fontWeight: 800 };
const avisoStyle = { padding: '12px', borderLeft: '4px solid var(--orange)', background: '#fff7ed', marginBottom: '12px', borderRadius: '0 8px 8px 0' };

const facturaCard = { padding: '10px 0', borderBottom: '1px solid #f1f5f9' };
const planCard = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', background: '#f8fafc', borderRadius: '10px', padding: '10px', marginTop: '8px', border: '1px solid #e2e8f0' };
const cuotaFila = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid #f8fafc' };
const uploadBox = { marginTop: '12px', padding: '14px', background: '#f0f9ff', borderRadius: '10px', border: '1px solid #bae6fd' };
const inputStyle = { width: '100%', padding: '9px 10px', borderRadius: '8px', border: '2px solid #e2e8f0', fontSize: '0.82rem', marginTop: '4px', boxSizing: 'border-box' };

export default PadreDashboard;
