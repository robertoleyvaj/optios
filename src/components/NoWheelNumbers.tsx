'use client'

import { useEffect } from 'react'

/**
 * Evita el bug clásico de los <input type="number">: cuando el campo está
 * enfocado y el usuario hace scroll con el mouse, el navegador cambia el
 * número solo (ej. 50 → 48). Al hacer scroll, quitamos el foco del campo,
 * así el valor nunca se altera por accidente y la página scrollea normal.
 * Aplica a TODO el sistema desde un solo lugar.
 */
export default function NoWheelNumbers() {
  useEffect(() => {
    const handler = () => {
      const active = document.activeElement
      if (active instanceof HTMLInputElement && active.type === 'number') {
        active.blur()
      }
    }
    document.addEventListener('wheel', handler, { passive: true })
    return () => document.removeEventListener('wheel', handler)
  }, [])

  return null
}
