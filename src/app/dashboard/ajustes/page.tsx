'use client'

import { useState } from 'react'
import RequireRol from '@/components/RequireRol'
import {
  Store, CreditCard, Bell, Globe, Save,
  Plus, X, Edit2, ChevronDown, CheckCircle2,
} from 'lucide-react'

type Sucursal = {
  id: number
  nombre: string
  direccion: string
  telefono: string
  horario: string
  activa: boolean
}

const TABS = [
  { key: 'sucursales', label: 'Sucursales',   icon: Store },
  { key: 'pagos',      label: 'Pagos',         icon: CreditCard },
  { key: 'sistema',    label: 'Sistema',       icon: Globe },
  { key: 'notif',      label: 'Notificaciones',icon: Bell },
]

function AjustesPage() {
  const [tab, setTab] = useState('sucursales')

  const [sucursales, setSucursales] = useState<Sucursal[]>([
    { id: 1, nombre: 'Baja Visión',    direccion: 'Blvd. Benito Juárez, Playas de Rosarito, B.C.',                                telefono: '661 104 0431', horario: 'Lun-Dom 10:00–18:00', activa: true },
    { id: 2, nombre: '5 de Mayo',      direccion: 'Av. 5 de Mayo, a un costado de Funeraria San Gabriel, Playas de Rosarito, B.C.', telefono: '661 612 0316', horario: 'Lun-Sáb 10:00–18:00', activa: true },
    { id: 3, nombre: 'Plaza Laureles', direccion: 'Plaza Laureles, Playas de Rosarito, B.C.',                                       telefono: '661 104 0431', horario: 'Lun-Dom 10:00–18:00', activa: true },
  ])

  const [comDebito,  setComDebito]  = useState('1.5')
  const [comCredito, setComCredito] = useState('2.9')
  const [metodosActivos, setMetodosActivos] = useState(['Efectivo', 'Tarjeta débito', 'Tarjeta crédito', 'Transferencia'])
  const [saved, setSaved] = useState(false)

  const guardar = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const toggleMetodo = (m: string) =>
    setMetodosActivos(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])

  return (
    <div className="space-y-5">

      <div>
        <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Ajustes</h1>
        <p className="text-sm text-zinc-400 mt-0.5">Configuración general del sistema</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-zinc-200/80 overflow-hidden">
        <div className="flex border-b border-zinc-100 px-2">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-5 py-4 text-sm font-medium border-b-2 transition-colors -mb-px ${tab === key ? 'border-[#0D9488] text-[#0B0E14]' : 'border-transparent text-zinc-400 hover:text-zinc-600'}`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        <div className="p-6">

          {/* ── SUCURSALES ── */}
          {tab === 'sucursales' && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-500">Información de cada punto de venta. Las sucursales activas aparecen en todos los módulos.</p>
              {sucursales.map(s => (
                <div key={s.id} className="border border-zinc-200 rounded-lg p-4 flex items-start gap-4">
                  <div className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${s.activa ? 'bg-emerald-400' : 'bg-zinc-300'}`} />
                  <div className="flex-1 grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-1">Nombre</label>
                      <input defaultValue={s.nombre}
                        className="w-full border border-zinc-200 rounded px-3 py-2 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-1">Teléfono</label>
                      <input defaultValue={s.telefono}
                        className="w-full border border-zinc-200 rounded px-3 py-2 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-1">Dirección</label>
                      <input defaultValue={s.direccion}
                        className="w-full border border-zinc-200 rounded px-3 py-2 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-1">Horario</label>
                      <input defaultValue={s.horario}
                        className="w-full border border-zinc-200 rounded px-3 py-2 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── PAGOS ── */}
          {tab === 'pagos' && (
            <div className="space-y-6 max-w-md">
              <div>
                <h3 className="text-sm font-bold text-zinc-700 mb-3">Métodos de pago activos</h3>
                <div className="space-y-2">
                  {['Efectivo', 'Tarjeta débito', 'Tarjeta crédito', 'Transferencia', 'Cheque'].map(m => (
                    <label key={m} className="flex items-center gap-3 cursor-pointer group">
                      <div onClick={() => toggleMetodo(m)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all cursor-pointer ${metodosActivos.includes(m) ? 'bg-[#0D9488] border-[#0D9488]' : 'border-zinc-300 hover:border-[#0D9488]'}`}>
                        {metodosActivos.includes(m) && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                      <span className="text-sm text-zinc-600">{m}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-zinc-700 mb-3">Comisiones bancarias</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <label className="text-sm text-zinc-600 w-40">Tarjeta débito</label>
                    <div className="relative">
                      <input type="number" value={comDebito} onChange={e => setComDebito(e.target.value)}
                        className="border border-zinc-200 rounded px-3 py-2 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 w-24 pr-7"
                        step="0.1" />
                      <span className="absolute right-3 top-1/2 -tranzinc-y-1/2 text-zinc-400 text-sm">%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="text-sm text-zinc-600 w-40">Tarjeta crédito</label>
                    <div className="relative">
                      <input type="number" value={comCredito} onChange={e => setComCredito(e.target.value)}
                        className="border border-zinc-200 rounded px-3 py-2 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 w-24 pr-7"
                        step="0.1" />
                      <span className="absolute right-3 top-1/2 -tranzinc-y-1/2 text-zinc-400 text-sm">%</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-zinc-400 mt-2">Estos porcentajes se aplican automáticamente al calcular el neto en ventas y finanzas.</p>
              </div>
            </div>
          )}

          {/* ── SISTEMA ── */}
          {tab === 'sistema' && (
            <div className="space-y-6 max-w-md">
              <div>
                <h3 className="text-sm font-bold text-zinc-700 mb-3">General</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Nombre del negocio</label>
                    <input defaultValue="GON Óptica"
                      className="w-full border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1.5">RFC</label>
                    <input defaultValue="XAXX010101000"
                      className="w-full border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 font-mono" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Moneda</label>
                    <div className="relative">
                      <select className="w-full appearance-none border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none pr-8">
                        <option>MXN — Peso Mexicano</option>
                        <option>USD — Dólar Americano</option>
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -tranzinc-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-700 mb-3">Integraciones</h3>
                <div className="space-y-3">
                  {[
                    { nombre: 'GON.mx (gonmx.com)', desc: 'Tienda ecommerce — Supabase compartida', activo: true },
                    { nombre: 'Verly Optical',       desc: 'Tienda ecommerce — Supabase compartida', activo: false },
                  ].map(i => (
                    <div key={i.nombre} className="flex items-center gap-3 p-3 border border-zinc-200 rounded-lg">
                      <div className={`w-2 h-2 rounded-full ${i.activo ? 'bg-emerald-400' : 'bg-zinc-300'}`} />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-zinc-700">{i.nombre}</p>
                        <p className="text-xs text-zinc-400">{i.desc}</p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded ${i.activo ? 'bg-emerald-50 text-emerald-600' : 'bg-zinc-100 text-zinc-400'}`}>
                        {i.activo ? 'Conectado' : 'Pendiente'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── NOTIFICACIONES ── */}
          {tab === 'notif' && (
            <div className="space-y-4 max-w-md">
              <p className="text-sm text-zinc-500">Configura qué eventos generan notificaciones en el sistema.</p>
              {[
                { label: 'Orden de laboratorio lista para entregar', desc: 'Cuando una orden pasa a estado "Listo"' },
                { label: 'Orden de laboratorio con problema',        desc: 'Cuando se marca un problema en una orden' },
                { label: 'Orden de laboratorio vencida',            desc: 'Cuando se pasa la fecha promesa sin entrega' },
                { label: 'Stock bajo en consumibles',               desc: 'Cuando un producto baja del mínimo' },
                { label: 'Cita agendada desde la web',              desc: 'Nueva cita creada automáticamente desde GON o Verly' },
                { label: 'Meta mensual alcanzada',                  desc: 'Cuando una sucursal alcanza su meta del mes' },
              ].map((n, i) => (
                <div key={i} className="flex items-start gap-3 p-4 border border-zinc-200 rounded-lg hover:border-zinc-300 transition-colors">
                  <input type="checkbox" defaultChecked={i < 4} className="mt-0.5 accent-[#0D9488]" />
                  <div>
                    <p className="text-sm font-semibold text-zinc-700">{n.label}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">{n.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Botón guardar */}
          <div className="mt-6 pt-5 border-t border-zinc-100 flex items-center gap-3">
            <button onClick={guardar}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#0B0E14] text-white rounded text-sm font-semibold hover:bg-[#1A1D27]">
              <Save className="w-4 h-4" />
              {saved ? '¡Guardado!' : 'Guardar cambios'}
            </button>
            {saved && <span className="text-sm text-emerald-500 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Cambios guardados</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AjustesPageProtected() {
  return (
    <RequireRol roles={['administrador']}>
      <AjustesPage />
    </RequireRol>
  )
}
