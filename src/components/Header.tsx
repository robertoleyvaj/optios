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
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0">
      {/* Search */}
      <div className="relative w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar clientes, ventas, productos..."
          className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-[#2BBFB3]/30 focus:border-[#2BBFB3] placeholder:text-slate-400"
        />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Date + Sucursal */}
        <div className="text-right mr-2">
          <p className="text-xs text-slate-400">{todayFormatted}</p>
          <div className="flex items-center justify-end gap-1 mt-0.5">
            <Store className="w-3 h-3 text-[#2BBFB3]" />
            <p className="text-xs font-medium text-slate-600">Todas las sucursales</p>
          </div>
        </div>

        {/* Notifications */}
        <button className="relative w-9 h-9 flex items-center justify-center rounded hover:bg-slate-100 transition-colors">
          <Bell className="w-4 h-4 text-slate-500" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#2BBFB3] to-[#1B3A6B] flex items-center justify-center cursor-pointer">
          <span className="text-white text-xs font-bold">RL</span>
        </div>
      </div>
    </header>
  )
}
