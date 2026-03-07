import { Platform } from 'react-native';
import Constants from 'expo-constants';

const getExpoHost = () => {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoClient?.hostUri ||
    null;

  if (!hostUri) return null;
  return hostUri.split(':')[0];
};

const getDefaultBaseUrl = () => {
  const expoHost = getExpoHost();

  if (expoHost) {
    // Works for physical devices and emulators when running via Expo dev server.
    return `http://${expoHost}:5000/api`;
  }

  if (Platform.OS === 'android') {
    // Android emulator cannot resolve localhost from host machine.
    return 'http://10.0.2.2:5000/api';
  }

  return 'http://localhost:5000/api';
};

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || getDefaultBaseUrl();
