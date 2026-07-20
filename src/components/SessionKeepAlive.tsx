'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Mantiene viva la sesión de Supabase mientras la app está abierta.
 * Un "latido" cada 2 min llama a getSession(), que refresca el token si está
 * por expirar, y también refresca al volver a la pestaña. Evita que la sesión
 * se caiga durante tareas largas (ej. un examen de 10-15 min) y te mande a inicio.
 */
export default function SessionKeepAlive() {
  useEffect(() => {
    const sb = createClient()
    const ping = () => { sb.auth.getSession().catch(() => {}) }

    const interval = setInterval(ping, 2 * 60 * 1000)  // cada 2 minutos
    const onVisible = () => { if (document.visibilityState === 'visible') ping() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    ping()  // uno inicial

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [])

  return null
}
