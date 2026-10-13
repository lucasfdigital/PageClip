import { useSyncExternalStore } from 'react'

/**
 * Estado mínimo da barra: a classe Overlay (chamada pelo main.js) escreve,
 * os componentes React leem. Sem biblioteca: é um objeto e uma lista de
 * ouvintes.
 */
export function createStore(initial) {
  let state = initial
  const listeners = new Set()

  return {
    get: () => state,
    set(patch) {
      const next = typeof patch === 'function' ? patch(state) : patch
      state = { ...state, ...next }
      for (const listener of listeners) listener()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export function useStore(store, selector) {
  return useSyncExternalStore(store.subscribe, () => selector(store.get()))
}
