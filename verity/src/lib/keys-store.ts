export type ApiKey = { id: string; label: string; value: string; createdAt: number; lastUsedAt?: number };
const KEYS: ApiKey[] = [];

export function allKeys(){ return KEYS; }
export function createKey(label: string){
  const id = crypto.randomUUID();
  const value = "dev_" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2,8);
  const k: ApiKey = { id, label: label || "Untitled", value, createdAt: Date.now() };
  KEYS.push(k); return k;
}
export function revokeKey(id: string){
  const i = KEYS.findIndex(k => k.id === id);
  if (i >= 0) KEYS.splice(i,1);
}
