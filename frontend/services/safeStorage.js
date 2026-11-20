import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { createSafeStorage } from '../utils/safeStorageCore';

const safeStorage = createSafeStorage({ asyncStorage: AsyncStorage, secureStore: SecureStore });

export default safeStorage;
export const { getItem, setItem, removeItem, multiRemove } = safeStorage;
