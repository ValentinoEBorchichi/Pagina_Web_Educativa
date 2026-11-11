import { API_URL } from '../config';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import { esNombreValido } from '../utils/validadores';

const AdminDashboard = () => {
    const [activeTab, setActiveTab] = useState('preinscripciones');
    const [preinscripciones, setPreinscripciones] = useState([]);
    const [alumnos, setAlumnos] = useState([]);
    const [cursos, setCursos] = useState([]);
    const [aulas, setAulas] = useState([]);
    const [showAlumnoForm, setShowAlumnoForm] = useState(false);
    const [cursosMssql, setCursosMssql] = useState([]);
    const [padres, setPadres] = useState([]);
    const [msgAlumno, setMsgAlumno] = useState(null);
    const [loading, setLoading] = useState(true);
    const { apiFetch } = useAuth();

    const [editingAlumno, setEditingAlumno] = useState(null);
    const [editingPersonal, setEditingPersonal] = useState(null);
    const [editingNivel, setEditingNivel] = useState(null);
    const [editingMateria, setEditingMateria] = useState(null);
    const [editingActividad, setEditingActividad] = useState(null);
    const [personal, setPersonal] = useState([]);
    const [niveles, setNiveles] = useState([]);

    const [rutasTransporte, setRutasTransporte] = useState([]);
    const [tarifas, setTarifas] = useState([]);
    const [planesPago, setPlanesPago] = useState([]);
    const [deportesTarifa, setDeportesTarifa] = useState([]);
    const [transportesTarifa, setTransportesTarifa] = useState([]);
    const [facturas, setFacturas] = useState([]);
    const [soloDeuda, setSoloDeuda] = useState(false);
    const [facturaAbierta, setFacturaAbierta] = useState(null);
    const [detalleFactura, setDetalleFactura] = useState([]);
    const [comprobantes, setComprobantes] = useState([]);
    const [comprobanteEstado, setComprobanteEstado] = useState('Pendiente');
    const [reportesStats, setReportesStats] = useState(null);
    const [reportesFinancieros, setReportesFinancieros] = useState(null);
    const [reporteAcademico, setReporteAcademico] = useState([]);
    const [reportePagos, setReportePagos] = useState([]);
    const [reporteDeudores, setReporteDeudores] = useState([]);
    const [materias, setMaterias] = useState([]);
    const [actividades, setActividades] = useState([]);
    const [horarios, setHorarios] = useState([]);
    const [docentes, setDocentes] = useState([]);
    const [academicoSub, setAcademicoSub] = useState('cursos');
    const [usuarios, setUsuarios] = useState([]);

    useEffect(() => {
        if (activeTab === 'preinscripciones') fetchPreinscripciones();
        if (activeTab === 'alumnos') { fetchAlumnos(); fetchCursosYAulas(); fetchCursosMssql(); fetchPadres(); }
        if (activeTab === 'academico') {
            fetchCursosYAulas(); fetchNiveles(); fetchMaterias();
            fetchActividades(); fetchHorarios(); fetchDocentes();
        }
        if (activeTab === 'personal') fetchPersonal();
        if (activeTab === 'finanzas') {
            fetchTarifas(); fetchPlanesPago(); fetchDeportesTarifa(); fetchTransportesTarifa(); fetchAlumnos();
            fetchFacturas(); fetchComprobantes();
        }
        if (activeTab === 'servicios') { fetchServicios(); fetchAlumnos(); }
        if (activeTab === 'reportes') { fetchReportesStats(); fetchReportesFinancieros(); fetchReporteAcademico(); fetchReportePagos(); fetchReporteDeudores(); }
        if (activeTab === 'usuarios') fetchUsuarios();
    }, [activeTab]);

    useEffect(() => {
        if (activeTab === 'finanzas') fetchFacturas();
    }, [activeTab, soloDeuda]);

    useEffect(() => {
        if (activeTab === 'finanzas') fetchComprobantes();
    }, [activeTab, comprobanteEstado]);

    const fetchUsuarios = async () => {
        try {
            const response = await apiFetch(`${API_URL}/api/auth/users`);
            if (response.ok) setUsuarios(await response.json());
        } catch (error) {
            console.error('Error usuarios:', error);
        }
    };

    const handleUserSubmit = async (e) => {
        e.preventDefault();
        const form = e.target;
        const datos = {
            nombre: form.nombre.value,
            username: form.username.value,
            password: form.password.value,
            rol: form.rol.value
        };
        const response = await apiFetch(`${API_URL}/api/auth/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });
        if (response.ok) { form.reset(); fetchUsuarios(); }
        else { const errorBody = await response.json(); alert(errorBody.message || 'Error al crear el usuario'); }
    };

    const updateUserRol = async (id, rol) => {
        const response = await apiFetch(`${API_URL}/api/auth/users/${id}/rol`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rol })
        });
        if (response.ok) fetchUsuarios();
        else { const errorBody = await response.json(); alert(errorBody.message || 'Error al cambiar el rol'); }
    };

    const deleteUsuario = async (id) => {
        if (!window.confirm('¿Eliminar este usuario? Esta acción no se puede deshacer.')) return;
        const response = await apiFetch(`${API_URL}/api/auth/users/${id}`, { method: 'DELETE' });
        if (response.ok) fetchUsuarios();
        else { const errorBody = await response.json(); alert(errorBody.message || 'Error al eliminar el usuario'); }
    };

    const fetchHorarios = async () => {
        try {
            const response = await apiFetch(`${API_URL}/api/academico/horarios`);
            if (response.ok) setHorarios(await response.json());
        } catch (error) {
            console.error('Error horarios:', error);
        }
    };

    const fetchDocentes = async () => {
        try {
            const response = await apiFetch(`${API_URL}/api/academico/docentes`);
            if (response.ok) setDocentes(await response.json());
        } catch (error) {
            console.error('Error docentes:', error);
        }
    };

    const handleHorarioSubmit = async (e) => {
        e.preventDefault();
        const form = e.target;
        const datos = {
            materia_id: form.materia_id.value,
            docente_id: form.docente_id.value,
            aula_id: form.aula_id.value,
            dia_semana: form.dia_semana.value,
            hora_inicio: form.hora_inicio.value,
            hora_fin: form.hora_fin.value
        };
        if (!datos.materia_id || !datos.docente_id || !datos.aula_id || !datos.dia_semana) {
            return alert('Completá materia, docente, aula y día.');
        }
        const response = await apiFetch(`${API_URL}/api/academico/horarios`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });
        if (response.ok) { form.reset(); fetchHorarios(); }
        else { const errorBody = await response.json(); alert(errorBody.message || 'Error al crear el horario'); }
    };

    const deleteHorario = async (id) => {
        if (!window.confirm('¿Eliminar este horario?')) return;
        const response = await apiFetch(`${API_URL}/api/academico/horarios/${id}`, { method: 'DELETE' });
        if (response.ok) fetchHorarios();
    };

    const fetchMaterias = async () => {
        try {
            const response = await apiFetch(`${API_URL}/api/academico/materias`);
            if (response.ok) setMaterias(await response.json());
        } catch (error) {
            console.error('Error materias:', error);
        }
    };

    const fetchActividades = async () => {
        try {
            const response = await apiFetch(`${API_URL}/api/academico/actividades`);
            if (response.ok) setActividades(await response.json());
        } catch (error) {
            console.error('Error actividades:', error);
        }
    };

    const handleMateriaSubmit = async (e) => {
        e.preventDefault();
        const form = e.target;
        const nombre = form.nombre.value.trim();
        const datos = { nombre, curso_id: form.curso_id.value };
        if (!datos.curso_id) return alert('Seleccioná un curso para la materia.');
        if (!esNombreValido(nombre)) return alert('El nombre de la materia solo puede contener letras (sin números ni símbolos).');
        const url = editingMateria
            ? `${API_URL}/api/academico/materias/${editingMateria.id}`
            : `${API_URL}/api/academico/materias`;
        const response = await apiFetch(url, {
            method: editingMateria ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });
        if (response.ok) { form.reset(); setEditingMateria(null); fetchMaterias(); }
        else { const errorBody = await response.json(); alert(errorBody.message || 'Error al guardar materia'); }
    };

    const deleteMateria = async (id) => {
        if (!window.confirm('¿Eliminar esta materia?')) return;
        const response = await apiFetch(`${API_URL}/api/academico/materias/${id}`, { method: 'DELETE' });
        if (response.ok) fetchMaterias();
    };

    const handleActividadSubmit = async (e) => {
        e.preventDefault();
        const form = e.target;
        const nombre = form.nombre.value.trim();
        const datos = {
            nombre,
            tipo: form.tipo.value,
            horario: form.horario.value,
            cupo_max: parseInt(form.cupo_max.value)
        };
        if (!esNombreValido(nombre)) return alert('El nombre de la actividad solo puede contener letras (sin números ni símbolos).');
        if (!datos.cupo_max || datos.cupo_max <= 0) return alert('Ingresá un cupo válido.');
        const url = editingActividad
            ? `${API_URL}/api/academico/actividades/${editingActividad.id}`
            : `${API_URL}/api/academico/actividades`;
        const response = await apiFetch(url, {
            method: editingActividad ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });
        if (response.ok) { form.reset(); setEditingActividad(null); fetchActividades(); }
        else { const errorBody = await response.json(); alert(errorBody.message || 'Error al guardar actividad'); }
    };

    const deleteActividad = async (id) => {
        if (!window.confirm('¿Eliminar esta actividad? Se borrarán también sus inscripciones.')) return;
        const response = await apiFetch(`${API_URL}/api/academico/actividades/${id}`, { method: 'DELETE' });
        if (response.ok) fetchActividades();
    };

    const fetchReportesStats = async () => {
        try {
            const response = await apiFetch(`${API_URL}/api/comunicacion/reportes/stats`);
            if (response.ok) setReportesStats(await response.json());
        } catch (error) { console.error(error); }
    };

    const fetchReportesFinancieros = async () => {
        try {
            const response = await apiFetch(`${API_URL}/api/movil/reportes-financieros`);
            if (response.ok) setReportesFinancieros(await response.json());
        } catch (error) { console.error('Error reporte financiero:', error); }
    };

    const fetchReporteAcademico = async () => {
        try {
            const response = await apiFetch(`${API_URL}/api/comunicacion/reportes/academico`);
            if (response.ok) setReporteAcademico(await response.json());
        } catch (error) { console.error('Error reporte académico:', error); }
    };

    const fetchReportePagos = async () => {
        try {
            const response = await apiFetch(`${API_URL}/api/comunicacion/reportes/financiero`);
            if (response.ok) setReportePagos(await response.json());
        } catch (error) { console.error('Error reporte de pagos:', error); }
    };

    // "Deudores" ahora es, simplemente, el listado de facturas con saldo > 0
    // (antes era un saldo agregado por alumno en una tabla separada).
    const fetchReporteDeudores = async () => {
        try {
            const response = await apiFetch(`${API_URL}/api/financiero/facturas?soloDeuda=1`);
            if (response.ok) setReporteDeudores(await response.json());
        } catch (error) { console.error('Error listado deudores:', error); }
    };

    const exportCSV = (filename, headers, rows) => {
        const escape = (val) => {
            if (val === null || val === undefined) return '';
            const s = String(val).replace(/"/g, '""');
            return /[",\n]/.test(s) ? `"${s}"` : s;
        };
        const csv = [headers.join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
        const blob = new Blob(["﻿" + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const exportLegajos = async () => {
        let data = alumnos;
        if (!data || data.length === 0) {
            const r = await apiFetch(`${API_URL}/api/academico/alumnos`);
            if (r.ok) data = await r.json();
        }
        if (!data || data.length === 0) return alert('No hay alumnos para exportar.');
        exportCSV(
            `legajos_alumnos_${new Date().toISOString().slice(0,10)}.csv`,
            ['ID', 'Apellido', 'Nombre', 'DNI', 'Fecha Nac.', 'Nivel', 'División'],
            data.map(a => [a.id, a.apellido, a.nombre, a.dni, a.fecha_nacimiento, a.nivel_nombre || '', a.division || ''])
        );
    };

    const exportPersonal = async () => {
        let data = personal;
        if (!data || data.length === 0) {
            const r = await apiFetch(`${API_URL}/api/financiero/personal`);
            if (r.ok) data = await r.json();
        }
        if (!data || data.length === 0) return alert('No hay personal para exportar.');
        exportCSV(
            `nomina_personal_${new Date().toISOString().slice(0,10)}.csv`,
            ['ID', 'Apellido', 'Nombre', 'DNI', 'Tipo', 'Email', 'Fecha Alta'],
            data.map(p => [p.id, p.apellido, p.nombre, p.dni, p.tipo, p.email, p.fecha_alta])
        );
    };

    const exportDeudores = async () => {
        try {
            const r = await apiFetch(`${API_URL}/api/financiero/facturas?soloDeuda=1`);
            if (!r.ok) return alert('No se pudo obtener el listado de deudores.');
            const data = await r.json();
            if (data.length === 0) return alert('No hay deudores registrados.');
            exportCSV(
                `deudores_${new Date().toISOString().slice(0,10)}.csv`,
                ['Factura', 'Apellido', 'Nombre', 'DNI', 'Período', 'Saldo Pendiente'],
                data.map(d => [d.id, d.alumno_apellido, d.alumno_nombre, d.alumno_dni, d.periodo, d.saldo])
            );
        } catch (e) { console.error(e); alert('Error al exportar.'); }
    };

    const exportReporteAcademico = async () => {
        try {
            const r = await apiFetch(`${API_URL}/api/comunicacion/reportes/academico`);
            if (!r.ok) return alert('No se pudo obtener el reporte académico.');
            const data = await r.json();
            if (data.length === 0) return alert('No hay calificaciones registradas.');
            exportCSV(
                `reporte_academico_${new Date().toISOString().slice(0,10)}.csv`,
                ['Apellido', 'Nombre', 'DNI', 'Nivel', 'División', 'Materia', 'Nota', 'Trimestre'],
                data.map(d => [d.apellido, d.nombre, d.dni, d.nivel_nombre || '', d.division || '', d.materia_nombre || '', d.nota, d.trimestre])
            );
        } catch (e) { console.error(e); alert('Error al exportar.'); }
    };

    const exportReporteFinanciero = async () => {
        try {
            const r = await apiFetch(`${API_URL}/api/comunicacion/reportes/financiero`);
            if (!r.ok) return alert('No se pudo obtener el reporte financiero.');
            const data = await r.json();
            if (data.length === 0) return alert('No hay pagos registrados.');
            exportCSV(
                `reporte_financiero_${new Date().toISOString().slice(0,10)}.csv`,
                ['Fecha', 'Apellido', 'Nombre', 'DNI', 'Monto Pagado', 'Método', 'Saldo Pendiente'],
                data.map(d => [d.fecha_pago, d.apellido, d.nombre, d.dni, d.monto_pagado, d.metodo_pago || '', d.saldo_pendiente])
            );
        } catch (e) { console.error(e); alert('Error al exportar.'); }
    };

    const exportPlanillaAsistencia = async () => {
        let data = alumnos;
        if (!data || data.length === 0) {
            const r = await apiFetch(`${API_URL}/api/academico/alumnos`);
            if (r.ok) data = await r.json();
        }
        if (!data || data.length === 0) return alert('No hay alumnos para generar la planilla.');
        const hoy = new Date().toISOString().slice(0,10);
        exportCSV(
            `planilla_asistencia_${hoy}.csv`,
            ['Fecha', 'ID Alumno', 'Apellido', 'Nombre', 'DNI', 'Estado'],
            data.map(a => [hoy, a.id, a.apellido, a.nombre, a.dni, ''])
        );
    };

    const fetchTarifas = async () => {
        try {
            const response = await apiFetch(`${API_URL}/api/financiero/tarifas`);
            if (response.ok) setTarifas(await response.json());
        } catch (error) { console.error(error); }
    };

    // Deportes activos, para el selector de tarifa cuando tipo_servicio = 'deporte'.
    const fetchDeportesTarifa = async () => {
        try {
            const response = await apiFetch(`${API_URL}/api/deportes`);
            if (response.ok) setDeportesTarifa(await response.json());
        } catch (error) { console.error('Error deportes:', error); }
    };

    // Recorridos de transporte, para el selector de tarifa cuando tipo_servicio = 'transporte'.
    const fetchTransportesTarifa = async () => {
        try {
            const response = await apiFetch(`${API_URL}/api/transporte`);
            if (response.ok) setTransportesTarifa(await response.json());
        } catch (error) { console.error('Error transportes:', error); }
    };

    const fetchPlanesPago = async () => {
        try {
            const response = await apiFetch(`${API_URL}/api/financiero/planes-pago`);
            if (response.ok) setPlanesPago(await response.json());
        } catch (error) { console.error('Error planes de pago:', error); }
    };

    const fetchFacturas = async () => {
        try {
            const response = await apiFetch(`${API_URL}/api/financiero/facturas${soloDeuda ? '?soloDeuda=1' : ''}`);
            if (response.ok) setFacturas(await response.json());
        } catch (error) { console.error('Error facturas:', error); }
    };

    const verDetalleFactura = async (facturaId) => {
        if (facturaAbierta === facturaId) { setFacturaAbierta(null); return; }
        try {
            const response = await apiFetch(`${API_URL}/api/financiero/facturas/${facturaId}/detalle`);
            if (response.ok) { setDetalleFactura(await response.json()); setFacturaAbierta(facturaId); }
        } catch (error) { console.error('Error detalle factura:', error); }
    };

    const fetchComprobantes = async () => {
        try {
            const response = await apiFetch(`${API_URL}/api/financiero/comprobantes${comprobanteEstado ? `?estado=${comprobanteEstado}` : ''}`);
            if (response.ok) setComprobantes(await response.json());
        } catch (error) { console.error('Error comprobantes:', error); }
    };

    const fetchServicios = async () => {
        try {
            const token = localStorage.getItem('token');
            const resTrans = await fetch(`${API_URL}/api/servicios/transporte/rutas`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (resTrans.ok) setRutasTransporte(await resTrans.json());
        } catch (error) { console.error(error); }
    };

    const deleteCurso = async (id) => {
        if (!window.confirm('¿Eliminar curso?')) return;
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/academico/cursos/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) fetchCursosYAulas();
        } catch (error) { console.error(error); }
    };

    const deleteAula = async (id) => {
        if (!window.confirm('¿Eliminar aula?')) return;
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/academico/aulas/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) fetchCursosYAulas();
        } catch (error) { console.error(error); }
    };

    const fetchNiveles = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/academico/niveles`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok) setNiveles(data);
        } catch (error) { console.error(error); }
    };

    const handleNivelSubmit = async (e) => {
        e.preventDefault();
        const form = e.target;
        const nombre = form.nombre.value.trim();
        if (!nombre) return alert('Ingresá el nombre del nivel.');
        if (!esNombreValido(nombre)) return alert('El nombre del nivel solo puede contener letras (sin números ni símbolos).');
        const url = editingNivel
            ? `${API_URL}/api/academico/niveles/${editingNivel.id}`
            : `${API_URL}/api/academico/niveles`;
        const response = await apiFetch(url, {
            method: editingNivel ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre })
        });
        if (response.ok) {
            form.reset();
            setEditingNivel(null);
            fetchNiveles();
        } else {
            const errorBody = await response.json().catch(() => ({}));
            alert(errorBody.message || 'Error al guardar el nivel');
        }
    };

    const deleteNivel = async (id) => {
        if (!window.confirm('¿Eliminar este nivel educativo?')) return;
        const response = await apiFetch(`${API_URL}/api/academico/niveles/${id}`, { method: 'DELETE' });
        if (response.ok) {
            fetchNiveles();
        } else {
            const errorBody = await response.json().catch(() => ({}));
            alert(errorBody.message || 'No se pudo eliminar el nivel');
        }
    };

    const fetchPersonal = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/financiero/personal`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok) setPersonal(data);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const [searchTermAlumno, setSearchTermAlumno] = useState('');
    const [searchTermPersonal, setSearchTermPersonal] = useState('');

    const deletePersonal = async (id) => {
        if (!window.confirm('¿Está seguro de eliminar a este miembro del personal?')) return;
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/financiero/personal/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) fetchPersonal();
        } catch (error) {
            console.error('Error:', error);
        }
    };
    const [showPersonalForm, setShowPersonalForm] = useState(false);
    const [showCursoForm, setShowCursoForm] = useState(false);
    const [showAulaForm, setShowAulaForm] = useState(false);

    const handlePersonalSubmit = async (e) => {
        e.preventDefault();
        const form = e.target;
        const personalData = {
            nombre: form.nombre.value,
            apellido: form.apellido.value,
            dni: form.dni.value,
            tipo: form.tipo.value,
            email: form.email.value
        };

        try {
            const token = localStorage.getItem('token');
            const url = editingPersonal
                ? `${API_URL}/api/financiero/personal/${editingPersonal.id}`
                : `${API_URL}/api/financiero/personal`;
            const response = await fetch(url, {
                method: editingPersonal ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(personalData)
            });
            if (response.ok) {
                setShowPersonalForm(false);
                setEditingPersonal(null);
                fetchPersonal();
            } else {
                const errorData = await response.json();
                alert(errorData.message || 'Error al guardar el legajo de personal');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error de conexión al guardar personal');
        }
    };

    const handleCursoSubmit = async (e) => {
        e.preventDefault();
        const form = e.target;
        const cursoData = {
            nivel_id: form.nivel_id.value,
            division: form.division.value,
            cupo: form.cupo.value
        };

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/academico/cursos`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify(cursoData)
            });
            if (response.ok) {
                setShowCursoForm(false);
                fetchCursosYAulas();
            }
        } catch (error) {
            console.error('Error:', error);
        }
    };

    const handleAulaSubmit = async (e) => {
        e.preventDefault();
        const form = e.target;
        const aulaData = {
            nombre: form.nombre.value,
            capacidad: form.capacidad.value
        };

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/academico/aulas`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify(aulaData)
            });
            if (response.ok) {
                setShowAulaForm(false);
                fetchCursosYAulas();
            }
        } catch (error) {
            console.error('Error:', error);
        }
    };

    const fetchCursosMssql = async () => {
        try {
            const response = await apiFetch(`${API_URL}/api/academico/cursos-mssql`);
            if (response.ok) setCursosMssql(await response.json());
        } catch (error) {
            console.error('Error cursos:', error);
        }
    };

    const fetchPadres = async () => {
        try {
            const response = await apiFetch(`${API_URL}/api/auth/padres`);
            if (response.ok) setPadres(await response.json());
        } catch (error) {
            console.error('Error padres:', error);
        }
    };

    // Alta/edición de alumno (Sprint 3: RF-03/RF-04/RF-10) contra SQL Server.
    // Éxito (201): limpia el formulario y muestra un cartel verde.
    // DNI duplicado (409): muestra el mensaje del backend en un cartel rojo.
    const handleAlumnoSubmit = async (e) => {
        e.preventDefault();
        const form = e.target;
        const alumnoData = {
            nombre: form.nombre.value.trim(),
            apellido: form.apellido.value.trim(),
            dni: form.dni.value.trim(),
            fecha_nacimiento: form.fecha_nacimiento.value,
            curso_id: parseInt(form.curso_id.value),
            padre_id: parseInt(form.padre_id.value)
        };
        if (!alumnoData.curso_id) return setMsgAlumno({ tipo: 'error', texto: 'Seleccioná un curso.' });
        if (!alumnoData.padre_id) return setMsgAlumno({ tipo: 'error', texto: 'Seleccioná un padre/tutor.' });

        try {
            const url = editingAlumno
                ? `${API_URL}/api/academico/alumnos/${editingAlumno.id}`
                : `${API_URL}/api/academico/alumnos`;

            const response = await apiFetch(url, {
                method: editingAlumno ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(alumnoData)
            });
            const data = await response.json().catch(() => ({}));
            if (response.ok) {
                form.reset();
                setEditingAlumno(null);
                fetchAlumnos();
                setMsgAlumno({ tipo: 'ok', texto: data.message || 'Alumno registrado correctamente.' });
            } else if (response.status === 409) {
                setMsgAlumno({ tipo: 'error', texto: data.message || 'Ya existe un alumno registrado con ese DNI' });
            } else {
                setMsgAlumno({ tipo: 'error', texto: data.message || 'Error al procesar el alumno' });
            }
        } catch (error) {
            console.error('Error:', error);
            setMsgAlumno({ tipo: 'error', texto: 'Error de conexión al registrar el alumno' });
        }
    };

    const deleteAlumno = async (id) => {
        if (!window.confirm('¿Está seguro de eliminar este legajo?')) return;
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/academico/alumnos/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) fetchAlumnos();
        } catch (error) {
            console.error('Error:', error);
        }
    };

    const fetchCursosYAulas = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const [resCursos, resAulas] = await Promise.all([
                fetch(`${API_URL}/api/academico/cursos`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${API_URL}/api/academico/aulas`, { headers: { 'Authorization': `Bearer ${token}` } })
            ]);
            const [dataCursos, dataAulas] = await Promise.all([resCursos.json(), resAulas.json()]);
            setCursos(dataCursos);
            setAulas(dataAulas);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchPreinscripciones = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/preinscripciones`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok) setPreinscripciones(data);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAlumnos = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/academico/alumnos`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok) setAlumnos(data);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async (id, nuevoEstado) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/preinscripciones/${id}/status`, {
                method: 'PATCH',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ estado: nuevoEstado })
            });
            if (response.ok) fetchPreinscripciones();
        } catch (error) {
            console.error('Error:', error);
        }
    };

    const filteredAlumnos = alumnos.filter(a => 
        a.nombre.toLowerCase().includes(searchTermAlumno.toLowerCase()) || 
        a.apellido.toLowerCase().includes(searchTermAlumno.toLowerCase()) ||
        a.dni.includes(searchTermAlumno)
    );

    const filteredPersonal = personal.filter(p => 
        p.nombre.toLowerCase().includes(searchTermPersonal.toLowerCase()) || 
        p.apellido.toLowerCase().includes(searchTermPersonal.toLowerCase()) ||
        p.dni.includes(searchTermPersonal)
    );

    const handleTarifaSubmit = async (e) => {
        e.preventDefault();
        const form = e.target;
        const tipo_servicio = form.tipo_servicio.value;
        const tarifaData = {
            tipo_servicio,
            descripcion: form.descripcion.value.trim() || null,
            monto: form.monto.value,
            vigencia: form.vigencia.value,
            deporte_id: tipo_servicio === 'deporte' && form.deporte_id.value ? parseInt(form.deporte_id.value) : null,
            transporte_id: tipo_servicio === 'transporte' && form.transporte_id.value ? parseInt(form.transporte_id.value) : null
        };

        try {
            const response = await apiFetch(`${API_URL}/api/financiero/tarifas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(tarifaData)
            });
            if (response.ok) { form.reset(); fetchTarifas(); }
            else { const errorBody = await response.json().catch(() => ({})); alert(errorBody.message || 'Error al guardar la tarifa'); }
        } catch (error) { console.error(error); }
    };

    const deleteTarifa = async (id) => {
        if (!window.confirm('¿Desactivar esta tarifa?')) return;
        try {
            const response = await apiFetch(`${API_URL}/api/financiero/tarifas/${id}`, { method: 'DELETE' });
            if (response.ok) fetchTarifas();
        } catch (error) { console.error(error); }
    };

    const handlePlanPagoSubmit = async (e) => {
        e.preventDefault();
        const form = e.target;
        const planData = {
            nombre: form.nombre.value.trim(),
            cantidad_cuotas: parseInt(form.cantidad_cuotas.value),
            recargo_pct: form.recargo_pct.value || 0
        };
        try {
            const response = await apiFetch(`${API_URL}/api/financiero/planes-pago`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(planData)
            });
            if (response.ok) { form.reset(); fetchPlanesPago(); }
            else { const errorBody = await response.json().catch(() => ({})); alert(errorBody.message || 'Error al guardar el plan de pago'); }
        } catch (error) { console.error(error); }
    };

    const deletePlanPago = async (id) => {
        if (!window.confirm('¿Desactivar este plan de pago?')) return;
        try {
            const response = await apiFetch(`${API_URL}/api/financiero/planes-pago/${id}`, { method: 'DELETE' });
            if (response.ok) fetchPlanesPago();
        } catch (error) { console.error(error); }
    };

    // Abre el archivo del comprobante (imagen o PDF) en una pestaña nueva.
    const verComprobante = async (comprobanteId) => {
        try {
            const response = await apiFetch(`${API_URL}/api/financiero/comprobantes/${comprobanteId}/archivo`);
            const data = await response.json().catch(() => ({}));
            if (!response.ok) return alert(data.message || 'No se pudo abrir el comprobante');
            window.open(data.url, '_blank');
        } catch (error) { console.error(error); alert('Error al abrir el comprobante'); }
    };

    const aprobarComprobante = async (id) => {
        if (!window.confirm('¿Aprobar este comprobante? Se descontará el monto de la factura.')) return;
        try {
            const response = await apiFetch(`${API_URL}/api/financiero/comprobantes/${id}/aprobar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            if (response.ok) { fetchComprobantes(); fetchFacturas(); }
            else { const errorBody = await response.json().catch(() => ({})); alert(errorBody.message || 'No se pudo aprobar el comprobante'); }
        } catch (error) { console.error(error); }
    };

    const rechazarComprobante = async (id) => {
        const observaciones = window.prompt('Motivo del rechazo (opcional):') || '';
        if (!window.confirm('¿Rechazar este comprobante?')) return;
        try {
            const response = await apiFetch(`${API_URL}/api/financiero/comprobantes/${id}/rechazar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ observaciones })
            });
            if (response.ok) fetchComprobantes();
            else { const errorBody = await response.json().catch(() => ({})); alert(errorBody.message || 'No se pudo rechazar el comprobante'); }
        } catch (error) { console.error(error); }
    };

    const handleRutaSubmit = async (e) => {
        e.preventDefault();
        const form = e.target;
        const rutaData = {
            nombre: form.nombre.value,
            chofer: form.chofer.value,
            capacidad: form.capacidad.value
        };

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/servicios/transporte/rutas`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify(rutaData)
            });
            if (response.ok) fetchServicios();
        } catch (error) { console.error(error); }
    };

    const handleAsignarTransporte = async (e) => {
        e.preventDefault();
        const form = e.target;
        const datos = {
            alumno_id: parseInt(form.alumno_id.value),
            ruta_id: parseInt(form.ruta_id.value),
            punto_encuentro: form.punto_encuentro.value.trim()
        };
        if (!datos.alumno_id || !datos.ruta_id) return alert('Seleccioná alumno y ruta.');
        const response = await apiFetch(`${API_URL}/api/servicios/transporte/asignar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });
        if (response.ok) { form.reset(); alert('Alumno asignado a la ruta correctamente.'); }
        else { const errorBody = await response.json().catch(() => ({})); alert(errorBody.message || 'Error al asignar el alumno a la ruta'); }
    };

    const deleteRuta = async (id) => {
        if (!window.confirm('¿Eliminar ruta?')) return;
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/servicios/transporte/rutas/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) fetchServicios();
        } catch (error) { console.error(error); }
    };

    return (
        <DashboardLayout title="Panel de Administración">
            {/* Tabs de Navegación */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
                <button 
                    onClick={() => setActiveTab('preinscripciones')} 
                    className={`btn ${activeTab === 'preinscripciones' ? 'btn-violet' : 'btn-hero-outline'}`}
                    style={{ fontSize: '0.8rem', color: activeTab === 'preinscripciones' ? 'white' : 'var(--blue)' }}
                >
                    📋 Preinscripciones
                </button>
                <button 
                    onClick={() => setActiveTab('alumnos')} 
                    className={`btn ${activeTab === 'alumnos' ? 'btn-violet' : 'btn-hero-outline'}`}
                    style={{ fontSize: '0.8rem', color: activeTab === 'alumnos' ? 'white' : 'var(--blue)' }}
                >
                    🎒 Legajos Alumnos
                </button>
                <button
                    onClick={() => setActiveTab('academico')}
                    className={`btn ${activeTab === 'academico' ? 'btn-violet' : 'btn-hero-outline'}`}
                    style={{ fontSize: '0.8rem', color: activeTab === 'academico' ? 'white' : 'var(--blue)' }}
                >
                    📚 Gestión Académica
                </button>
                <button 
                    onClick={() => setActiveTab('personal')} 
                    className={`btn ${activeTab === 'personal' ? 'btn-violet' : 'btn-hero-outline'}`}
                    style={{ fontSize: '0.8rem', color: activeTab === 'personal' ? 'white' : 'var(--blue)' }}
                >
                    👨‍🏫 Personal y Docentes
                </button>
                <button 
                    onClick={() => setActiveTab('finanzas')} 
                    className={`btn ${activeTab === 'finanzas' ? 'btn-violet' : 'btn-hero-outline'}`}
                    style={{ fontSize: '0.8rem', color: activeTab === 'finanzas' ? 'white' : 'var(--blue)' }}
                >
                    💰 Finanzas y Pagos
                </button>
                <button 
                    onClick={() => setActiveTab('servicios')} 
                    className={`btn ${activeTab === 'servicios' ? 'btn-violet' : 'btn-hero-outline'}`}
                    style={{ fontSize: '0.8rem', color: activeTab === 'servicios' ? 'white' : 'var(--blue)' }}
                >
                    🔧 Servicios
                </button>
                <button
                    onClick={() => setActiveTab('usuarios')}
                    className={`btn ${activeTab === 'usuarios' ? 'btn-violet' : 'btn-hero-outline'}`}
                    style={{ fontSize: '0.8rem', color: activeTab === 'usuarios' ? 'white' : 'var(--blue)' }}
                >
                    👤 Usuarios y Roles
                </button>
                <button
                    onClick={() => setActiveTab('reportes')}
                    className={`btn ${activeTab === 'reportes' ? 'btn-violet' : 'btn-hero-outline'}`}
                    style={{ fontSize: '0.8rem', color: activeTab === 'reportes' ? 'white' : 'var(--blue)' }}
                >
                    📊 Reportes
                </button>
            </div>

            {activeTab === 'preinscripciones' && (
                <>
                    {/* Estadísticas Rápidas */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                        <div className="dashboard-card" style={{ ...cardStyle, borderLeft: '4px solid var(--blue)' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-sm)', textTransform: 'uppercase' }}>Total Preinscripciones</span>
                            <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--blue)', marginTop: '8px' }}>{preinscripciones.length}</div>
                        </div>
                        <div className="dashboard-card" style={{ ...cardStyle, borderLeft: '4px solid var(--orange)' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-sm)', textTransform: 'uppercase' }}>Pendientes</span>
                            <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--orange)', marginTop: '8px' }}>
                                {preinscripciones.filter(p => p.estado === 'pendiente').length}
                            </div>
                        </div>
                    </div>

                    <div style={{ background: 'var(--white)', padding: '24px', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '1.25rem', color: 'var(--blue)', fontWeight: 800 }}>Solicitudes de Admisión</h2>
                            <button onClick={fetchPreinscripciones} className="btn btn-hero-outline" style={{ fontSize: '0.85rem', padding: '8px 16px' }}>🔄 Actualizar</button>
                        </div>

                        {loading ? <p>Cargando...</p> : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                                            <th style={thStyle}>Fecha</th>
                                            <th style={thStyle}>Alumno/DNI</th>
                                            <th style={thStyle}>Nivel/Turno</th>
                                            <th style={thStyle}>Estado</th>
                                            <th style={thStyle}>Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {preinscripciones.map((p) => (
                                            <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={tdStyle}>{new Date(p.fecha).toLocaleDateString()}</td>
                                                <td style={tdStyle}>
                                                    <div style={{ fontWeight: 700 }}>{p.alumno_nombre}</div>
                                                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>DNI: {p.alumno_dni}</div>
                                                </td>
                                                <td style={tdStyle}>{p.nivel} - {p.turno}</td>
                                                <td style={tdStyle}>
                                                    <span style={{
                                                        padding: '4px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: '800',
                                                        backgroundColor: getStatusColor(p.estado).bg, color: getStatusColor(p.estado).text
                                                    }}>{p.estado}</span>
                                                </td>
                                                <td style={tdStyle}>
                                                    <select value={p.estado} onChange={(e) => updateStatus(p.id, e.target.value)} style={{ padding: '4px', borderRadius: '4px' }}>
                                                        <option value="pendiente">Pendiente</option>
                                                        <option value="contactado">Contactado</option>
                                                        <option value="entrevista">Entrevista</option>
                                                        <option value="inscripto">Inscripto</option>
                                                        <option value="rechazado">Rechazado</option>
                                                    </select>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            {activeTab === 'alumnos' && (
                <div style={{ background: 'var(--white)', padding: '24px', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--blue)', fontWeight: 800 }}>Gestión de Legajos</h2>
                        <div style={{ display: 'flex', gap: '12px', flex: 1, maxWidth: '400px', marginLeft: '24px' }}>
                            <input 
                                type="text" 
                                placeholder="🔍 Buscar por nombre o DNI..." 
                                style={{ ...inputStyle, padding: '8px 16px' }}
                                value={searchTermAlumno}
                                onChange={(e) => setSearchTermAlumno(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={() => { setShowAlumnoForm(!showAlumnoForm); setMsgAlumno(null); setEditingAlumno(null); }}
                            className="btn btn-green" style={{ fontSize: '0.85rem' }}
                        >
                            {showAlumnoForm ? '✕ Cancelar' : '+ Nuevo Alumno'}
                        </button>
                    </div>

                    {msgAlumno && (
                        <div role="alert" style={{
                            marginBottom: '16px', padding: '14px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 700,
                            background: msgAlumno.tipo === 'ok' ? '#dcfce7' : '#fee2e2',
                            color: msgAlumno.tipo === 'ok' ? '#166534' : '#dc2626',
                            border: `1px solid ${msgAlumno.tipo === 'ok' ? '#bbf7d0' : '#fecaca'}`
                        }}>
                            {msgAlumno.tipo === 'ok' ? '✅ ' : '⚠️ '}{msgAlumno.texto}
                        </div>
                    )}

                    {showAlumnoForm && (
                        <form onSubmit={handleAlumnoSubmit} style={{
                            background: '#f8fafc', padding: '20px', borderRadius: '12px', marginBottom: '24px',
                            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px'
                        }}>
                            <input type="text" placeholder="Nombre" required style={inputStyle} name="nombre" defaultValue={editingAlumno?.nombre || ''} />
                            <input type="text" placeholder="Apellido" required style={inputStyle} name="apellido" defaultValue={editingAlumno?.apellido || ''} />
                            <input type="number" placeholder="DNI" required style={inputStyle} name="dni" defaultValue={editingAlumno?.dni || ''} />
                            <input type="date" required style={inputStyle} name="fecha_nacimiento" defaultValue={editingAlumno?.fecha_nacimiento || ''} />
                            <select required style={inputStyle} name="curso_id" defaultValue={editingAlumno?.curso_id || ''}>
                                <option value="">Seleccionar Curso</option>
                                {cursosMssql.map(c => (
                                    <option key={c.id} value={c.id}>{c.nivel} {c.grado}°{c.division} - {c.turno} ({c.ciclo_lectivo})</option>
                                ))}
                            </select>
                            <select required style={inputStyle} name="padre_id" defaultValue={editingAlumno?.padre_id || ''}>
                                <option value="">Seleccionar Padre/Tutor</option>
                                {padres.map(p => (
                                    <option key={p.id} value={p.id}>{p.nombre} ({p.username})</option>
                                ))}
                            </select>
                            <button type="submit" className="btn btn-violet" style={{ height: '45px' }}>
                                {editingAlumno ? 'Guardar Cambios' : 'Registrar Legajo'}
                            </button>
                        </form>
                    )}

                    {loading ? <p>Cargando legajos...</p> : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                                        <th style={thStyle}>Legajo</th>
                                        <th style={thStyle}>Nombre y Apellido</th>
                                        <th style={thStyle}>DNI</th>
                                        <th style={thStyle}>Curso</th>
                                        <th style={thStyle}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAlumnos.length === 0 ? (
                                        <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>No se encontraron alumnos.</td></tr>
                                    ) : (
                                        filteredAlumnos.map((a) => (
                                            <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={tdStyle}>#{a.id}</td>
                                                <td style={tdStyle}><strong>{a.apellido}, {a.nombre}</strong></td>
                                                <td style={tdStyle}>{a.dni}</td>
                                                <td style={tdStyle}>{a.nivel ? `${a.nivel} ${a.grado}°${a.division} - ${a.turno}` : 'Sin asignar'}</td>
                                                <td style={tdStyle}>
                                                    <button 
                                                        onClick={() => {
                                                            setEditingAlumno(a);
                                                            setShowAlumnoForm(true);
                                                        }}
                                                        style={{ background: 'none', border: 'none', color: 'var(--blue)', fontWeight: 700, cursor: 'pointer', marginRight: '10px' }}
                                                    >
                                                        Editar
                                                    </button>
                                                    <button 
                                                        onClick={() => deleteAlumno(a.id)}
                                                        style={{ background: 'none', border: 'none', color: '#dc2626', fontWeight: 700, cursor: 'pointer' }}
                                                    >
                                                        Baja
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'academico' && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
                    {[
                        { key: 'cursos', label: '🏫 Cursos y Aulas' },
                        { key: 'materias', label: '📖 Materias' },
                        { key: 'horarios', label: '🕐 Horarios' },
                        { key: 'actividades', label: '🎭 Actividades' }
                    ].map(s => (
                        <button
                            key={s.key}
                            onClick={() => setAcademicoSub(s.key)}
                            className={`btn ${academicoSub === s.key ? 'btn-green' : 'btn-hero-outline'}`}
                            style={{ fontSize: '0.78rem', padding: '8px 14px', color: academicoSub === s.key ? 'white' : 'var(--blue)' }}
                        >
                            {s.label}
                        </button>
                    ))}
                </div>
            )}

            {activeTab === 'academico' && academicoSub === 'cursos' && (
              <>
                <div style={{ background: 'var(--white)', padding: '24px', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)', marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '1.25rem', color: 'var(--blue)', fontWeight: 800, marginBottom: '8px' }}>Niveles Educativos</h2>
                    <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '16px' }}>
                        Configurá los niveles (Inicial, Primario, Secundario u otros). Las divisiones se crean luego como cursos dentro de cada nivel.
                    </p>
                    <form onSubmit={handleNivelSubmit} style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                        <input key={`nivel-${editingNivel?.id || 'new'}`} type="text" name="nombre" placeholder="Nombre del nivel (Ej: Inicial)" required style={{ ...inputStyle, flex: 1, minWidth: '220px' }} defaultValue={editingNivel?.nombre || ''} />
                        <button type="submit" className="btn btn-violet" style={{ whiteSpace: 'nowrap' }}>{editingNivel ? 'Guardar Cambios' : '+ Crear Nivel'}</button>
                        {editingNivel && (
                            <button type="button" onClick={() => setEditingNivel(null)} className="btn btn-hero-outline" style={{ whiteSpace: 'nowrap', color: 'var(--blue)' }}>Cancelar</button>
                        )}
                    </form>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {niveles.length === 0 ? (
                            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>No hay niveles configurados.</span>
                        ) : (
                            niveles.map(n => (
                                <span key={n.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#eff6ff', color: 'var(--blue)', fontWeight: 700, fontSize: '0.85rem', padding: '6px 12px', borderRadius: '20px' }}>
                                    {n.nombre}
                                    <button onClick={() => setEditingNivel(n)} title="Editar nivel" style={{ background: 'none', border: 'none', color: 'var(--blue)', fontWeight: 800, cursor: 'pointer', fontSize: '0.9rem', lineHeight: 1 }}>✎</button>
                                    <button onClick={() => deleteNivel(n.id)} title="Eliminar nivel" style={{ background: 'none', border: 'none', color: '#dc2626', fontWeight: 800, cursor: 'pointer', fontSize: '0.9rem', lineHeight: 1 }}>✕</button>
                                </span>
                            ))
                        )}
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    <div style={{ background: 'var(--white)', padding: '24px', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '1.25rem', color: 'var(--blue)', fontWeight: 800 }}>Cursos</h2>
                            <button onClick={() => setShowCursoForm(!showCursoForm)} className="btn btn-green" style={{ fontSize: '0.85rem' }}>
                                {showCursoForm ? '✕ Cancelar' : '+ Nuevo Curso'}
                            </button>
                        </div>
                        {showCursoForm && (
                            <form onSubmit={handleCursoSubmit} style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <select name="nivel_id" required style={inputStyle}>
                                    <option value="">Seleccionar Nivel</option>
                                    {niveles.map(n => <option key={n.id} value={n.id}>{n.nombre}</option>)}
                                </select>
                                <input type="text" name="division" placeholder="División (Ej: A, B, 1°)" required style={inputStyle} />
                                <input type="number" name="cupo" min="1" step="1" placeholder="Cupo Máximo" required style={inputStyle} />
                                <button type="submit" className="btn btn-violet">Crear Curso</button>
                            </form>
                        )}
                        {loading ? <p>Cargando...</p> : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                                        <th style={thStyle}>Nivel</th>
                                        <th style={thStyle}>División</th>
                                        <th style={thStyle}>Cupo</th>
                                        <th style={thStyle}>Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cursos.length === 0 ? (
                                        <tr><td colSpan="4" style={{ textAlign: 'center', padding: '10px' }}>No hay cursos registrados.</td></tr>
                                    ) : (
                                        cursos.map(c => (
                                            <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={tdStyle}>{c.nivel_nombre}</td>
                                                <td style={tdStyle}><strong>{c.division}</strong></td>
                                                <td style={tdStyle}>{c.cupo} alumnos</td>
                                                <td style={tdStyle}>
                                                    <button onClick={() => deleteCurso(c.id)} style={{ background: 'none', border: 'none', color: '#dc2626', fontWeight: 700, cursor: 'pointer' }}>Eliminar</button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <div style={{ background: 'var(--white)', padding: '24px', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '1.25rem', color: 'var(--blue)', fontWeight: 800 }}>Aulas</h2>
                            <button onClick={() => setShowAulaForm(!showAulaForm)} className="btn btn-green" style={{ fontSize: '0.85rem' }}>
                                {showAulaForm ? '✕ Cancelar' : '+ Nueva Aula'}
                            </button>
                        </div>
                        {showAulaForm && (
                            <form onSubmit={handleAulaSubmit} style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <input type="text" name="nombre" placeholder="Nombre del Aula" required style={inputStyle} />
                                <input type="number" name="capacidad" min="1" step="1" placeholder="Capacidad" required style={inputStyle} />
                                <button type="submit" className="btn btn-violet">Crear Aula</button>
                            </form>
                        )}
                        {loading ? <p>Cargando...</p> : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                                        <th style={thStyle}>Nombre</th>
                                        <th style={thStyle}>Capacidad</th>
                                        <th style={thStyle}>Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {aulas.map(a => (
                                        <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={tdStyle}>{a.nombre}</td>
                                            <td style={tdStyle}>{a.capacidad} pers.</td>
                                            <td style={tdStyle}>
                                                <button onClick={() => deleteAula(a.id)} style={{ background: 'none', border: 'none', color: '#dc2626', fontWeight: 700, cursor: 'pointer' }}>Eliminar</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
              </>
            )}

            {activeTab === 'personal' && (
                <div style={{ background: 'var(--white)', padding: '24px', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--blue)', fontWeight: 800 }}>Personal de la Institución</h2>
                        <div style={{ display: 'flex', gap: '12px', flex: 1, maxWidth: '400px', marginLeft: '24px' }}>
                            <input 
                                type="text" 
                                placeholder="🔍 Buscar personal..." 
                                style={{ ...inputStyle, padding: '8px 16px' }}
                                value={searchTermPersonal}
                                onChange={(e) => setSearchTermPersonal(e.target.value)}
                            />
                        </div>
                        <button onClick={() => { if (showPersonalForm) { setShowPersonalForm(false); setEditingPersonal(null); } else { setEditingPersonal(null); setShowPersonalForm(true); } }} className="btn btn-green" style={{ fontSize: '0.85rem' }}>
                            {showPersonalForm ? '✕ Cancelar' : '+ Nuevo Personal'}
                        </button>
                    </div>

                    {showPersonalForm && (
                        <form onSubmit={handlePersonalSubmit} style={{ 
                            background: '#f8fafc', padding: '20px', borderRadius: '12px', marginBottom: '24px',
                            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px'
                        }}>
                            <input key={`nombre-${editingPersonal?.id || 'new'}`} type="text" name="nombre" placeholder="Nombre" required style={inputStyle} defaultValue={editingPersonal?.nombre || ''} />
                            <input key={`apellido-${editingPersonal?.id || 'new'}`} type="text" name="apellido" placeholder="Apellido" required style={inputStyle} defaultValue={editingPersonal?.apellido || ''} />
                            <input key={`dni-${editingPersonal?.id || 'new'}`} type="text" name="dni" placeholder="DNI" required style={inputStyle} defaultValue={editingPersonal?.dni || ''} />
                            <input key={`email-${editingPersonal?.id || 'new'}`} type="email" name="email" placeholder="Email" required style={inputStyle} defaultValue={editingPersonal?.email || ''} />
                            <select key={`tipo-${editingPersonal?.id || 'new'}`} name="tipo" required style={inputStyle} defaultValue={editingPersonal?.tipo || 'Docente'}>
                                <option value="Docente">Docente</option>
                                <option value="Administrativo">Administrativo</option>
                                <option value="Maestranza">Maestranza</option>
                                <option value="Directivo">Directivo</option>
                            </select>
                            <button type="submit" className="btn btn-violet">{editingPersonal ? 'Guardar Cambios' : 'Registrar Personal'}</button>
                        </form>
                    )}
                    {loading ? <p>Cargando personal...</p> : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                                        <th style={thStyle}>Legajo</th>
                                        <th style={thStyle}>Nombre</th>
                                        <th style={thStyle}>DNI</th>
                                        <th style={thStyle}>Tipo</th>
                                        <th style={thStyle}>Email</th>
                                        <th style={thStyle}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {personal.length === 0 ? (
                                        <tr><td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>No hay personal registrado.</td></tr>
                                    ) : (
                                        filteredPersonal.map((p) => (
                                            <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={tdStyle}>#{p.id}</td>
                                                <td style={tdStyle}><strong>{p.apellido}, {p.nombre}</strong></td>
                                                <td style={tdStyle}>{p.dni}</td>
                                                <td style={tdStyle}><span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--blue)' }}>{p.tipo.toUpperCase()}</span></td>
                                                <td style={tdStyle}>{p.email}</td>
                                                <td style={tdStyle}>
                                                    <button
                                                        onClick={() => { setEditingPersonal(p); setShowPersonalForm(true); }}
                                                        style={{ background: 'none', border: 'none', color: 'var(--blue)', fontWeight: 700, cursor: 'pointer', marginRight: '10px' }}
                                                    >
                                                        Editar
                                                    </button>
                                                    <button
                                                        onClick={() => deletePersonal(p.id)}
                                                        style={{ background: 'none', border: 'none', color: '#dc2626', fontWeight: 700, cursor: 'pointer' }}
                                                    >
                                                        Baja
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'finanzas' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ background: 'var(--white)', padding: '24px', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--blue)', fontWeight: 800, marginBottom: '24px' }}>Establecer Tarifas</h2>
                        <form onSubmit={handleTarifaSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={labelStyle}>Tipo de servicio</label>
                                <select name="tipo_servicio" required style={inputStyle} defaultValue="cuota">
                                    <option value="cuota">Cuota</option>
                                    <option value="deporte">Deporte</option>
                                    <option value="transporte">Transporte</option>
                                    <option value="comedor">Comedor</option>
                                </select>
                            </div>
                            <div>
                                <label style={labelStyle}>Deporte (solo si el tipo es "Deporte")</label>
                                <select name="deporte_id" style={inputStyle} defaultValue="">
                                    <option value="">Sin asociar</option>
                                    {deportesTarifa.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={labelStyle}>Recorrido (solo si el tipo es "Transporte")</label>
                                <select name="transporte_id" style={inputStyle} defaultValue="">
                                    <option value="">Sin asociar</option>
                                    {transportesTarifa.map(t => <option key={t.id} value={t.id}>Recorrido {t.numero_recorrido} — {t.nombre}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={labelStyle}>Descripción</label>
                                <input type="text" name="descripcion" placeholder="Ej: Cuota mensual Nivel Primario" style={inputStyle} />
                            </div>
                            <div>
                                <label style={labelStyle}>Monto ($)</label>
                                <input type="number" name="monto" min="0.01" step="0.01" placeholder="Ej: 45000.00" required style={inputStyle} />
                            </div>
                            <div>
                                <label style={labelStyle}>Vigencia (desde)</label>
                                <input type="date" name="vigencia" required style={inputStyle} />
                            </div>
                            <button type="submit" className="btn btn-hero-orange" style={{ padding: '14px', color: 'white' }}>Guardar Tarifa</button>
                        </form>

                        <h3 style={{ fontSize: '1.05rem', color: 'var(--blue)', fontWeight: 800, margin: '32px 0 16px' }}>Tarifas vigentes</h3>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                                    <th style={thStyle}>Servicio</th>
                                    <th style={thStyle}>Monto</th>
                                    <th style={thStyle}>Vigencia</th>
                                    <th style={thStyle}>Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tarifas.length === 0 ? (
                                    <tr><td colSpan="4" style={{ textAlign: 'center', padding: '20px' }}>No hay tarifas configuradas.</td></tr>
                                ) : (
                                    tarifas.map(t => (
                                        <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={tdStyle}>{t.descripcion || t.tipo_servicio}{t.deporte_nombre ? ` (${t.deporte_nombre})` : ''}{t.transporte_nombre ? ` (${t.transporte_nombre})` : ''}</td>
                                            <td style={tdStyle}><strong>${Number(t.monto).toFixed(2)}</strong></td>
                                            <td style={tdStyle}>{t.vigencia}{t.vigencia_hasta ? ` a ${t.vigencia_hasta}` : ''}</td>
                                            <td style={tdStyle}>
                                                {t.activo && <button onClick={() => deleteTarifa(t.id)} style={{ background: 'none', border: 'none', color: '#dc2626', fontWeight: 700, cursor: 'pointer' }}>Desactivar</button>}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div style={{ background: 'var(--white)', padding: '24px', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--blue)', fontWeight: 800, marginBottom: '24px' }}>Planes de Pago (cuotas)</h2>
                        <form onSubmit={handlePlanPagoSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={labelStyle}>Nombre</label>
                                <input type="text" name="nombre" placeholder="Ej: 3 cuotas" required style={inputStyle} />
                            </div>
                            <div>
                                <label style={labelStyle}>Cantidad de cuotas</label>
                                <input type="number" name="cantidad_cuotas" min="1" max="24" placeholder="Ej: 3" required style={inputStyle} />
                            </div>
                            <div>
                                <label style={labelStyle}>Recargo (%)</label>
                                <input type="number" name="recargo_pct" min="0" step="0.01" defaultValue="0" style={inputStyle} />
                            </div>
                            <button type="submit" className="btn btn-hero-orange" style={{ padding: '14px', color: 'white' }}>Guardar Plan</button>
                        </form>

                        <h3 style={{ fontSize: '1.05rem', color: 'var(--blue)', fontWeight: 800, margin: '32px 0 16px' }}>Planes vigentes</h3>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                                    <th style={thStyle}>Nombre</th>
                                    <th style={thStyle}>Cuotas</th>
                                    <th style={thStyle}>Recargo</th>
                                    <th style={thStyle}>Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {planesPago.length === 0 ? (
                                    <tr><td colSpan="4" style={{ textAlign: 'center', padding: '20px' }}>No hay planes de pago configurados.</td></tr>
                                ) : (
                                    planesPago.map(p => (
                                        <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={tdStyle}>{p.nombre}</td>
                                            <td style={tdStyle}>{p.cantidad_cuotas}</td>
                                            <td style={tdStyle}>{Number(p.recargo_pct) > 0 ? `${p.recargo_pct}%` : 'Sin recargo'}</td>
                                            <td style={tdStyle}>
                                                {p.activo && <button onClick={() => deletePlanPago(p.id)} style={{ background: 'none', border: 'none', color: '#dc2626', fontWeight: 700, cursor: 'pointer' }}>Desactivar</button>}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                  </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div style={{ background: 'var(--white)', padding: '24px', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h2 style={{ fontSize: '1.25rem', color: 'var(--blue)', fontWeight: 800 }}>Facturas</h2>
                                <label style={{ fontSize: '0.8rem', display: 'flex', gap: '6px', alignItems: 'center' }}>
                                    <input type="checkbox" checked={soloDeuda} onChange={(e) => setSoloDeuda(e.target.checked)} />
                                    Solo con deuda
                                </label>
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                                        <th style={thStyle}>Alumno</th>
                                        <th style={thStyle}>Período</th>
                                        <th style={thStyle}>Estado</th>
                                        <th style={thStyle}>Saldo</th>
                                        <th style={thStyle}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {facturas.length === 0 ? (
                                        <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>No hay facturas para mostrar.</td></tr>
                                    ) : (
                                        facturas.map(f => (
                                            <React.Fragment key={f.id}>
                                                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={tdStyle}>{f.alumno_apellido}, {f.alumno_nombre}</td>
                                                    <td style={tdStyle}>{f.periodo}</td>
                                                    <td style={tdStyle}>{f.estado}</td>
                                                    <td style={tdStyle}><strong>${Number(f.saldo).toFixed(2)}</strong> / ${Number(f.total).toFixed(2)}</td>
                                                    <td style={tdStyle}>
                                                        <button onClick={() => verDetalleFactura(f.id)} style={{ background: 'none', border: 'none', color: 'var(--blue)', fontWeight: 700, cursor: 'pointer' }}>
                                                            {facturaAbierta === f.id ? 'Ocultar' : 'Ver detalle'}
                                                        </button>
                                                    </td>
                                                </tr>
                                                {facturaAbierta === f.id && (
                                                    <tr>
                                                        <td colSpan="5" style={{ padding: '8px 16px', background: '#f8fafc' }}>
                                                            {detalleFactura.length === 0 ? 'Sin conceptos.' : (
                                                                <ul style={{ margin: 0, paddingLeft: '18px' }}>
                                                                    {detalleFactura.map(d => (
                                                                        <li key={d.id}>{d.descripcion}: ${Number(d.subtotal).toFixed(2)}</li>
                                                                    ))}
                                                                </ul>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div style={{ background: 'var(--white)', padding: '24px', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h2 style={{ fontSize: '1.25rem', color: 'var(--blue)', fontWeight: 800 }}>Comprobantes de transferencia</h2>
                                <select value={comprobanteEstado} onChange={(e) => setComprobanteEstado(e.target.value)} style={{ ...inputStyle, width: 'auto', padding: '6px 10px' }}>
                                    <option value="Pendiente">Pendientes</option>
                                    <option value="Aprobado">Aprobados</option>
                                    <option value="Rechazado">Rechazados</option>
                                    <option value="">Todos</option>
                                </select>
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                                        <th style={thStyle}>Alumno</th>
                                        <th style={thStyle}>Período</th>
                                        <th style={thStyle}>Cuota</th>
                                        <th style={thStyle}>Monto</th>
                                        <th style={thStyle}>Cargado</th>
                                        <th style={thStyle}>Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {comprobantes.length === 0 ? (
                                        <tr><td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>No hay comprobantes para mostrar.</td></tr>
                                    ) : (
                                        comprobantes.map(c => (
                                            <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={tdStyle}>{c.alumno_apellido}, {c.alumno_nombre}</td>
                                                <td style={tdStyle}>{c.periodo}</td>
                                                <td style={tdStyle}>{c.numero_cuota ? `Cuota ${c.numero_cuota}${c.cantidad_cuotas ? `/${c.cantidad_cuotas}` : ''}` : 'Pago directo'}</td>
                                                <td style={tdStyle}><strong>${Number(c.monto).toFixed(2)}</strong></td>
                                                <td style={tdStyle}>{new Date(c.fecha_carga).toLocaleDateString('es-AR')}</td>
                                                <td style={tdStyle}>
                                                    <button onClick={() => verComprobante(c.id)} style={{ background: 'none', border: 'none', color: 'var(--blue)', fontWeight: 700, cursor: 'pointer', marginRight: '10px' }}>Ver</button>
                                                    {c.estado_verificacion === 'Pendiente' && (
                                                        <>
                                                            <button onClick={() => aprobarComprobante(c.id)} style={{ background: 'none', border: 'none', color: '#166534', fontWeight: 700, cursor: 'pointer', marginRight: '10px' }}>Aprobar</button>
                                                            <button onClick={() => rechazarComprobante(c.id)} style={{ background: 'none', border: 'none', color: '#dc2626', fontWeight: 700, cursor: 'pointer' }}>Rechazar</button>
                                                        </>
                                                    )}
                                                    {c.estado_verificacion !== 'Pendiente' && <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{c.estado_verificacion}</span>}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'servicios' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
                    <div style={{ background: 'var(--white)', padding: '24px', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--blue)', fontWeight: 800, marginBottom: '24px' }}>Rutas de Transporte</h2>
                        <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '16px' }}>El agendamiento de instalaciones (pileta, gimnasio, laboratorios) se gestiona desde el panel docente.</p>
                        <form onSubmit={handleRutaSubmit} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                            <input type="text" name="nombre" placeholder="Nombre Ruta" required style={inputStyle} />
                            <input type="text" name="chofer" placeholder="Chofer" required style={inputStyle} />
                            <input type="number" name="capacidad" min="1" step="1" placeholder="Cap." required style={{ ...inputStyle, width: '80px' }} />
                            <button type="submit" className="btn btn-green">+</button>
                        </form>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                                    <th style={thStyle}>Ruta</th>
                                    <th style={thStyle}>Chofer</th>
                                    <th style={thStyle}>Cap.</th>
                                    <th style={thStyle}>Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rutasTransporte.length === 0 ? (
                                    <tr><td colSpan="4" style={{ textAlign: 'center', padding: '10px' }}>No hay rutas.</td></tr>
                                ) : (
                                    rutasTransporte.map(r => (
                                        <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={tdStyle}>{r.nombre}</td>
                                            <td style={tdStyle}>{r.chofer}</td>
                                            <td style={tdStyle}>{r.capacidad}</td>
                                            <td style={tdStyle}>
                                                <button onClick={() => deleteRuta(r.id)} style={{ background: 'none', border: 'none', color: '#dc2626', fontWeight: 700, cursor: 'pointer' }}>Eliminar</button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>

                        <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
                            <h3 style={{ fontSize: '1.05rem', color: 'var(--blue)', fontWeight: 800, marginBottom: '8px' }}>🚏 Asignar alumno a una ruta</h3>
                            <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '12px' }}>Asigná un alumno a un recorrido e indicá su punto de encuentro.</p>
                            <form onSubmit={handleAsignarTransporte} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', alignItems: 'end' }}>
                                <select name="alumno_id" required style={inputStyle} defaultValue="">
                                    <option value="">Seleccionar alumno...</option>
                                    {alumnos.map(a => <option key={a.id} value={a.id}>{a.apellido}, {a.nombre} (DNI {a.dni})</option>)}
                                </select>
                                <select name="ruta_id" required style={inputStyle} defaultValue="">
                                    <option value="">Seleccionar ruta...</option>
                                    {rutasTransporte.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                                </select>
                                <input type="text" name="punto_encuentro" placeholder="Punto de encuentro (opcional)" style={inputStyle} />
                                <button type="submit" className="btn btn-green" style={{ whiteSpace: 'nowrap' }}>Asignar</button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'reportes' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                    <div style={{ background: 'var(--white)', padding: '24px', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)' }}>
                        <h2 style={{ fontSize: '1.1rem', color: 'var(--blue)', fontWeight: 800, marginBottom: '20px' }}>📈 Indicadores Institucionales</h2>
                        {reportesStats === null ? (
                            <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Cargando estadísticas…</p>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                                <div style={{ padding: '14px', background: '#f0f9ff', borderRadius: '10px', textAlign: 'center' }}>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Alumnos</span>
                                    <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--blue)' }}>{reportesStats.total_alumnos}</div>
                                </div>
                                <div style={{ padding: '14px', background: '#f0fdf4', borderRadius: '10px', textAlign: 'center' }}>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Docentes</span>
                                    <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--green)' }}>{reportesStats.total_docentes}</div>
                                </div>
                                <div style={{ padding: '14px', background: '#fffbeb', borderRadius: '10px', textAlign: 'center' }}>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Preinscr. Pendientes</span>
                                    <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--orange)' }}>{reportesStats.preinscripciones_pendientes}</div>
                                </div>
                                <div style={{ padding: '14px', background: '#fef2f2', borderRadius: '10px', textAlign: 'center' }}>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Deuda Total</span>
                                    <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#991b1b' }}>${Number(reportesStats.deuda_total || 0).toFixed(2)}</div>
                                </div>
                            </div>
                        )}
                        <button onClick={() => { fetchReportesStats(); fetchReportesFinancieros(); fetchReporteAcademico(); fetchReportePagos(); fetchReporteDeudores(); }} className="btn btn-hero-outline" style={{ fontSize: '0.75rem', color: 'var(--blue)', borderColor: 'var(--blue)', marginTop: '16px' }}>🔄 Refrescar reportes</button>
                    </div>

                    <div style={{ gridColumn: '1 / -1', background: 'var(--white)', padding: '24px', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)', overflowX: 'auto' }}>
                        <h2 style={{ fontSize: '1.1rem', color: 'var(--blue)', fontWeight: 800, marginBottom: '16px' }}>📊 Finanzas por servicio</h2>
                        {!reportesFinancieros ? <p style={{ color: '#64748b' }}>Cargando datos financieros…</p> : <>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginBottom: '24px' }}>
                                <thead><tr style={{ borderBottom: '2px solid #f1f5f9' }}><th style={thStyle}>Deporte / transporte</th><th style={thStyle}>Facturado</th><th style={thStyle}>Ingresos</th></tr></thead>
                                <tbody>{(reportesFinancieros.por_servicio || []).filter(r => ['deporte', 'transporte'].includes(r.servicio)).map(r => <tr key={r.servicio} style={{ borderBottom: '1px solid #f1f5f9' }}><td style={tdStyle}>{r.servicio}</td><td style={tdStyle}>${Number(r.facturado || 0).toFixed(2)}</td><td style={tdStyle}>${Number(r.ingresos || 0).toFixed(2)}</td></tr>)}
                                    {!(reportesFinancieros.por_servicio || []).some(r => ['deporte', 'transporte'].includes(r.servicio)) && <tr><td colSpan="3" style={{ padding: 16, color: '#64748b' }}>Todavía no hay cargos de deporte o transporte.</td></tr>}</tbody>
                            </table>
                            <h3 style={{ color: 'var(--blue)', marginBottom: 12 }}>Morosos</h3>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginBottom: '24px' }}>
                                <thead><tr style={{ borderBottom: '2px solid #f1f5f9' }}><th style={thStyle}>Alumno</th><th style={thStyle}>Deuda pendiente</th></tr></thead>
                                <tbody>{(reportesFinancieros.morosos || []).map(r => <tr key={r.alumno_id} style={{ borderBottom: '1px solid #f1f5f9' }}><td style={tdStyle}>{r.apellido}, {r.nombre}</td><td style={tdStyle}>${Number(r.deuda || 0).toFixed(2)}</td></tr>)}
                                    {!(reportesFinancieros.morosos || []).length && <tr><td colSpan="2" style={{ padding: 16, color: '#64748b' }}>No hay saldos pendientes.</td></tr>}</tbody>
                            </table>
                            <h3 style={{ color: 'var(--blue)', marginBottom: 12 }}>Facturas y pagos aplicados</h3>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead><tr style={{ borderBottom: '2px solid #f1f5f9' }}><th style={thStyle}>Fecha</th><th style={thStyle}>Alumno</th><th style={thStyle}>Estado</th><th style={thStyle}>Total</th><th style={thStyle}>Saldo</th></tr></thead>
                                <tbody>{(reportesFinancieros.facturas || []).map(r => <tr key={r.factura_id} style={{ borderBottom: '1px solid #f1f5f9' }}><td style={tdStyle}>{new Date(r.fecha_emision).toLocaleDateString('es-AR')}</td><td style={tdStyle}>{r.apellido}, {r.nombre}</td><td style={tdStyle}>{r.estado}</td><td style={tdStyle}>${Number(r.total).toFixed(2)}</td><td style={tdStyle}>${Number(r.saldo).toFixed(2)}</td></tr>)}
                                    {!(reportesFinancieros.facturas || []).length && <tr><td colSpan="5" style={{ padding: 16, color: '#64748b' }}>No hay facturas cargadas.</td></tr>}</tbody>
                            </table>
                        </>}
                    </div>

                    <div style={{ gridColumn: '1 / -1', background: 'var(--white)', padding: '24px', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)', overflowX: 'auto' }}>
                        <h2 style={{ fontSize: '1.1rem', color: 'var(--blue)', fontWeight: 800, marginBottom: '16px' }}>📚 Reporte académico · calificaciones</h2>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead><tr style={{ borderBottom: '2px solid #f1f5f9' }}><th style={thStyle}>Alumno</th><th style={thStyle}>DNI</th><th style={thStyle}>Curso</th><th style={thStyle}>Materia</th><th style={thStyle}>Trimestre</th><th style={thStyle}>Nota</th></tr></thead>
                            <tbody>{reporteAcademico.map((r, i) => <tr key={`${r.dni}-${r.materia_nombre}-${r.trimestre}-${i}`} style={{ borderBottom: '1px solid #f1f5f9' }}><td style={tdStyle}>{r.apellido}, {r.nombre}</td><td style={tdStyle}>{r.dni}</td><td style={tdStyle}>{[r.nivel_nombre, r.division].filter(Boolean).join(' · ') || '—'}</td><td style={tdStyle}>{r.materia_nombre || '—'}</td><td style={tdStyle}>{r.trimestre}</td><td style={tdStyle}>{r.nota}</td></tr>)}
                                {!reporteAcademico.length && <tr><td colSpan="6" style={{ padding: 16, color: '#64748b' }}>No hay calificaciones para mostrar.</td></tr>}</tbody>
                        </table>
                    </div>

                    <div style={{ gridColumn: '1 / -1', background: 'var(--white)', padding: '24px', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)', overflowX: 'auto' }}>
                        <h2 style={{ fontSize: '1.1rem', color: 'var(--blue)', fontWeight: 800, marginBottom: '16px' }}>💳 Registro de pagos</h2>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead><tr style={{ borderBottom: '2px solid #f1f5f9' }}><th style={thStyle}>Fecha</th><th style={thStyle}>Alumno</th><th style={thStyle}>DNI</th><th style={thStyle}>Método</th><th style={thStyle}>Monto</th><th style={thStyle}>Saldo pendiente</th></tr></thead>
                            <tbody>{reportePagos.map((r, i) => <tr key={`${r.dni}-${r.fecha_pago}-${i}`} style={{ borderBottom: '1px solid #f1f5f9' }}><td style={tdStyle}>{r.fecha_pago ? new Date(r.fecha_pago).toLocaleDateString('es-AR') : '—'}</td><td style={tdStyle}>{r.apellido}, {r.nombre}</td><td style={tdStyle}>{r.dni}</td><td style={tdStyle}>{r.metodo_pago || '—'}</td><td style={tdStyle}>${Number(r.monto_pagado || 0).toFixed(2)}</td><td style={tdStyle}>${Number(r.saldo_pendiente || 0).toFixed(2)}</td></tr>)}
                                {!reportePagos.length && <tr><td colSpan="6" style={{ padding: 16, color: '#64748b' }}>No hay pagos registrados para mostrar.</td></tr>}</tbody>
                        </table>
                    </div>

                    <div style={{ gridColumn: '1 / -1', background: 'var(--white)', padding: '24px', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)', overflowX: 'auto' }}>
                        <h2 style={{ fontSize: '1.1rem', color: 'var(--blue)', fontWeight: 800, marginBottom: '16px' }}>⚠️ Listado de deudores</h2>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead><tr style={{ borderBottom: '2px solid #f1f5f9' }}><th style={thStyle}>Alumno</th><th style={thStyle}>DNI</th><th style={thStyle}>Período</th><th style={thStyle}>Saldo pendiente</th></tr></thead>
                            <tbody>{reporteDeudores.map((r) => <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}><td style={tdStyle}>{r.alumno_apellido}, {r.alumno_nombre}</td><td style={tdStyle}>{r.alumno_dni}</td><td style={tdStyle}>{r.periodo}</td><td style={tdStyle}>${Number(r.saldo || 0).toFixed(2)}</td></tr>)}
                                {!reporteDeudores.length && <tr><td colSpan="4" style={{ padding: 16, color: '#64748b' }}>No hay deudas pendientes.</td></tr>}</tbody>
                        </table>
                    </div>

                    <div style={{ background: 'var(--white)', padding: '24px', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)' }}>
                        <h2 style={{ fontSize: '1.1rem', color: 'var(--blue)', fontWeight: 800, marginBottom: '20px' }}>📋 Listados Disponibles</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <button onClick={exportReporteAcademico} className="btn btn-hero-outline" style={{ fontSize: '0.85rem', textAlign: 'left', color: 'var(--blue)', borderColor: 'var(--blue)' }}>📄 Reporte Académico - Calificaciones (CSV)</button>
                            <button onClick={exportReporteFinanciero} className="btn btn-hero-outline" style={{ fontSize: '0.85rem', textAlign: 'left', color: 'var(--blue)', borderColor: 'var(--blue)' }}>📄 Reporte Financiero - Pagos (CSV)</button>
                            <button onClick={exportDeudores} className="btn btn-hero-outline" style={{ fontSize: '0.85rem', textAlign: 'left', color: 'var(--blue)', borderColor: 'var(--blue)' }}>📄 Listado de Deudores (CSV)</button>
                            <button onClick={exportPlanillaAsistencia} className="btn btn-hero-outline" style={{ fontSize: '0.85rem', textAlign: 'left', color: 'var(--blue)', borderColor: 'var(--blue)' }}>📄 Planilla de Asistencia (CSV)</button>
                            <button onClick={exportLegajos} className="btn btn-hero-outline" style={{ fontSize: '0.85rem', textAlign: 'left', color: 'var(--blue)', borderColor: 'var(--blue)' }}>📄 Legajos de Alumnos (CSV)</button>
                            <button onClick={exportPersonal} className="btn btn-hero-outline" style={{ fontSize: '0.85rem', textAlign: 'left', color: 'var(--blue)', borderColor: 'var(--blue)' }}>📄 Nómina de Personal (CSV)</button>
                        </div>
                    </div>
                </div>
            )}
            {activeTab === 'academico' && academicoSub === 'materias' && (
                <div style={cardStyle}>
                    <h2 style={{ fontSize: '1.25rem', color: 'var(--blue)', fontWeight: 800, marginBottom: '8px' }}>Materias por Curso</h2>
                    <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '20px' }}>
                        Las materias se asignan a un curso. Todos los alumnos de ese curso las cursan automáticamente.
                    </p>

                    <form onSubmit={handleMateriaSubmit} style={{
                        background: '#f8fafc', padding: '16px', borderRadius: '12px', marginBottom: '24px',
                        display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', alignItems: 'end'
                    }}>
                        <input key={`materia-nombre-${editingMateria?.id || 'new'}`} type="text" name="nombre" placeholder="Nombre de la materia" required style={inputStyle} defaultValue={editingMateria?.nombre || ''} />
                        <select key={`materia-curso-${editingMateria?.id || 'new'}`} name="curso_id" required style={inputStyle} defaultValue={editingMateria?.curso_id || ''}>
                            <option value="">Seleccionar curso...</option>
                            {cursos.map(c => (
                                <option key={c.id} value={c.id}>{c.nivel_nombre} - {c.division}</option>
                            ))}
                        </select>
                        <button type="submit" className="btn btn-violet" style={{ whiteSpace: 'nowrap' }}>{editingMateria ? 'Guardar Cambios' : '+ Crear Materia'}</button>
                        {editingMateria && (
                            <button type="button" onClick={() => setEditingMateria(null)} className="btn btn-hero-outline" style={{ whiteSpace: 'nowrap', color: 'var(--blue)' }}>Cancelar</button>
                        )}
                    </form>

                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                                <th style={thStyle}>Materia</th>
                                <th style={thStyle}>Curso</th>
                                <th style={thStyle}>Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {materias.length === 0 ? (
                                <tr><td colSpan="3" style={{ textAlign: 'center', padding: '20px' }}>No hay materias registradas.</td></tr>
                            ) : (
                                materias.map(m => (
                                    <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={tdStyle}><strong>{m.nombre}</strong></td>
                                        <td style={tdStyle}>{m.nivel_nombre ? `${m.nivel_nombre} - ${m.division}` : 'Sin curso'}</td>
                                        <td style={tdStyle}>
                                            <button onClick={() => setEditingMateria(m)} style={{ background: 'none', border: 'none', color: 'var(--blue)', fontWeight: 700, cursor: 'pointer', marginRight: '10px' }}>Editar</button>
                                            <button onClick={() => deleteMateria(m.id)} style={{ background: 'none', border: 'none', color: '#dc2626', fontWeight: 700, cursor: 'pointer' }}>Eliminar</button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'academico' && academicoSub === 'actividades' && (
                <div style={cardStyle}>
                    <h2 style={{ fontSize: '1.25rem', color: 'var(--blue)', fontWeight: 800, marginBottom: '8px' }}>Actividades Extracurriculares</h2>
                    <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '20px' }}>
                        Creá actividades deportivas o culturales. Los alumnos se inscriben desde su portal (hasta cubrir el cupo).
                    </p>

                    <form onSubmit={handleActividadSubmit} style={{
                        background: '#f8fafc', padding: '16px', borderRadius: '12px', marginBottom: '24px',
                        display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr 1fr auto', gap: '12px', alignItems: 'end'
                    }}>
                        <input key={`act-nombre-${editingActividad?.id || 'new'}`} type="text" name="nombre" placeholder="Nombre (Ej: Fútbol)" required style={inputStyle} defaultValue={editingActividad?.nombre || ''} />
                        <select key={`act-tipo-${editingActividad?.id || 'new'}`} name="tipo" required style={inputStyle} defaultValue={editingActividad?.tipo || 'Deporte'}>
                            <option value="Deporte">Deporte</option>
                            <option value="Cultura">Cultura</option>
                            <option value="Idioma">Idioma</option>
                        </select>
                        <input key={`act-horario-${editingActividad?.id || 'new'}`} type="text" name="horario" placeholder="Horario (Ej: Lun y Mié 16hs)" style={inputStyle} defaultValue={editingActividad?.horario || ''} />
                        <input key={`act-cupo-${editingActividad?.id || 'new'}`} type="number" name="cupo_max" placeholder="Cupo" min="1" required style={inputStyle} defaultValue={editingActividad?.cupo_max || ''} />
                        <button type="submit" className="btn btn-violet" style={{ whiteSpace: 'nowrap' }}>{editingActividad ? 'Guardar' : '+ Crear'}</button>
                        {editingActividad && (
                            <button type="button" onClick={() => setEditingActividad(null)} className="btn btn-hero-outline" style={{ whiteSpace: 'nowrap', color: 'var(--blue)' }}>Cancelar</button>
                        )}
                    </form>

                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                                <th style={thStyle}>Actividad</th>
                                <th style={thStyle}>Tipo</th>
                                <th style={thStyle}>Horario</th>
                                <th style={thStyle}>Inscriptos / Cupo</th>
                                <th style={thStyle}>Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {actividades.length === 0 ? (
                                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>No hay actividades creadas.</td></tr>
                            ) : (
                                actividades.map(a => (
                                    <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={tdStyle}><strong>{a.nombre}</strong></td>
                                        <td style={tdStyle}>{a.tipo}</td>
                                        <td style={tdStyle}>{a.horario || '-'}</td>
                                        <td style={tdStyle}>
                                            <span style={{ fontWeight: 800, color: a.inscriptos >= a.cupo_max ? '#dc2626' : 'var(--green)' }}>
                                                {a.inscriptos} / {a.cupo_max}
                                            </span>
                                        </td>
                                        <td style={tdStyle}>
                                            <button onClick={() => setEditingActividad(a)} style={{ background: 'none', border: 'none', color: 'var(--blue)', fontWeight: 700, cursor: 'pointer', marginRight: '10px' }}>Editar</button>
                                            <button onClick={() => deleteActividad(a.id)} style={{ background: 'none', border: 'none', color: '#dc2626', fontWeight: 700, cursor: 'pointer' }}>Eliminar</button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'academico' && academicoSub === 'horarios' && (
                <div style={cardStyle}>
                    <h2 style={{ fontSize: '1.25rem', color: 'var(--blue)', fontWeight: 800, marginBottom: '8px' }}>Horarios y Asignación de Docentes</h2>
                    <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '20px' }}>
                        Asigná un docente y un aula a cada materia en una franja horaria. El sistema rechaza superposiciones del mismo docente o de la misma aula en el mismo día.
                    </p>

                    {docentes.length === 0 && (
                        <p style={{ fontSize: '0.8rem', color: '#991b1b', marginBottom: '16px' }}>
                            No hay docentes cargados. Agregá personal de tipo "Docente" en la pestaña Personal para poder asignarlos.
                        </p>
                    )}

                    <form onSubmit={handleHorarioSubmit} style={{
                        background: '#f8fafc', padding: '16px', borderRadius: '12px', marginBottom: '24px',
                        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', alignItems: 'end'
                    }}>
                        <div>
                            <label style={labelStyle}>Materia</label>
                            <select name="materia_id" required style={inputStyle} defaultValue="">
                                <option value="">Seleccionar...</option>
                                {materias.map(m => (
                                    <option key={m.id} value={m.id}>{m.nombre}{m.nivel_nombre ? ` (${m.nivel_nombre} ${m.division})` : ''}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Docente</label>
                            <select name="docente_id" required style={inputStyle} defaultValue="">
                                <option value="">Seleccionar...</option>
                                {docentes.map(d => (
                                    <option key={d.id} value={d.id}>{d.apellido}, {d.nombre}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Aula</label>
                            <select name="aula_id" required style={inputStyle} defaultValue="">
                                <option value="">Seleccionar...</option>
                                {aulas.map(a => (
                                    <option key={a.id} value={a.id}>{a.nombre}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Día</label>
                            <select name="dia_semana" required style={inputStyle} defaultValue="">
                                <option value="">Seleccionar...</option>
                                <option value="1">Lunes</option>
                                <option value="2">Martes</option>
                                <option value="3">Miércoles</option>
                                <option value="4">Jueves</option>
                                <option value="5">Viernes</option>
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Hora Inicio</label>
                            <input type="time" name="hora_inicio" required style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>Hora Fin</label>
                            <input type="time" name="hora_fin" required style={inputStyle} />
                        </div>
                        <button type="submit" className="btn btn-violet" style={{ whiteSpace: 'nowrap' }}>+ Asignar</button>
                    </form>

                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                                <th style={thStyle}>Día</th>
                                <th style={thStyle}>Horario</th>
                                <th style={thStyle}>Materia</th>
                                <th style={thStyle}>Docente</th>
                                <th style={thStyle}>Aula</th>
                                <th style={thStyle}>Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {horarios.length === 0 ? (
                                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>No hay horarios asignados.</td></tr>
                            ) : (
                                horarios.map(h => (
                                    <tr key={h.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={tdStyle}>{DIAS_SEMANA[h.dia_semana] || h.dia_semana}</td>
                                        <td style={tdStyle}>{h.hora_inicio} - {h.hora_fin}</td>
                                        <td style={tdStyle}><strong>{h.materia_nombre || 'Sin materia'}</strong>{h.nivel_nombre ? <span style={{ color: '#64748b', fontSize: '0.8rem' }}> ({h.nivel_nombre} {h.division})</span> : null}</td>
                                        <td style={tdStyle}>{h.docente_nombre || 'Sin docente'}</td>
                                        <td style={tdStyle}>{h.aula_nombre || 'Sin aula'}</td>
                                        <td style={tdStyle}>
                                            <button onClick={() => deleteHorario(h.id)} style={{ background: 'none', border: 'none', color: '#dc2626', fontWeight: 700, cursor: 'pointer' }}>Eliminar</button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
            {activeTab === 'usuarios' && (
                <div style={cardStyle}>
                    <h2 style={{ fontSize: '1.25rem', color: 'var(--blue)', fontWeight: 800, marginBottom: '8px' }}>Usuarios y Roles</h2>
                    <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '20px' }}>
                        Creá cuentas de acceso y asigná su rol mediante la lista desplegable. El rol restringe a qué secciones del sistema puede ingresar cada usuario.
                    </p>

                    <form onSubmit={handleUserSubmit} style={{
                        background: '#f8fafc', padding: '16px', borderRadius: '12px', marginBottom: '24px',
                        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', alignItems: 'end'
                    }}>
                        <div>
                            <label style={labelStyle}>Nombre completo</label>
                            <input type="text" name="nombre" placeholder="Nombre y Apellido" required style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>Usuario / Correo</label>
                            <input type="text" name="username" placeholder="usuario o correo" required style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>Contraseña</label>
                            <input type="password" name="password" placeholder="Mín. 8: mayúscula, número y símbolo" required style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>Rol</label>
                            <select name="rol" required style={inputStyle} defaultValue="">
                                <option value="">Seleccionar...</option>
                                <option value="admin">Administrador</option>
                                <option value="docente">Docente</option>
                                <option value="alumno">Alumno</option>
                                <option value="padre">Padre/Tutor</option>
                            </select>
                        </div>
                        <button type="submit" className="btn btn-violet" style={{ whiteSpace: 'nowrap' }}>+ Crear Usuario</button>
                    </form>

                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                                <th style={thStyle}>Nombre</th>
                                <th style={thStyle}>Usuario</th>
                                <th style={thStyle}>Rol</th>
                                <th style={thStyle}>Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {usuarios.length === 0 ? (
                                <tr><td colSpan="4" style={{ textAlign: 'center', padding: '20px' }}>No hay usuarios registrados.</td></tr>
                            ) : (
                                usuarios.map(u => (
                                    <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={tdStyle}><strong>{u.nombre}</strong></td>
                                        <td style={tdStyle}>{u.username}</td>
                                        <td style={tdStyle}>
                                            <select
                                                value={u.rol}
                                                onChange={(e) => updateUserRol(u.id, e.target.value)}
                                                style={{ padding: '6px', borderRadius: '6px', border: '1px solid #e2e8f0', fontWeight: 700 }}
                                            >
                                                <option value="admin">Administrador</option>
                                                <option value="docente">Docente</option>
                                                <option value="alumno">Alumno</option>
                                                <option value="padre">Padre/Tutor</option>
                                            </select>
                                        </td>
                                        <td style={tdStyle}>
                                            <button onClick={() => deleteUsuario(u.id)} style={{ background: 'none', border: 'none', color: '#dc2626', fontWeight: 700, cursor: 'pointer' }}>Eliminar</button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </DashboardLayout>
    );
};

const DIAS_SEMANA = { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes' };

const labelStyle = { display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' };

const inputStyle = {
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    fontSize: '0.9rem',
    outline: 'none',
    width: '100%'
};

const cardStyle = { background: 'var(--white)', padding: '24px', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)' };
const thStyle = { padding: '16px', fontSize: '0.85rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' };
const tdStyle = { padding: '16px', fontSize: '0.9rem', verticalAlign: 'top' };

const getStatusColor = (status) => {
    switch (status) {
        case 'pendiente': return { bg: '#fffbeb', text: '#92400e' };
        case 'contactado': return { bg: '#f0fdf4', text: '#166534' };
        case 'entrevista': return { bg: '#eff6ff', text: '#1e40af' };
        case 'inscripto': return { bg: '#f0f9ff', text: '#0369a1' };
        case 'rechazado': return { bg: '#fef2f2', text: '#991b1b' };
        default: return { bg: '#f8fafc', text: '#475569' };
    }
};

export default AdminDashboard;
