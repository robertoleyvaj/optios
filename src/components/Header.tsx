'use client'

import { Bell, Search, Store } from 'lucide-react'

export default function Header() {
  const today = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // Capitalize first letter
  const todayFormatted = today.charAt(0).toUpperCase() + today.slice(1)

  return (
    <header className="h-14 bg-white border-b border-zinc-200 flex items-center justify-between px-6 flex-shrink-0">
      {/* Search */}
      <div className="relative w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
        <input
          type="text"
          placeholder="Buscar clientes, ventas, productos..."
          className="w-full pl-8 pr-4 py-1.5 text-[13px] bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20 focus:border-[#0D9488] placeholder:text-zinc-400 transition-shadow"
        />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Date + Sucursal */}
        <div className="text-right mr-1">
          <p className="text-[11px] text-zinc-400">{todayFormatted}</p>
          <div className="flex items-center justify-end gap-1 mt-0.5">
            <Store className="w-3 h-3 text-[#0D9488]" />
            <p className="text-[11px] font-medium text-zinc-600">Todas las sucursales</p>
          </div>
        </div>

        {/* Notifications */}
        <button className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 transition-colors">
          <Bell className="w-[15px] h-[15px] text-zinc-500" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#DC2626] rounded-full ring-2 ring-white" />
        </button>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-[#0B0E14] flex items-center justify-center cursor-pointer">
          <span className="text-white text-[11px] font-semibold">RL</span>
        </div>
      </div>
    </header>
  )
}
