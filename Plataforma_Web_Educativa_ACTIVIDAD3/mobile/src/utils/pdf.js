import { Alert } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

// Descarga un PDF autenticado del backend a un archivo temporal y lo abre
// con el diálogo nativo de impresión (que en iOS/Android también permite
// guardarlo como PDF). Si falla o no está disponible, cae a la hoja de
// compartir del sistema para que el usuario pueda guardarlo o enviarlo.
export async function descargarYAbrirPdf(url, token, nombreArchivo) {
  let archivo;
  try {
    archivo = await File.downloadFileAsync(url, new File(Paths.cache, nombreArchivo), {
      headers: { Authorization: `Bearer ${token}` },
      idempotent: true,
    });
  } catch (e) {
    Alert.alert('No se pudo descargar el PDF', e.message || 'Error de conexión con el servidor');
    return;
  }

  try {
    await Print.printAsync({ uri: archivo.uri });
  } catch {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(archivo.uri, { mimeType: 'application/pdf', dialogTitle: nombreArchivo });
    } else {
      Alert.alert('No se pudo abrir el PDF', 'El dispositivo no soporta impresión ni compartir archivos.');
    }
  }
}
