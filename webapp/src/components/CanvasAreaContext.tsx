import { createContext, useContext } from 'react'

export interface CanvasAreaContextValue {
  captureMode: boolean
}

const CanvasAreaContext = createContext<CanvasAreaContextValue | null>(null)

export function useCanvasArea() {
  return useContext(CanvasAreaContext)
}

export const CanvasAreaProvider = CanvasAreaContext.Provider
