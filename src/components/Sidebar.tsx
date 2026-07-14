'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, ShoppingCart, Users, Package, FlaskConical,
  DollarSign, BarChart3, CalendarDays, FolderOpen, Settings,
  LogOut, Glasses, ChevronDown, Plus, Clock, Wallet, TrendingUp, Mail, Microscope, Star, X,
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

// Módulos core: todos los roles de tienda los ven
const CORE = ['dashboard','ventas','agenda','expedientes','laboratorio','caja','inbox','mi-desempeno']

// Módulos de gestión: solo gerente y admin
const GESTION_GERENTE = ['inventario','reportes']
const GESTION_ADMIN   = [...GESTION_GERENTE, 'analitica','finanzas','usuarios','ajustes']

const CORE_ADMIN = CORE.filter(k => k !== 'mi-desempeno')

const PERMISOS: Record<Rol, string[]> = {
  administrador: [...CORE_ADMIN, ...GESTION_ADMIN],
  gerente:       [...CORE, ...GESTION_GERENTE],
  vendedor:      [...CORE],
  repartidor:    ['laboratorio','inbox'],
}

// ─────────────────────────────────────────
// Definición del menú completo
// ─────────────────────────────────────────
type SubItem = { href: string; label: string; icon: React.ElementType }
type MenuItem =
  | { type?: 'item'; href: string; label: string; icon: React.ElementType; key: string; pronto?: boolean; subItems?: SubItem[] }
  | { type: 'sep'; label: string; key: string }

// Módulos core — todos los roles de tienda
const MENU_CORE: MenuItem[] = [
  { href: '/dashboard',             label: 'Inicio',      icon: LayoutDashboard, key: 'dashboard' },
  {
    href: '/dashboard/ventas',      label: 'Ventas',      icon: ShoppingCart,    key: 'ventas',
    subItems: [
      { href: '/dashboard/ventas/nueva', label: 'Nueva venta', icon: Plus },
      { href: '/dashboard/ventas',       label: 'Historial',   icon: Clock },
    ],
  },
  { href: '/dashboard/agenda',      label: 'Agenda',      icon: CalendarDays,    key: 'agenda' },
  { href: '/dashboard/expedientes', label: 'Expedientes', icon: FolderOpen,      key: 'expedientes' },
  { href: '/dashboard/laboratorio', label: 'Laboratorio', icon: FlaskConical,    key: 'laboratorio' },
  { href: '/dashboard/caja',          label: 'Caja',          icon: Wallet,          key: 'caja' },
  { href: '/dashboard/inbox',         label: 'Inbox',         icon: Mail,            key: 'inbox' },
  { href: '/dashboard/mi-desempeno',  label: 'Mi Desempeño',  icon: Star,            key: 'mi-desempeno' },
]

// Módulos de gestión — gerente y admin
const MENU_GESTION: MenuItem[] = [
  { type: 'sep', label: 'Gestión', key: '_sep_gestion' },
  { href: '/dashboard/inventario',  label: 'Inventario',       icon: Package,    key: 'inventario' },
  { href: '/dashboard/reportes',    label: 'Reportes',         icon: BarChart3,  key: 'reportes' },
  { href: '/dashboard/analitica',   label: 'Analítica',        icon: Microscope, key: 'analitica', pronto: true },
  { href: '/dashboard/finanzas',    label: 'Finanzas',         icon: DollarSign, key: 'finanzas' },
  { href: '/dashboard/usuarios',    label: 'Usuarios',         icon: Users,      key: 'usuarios' },
  { href: '/dashboard/ajustes',     label: 'Ajustes',          icon: Settings,   key: 'ajustes' },
]

const MENU_REPARTIDOR: MenuItem[] = [
  { href: '/dashboard/laboratorio', label: 'Laboratorio', icon: FlaskConical, key: 'laboratorio' },
  { href: '/dashboard/inbox',       label: 'Inbox',       icon: Mail,         key: 'inbox' },
]

const USUARIO_DEFAULT = { nombre: 'Usuario', apodo: 'Usuario', iniciales: 'U', rol: 'vendedor' as Rol, sucursal: '' }

export default function Sidebar({
  isOpen = false,
  onClose,
}: {
  isOpen?: boolean
  onClose?: () => void
}) {
  const pathname = usePathname()
  const router   = useRouter()
  const [usuario, setUsuario] = useState(USUARIO_DEFAULT)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('optios_demo_user')
      if (raw) {
        const u = JSON.parse(raw)
        setUsuario({
          nombre:    u.nombre    ?? 'Usuario',
          apodo:     u.apodo     ?? u.nombre?.split(' ')[0] ?? 'Usuario',
          iniciales: u.iniciales ?? (u.nombre ? u.nombre.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : 'U'),
          rol:       (u.rol ?? 'vendedor') as Rol,
          sucursal:  u.sucursal  ?? '',
        })
      }
    } catch { /* noop */ }
  }, [])

  const puedeVer = (key: string) => PERMISOS[usuario.rol]?.includes(key) ?? false

  const handleLogout = () => {
    localStorage.removeItem('optios_demo_user')
    router.push('/login')
  }

  // Construir menú según rol
  const menuBase = usuario.rol === 'repartidor' ? MENU_REPARTIDOR : MENU_CORE
  const menuExtra = usuario.rol === 'administrador' || usuario.rol === 'gerente' ? MENU_GESTION : []
  const itemsVisibles = [...menuBase, ...menuExtra].filter(item =>
    item.type === 'sep' || puedeVer(item.key)
  )

  return (
    <aside className={`
      w-64 bg-[#0B0E14] flex flex-col h-screen
      fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out
      lg:relative lg:flex-shrink-0 lg:translate-x-0
      ${isOpen ? 'translate-x-0' : '-translate-x-full'}
    `}>

      {/* Logo */}
      <div className="px-5 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#0D9488] flex items-center justify-center flex-shrink-0">
            <Glasses className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-[15px] leading-none tracking-tight">OptiOS</p>
            <p className="text-white/35 text-[11px] mt-1">Sistema de Gestión</p>
          </div>
        </div>
        {/* Close button — mobile only */}
        <button
          onClick={onClose}
          className="lg:hidden w-7 h-7 flex items-center justify-center rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {itemsVisibles.map((item) => {
          // Separador de sección
          if (item.type === 'sep') {
            return (
              <div key={item.key} className="pt-4 pb-1 px-3">
                <p className="text-[10px] font-semibold text-white/20 uppercase tracking-widest">{item.label}</p>
              </div>
            )
          }

          const Icon = item.icon
          const isParentActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const hasSubItems = !!item.subItems
          const showSub = hasSubItems && isParentActive
          const pronto = item.pronto

          return (
            <div key={item.href}>
              <Link
                href={pronto ? '#' : item.href}
                onClick={pronto ? (e) => e.preventDefault() : onClose}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors duration-100 ${
                  pronto
                    ? 'text-white/20 cursor-default'
                    : isParentActive
                    ? 'bg-white/[0.07] text-white'
                    : 'text-white/45 hover:text-white/90 hover:bg-white/[0.04]'
                }`}
              >
                <Icon className={`w-[15px] h-[15px] flex-shrink-0 ${isParentActive && !pronto ? 'text-[#2DD4BF]' : ''}`} />
                <span className="flex-1">{item.label}</span>
                {pronto && (
                  <span className="text-[9px] font-bold text-white/20 uppercase tracking-wide">Pronto</span>
                )}
                {hasSubItems && !pronto && (
                  <ChevronDown className={`w-3 h-3 transition-transform ${showSub ? 'rotate-180' : ''}`} />
                )}
              </Link>

              {showSub && item.subItems && (
                <div className="ml-[18px] mt-0.5 pl-3.5 border-l border-white/10 space-y-0.5">
                  {item.subItems.map((sub) => {
                    const SubIcon = sub.icon
                    const isSubActive = pathname === sub.href
                    return (
                      <Link key={sub.href} href={sub.href}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12.5px] font-medium transition-colors ${
                          isSubActive ? 'text-[#2DD4BF] bg-white/[0.06]' : 'text-white/35 hover:text-white/70 hover:bg-white/[0.04]'
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

      {/* Usuario activo */}
      <div className="px-3 py-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg mb-0.5">
          <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-[11px] font-semibold">{usuario.iniciales}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-[13px] font-medium truncate leading-tight">{usuario.nombre}</p>
            <p className="text-white/35 text-[11px] leading-tight mt-0.5">
              {ROL_LABEL[usuario.rol]}{usuario.sucursal && usuario.sucursal !== 'Todas' ? ` · ${usuario.sucursal}` : ''}
            </p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] text-white/35 hover:text-white/80 hover:bg-white/[0.04] transition-colors">
          <LogOut className="w-3.5 h-3.5" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  )
}
