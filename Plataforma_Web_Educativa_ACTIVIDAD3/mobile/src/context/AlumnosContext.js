import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiUrl } from '../config';

// Datos de "mis hijos" (deportes/transporte/comedor), el nombre del padre
// logueado, y -por hijo seleccionado- su resumen académico (notas,
// asistencia) y su deuda, compartidos entre las pestañas Home/Cobranzas/
// Transporte/Mi Cuenta, para no repetir fetches ni perder la selección de
// hijo al cambiar de pestaña.
const AlumnosContext = createContext(null);

// Cada función llama a fetch() con una ruta literal fija, nunca con una
// variable "path" de por medio (aunque apiUrl() ya valida contra una lista
// blanca y el origin, un análisis estático genérico no puede probar que acá
// nunca llega una URL controlada por el usuario si hay una indirección de
// por medio -por eso no hay un helper único "obtenerJson(path, ...)"-).

async function obtenerServicios(token) {
  const res = await fetch(apiUrl('/api/movil/mis-inscripciones'), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'No se pudieron cargar los servicios');
  if (!data.alumnos?.length) throw new Error('No hay alumnos vinculados a esta cuenta.');
  return data.alumnos;
}

async function obtenerMiUsuario(token) {
  const res = await fetch(apiUrl('/api/auth/me'), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null; // el saludo no debe romper la pantalla si falla
  return res.json().catch(() => null);
}

async function obtenerResumenAlumno(token, alumnoId) {
  const res = await fetch(apiUrl('/api/academico/mis-hijos/resumen', alumnoId), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'No se pudo cargar el resumen académico');
  return data;
}

async function obtenerFacturasAlumno(token, alumnoId) {
  const res = await fetch(apiUrl('/api/facturas', alumnoId), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'No se pudo cargar la cuenta');
  return data;
}

export function AlumnosProvider({ token, onLogout, children }) {
  const [alumnos, setAlumnos] = useState([]);
  const [alumnoId, setAlumnoId] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);

  const [nombreUsuario, setNombreUsuario] = useState('');

  const [resumenAlumno, setResumenAlumno] = useState(null);
  const [deudaAlumno, setDeudaAlumno] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const recargar = useCallback(() => setIntento((n) => n + 1), []);

  // Lista de hijos + nombre del padre logueado (una sola vez, en paralelo).
  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setError('');
    Promise.all([
      obtenerServicios(token),
      obtenerMiUsuario(token).catch(() => null),
    ])
      .then(([lista, me]) => {
        if (cancelado) return;
        setAlumnos(lista);
        setAlumnoId((actual) => (lista.some((item) => item.alumno.id === actual) ? actual : lista[0].alumno.id));
        if (me?.nombre) setNombreUsuario(me.nombre);
      })
      .catch((e) => {
        if (!cancelado) setError(e.message || 'No se pudieron cargar los servicios');
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => { cancelado = true; };
  }, [token, intento]);

  const alumnoSeleccionado = useMemo(
    () => alumnos.find((item) => item.alumno.id === alumnoId) || null,
    [alumnos, alumnoId]
  );

  // Resumen académico (notas/asistencia) y deuda del hijo seleccionado:
  // se recalculan cada vez que cambia el hijo.
  useEffect(() => {
    if (!alumnoId) return;
    let cancelado = false;
    setCargandoDetalle(true);
    Promise.all([
      obtenerResumenAlumno(token, alumnoId),
      obtenerFacturasAlumno(token, alumnoId),
    ])
      .then(([resumen, cuenta]) => {
        if (cancelado) return;
        setResumenAlumno(resumen);
        setDeudaAlumno({ totalAdeudado: Number(cuenta.total_adeudado || 0), facturas: cuenta.facturas || [] });
      })
      .catch(() => {
        if (!cancelado) { setResumenAlumno(null); setDeudaAlumno(null); }
      })
      .finally(() => {
        if (!cancelado) setCargandoDetalle(false);
      });
    return () => { cancelado = true; };
  }, [alumnoId, token]);

  const value = useMemo(() => ({
    token,
    onLogout,
    nombreUsuario,
    alumnos,
    alumnoId,
    alumnoSeleccionado,
    setAlumnoId,
    cargando,
    error,
    recargar,
    resumenAlumno,
    deudaAlumno,
    cargandoDetalle,
  }), [token, onLogout, nombreUsuario, alumnos, alumnoId, alumnoSeleccionado, cargando, error, recargar, resumenAlumno, deudaAlumno, cargandoDetalle]);

  return <AlumnosContext.Provider value={value}>{children}</AlumnosContext.Provider>;
}

export function useAlumnos() {
  const ctx = useContext(AlumnosContext);
  if (!ctx) throw new Error('useAlumnos debe usarse dentro de un AlumnosProvider');
  return ctx;
}
