'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Package,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Banknote,
  ChevronDown,
  ChevronUp,
  Store,
  Target,
  Pencil,
  Check,
  X,
  Search,
  UserPlus,
  FlaskConical,
  Award,
  Zap,
} from 'lucide-react'

// --- Mock data ---
// Ventas mensuales — semana a semana del mes actual
const now = new Date()
const monthName = now.toLocaleString('es-MX', { month: 'long', year: 'numeric' })
const monthLabel = monthName.charAt(0).toUpperCase() + monthName.slice(1)

const salesData = [
  { semana: 'Sem 1\n1–7 jun', ventas: 18400 },
  { semana: 'Sem 2\n8–14 jun', ventas: 24800 },
  { semana: 'Sem 3\n15–21 jun', ventas: 31200 },
  { semana: 'Sem 4\n22–25 jun', ventas: 19600 },
]

const categoryData = [
  { name: 'Armazones', value: 42 },
  { name: 'Lentes contacto', value: 28 },
  { name: 'Micas', value: 18 },
  { name: 'Accesorios', value: 12 },
]

const COLORS = ['#0D9488', '#1B3A6B', '#6366F1', '#F59E0B']

const appointments = [
  { name: 'María González', time: '10:00', type: 'Examen visual', status: 'confirmada' },
  { name: 'Carlos Ruiz', time: '10:45', type: 'Entrega de lentes', status: 'pendiente' },
  { name: 'Ana López', time: '11:30', type: 'Consulta', status: 'confirmada' },
  { name: 'Pedro Sánchez', time: '12:00', type: 'Examen visual', status: 'cancelada' },
  { name: 'Laura Martínez', time: '13:15', type: 'Entrega de lentes', status: 'confirmada' },
]

const topProducts = [
  { name: 'Armazón Ray-Ban RB5154', category: 'Armazones', units: 12, revenue: 14400 },
  { name: 'Lentes contacto Acuvue', category: 'Lentes de contacto', units: 34, revenue: 10200 },
  { name: 'Micas progresivas Essilor', category: 'Micas', units: 8, revenue: 9600 },
  { name: 'Armazón Oakley OX8046', category: 'Armazones', units: 6, revenue: 8400 },
  { name: 'Solución para lentes', category: 'Accesorios', units: 28, revenue: 2800 },
]

const lowStock = [
  { name: 'Solución Renu 120ml', stock: 2, min: 10 },
  { name: 'Estuche de viaje', stock: 4, min: 15 },
  { name: 'Paño de microfibra', stock: 3, min: 20 },
]

const cajaData = [
  { sucursal: 'Baja Visión', efectivo: 4250, color: '#0D9488' },
  { sucursal: '5 de Mayo', efectivo: 3180, color: '#1B3A6B' },
  { sucursal: 'Plaza Laureles', efectivo: 5620, color: '#6366F1' },
]
const totalCaja = cajaData.reduce((s, c) => s + c.efectivo, 0)

// Metas — ventas actuales mock por sucursal
const ventasActualesPorSucursal: Record<string, number> = {
  'Baja Visión': 64000,
  '5 de Mayo': 51000,
  'Plaza Laureles': 47000,
}

// --- Sub-components ---
function StatCard({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  trend,
  trendLabel,
}: {
  label: string
  value: string
  icon: React.ElementType
  iconBg: string
  iconColor: string
  trend: 'up' | 'down' | 'neutral'
  trendLabel: string
}) {
  return (
    <div className="bg-white rounded-lg p-5 border border-zinc-200/80">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-zinc-500 font-medium">{label}</p>
          <p className="text-2xl font-bold text-zinc-800 mt-1">{value}</p>
        </div>
        <div className={`w-11 h-11 rounded-md ${iconBg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1">
        {trend === 'up' ? (
          <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
        ) : trend === 'down' ? (
          <TrendingDown className="w-3.5 h-3.5 text-red-400" />
        ) : null}
        <span className={`text-xs font-medium ${
          trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-red-400' : 'text-zinc-400'
        }`}>
          {trendLabel}
        </span>
      </div>
    </div>
  )
}

function CajaCard({ sucursalFiltro }: { sucursalFiltro: string | null }) {
  const [open, setOpen] = useState(false)

  // Si hay filtro de sucursal, mostrar solo esa
  const datos = sucursalFiltro
    ? cajaData.filter(c => c.sucursal === sucursalFiltro)
    : cajaData
  const total = datos.reduce((s, c) => s + c.efectivo, 0)

  return (
    <div className="bg-white rounded-lg border border-zinc-200/80 overflow-hidden">
      <button
        onClick={() => !sucursalFiltro && setOpen(!open)}
        className={`w-full p-5 flex items-start justify-between text-left ${!sucursalFiltro ? 'hover:bg-zinc-50 transition-colors' : ''}`}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm text-zinc-500 font-medium">Efectivo en caja</p>
            {!sucursalFiltro && (open
              ? <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
              : <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
            )}
          </div>
          <p className="text-2xl font-bold text-zinc-800 mt-1">
            ${total.toLocaleString('es-MX')}
          </p>
        </div>
        <div className="w-11 h-11 rounded-md bg-emerald-50 flex items-center justify-center">
          <Banknote className="w-5 h-5 text-emerald-500" />
        </div>
      </button>

      {!sucursalFiltro && open && (
        <div className="border-t border-zinc-100 px-5 pb-4 pt-3 space-y-3">
          {cajaData.map((c) => (
            <div key={c.sucursal} className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${c.color}18` }}>
                <Store className="w-3.5 h-3.5" style={{ color: c.color }} />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-medium text-zinc-600">{c.sucursal}</span>
                  <span className="text-xs font-bold text-zinc-800">${c.efectivo.toLocaleString('es-MX')}</span>
                </div>
                <div className="h-1 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round((c.efectivo / totalCaja) * 100)}%`,
                      background: c.color,
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!sucursalFiltro && !open && (
        <div className="px-5 pb-4 mt-1">
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-xs font-medium text-emerald-500">3 sucursales activas</span>
          </div>
        </div>
      )}

      {sucursalFiltro && (
        <div className="px-5 pb-4 mt-1">
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-xs font-medium text-emerald-500">Tu sucursal hoy</span>
          </div>
        </div>
      )}
    </div>
  )
}

function MetasCard({ sucursalFiltro, esAdmin }: { sucursalFiltro: string | null; esAdmin: boolean }) {
  // Calcular días del mes y días transcurridos
  const hoy = new Date()
  const diaActual = hoy.getDate()
  const diasEnMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate()
  const fraccionMes = diaActual / diasEnMes

  const [editando, setEditando] = useState(false)
  const [metas, setMetas] = useState([
    { sucursal: 'Baja Visión', meta: 150000, color: '#0D9488' },
    { sucursal: '5 de Mayo', meta: 120000, color: '#1B3A6B' },
    { sucursal: 'Plaza Laureles', meta: 130000, color: '#6366F1' },
  ])
  const [draft, setDraft] = useState(metas.map(m => ({ ...m })))

  // Filtrar por sucursal si no es admin
  const metasFiltradas = sucursalFiltro
    ? metas.filter(m => m.sucursal === sucursalFiltro)
    : metas
  const draftFiltrado = sucursalFiltro
    ? draft.filter(m => m.sucursal === sucursalFiltro)
    : draft

  const guardar = () => {
    setMetas(draft)
    setEditando(false)
  }

  const cancelar = () => {
    setDraft(metas.map(m => ({ ...m })))
    setEditando(false)
  }

  return (
    <div className="bg-white rounded-lg p-5 border border-zinc-200/80">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-[#0D9488]" />
          <h2 className="text-sm font-semibold text-zinc-800">Metas del mes</h2>
          <span className="text-xs text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full">
            Día {diaActual} de {diasEnMes}
          </span>
        </div>
        {esAdmin && (!editando ? (
          <button
            onClick={() => setEditando(true)}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            <Pencil className="w-3 h-3" />
            Editar metas
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={cancelar} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600">
              <X className="w-3 h-3" /> Cancelar
            </button>
            <button onClick={guardar} className="flex items-center gap-1 text-xs text-[#0D9488] font-medium hover:text-teal-600">
              <Check className="w-3 h-3" /> Guardar
            </button>
          </div>
        ))}
      </div>

      <div className={`grid gap-4 ${metasFiltradas.length === 1 ? 'grid-cols-1' : 'grid-cols-3'}`}>
        {(editando ? draftFiltrado : metasFiltradas).map((s) => {
          const draftIdx = draft.findIndex(d => d.sucursal === s.sucursal)
          const actual = ventasActualesPorSucursal[s.sucursal] ?? 0
          const esperado = Math.round(s.meta * fraccionMes)
          const diferencia = actual - esperado
          const adelante = diferencia >= 0
          const pctActual = Math.min((actual / s.meta) * 100, 100)
          const pctEsperado = Math.min(fraccionMes * 100, 100)

          return (
            <div key={s.sucursal} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-700">{s.sucursal}</span>
                {editando ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-zinc-400">$</span>
                    <input
                      type="number"
                      value={draft[draftIdx].meta}
                      onChange={(e) => {
                        const next = [...draft]
                        next[draftIdx] = { ...next[draftIdx], meta: Number(e.target.value) }
                        setDraft(next)
                      }}
                      className="w-24 text-xs border border-zinc-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#0D9488] text-right"
                    />
                  </div>
                ) : (
                  <span className="text-xs text-zinc-400">Meta: ${s.meta.toLocaleString('es-MX')}</span>
                )}
              </div>

              {/* Barra con marcador de esperado */}
              <div className="relative h-2 bg-zinc-100 rounded-full overflow-visible">
                {/* Progreso actual */}
                <div
                  className="absolute top-0 left-0 h-full rounded-full transition-all"
                  style={{ width: `${pctActual}%`, background: s.color }}
                />
                {/* Línea de esperado */}
                <div
                  className="absolute top-[-3px] h-[14px] w-0.5 bg-zinc-400 rounded-full z-10"
                  style={{ left: `${pctEsperado}%` }}
                  title={`Esperado al día ${diaActual}: $${esperado.toLocaleString('es-MX')}`}
                />
              </div>

              {/* Números */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-zinc-800">${actual.toLocaleString('es-MX')}</p>
                  <p className="text-xs text-zinc-400">de ${s.meta.toLocaleString('es-MX')}</p>
                </div>
                <div className={`text-right ${adelante ? 'text-emerald-500' : 'text-red-400'}`}>
                  <p className="text-xs font-bold">
                    {adelante ? '+' : '-'}${Math.abs(diferencia).toLocaleString('es-MX')}
                  </p>
                  <p className="text-xs opacity-70">{adelante ? 'adelante' : 'abajo'} del ritmo</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const statusMap = {
  confirmada: { label: 'Confirmada', icon: CheckCircle2, color: 'text-emerald-500' },
  pendiente: { label: 'Pendiente', icon: Clock, color: 'text-amber-500' },
  cancelada: { label: 'Cancelada', icon: XCircle, color: 'text-red-400' },
}

// ─────────────────────────────────────────
// Pacientes para búsqueda rápida (mock — luego viene de Supabase)
// ─────────────────────────────────────────
const PACIENTES_BUSQUEDA = [
  { id: 1, nombre: 'María González',  telefono: '686 123 4567', ultimaVisita: '10 Apr 2026', receta: 'Progresivo · OD -2.50 -0.75 · OI -2.25 -0.50' },
  { id: 2, nombre: 'Carlos Ruiz',     telefono: '686 234 5678', ultimaVisita: '22 Ene 2026', receta: 'Monofocal · OD +1.00 · OI +1.25 -0.25' },
  { id: 3, nombre: 'Ana López',       telefono: '686 345 6789', ultimaVisita: '05 Mar 2026', receta: 'Bifocal · OD -3.00 -1.25 · OI -3.25 -1.00' },
  { id: 4, nombre: 'Pedro Sánchez',   telefono: '686 456 7890', ultimaVisita: '14 Nov 2025', receta: 'Monofocal · OD -1.00 · OI -0.75' },
  { id: 5, nombre: 'Laura Martínez',  telefono: '686 567 8901', ultimaVisita: '28 Feb 2026', receta: 'Monofocal · OD -4.50 · OI -4.25' },
  { id: 6, nombre: 'Jorge Herrera',   telefono: '686 678 9012', ultimaVisita: '29 Jun 2026', receta: 'Progresivo · OD +2.00 -0.50 · OI +2.25 -0.75' },
  { id: 7, nombre: 'Sofía Ramos',     telefono: '686 789 0123', ultimaVisita: '15 May 2026', receta: 'Progresivo · OD -1.50 -0.50 · OI -1.75 -0.25' },
  { id: 8, nombre: 'Daniela Fuentes', telefono: '661 234 5678', ultimaVisita: '29 Jun 2026', receta: 'Monofocal · OD -1.75 -0.50 · OI -2.00 -0.25' },
]

type Paciente = typeof PACIENTES_BUSQUEDA[0]

// Lentes listos para entrega hoy (mock)
const LISTOS_HOY = [
  { id: 101, nombre: 'Pedro Martínez', folio: 'L-0041' },
  { id: 102, nombre: 'Ana Pacheco',    folio: 'L-0039' },
]

// ─────────────────────────────────────────
// Vista dashboard activo para vendedor
// ─────────────────────────────────────────
// ── Comisiones y bonos ───────────────────────────────────────────
const BONOS_TABLA = [
  { meta: 50000,  bono: 500  },
  { meta: 100000, bono: 800  },
  { meta: 150000, bono: 1200 },
  { meta: 200000, bono: 4050 },
  { meta: 230000, bono: 5100 },
  { meta: 250000, bono: 5800 },
  { meta: 265000, bono: 6325 },
  { meta: 300000, bono: 7550 },
]

function calcularComision(ventas: number): number {
  if (ventas <= 0) return 0
  if (ventas <= 100000) return ventas * 0.015
  if (ventas <= 150000) return 1500 + (ventas - 100000) * 0.02
  return 1500 + 1000 + (ventas - 150000) * 0.025
}

function calcularBono(ventas: number): { actual: number; siguiente: { meta: number; bono: number } | null } {
  let actual = 0
  let siguiente = null
  for (const b of BONOS_TABLA) {
    if (ventas >= b.meta) actual = b.bono
    else { siguiente = b; break }
  }
  return { actual, siguiente }
}

// ─────────────────────────────────────────
function VistaVendedor({ nombre, sucursal }: { nombre: string; sucursal: string }) {
  const router = useRouter()
  const [query, setQuery]             = useState('')
  const [paciente, setPaciente]       = useState<Paciente | null>(null)
  const [nuevoForm, setNuevoForm]     = useState({ nombre: '', telefono: '' })
  const [mostrarNuevo, setMostrarNuevo] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [ventasMes, setVentasMes] = useState(0)
  const META_MES = 200000

  useEffect(() => {
    const fetchVentasMes = async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const sb = createClient()
        const ahora = new Date()
        const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString()
        const fin = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59).toISOString()
        const { data } = await sb
          .from('ventas')
          .select('total')
          .eq('atendido_por', nombre)
          .eq('es_cotizacion', false)
          .eq('estado', 'activa')
          .gte('created_at', inicio)
          .lte('created_at', fin)
        if (data) setVentasMes(data.reduce((s, v) => s + Number(v.total), 0))
      } catch { /* usa 0 */ }
    }
    fetchVentasMes()
  }, [nombre])

  // Cálculos de desempeño
  const comision = calcularComision(ventasMes)
  const { actual: bonoActual, siguiente: bonoSiguiente } = calcularBono(ventasMes)
  const totalExtra = comision + bonoActual
  const pctMeta = Math.min((ventasMes / META_MES) * 100, 100)

  // Pacientes recientes: ordenados por fecha más reciente
  const recientes = [...PACIENTES_BUSQUEDA]
    .sort((a, b) => new Date(b.ultimaVisita).getTime() - new Date(a.ultimaVisita).getTime())
    .slice(0, 5)

  const resultados = query.trim().length > 0
    ? PACIENTES_BUSQUEDA.filter(p =>
        p.nombre.toLowerCase().includes(query.toLowerCase()) ||
        p.telefono.includes(query)
      )
    : []

  const seleccionar = (p: Paciente) => {
    setPaciente(p)
    setQuery('')
    setMostrarNuevo(false)
  }

  const irAVenta = (p?: Paciente) => {
    const target = p ?? paciente
    if (target) localStorage.setItem('optios_flow_paciente', JSON.stringify(target))
    router.push('/dashboard/ventas/nueva')
  }

  const limpiar = () => {
    setPaciente(null)
    setQuery('')
    setMostrarNuevo(false)
    setNuevoForm({ nombre: '', telefono: '' })
  }

  const inIdle = !query && !paciente && !mostrarNuevo
  const fechaHoy = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="max-w-2xl mx-auto space-y-4 pt-1">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Hola, {nombre.split(' ')[0]}</h1>
          <p className="text-sm text-zinc-400 mt-0.5 capitalize">{fechaHoy} · {sucursal}</p>
        </div>
        <div className="flex items-center gap-5 text-right">
          <div>
            <p className="text-xs text-zinc-400">Ventas hoy</p>
            <p className="text-sm font-bold text-zinc-800">$3,200</p>
          </div>
          <div>
            <p className="text-xs text-zinc-400">Listos</p>
            <p className="text-sm font-bold text-emerald-600">{LISTOS_HOY.length}</p>
          </div>
        </div>
      </div>

      {/* ── Barra de búsqueda ── */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -tranzinc-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setPaciente(null) }}
          placeholder="Buscar paciente por nombre o teléfono..."
          className="w-full border border-zinc-200 rounded-xl pl-10 pr-10 py-3.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-200 placeholder:text-zinc-400 shadow-sm"
        />
        {query && (
          <button onClick={() => setQuery('')}
            className="absolute right-3.5 top-1/2 -tranzinc-y-1/2 text-zinc-300 hover:text-zinc-500 text-lg leading-none">
            ×
          </button>
        )}
      </div>

      {/* ── Resultados de búsqueda ── */}
      {query.trim().length > 0 && (
        <div className="border border-zinc-100 rounded-xl overflow-hidden bg-white shadow-sm divide-y divide-zinc-50">
          {resultados.length > 0
            ? resultados.map(p => (
                <button key={p.id} onClick={() => seleccionar(p)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-zinc-50 transition-colors group">
                  <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center flex-shrink-0 text-xs font-bold text-zinc-500 group-hover:bg-zinc-200 transition-colors">
                    {p.nombre.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-800">{p.nombre}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">{p.telefono} · Última visita {p.ultimaVisita}</p>
                  </div>
                  <span className="text-zinc-300 text-sm">›</span>
                </button>
              ))
            : (
              <div className="px-4 py-4 text-center">
                <p className="text-sm text-zinc-500 mb-3">No se encontró &ldquo;{query}&rdquo;</p>
                <button onClick={() => {
                  setNuevoForm({ nombre: query, telefono: '' })
                  setMostrarNuevo(true)
                  setQuery('')
                }} className="text-sm font-medium text-zinc-900 underline underline-offset-2">
                  Registrar &ldquo;{query}&rdquo; como nuevo
                </button>
              </div>
            )
          }
        </div>
      )}

      {/* ── Paciente seleccionado ── */}
      {paciente && !query && (
        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-sm font-bold text-zinc-600 flex-shrink-0">
                {paciente.nombre.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div>
                <p className="text-base font-semibold text-zinc-900">{paciente.nombre}</p>
                {paciente.telefono && <p className="text-xs text-zinc-400">{paciente.telefono}</p>}
              </div>
            </div>
            <button onClick={limpiar}
              className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors">
              Cambiar ×
            </button>
          </div>
          {paciente.receta !== 'Sin receta' && (
            <div className="border-t border-zinc-50 pt-3">
              <p className="text-xs font-medium text-zinc-400 mb-1.5">Última receta · {paciente.ultimaVisita}</p>
              <p className="text-xs text-zinc-600 font-mono leading-relaxed">{paciente.receta}</p>
            </div>
          )}
          <button onClick={() => irAVenta()}
            className="w-full py-3.5 bg-zinc-900 text-white text-sm font-semibold rounded-xl hover:bg-zinc-800 active:scale-[0.98] transition-all">
            Crear venta →
          </button>
        </div>
      )}

      {/* ── Formulario paciente nuevo ── */}
      {mostrarNuevo && (
        <div className="border border-zinc-200 rounded-xl bg-white p-4 space-y-3">
          <p className="text-sm font-semibold text-zinc-700">Datos del paciente nuevo</p>
          <input autoFocus value={nuevoForm.nombre}
            onChange={e => setNuevoForm(f => ({ ...f, nombre: e.target.value }))}
            placeholder="Nombre completo *"
            className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-200 placeholder:text-zinc-400" />
          <input value={nuevoForm.telefono}
            onChange={e => setNuevoForm(f => ({ ...f, telefono: e.target.value }))}
            placeholder="Teléfono (opcional)"
            className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-200 placeholder:text-zinc-400" />
          <div className="flex gap-2 pt-1">
            <button onClick={limpiar}
              className="flex-1 py-2 border border-zinc-200 rounded-lg text-sm text-zinc-500 hover:bg-zinc-50">
              Cancelar
            </button>
            <button disabled={!nuevoForm.nombre.trim()}
              onClick={() => seleccionar({ id: Date.now(), nombre: nuevoForm.nombre.trim(), telefono: nuevoForm.telefono, ultimaVisita: 'Hoy', receta: 'Sin receta' })}
              className="flex-1 py-2 bg-zinc-900 text-white rounded-lg text-sm font-semibold hover:bg-zinc-800 disabled:opacity-40 transition-colors">
              Continuar →
            </button>
          </div>
        </div>
      )}

      {/* ── Dashboard activo: dos columnas ── */}
      {inIdle && (
        <div className="grid grid-cols-2 gap-4">

          {/* Recientes */}
          <div className="bg-white border border-zinc-100 rounded-xl p-4 shadow-sm">
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Recientes</h2>
            <div className="space-y-0.5">
              {recientes.map(p => (
                <button key={p.id} onClick={() => seleccionar(p)}
                  className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-zinc-50 transition-colors text-left group">
                  <div className="w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center text-xs font-bold text-zinc-500 flex-shrink-0 group-hover:bg-zinc-200 transition-colors">
                    {p.nombre.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-800 truncate">{p.nombre}</p>
                    <p className="text-xs text-zinc-400 truncate">{p.ultimaVisita}</p>
                  </div>
                  <span className="text-zinc-200 group-hover:text-zinc-400 text-sm transition-colors">›</span>
                </button>
              ))}
            </div>
          </div>

          {/* Listos para entregar */}
          <div className="bg-white border border-zinc-100 rounded-xl p-4 shadow-sm">
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Listos para entregar</h2>
            {LISTOS_HOY.length > 0 ? (
              <div className="space-y-0.5">
                {LISTOS_HOY.map(l => (
                  <div key={l.id}
                    className="flex items-center gap-3 px-2 py-2.5 rounded-lg">
                    <FlaskConical className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-800 truncate">{l.nombre}</p>
                      <p className="text-xs text-zinc-400">{l.folio}</p>
                    </div>
                    <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex-shrink-0">
                      Listo
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-400 px-2 py-2">Sin lentes listos por ahora.</p>
            )}
          </div>

        </div>
      )}

      {/* ── Acciones rápidas ── */}
      {inIdle && (
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => irAVenta()}
            className="flex items-center justify-center gap-2 py-3 bg-zinc-900 text-white text-sm font-semibold rounded-xl hover:bg-zinc-800 active:scale-[0.98] transition-all">
            <ShoppingCart className="w-4 h-4" />
            Nueva venta
          </button>
          <button onClick={() => router.push('/dashboard/expedientes?nuevo=true')}
            className="flex items-center justify-center gap-2 py-3 border border-zinc-200 text-zinc-700 text-sm font-medium rounded-xl hover:bg-zinc-50 active:scale-[0.98] transition-all">
            <UserPlus className="w-4 h-4" />
            Paciente nuevo
          </button>
        </div>
      )}

    </div>
  )
}

// ─────────────────────────────────────────
export default function DashboardPage() {
  const [usuario, setUsuario] = useState<{ nombre: string; rol: string; sucursal: string } | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('optios_demo_user')
      if (raw) setUsuario(JSON.parse(raw))
    } catch { /* noop */ }
  }, [])

  const esAdmin    = !usuario || usuario.rol === 'administrador' || usuario.rol === 'gerente'
  const esVendedor = usuario?.rol === 'vendedor'
  const sucursalFiltro = esAdmin ? null : usuario?.sucursal ?? null
  const nombreUsuario = usuario?.nombre ?? 'Usuario'

  // Vendedor: flujo guiado de atención
  if (esVendedor) {
    return <VistaVendedor nombre={nombreUsuario} sucursal={usuario?.sucursal ?? ''} />
  }

  return (
    <div className="space-y-5">

      {/* Greeting */}
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Hola, {nombreUsuario}</h1>
        <p className="text-sm text-zinc-400 mt-0.5">
          {esAdmin
            ? 'Aquí está el resumen de hoy en todas tus sucursales.'
            : `Aquí está el resumen de hoy en ${sucursalFiltro}.`}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Ventas del día"
          value="$8,450"
          icon={ShoppingCart}
          iconBg="bg-[#0D9488]/10"
          iconColor="text-[#0D9488]"
          trend="up"
          trendLabel="+18% vs ayer"
        />
        <CajaCard sucursalFiltro={sucursalFiltro} />
        <StatCard
          label="En laboratorio"
          value="34"
          icon={Package}
          iconBg="bg-amber-50"
          iconColor="text-amber-500"
          trend="neutral"
          trendLabel="6 listos para entregar"
        />
        <StatCard
          label="Por cobrar"
          value="$23,800"
          icon={DollarSign}
          iconBg="bg-rose-50"
          iconColor="text-rose-500"
          trend="up"
          trendLabel="8 cuentas pendientes"
        />
      </div>

      {/* Metas del mes */}
      <MetasCard sucursalFiltro={sucursalFiltro} esAdmin={esAdmin} />

      {/* Main grid */}
      <div className="grid grid-cols-3 gap-4">

        {/* Sales chart — spans 2 cols */}
        <div className="col-span-2 bg-white rounded-lg p-5 border border-zinc-200/80">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-zinc-800">Ventas del mes — {monthLabel}</h2>
              <p className="text-xs text-zinc-400 mt-0.5">Total acumulado: $94,000 MXN</p>
            </div>
            <span className="text-xs font-medium text-[#0D9488] bg-[#0D9488]/10 px-3 py-1 rounded-full">
              Mes actual
            </span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={salesData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0D9488" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#0D9488" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="semana" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: '#0B0E14', border: 'none', borderRadius: 10, color: '#fff', fontSize: 12 }}
                formatter={(v: unknown) => [`$${Number(v).toLocaleString('es-MX')}`, 'Ventas']}
              />
              <Area type="monotone" dataKey="ventas" stroke="#0D9488" strokeWidth={2.5} fill="url(#salesGrad)" dot={{ fill: '#0D9488', r: 4, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Upcoming appointments */}
        <div className="bg-white rounded-lg p-5 border border-zinc-200/80">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-800">Próximas citas</h2>
            <span className="text-xs text-[#0D9488] font-medium cursor-pointer hover:underline">Ver todas</span>
          </div>
          <div className="space-y-3">
            {appointments.map((a, i) => {
              const s = statusMap[a.status as keyof typeof statusMap]
              const StatusIcon = s.icon
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-zinc-500">{a.time}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-zinc-700 truncate">{a.name}</p>
                    <p className="text-xs text-zinc-400">{a.type}</p>
                  </div>
                  <StatusIcon className={`w-4 h-4 flex-shrink-0 ${s.color}`} />
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-3 gap-4">

        {/* Top products */}
        <div className="col-span-2 bg-white rounded-lg p-5 border border-zinc-200/80">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-800">Productos más vendidos</h2>
            <span className="text-xs text-[#0D9488] font-medium cursor-pointer hover:underline">Ver inventario</span>
          </div>
          <div className="overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="text-left text-zinc-400 font-medium pb-2">Producto</th>
                  <th className="text-left text-zinc-400 font-medium pb-2">Categoría</th>
                  <th className="text-right text-zinc-400 font-medium pb-2">Unidades</th>
                  <th className="text-right text-zinc-400 font-medium pb-2">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {topProducts.map((p, i) => (
                  <tr key={i} className="hover:bg-zinc-50 transition-colors">
                    <td className="py-2.5 text-zinc-700 font-medium">{p.name}</td>
                    <td className="py-2.5 text-zinc-400">{p.category}</td>
                    <td className="py-2.5 text-right text-zinc-600">{p.units}</td>
                    <td className="py-2.5 text-right font-semibold text-zinc-800">
                      ${p.revenue.toLocaleString('es-MX')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column — categories + low stock */}
        <div className="space-y-4">

          {/* Category pie */}
          <div className="bg-white rounded-lg p-5 border border-zinc-200/80">
            <h2 className="text-sm font-semibold text-zinc-800 mb-3">Ventas por categoría</h2>
            <div className="flex items-center gap-3">
              <ResponsiveContainer width={90} height={90}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={28} outerRadius={42} dataKey="value" strokeWidth={0}>
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 flex-1">
                {categoryData.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[i] }} />
                    <span className="text-xs text-zinc-500 flex-1 truncate">{c.name}</span>
                    <span className="text-xs font-semibold text-zinc-700">{c.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Low stock */}
          <div className="bg-white rounded-lg p-5 border border-zinc-200/80">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-zinc-800">Inventario bajo</h2>
            </div>
            <div className="space-y-3">
              {lowStock.map((item, i) => (
                <div key={i}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-zinc-600 font-medium truncate pr-2">{item.name}</span>
                    <span className="text-xs font-bold text-red-500 flex-shrink-0">{item.stock} uds</span>
                  </div>
                  <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-400 rounded-full"
                      style={{ width: `${Math.round((item.stock / item.min) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
