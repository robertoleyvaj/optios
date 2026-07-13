'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const INACTIVITY_MS  = 4 * 60 * 60 * 1000  // 4 horas
const WARNING_BEFORE = 5 * 60 * 1000        // aviso 5 min antes
const CHECK_INTERVAL = 30 * 1000            // revisar cada 30 s

export default function SessionGuard() {
  const router            = useRouter()
  const lastActivityRef   = useRef<number>(Date.now())
  const [showWarning, setShowWarning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)

  // Actualizar actividad en cualquier interacción
  useEffect(() => {
    const reset = () => { lastActivityRef.current = Date.now() }
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click']
    events.forEach(e => window.addEventListener(e, reset, { passive: true }))
    return () => events.forEach(e => window.removeEventListener(e, reset))
  }, [])

  // Revisar inactividad periódicamente
  useEffect(() => {
    const interval = setInterval(() => {
      const idle = Date.now() - lastActivityRef.current

      if (idle >= INACTIVITY_MS) {
        // Expirado — cerrar sesión
        localStorage.removeItem('optios_demo_user')
        router.push('/login?reason=inactivity')
        return
      }

      const remaining = INACTIVITY_MS - idle
      if (remaining <= WARNING_BEFORE) {
        setShowWarning(true)
        setSecondsLeft(Math.ceil(remaining / 1000))
      } else {
        setShowWarning(false)
      }
    }, CHECK_INTERVAL)

    return () => clearInterval(interval)
  }, [router])

  // Contador en tiempo real cuando el aviso está visible
  useEffect(() => {
    if (!showWarning) return
    const tick = setInterval(() => {
      const remaining = INACTIVITY_MS - (Date.now() - lastActivityRef.current)
      if (remaining <= 0) {
        clearInterval(tick)
        return
      }
      setSecondsLeft(Math.ceil(remaining / 1000))
    }, 1000)
    return () => clearInterval(tick)
  }, [showWarning])

  const handleContinue = () => {
    lastActivityRef.current = Date.now()
    setShowWarning(false)
  }

  const handleLogout = () => {
    localStorage.removeItem('optios_demo_user')
    router.push('/login')
  }

  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60

  if (!showWarning) return null

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
        {/* Ícono */}
        <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>

        <h2 className="text-[17px] font-semibold text-zinc-900 mb-2">
          Sesión a punto de expirar
        </h2>
        <p className="text-sm text-zinc-500 mb-5 leading-relaxed">
          No se ha detectado actividad. La sesión se cerrará en:
        </p>

        {/* Contador */}
        <div className="text-4xl font-bold text-zinc-900 mb-6 tabular-nums">
          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleLogout}
            className="flex-1 border border-zinc-200 text-zinc-600 text-sm font-medium py-2.5 rounded-lg hover:bg-zinc-50 transition-colors"
          >
            Cerrar sesión
          </button>
          <button
            onClick={handleContinue}
            className="flex-1 bg-[#0B0E14] text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-[#1A1D27] transition-colors"
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  )
}
