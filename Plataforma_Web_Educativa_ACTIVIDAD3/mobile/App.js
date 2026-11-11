import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
} from '@expo-google-fonts/nunito';
import {
  PlayfairDisplay_700Bold,
  PlayfairDisplay_800ExtraBold,
} from '@expo-google-fonts/playfair-display';
import LoginScreen from './src/screens/LoginScreen';
import RecuperarPasswordScreen from './src/screens/RecuperarPasswordScreen';
import ServiciosAlumnoScreen from './src/screens/ServiciosAlumnoScreen';
import CuentaScreen from './src/screens/CuentaScreen';
import { ComprobanteProvisorioScreen, HistorialScreen } from './src/screens/HistorialScreen';
import CambiarPasswordScreen from './src/screens/CambiarPasswordScreen';
import SubirComprobanteScreen from './src/screens/SubirComprobanteScreen';
import Header from './src/components/Header';
import { COLORS } from './src/theme';

const Stack = createNativeStackNavigator();

export default function App() {
  const [sesion, setSesion] = useState(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
    PlayfairDisplay_700Bold,
    PlayfairDisplay_800ExtraBold,
  });

  useEffect(() => {
    SecureStore.getItemAsync('jwt').then((token) => {
      if (token) setSesion({ token });
    }).finally(() => setCargandoSesion(false));
  }, []);

  if (cargandoSesion || !fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: COLORS.bg }}>
        <ActivityIndicator size="large" color={COLORS.blue} />
      </View>
    );
  }

  const cerrarSesion = async () => {
    await SecureStore.deleteItemAsync('jwt');
    setSesion(null);
  };

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          contentStyle: { backgroundColor: COLORS.bg },
        }}
      >
        {sesion ? (
          <>
            <Stack.Screen
              name="ServiciosAlumno"
              options={{ header: () => <Header title="Servicios del alumno" onLogout={cerrarSesion} /> }}
            >
              {(props) => <ServiciosAlumnoScreen {...props} token={sesion.token} onLogout={cerrarSesion} />}
            </Stack.Screen>
            <Stack.Screen
              name="Cuenta"
              component={CuentaScreen}
              options={{ header: () => <Header title="Cuotas e historial" onLogout={cerrarSesion} /> }}
            />
            <Stack.Screen
              name="Historial"
              component={HistorialScreen}
              options={{ header: () => <Header title="Historial de facturas" onLogout={cerrarSesion} /> }}
            />
            <Stack.Screen
              name="ComprobanteProvisorio"
              component={ComprobanteProvisorioScreen}
              options={{ header: () => <Header title="Comprobante provisorio" onLogout={cerrarSesion} /> }}
            />
            <Stack.Screen
              name="SubirComprobante"
              component={SubirComprobanteScreen}
              options={{ header: () => <Header title="Subir comprobante" onLogout={cerrarSesion} /> }}
            />
            <Stack.Screen
              name="CambiarPassword"
              component={CambiarPasswordScreen}
              options={{ header: () => <Header title="Cambiar contraseña" onLogout={cerrarSesion} /> }}
            />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" options={{ headerShown: false }}>
              {(props) => <LoginScreen {...props} onLogin={async (token) => {
                await SecureStore.setItemAsync('jwt', token);
                setSesion({ token });
              }} />}
            </Stack.Screen>
            <Stack.Screen
              name="RecuperarPassword"
              component={RecuperarPasswordScreen}
              options={{ header: () => <Header title="Recuperar contraseña" /> }}
            />
          </>
        )}
      </Stack.Navigator>
      <StatusBar style="light" />
    </NavigationContainer>
  );
}
