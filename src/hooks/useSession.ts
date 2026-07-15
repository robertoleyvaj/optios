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

    const parseFromMeta = (meta: Record<string, string>, userId: string): SessionUser => ({
      id:            userId || meta.sub || '',
      nombre:        meta.nombre || '',
      apodo:         meta.apodo || meta.nombre?.split(' ')[0] || '',
      iniciales:     meta.iniciales || '',
      rol:           meta.rol || 'vendedor',
      sucursal:      meta.sucursal || '',
      nombre_receta: meta.nombre_receta || '',
    })

    // Si user_metadata tiene sucursal → úsala directamente (path rápido, sin query a DB)
    // Si no → query a usuarios tabla como fallback (cubre el caso de primera sesión antes
    //   de que el login haya poblado user_metadata)
    const resolveSession = async (session: { user?: { id: string; user_metadata: Record<string, string> } } | null) => {
      if (!session?.user) {
        setUsuario(null)
        setLoading(false)
        return
      }

      const meta = (session.user.user_metadata ?? {}) as Record<string, string>

      if (meta.sucursal) {
        // user_metadata ya tiene sucursal → rápido, no hace query
        setUsuario(parseFromMeta(meta, session.user.id))
        setLoading(false)
        return
      }

      // Fallback: leer de la tabla usuarios (cuando user_metadata no está poblado todavía)
      try {
        const { data } = await sb
          .from('usuarios')
          .select('nombre, apodo, iniciales, rol, sucursal, nombre_receta')
          .eq('auth_user_id', session.user.id)
          .single()

        if (data) {
          setUsuario({
            id:            session.user.id,
            nombre:        data.nombre        || '',
            apodo:         data.apodo         || (data.nombre ?? '').split(' ')[0] || '',
            iniciales:     data.iniciales     || '',
            rol:           data.rol           || 'vendedor',
            sucursal:      data.sucursal      || '',
            nombre_receta: data.nombre_receta || '',
          })
        } else {
          setUsuario(parseFromMeta(meta, session.user.id))
        }
      } catch {
        // Si la query falla (RLS, red, etc.), usar lo que haya en meta
        setUsuario(parseFromMeta(meta, session.user.id))
      }
      setLoading(false)
    }

    // Carga inicial
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sb.auth.getSession().then(({ data: { session } }) => resolveSession(session as any))

    // Escuchar cambios (login / logout / refresh de token)
    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      resolveSession(session as any)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await createClient().auth.signOut()
  }

  return { usuario, loading, signOut }
}
