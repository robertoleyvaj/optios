'use client'
// Barra inferior tipo app (solo pantallas chicas, < lg).
// "Más" abre el menú lateral completo. Respeta los permisos del rol igual que el Sidebar.
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LayoutDashboard, FolderOpen, Plus, FlaskConical, Menu, Clock, Package } from 'lucide-react'

type Rol = 'administrador' | 'gerente' | 'vendedor' | 'repartidor' | 'web'
type Item = { href: string; label: string; icon: React.ElementType; principal?: boolean; exacto?: boolean }

const ITEMS: Record<Rol, Item[]> = {
  administrador: [
    { href: '/dashboard',             label: 'Inicio',      icon: LayoutDashboard, exacto: true },
    { href: '/dashboard/expedientes', label: 'Expedientes', icon: FolderOpen },
    { href: '/dashboard/ventas/nueva', label: 'Venta',      icon: Plus, principal: true },
    { href: '/dashboard/laboratorio', label: 'Laboratorio', icon: FlaskConical },
  ],
  gerente: [],
  vendedor: [],
  repartidor: [
    { href: '/dashboard/laboratorio', label: 'Laboratorio', icon: FlaskConical },
    { href: '/dashboard/checador',    label: 'Checador',    icon: Clock },
  ],
  web: [
    { href: '/dashboard/inventario-nuevo', label: 'Inventario', icon: Package },
  ],
}
ITEMS.gerente = ITEMS.administrador
ITEMS.vendedor = ITEMS.administrador

export default function BottomNav({ onMas, menuAbierto }: { onMas: () => void; menuAbierto: boolean }) {
  const pathname = usePathname()
  const [rol, setRol] = useState<Rol>('vendedor')
  useEffect(() => {
    try { const u = JSON.parse(localStorage.getItem('optios_demo_user') || '{}'); if (u.rol) setRol(u.rol) } catch { /* noop */ }
  }, [])

  const items = ITEMS[rol] ?? ITEMS.vendedor
  const activo = (it: Item) => it.exacto ? pathname === it.href : (pathname === it.href || pathname.startsWith(it.href + '/'))

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-zinc-200"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Navegación principal"
    >
      <div className="flex items-stretch justify-around h-16 max-w-xl mx-auto">
        {items.map(it => {
          const Icon = it.icon
          const on = activo(it)
          if (it.principal) return (
            <Link key={it.href} href={it.href} className="flex-1 flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform">
              <span className={`w-11 h-11 -mt-1 rounded-2xl flex items-center justify-center shadow-md ${on ? 'bg-[#0D9488]' : 'bg-[#0B0E14]'}`}>
                <Icon className="w-5 h-5 text-white" strokeWidth={2.4} />
              </span>
              <span className={`text-[10px] font-medium ${on ? 'text-[#0D9488]' : 'text-zinc-500'}`}>{it.label}</span>
            </Link>
          )
          return (
            <Link key={it.href} href={it.href} className="flex-1 flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform">
              <Icon className={`w-[22px] h-[22px] ${on ? 'text-[#0D9488]' : 'text-zinc-400'}`} strokeWidth={on ? 2.2 : 1.8} />
              <span className={`text-[10px] ${on ? 'text-[#0D9488] font-semibold' : 'text-zinc-500 font-medium'}`}>{it.label}</span>
            </Link>
          )
        })}
        <button onClick={onMas} className="flex-1 flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform" aria-label="Más opciones">
          <Menu className={`w-[22px] h-[22px] ${menuAbierto ? 'text-[#0D9488]' : 'text-zinc-400'}`} strokeWidth={1.8} />
          <span className={`text-[10px] font-medium ${menuAbierto ? 'text-[#0D9488]' : 'text-zinc-500'}`}>Más</span>
        </button>
      </div>
    </nav>
  )
}
