import { useEffect, useState } from 'react';
import { ActivityIndicator, Button, SectionList, StyleSheet, Text, View } from 'react-native';
import { API_URL } from '../config';

// HU4: deportes (máximo 2, RF-06) y transporte (RF-09) vigentes del alumno.
// Parámetros de navegación: { alumnoId, token }.

const MAX_DEPORTES = 2;

export default function ServiciosAlumnoScreen({ route }) {
  const { alumnoId, token } = route.params;
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setError('');
    fetch(`${API_URL}/api/inscripciones/${alumnoId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'No se pudieron cargar los servicios');
        return data;
      })
      .then((data) => {
        if (!cancelado) setDatos(data);
      })
      .catch((e) => {
        if (!cancelado) {
          setError(e instanceof TypeError ? 'No se pudo conectar con el servidor' : e.message);
        }
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [alumnoId, token, intento]);

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
  ];

  return (
    <SectionList
      style={styles.container}
      sections={secciones}
      ListHeaderComponent={
        alumno ? <Text style={styles.alumno}>{alumno.nombre} {alumno.apellido}</Text> : null
      }
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
  alumno: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  seccion: { fontSize: 16, fontWeight: 'bold', marginTop: 16, marginBottom: 4 },
  item: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  nombre: { fontSize: 16 },
  vacio: { color: '#666', fontStyle: 'italic' },
  error: { color: '#b91c1c', marginBottom: 12 },
});
