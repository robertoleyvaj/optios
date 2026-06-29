'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, ShoppingCart, Users, Package, FlaskConical,
  DollarSign, BarChart3, CalendarDays, FolderOpen, Settings,
  LogOut, Glasses, ChevronDown, Plus, Clock, Wallet, ChevronUp,
} from 'lucide-react'

// ─────────────────────────────────────────
// Roles y permisos
// ─────────────────────────────────────────
type Rol = 'administrador' | 'gerente' | 'vendedor' | 'repartidor'

const ROL_LABEL: Record<Rol, string> = {
  administrador: 'Administrador',
  gerente:       'Gerente',
  vendedor:      'Vendedor',
  repartidor:    'Repartidor',
}

// Módulos a los que tiene acceso cada rol
const PERMISOS: Record<Rol, string[]> = {
  administrador: ['dashboard','ventas','agenda','expedientes','inventario','laboratorio','caja','finanzas','reportes','usuarios','ajustes'],
  gerente:       ['dashboard','ventas','agenda','expedientes','inventario','laboratorio','caja','finanzas','reportes'],
  vendedor:      ['dashboard','ventas','agenda','expedientes','laboratorio','caja'],
  repartidor:    ['laboratorio'],
}

// ─────────────────────────────────────────
// Usuarios demo (mientras no hay auth real)
// ─────────────────────────────────────────
const USUARIOS_DEMO = [
  { nombre: 'Roberto Leyva', iniciales: 'RL', rol: 'administrador' as Rol, sucursal: 'Todas',        nombreReceta: 'Dr. Leyva' },
  { nombre: 'Ana Castillo',  iniciales: 'AC', rol: 'gerente'       as Rol, sucursal: 'Baja Visión', nombreReceta: 'Dra. Castillo' },
  { nombre: 'Karina López',  iniciales: 'KL', rol: 'vendedor'      as Rol, sucursal: 'Baja Visión', nombreReceta: 'Karina López' },
  { nombre: 'Sergio',        iniciales: 'SG', rol: 'repartidor'    as Rol, sucursal: 'Todas',        nombreReceta: 'Sergio' },
]

// ─────────────────────────────────────────
// Definición del menú completo
// ─────────────────────────────────────────
type SubItem = { href: string; label: string; icon: React.ElementType }
type MenuItem = { href: string; label: string; icon: React.ElementType; key: string; subItems?: SubItem[] }

const MENU_ITEMS: MenuItem[] = [
  { href: '/dashboard',                  label: 'Dashboard',    icon: LayoutDashboard, key: 'dashboard' },
  {
    href: '/dashboard/ventas',           label: 'Ventas',       icon: ShoppingCart,    key: 'ventas',
    subItems: [
      { href: '/dashboard/ventas/nueva', label: 'Nueva venta',  icon: Plus },
      { href: '/dashboard/ventas',       label: 'Historial',    icon: Clock },
    ],
  },
  { href: '/dashboard/agenda',           label: 'Agenda',       icon: CalendarDays,    key: 'agenda' },
  { href: '/dashboard/expedientes',      label: 'Expedientes',  icon: FolderOpen,      key: 'expedientes' },
  { href: '/dashboard/inventario',       label: 'Inventario',   icon: Package,         key: 'inventario' },
  { href: '/dashboard/laboratorio',      label: 'Laboratorio',  icon: FlaskConical,    key: 'laboratorio' },
  { href: '/dashboard/caja',             label: 'Caja',         icon: Wallet,          key: 'caja' },
  { href: '/dashboard/finanzas',         label: 'Finanzas',     icon: DollarSign,      key: 'finanzas' },
  { href: '/dashboard/reportes',         label: 'Reportes',     icon: BarChart3,       key: 'reportes' },
  { href: '/dashboard/usuarios',         label: 'Usuarios',     icon: Users,           key: 'usuarios' },
  { href: '/dashboard/ajustes',          label: 'Ajustes',      icon: Settings,        key: 'ajustes' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  // Usuario activo (demo — luego viene de Supabase session)
  const [usuarioIdx, setUsuarioIdx] = useState(0)
  const [showUserSwitch, setShowUserSwitch] = useState(false)
  const usuario = USUARIOS_DEMO[usuarioIdx]

  const puedeVer = (key: string) => PERMISOS[usuario.rol].includes(key)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const itemsVisibles = MENU_ITEMS.filter(item => puedeVer(item.key))

  return (
    <aside className="w-64 bg-[#0B1A35] flex flex-col h-screen flex-shrink-0">

      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-gradient-to-br from-[#2BBFB3] to-[#1B3A6B] flex items-center justify-center flex-shrink-0">
            <Glasses className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-lg leading-none">OptiOS</p>
            <p className="text-white/40 text-xs mt-0.5">Sistema de Gestión</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {itemsVisibles.map((item) => {
          const Icon = item.icon
          const isParentActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const hasSubItems = !!item.subItems
          const showSub = hasSubItems && isParentActive

          return (
            <div key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isParentActive
                    ? 'bg-[#2BBFB3]/15 text-[#2BBFB3] border border-[#2BBFB3]/20'
                    : 'text-white/50 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${isParentActive ? 'text-[#2BBFB3]' : ''}`} />
                <span className="flex-1">{item.label}</span>
                {hasSubItems && (
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSub ? 'rotate-180' : ''}`} />
                )}
              </Link>

              {showSub && item.subItems && (
                <div className="ml-3 mt-0.5 pl-4 border-l border-white/10 space-y-0.5">
                  {item.subItems.map((sub) => {
                    const SubIcon = sub.icon
                    const isSubActive = pathname === sub.href
                    return (
                      <Link key={sub.href} href={sub.href}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                          isSubActive ? 'text-[#2BBFB3] bg-[#2BBFB3]/10' : 'text-white/40 hover:text-white/80 hover:bg-white/5'
                        }`}>
                        <SubIcon className="w-3.5 h-3.5 flex-shrink-0" />
                        {sub.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Usuario activo + switcher de demo */}
      <div className="px-3 py-4 border-t border-white/5">

        {/* Switcher de usuario — solo para demo/desarrollo */}
        {showUserSwitch && (
          <div className="mb-2 bg-white/5 rounded-lg overflow-hidden border border-white/10">
            <div className="px-3 py-2 border-b border-white/10">
              <p className="text-xs text-white/30 font-semibold uppercase tracking-wider">Demo — cambiar usuario</p>
            </div>
            {USUARIOS_DEMO.map((u, i) => (
              <button key={i} onClick={() => { setUsuarioIdx(i); setShowUserSwitch(false); if (typeof window !== 'undefined') localStorage.setItem('optios_demo_user', JSON.stringify(USUARIOS_DEMO[i])) }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/5 transition-colors ${usuarioIdx === i ? 'bg-[#2BBFB3]/10' : ''}`}>
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#2BBFB3] to-[#1B3A6B] flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold leading-none">{u.iniciales[0]}</span>
                </div>
                <div className="text-left min-w-0">
                  <p className="text-xs text-white font-medium truncate">{u.nombre}</p>
                  <p className="text-xs text-white/40">{ROL_LABEL[u.rol]}</p>
                </div>
                {usuarioIdx === i && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#2BBFB3]" />}
              </button>
            ))}
          </div>
        )}

        {/* Info del usuario actual */}
        <button
          onClick={() => setShowUserSwitch(v => !v)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors group mb-1">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2BBFB3] to-[#1B3A6B] flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">{usuario.iniciales}</span>
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-white text-sm font-medium truncate">{usuario.nombre}</p>
            <p className="text-white/40 text-xs">{ROL_LABEL[usuario.rol]}{usuario.sucursal !== 'Todas' ? ` · ${usuario.sucursal}` : ''}</p>
          </div>
          {showUserSwitch
            ? <ChevronUp className="w-3.5 h-3.5 text-white/30" />
            : <ChevronDown className="w-3.5 h-3.5 text-white/30" />}
        </button>

        <button onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/40 hover:text-white hover:bg-white/5 transition-all">
          <LogOut className="w-4 h-4" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  )
}
