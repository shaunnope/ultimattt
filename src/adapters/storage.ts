// Storage that never throws. Reads and writes go to localStorage when it works and to memory
// when it does not (private windows, blocked site data, quota), so the game always runs.

const memory = new Map<string, string>();

export function resetStorageForTests(): void {
  memory.clear();
}

function ls(): Storage | null {
  try {
    return (globalThis as { localStorage?: Storage }).localStorage ?? null;
  } catch {
    return null;
  }
}

export function storageGet(key: string): string | null {
  try {
    const store = ls();
    if (store) {
      const value = store.getItem(key);
      if (value !== null) return value;
    }
  } catch {
    /* fall through to memory */
  }
  return memory.get(key) ?? null;
}

/** Returns true when the value reached persistent storage. It is always kept in memory. */
export function storageSet(key: string, value: string): boolean {
  memory.set(key, value);
  try {
    const store = ls();
    if (!store) return false;
    store.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function storageRemove(key: string): void {
  memory.delete(key);
  try {
    ls()?.removeItem(key);
  } catch {
    /* ignore */
  }
}
