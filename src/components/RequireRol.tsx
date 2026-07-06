'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldOff } from 'lucide-react'

type Rol = 'administrador' | 'gerente' | 'vendedor' | 'repartidor'

/**
 * Wraps a page and only renders children if the logged-in user
 * has one of the allowed roles. Otherwise shows a 403 screen.
 *
 * Usage:
 *   <RequireRol roles={['administrador']}>
 *     <MyPage />
 *   </RequireRol>
 */
export default function RequireRol({
  roles,
  children,
}: {
  roles: Rol[]
  children: React.ReactNode
}) {
  const router = useRouter()
  const [estado, setEstado] = useState<'cargando' | 'ok' | 'denegado'>('cargando')

  useEffect(() => {
    try {
      const raw = localStorage.getItem('optios_demo_user')
      if (!raw) { router.replace('/login'); return }
      const u = JSON.parse(raw)
      const rol: Rol = u.rol ?? 'vendedor'
      setEstado(roles.includes(rol) ? 'ok' : 'denegado')
    } catch {
      router.replace('/login')
    }
  }, [roles, router])

  if (estado === 'cargando') return null

  if (estado === 'denegado') {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
          <ShieldOff className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-zinc-800 mb-1">Acceso restringido</h2>
        <p className="text-sm text-zinc-400 mb-6 max-w-xs">
          No tienes permiso para ver esta sección. Si necesitas acceso, contacta al administrador.
        </p>
        <button onClick={() => router.push('/dashboard')}
          className="px-5 py-2.5 bg-[#0B0E14] text-white rounded-lg text-sm font-semibold hover:bg-zinc-800">
          Volver al inicio
        </button>
      </div>
    )
  }

  return <>{children}</>
}
