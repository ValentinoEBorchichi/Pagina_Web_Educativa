import { useEffect, useState } from 'react';
import { ActivityIndicator, Button, SectionList, StyleSheet, Text, View } from 'react-native';
import { apiUrl } from '../config';

// HU4: deportes (máximo 2, RF-06) y transporte (RF-09) vigentes del alumno.
// Parámetros de navegación: { alumnoId }.

const MAX_DEPORTES = 2;

async function obtenerServicios(token) {
  const res = await fetch(apiUrl('/api/movil/mis-inscripciones'), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'No se pudieron cargar los servicios');
  if (!data.alumnos?.length) throw new Error('No hay alumnos vinculados a esta cuenta.');
  return data.alumnos;
}

export default function ServiciosAlumnoScreen({ route, navigation, token: tokenProp, onLogout }) {
  const token = tokenProp || route.params?.token;
  const [datos, setDatos] = useState(null);
  const [alumnoId, setAlumnoId] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setError('');
    obtenerServicios(token)
      .then((alumnos) => {
        if (!cancelado) {
          const seleccionado = alumnos.find((item) => item.alumno.id === alumnoId) || alumnos[0];
          setAlumnoId(seleccionado.alumno.id);
          setDatos({ ...seleccionado, deportes: (seleccionado.deportes || []).slice(0, MAX_DEPORTES), alumnos });
        }
      })
      .catch((e) => {
        if (!cancelado) setError(e.message || 'No se pudieron cargar los servicios');
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [token, intento]);

  if (cargando) {
    return <ActivityIndicator style={styles.centro} size="large" />;
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>{error}</Text>
        <Button title="Reintentar" onPress={() => setIntento((n) => n + 1)} />
      </View>
    );
  }

  const { alumno, deportes = [], transporte } = datos;
  const secciones = [
    {
      titulo: `Deportes (${deportes.length}/${MAX_DEPORTES})`,
      vacio: 'Sin deportes inscriptos',
      data: deportes.map((d) => ({ key: `deporte-${d.id}`, nombre: d.nombre, detalle: d.horario })),
    },
    {
      titulo: 'Transporte',
      vacio: 'No usa transporte escolar',
      data: transporte
        ? [{
            key: `transporte-${transporte.id}`,
            nombre: transporte.nombre,
            detalle: `Recorrido N° ${transporte.numero_recorrido}` +
              (transporte.hora_salida ? ` · Salida ${transporte.hora_salida}` : ''),
          }]
        : [],
    },
    {
      titulo: 'Comedor',
      vacio: datos.comedor ? 'Inscripto al comedor' : 'Sin inscripción al comedor',
      data: [],
    },
  ];

  return (
    <SectionList
      style={styles.container}
      sections={secciones}
      ListHeaderComponent={alumno ? <View>
        <Text style={styles.periodo}>Servicios de {new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</Text>
        <Text style={styles.alumno}>{alumno.nombre} {alumno.apellido}</Text>
        {(datos.alumnos || []).length > 1 ? (datos.alumnos || []).map((hijo) => <Button key={hijo.alumno.id} title={`${hijo.alumno.id === alumnoId ? '✓ ' : ''}${hijo.alumno.nombre} ${hijo.alumno.apellido}`} onPress={() => {
          setAlumnoId(hijo.alumno.id);
          setDatos({ ...hijo, deportes: (hijo.deportes || []).slice(0, MAX_DEPORTES), alumnos: datos.alumnos });
        }} />) : null}
        <Button title="Ver cuotas e historial" onPress={() => navigation.navigate('Cuenta', { alumnoId, token })} />
        <Button title="Cambiar contraseña" onPress={() => navigation.navigate('CambiarPassword', { token })} />
        {onLogout ? <Button title="Cerrar sesión" onPress={onLogout} /> : null}
      </View> : null}
      renderSectionHeader={({ section }) => <Text style={styles.seccion}>{section.titulo}</Text>}
      renderSectionFooter={({ section }) =>
        section.data.length === 0 ? <Text style={styles.vacio}>{section.vacio}</Text> : null
      }
      renderItem={({ item }) => (
        <View style={styles.item}>
          <Text style={styles.nombre}>{item.nombre}</Text>
          <Text>{item.detalle}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  centro: { flex: 1 },
  periodo: { color: '#64748b', textTransform: 'capitalize', marginBottom: 4 },
  alumno: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  seccion: { fontSize: 16, fontWeight: 'bold', marginTop: 16, marginBottom: 4 },
  item: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  nombre: { fontSize: 16 },
  vacio: { color: '#666', fontStyle: 'italic' },
  error: { color: '#b91c1c', marginBottom: 12 },
});
