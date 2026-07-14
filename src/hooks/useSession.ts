'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export type SessionUser = {
  id: string
  nombre: string
  apodo: string
  iniciales: string
  rol: string
  sucursal: string
  nombre_receta: string
}

export function useSession() {
  const [usuario, setUsuario] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sb = createClient()

    const parse = (meta: Record<string, string>): SessionUser => ({
      id:            meta.sub || '',
      nombre:        meta.nombre || '',
      apodo:         meta.apodo || meta.nombre?.split(' ')[0] || '',
      iniciales:     meta.iniciales || '',
      rol:           meta.rol || 'vendedor',
      sucursal:      meta.sucursal || '',
      nombre_receta: meta.nombre_receta || '',
    })

    // Carga inicial
    sb.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.user_metadata) {
        setUsuario(parse(session.user.user_metadata as Record<string, string>))
      } else {
        setUsuario(null)
      }
      setLoading(false)
    })

    // Escuchar cambios (login / logout / refresh)
    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.user_metadata) {
        setUsuario(parse(session.user.user_metadata as Record<string, string>))
      } else {
        setUsuario(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await createClient().auth.signOut()
  }

  return { usuario, loading, signOut }
}
