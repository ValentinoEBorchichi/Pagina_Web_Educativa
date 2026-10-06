import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import RecuperarPasswordScreen from './src/screens/RecuperarPasswordScreen';
import ServiciosAlumnoScreen from './src/screens/ServiciosAlumnoScreen';

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
      </Stack.Navigator>
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}
