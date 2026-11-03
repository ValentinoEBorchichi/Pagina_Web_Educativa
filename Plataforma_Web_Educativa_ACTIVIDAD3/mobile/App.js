import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import RecuperarPasswordScreen from './src/screens/RecuperarPasswordScreen';
import ServiciosAlumnoScreen from './src/screens/ServiciosAlumnoScreen';
import CuentaScreen from './src/screens/CuentaScreen';
import { ComprobanteProvisorioScreen, HistorialScreen } from './src/screens/HistorialScreen';
import CambiarPasswordScreen from './src/screens/CambiarPasswordScreen';
import SubirComprobanteScreen from './src/screens/SubirComprobanteScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="RecuperarPassword">
        <Stack.Screen
          name="RecuperarPassword"
          component={RecuperarPasswordScreen}
          options={{ title: 'Recuperar contraseña' }}
        />
        {/* Recibe { alumnoId, token } como parámetros de navegación. */}
        <Stack.Screen
          name="ServiciosAlumno"
          component={ServiciosAlumnoScreen}
          options={{ title: 'Servicios del alumno' }}
        />
        <Stack.Screen name="Cuenta" component={CuentaScreen} options={{ title: 'Cuotas e historial' }} />
        <Stack.Screen name="Historial" component={HistorialScreen} options={{ title: 'Historial de facturas' }} />
        <Stack.Screen name="ComprobanteProvisorio" component={ComprobanteProvisorioScreen} options={{ title: 'Comprobante provisorio' }} />
        <Stack.Screen name="SubirComprobante" component={SubirComprobanteScreen} options={{ title: 'Subir comprobante' }} />
        <Stack.Screen name="CambiarPassword" component={CambiarPasswordScreen} options={{ title: 'Cambiar contraseña' }} />
      </Stack.Navigator>
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}
