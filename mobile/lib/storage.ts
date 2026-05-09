import { createMMKV } from 'react-native-mmkv';

const mmkv = createMMKV();

/**
 * Drop-in replacement for AsyncStorage using MMKV (~30x faster).
 * Same API surface: getItem, setItem, removeItem, clear.
 * All methods are synchronous under the hood but wrapped in Promise for compatibility.
 */
const storage = {
  getItem(key: string): Promise<string | null> {
    const value = mmkv.getString(key);
    return Promise.resolve(value ?? null);
  },
  setItem(key: string, value: string): Promise<void> {
    mmkv.set(key, value);
    return Promise.resolve();
  },
  removeItem(key: string): Promise<void> {
    mmkv.remove(key);
    return Promise.resolve();
  },
  clear(): Promise<void> {
    mmkv.clearAll();
    return Promise.resolve();
  },
  getAllKeys(): Promise<string[]> {
    return Promise.resolve(mmkv.getAllKeys());
  },
  multiRemove(keys: string[]): Promise<void> {
    for (const key of keys) mmkv.remove(key);
    return Promise.resolve();
  },
};

export default storage;
