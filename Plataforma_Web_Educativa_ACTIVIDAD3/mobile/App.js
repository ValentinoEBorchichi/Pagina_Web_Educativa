import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
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
import TransporteScreen from './src/screens/TransporteScreen';
import MasScreen from './src/screens/MasScreen';
import DeportesScreen from './src/screens/DeportesScreen';
import { ComprobanteProvisorioScreen, HistorialScreen } from './src/screens/HistorialScreen';
import CambiarPasswordScreen from './src/screens/CambiarPasswordScreen';
import SubirComprobanteScreen from './src/screens/SubirComprobanteScreen';
import Header from './src/components/Header';
import { AlumnosProvider, useAlumnos } from './src/context/AlumnosContext';
import { COLORS, FONTS } from './src/theme';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Íconos siempre "rellenos" (sin -outline), a pedido: se distinguen por
// color (tabBarActiveTintColor/InactiveTintColor), no por el estilo del ícono.
const ICONOS_TAB = {
  Home: 'home',
  Cobranzas: 'card',
  Transporte: 'bus',
  MiCuenta: 'person-circle',
};

// La pestaña "Cobranzas" es CuentaScreen, pero CuentaScreen espera
// alumnoId/token en route.params (así funciona hoy, sin tocar ese archivo).
// Este wrapper los toma del AlumnosContext compartido en cada render, así
// cambiar de hijo en Home también actualiza lo que ve Cobranzas.
function CobranzasTab(props) {
  const { alumnoId, token } = useAlumnos();
  return (
    <CuentaScreen
      {...props}
      route={{ ...props.route, params: { ...props.route.params, alumnoId, token } }}
    />
  );
}

// Header de cada pestaña/pantalla autenticada: lee el saludo y "Salir" del
// AlumnosContext (disponible en todo el stack autenticado), así el botón de
// cerrar sesión queda siempre visible arriba, sin depender de qué pantalla
// lo registre.
function AppHeader({ title, subtitle }) {
  const { onLogout, nombreUsuario } = useAlumnos();
  return <Header title={title} subtitle={subtitle} nombre={nombreUsuario} onLogout={onLogout} />;
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: COLORS.blue,
        tabBarInactiveTintColor: COLORS.textSoft,
        tabBarLabelStyle: { fontFamily: FONTS.bodyBold, fontSize: 11 },
        tabBarStyle: { backgroundColor: COLORS.white, borderTopColor: COLORS.border },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={ICONOS_TAB[route.name]} color={color} size={size} />
        ),
      })}
    >
      <Tab.Screen
        name="Home"
        component={ServiciosAlumnoScreen}
        options={{ header: () => <AppHeader title="Inicio" subtitle="Educar para Transformar" /> }}
      />
      <Tab.Screen
        name="Cobranzas"
        component={CobranzasTab}
        options={{ header: () => <AppHeader title="Cobranzas" subtitle="Cuotas, facturas y comprobantes" /> }}
      />
      <Tab.Screen
        name="Transporte"
        component={TransporteScreen}
        options={{ header: () => <AppHeader title="Transporte" subtitle="Recorrido escolar" /> }}
      />
      <Tab.Screen
        name="MiCuenta"
        component={MasScreen}
        options={{ tabBarLabel: 'Mi Cuenta', header: () => <AppHeader title="Mi Cuenta" subtitle="Cuenta y familia" /> }}
      />
    </Tab.Navigator>
  );
}

// Stack autenticado completo (tabs + pantallas que se abren "encima",
// ocultando la barra inferior). Envuelto en AlumnosProvider para que CUALQUIER
// pantalla de acá adentro -incluida Deportes, que no es una tab- pueda leer
// el hijo seleccionado con useAlumnos() sin pasarlo a mano por parámetros.
function AuthenticatedApp({ token, onLogout }) {
  return (
    <AlumnosProvider token={token} onLogout={onLogout}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ contentStyle: { backgroundColor: COLORS.bg } }}>
          <Stack.Screen name="Tabs" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen
            name="Deportes"
            component={DeportesScreen}
            options={{ header: () => <AppHeader title="Deportes" subtitle="Inscripción y baja" /> }}
          />
          <Stack.Screen
            name="Historial"
            component={HistorialScreen}
            options={{ header: () => <AppHeader title="Historial de facturas" /> }}
          />
          <Stack.Screen
            name="ComprobanteProvisorio"
            component={ComprobanteProvisorioScreen}
            options={{ header: () => <AppHeader title="Comprobante provisorio" /> }}
          />
          <Stack.Screen
            name="SubirComprobante"
            component={SubirComprobanteScreen}
            options={{ header: () => <AppHeader title="Subir comprobante" /> }}
          />
          <Stack.Screen
            name="CambiarPassword"
            component={CambiarPasswordScreen}
            options={{ header: () => <AppHeader title="Cambiar contraseña" /> }}
          />
        </Stack.Navigator>
        <StatusBar style="light" />
      </NavigationContainer>
    </AlumnosProvider>
  );
}

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

  if (sesion) {
    return (
      <AuthenticatedApp
        token={sesion.token}
        onLogout={async () => {
          await SecureStore.deleteItemAsync('jwt');
          setSesion(null);
        }}
      />
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ contentStyle: { backgroundColor: COLORS.bg } }}>
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
      </Stack.Navigator>
      <StatusBar style="light" />
    </NavigationContainer>
  );
}
