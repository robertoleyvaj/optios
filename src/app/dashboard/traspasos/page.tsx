'use client'

import RequireRol from '@/components/RequireRol'
import Traspasos from '../inventario-nuevo/Traspasos'

// Página para que cualquier persona de la sucursal confirme los traspasos que le llegan.
// Se entra desde la campanita.
export default function Page() {
  return (
    <RequireRol roles={['administrador', 'gerente', 'vendedor']}>
      <div className="space-y-4 max-w-3xl">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Traspasos por recibir</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Cuando llegue la pieza a tu sucursal, revísala y pícale “Ya llegó”.</p>
        </div>
        <Traspasos puedeEnviar={false} soloRecibir />
      </div>
    </RequireRol>
  )
}
