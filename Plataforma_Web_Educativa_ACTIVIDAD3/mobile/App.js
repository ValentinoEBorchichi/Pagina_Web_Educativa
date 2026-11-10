import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import LoginScreen from './src/screens/LoginScreen';
import RecuperarPasswordScreen from './src/screens/RecuperarPasswordScreen';
import ServiciosAlumnoScreen from './src/screens/ServiciosAlumnoScreen';
import CuentaScreen from './src/screens/CuentaScreen';
import { ComprobanteProvisorioScreen, HistorialScreen } from './src/screens/HistorialScreen';
import CambiarPasswordScreen from './src/screens/CambiarPasswordScreen';
import SubirComprobanteScreen from './src/screens/SubirComprobanteScreen';

const Stack = createNativeStackNavigator();

const COLORS = {
  primary: '#1a5fa8',
  primaryDark: '#154e8a',
  background: '#f8fafc',
  surface: '#ffffff',
  text: '#0f172a',
  muted: '#64748b',
};

export default function App() {
  const [sesion, setSesion] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    SecureStore.getItemAsync('jwt').then((token) => {
      if (token) setSesion({ token });
    }).finally(() => setCargando(false));
  }, []);

  if (cargando) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator size="large" /></View>;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{
        headerStyle: { backgroundColor: COLORS.surface },
        headerTintColor: COLORS.text,
        headerTitleStyle: { fontWeight: '800' },
        contentStyle: { backgroundColor: COLORS.background },
      }}>
        {sesion ? (
          <>
            <Stack.Screen name="ServiciosAlumno" options={{ title: 'Servicios del alumno' }}>
              {(props) => <ServiciosAlumnoScreen {...props} token={sesion.token} onLogout={async () => {
                await SecureStore.deleteItemAsync('jwt');
                setSesion(null);
              }} />}
            </Stack.Screen>
            <Stack.Screen name="Cuenta" component={CuentaScreen} options={{ title: 'Cuotas e historial' }} />
            <Stack.Screen name="Historial" component={HistorialScreen} options={{ title: 'Historial de facturas' }} />
            <Stack.Screen name="ComprobanteProvisorio" component={ComprobanteProvisorioScreen} options={{ title: 'Comprobante provisorio' }} />
            <Stack.Screen name="SubirComprobante" component={SubirComprobanteScreen} options={{ title: 'Subir comprobante' }} />
            <Stack.Screen name="CambiarPassword" component={CambiarPasswordScreen} options={{ title: 'Cambiar contraseña' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" options={{ title: 'Iniciar sesión' }}>
              {(props) => <LoginScreen {...props} onLogin={async (token) => {
                await SecureStore.setItemAsync('jwt', token);
                setSesion({ token });
              }} />}
            </Stack.Screen>
            <Stack.Screen name="RecuperarPassword" component={RecuperarPasswordScreen} options={{ title: 'Recuperar contraseña' }} />
          </>
        )}
      </Stack.Navigator>
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}
