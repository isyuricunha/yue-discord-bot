import '@testing-library/jest-dom/vitest'

// Node 22+ keeps globalThis.localStorage undefined unless
// --experimental-webstorage is set, and the jsdom global binding can miss it
// depending on the local node version (CI runs a different one). The panel
// and its tests assume localStorage, so fill it in when missing.
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>()
  const storage: Storage = {
    get length() {
      return store.size
    },
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value))
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
    key: (index: number) => [...store.keys()][index] ?? null,
  }
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true })
}
