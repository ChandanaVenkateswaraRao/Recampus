import AsyncStorage from '@react-native-async-storage/async-storage';

export const TOKEN_KEY = 'recampus_mobile_token';

export const saveToken = (token: string) => AsyncStorage.setItem(TOKEN_KEY, token);

export const getToken = () => AsyncStorage.getItem(TOKEN_KEY);

export const clearToken = () => AsyncStorage.removeItem(TOKEN_KEY);
