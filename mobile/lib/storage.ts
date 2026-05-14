import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Storage wrapper — uses AsyncStorage for Expo Go compatibility.
 * All consumers import from this file so the backend can be swapped later
 * (e.g. to MMKV for dev-client builds) without touching 23 files.
 */
export default AsyncStorage;
