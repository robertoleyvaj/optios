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
} from 'lucide-react'

// --- Mock data ---
// Ventas mensuales — semana a semana del mes actual
const now = new Date()
const monthName = now.toLocaleString('es-MX', { month: 'long', year: 'numeric' })
const monthLabel = monthName.charAt(0).toUpperCase() + monthName.slice(1)


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

function MetasCard({ sucursalFiltro, esAdmin, ventasReales }: { sucursalFiltro: string | null; esAdmin: boolean; ventasReales: Record<string, number> }) {
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
          const actual = ventasReales[s.sucursal] ?? 0
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
// Tipos para la vista vendedor
// ─────────────────────────────────────────
type PacienteReal = { id: string; nombre: string; apellido: string; telefono: string }
type LabListo     = { id: string; folio: string; paciente: string }

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
  const [query, setQuery]               = useState('')
  const [paciente, setPaciente]         = useState<PacienteReal | null>(null)
  const [nuevoForm, setNuevoForm]       = useState({ nombre: '', telefono: '' })
  const [mostrarNuevo, setMostrarNuevo] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Datos reales de Supabase
  const [ventasHoy, setVentasHoy]         = useState(0)
  const [recientes, setRecientes]         = useState<PacienteReal[]>([])
  const [listosHoy, setListosHoy]         = useState<LabListo[]>([])
  const [busqResultados, setBusqResultados] = useState<PacienteReal[]>([])

  // Carga inicial: recientes, listos, ventas hoy
  useEffect(() => {
    if (!sucursal) return
    const fetchData = async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const sb  = createClient()
      const hoy = new Date().toISOString().split('T')[0]

      const [pRec, vHoy, listos] = await Promise.all([
        sb.from('pacientes').select('id,nombre,apellido,telefono').order('created_at', { ascending: false }).limit(6),
        sb.from('ventas').select('total,saldo').eq('sucursal', sucursal).eq('estado', 'activa').gte('created_at', `${hoy}T00:00:00`).lte('created_at', `${hoy}T23:59:59`),
        sb.from('ordenes_lab').select('id,folio,paciente').eq('sucursal', sucursal).eq('estado', 'listo').order('fecha_ingreso', { ascending: true }).limit(5),
      ])

      if (pRec.data)  setRecientes(pRec.data)
      if (vHoy.data)  setVentasHoy(vHoy.data.reduce((s, v) => s + Number(v.total) - Number(v.saldo ?? 0), 0))
      if (listos.data) setListosHoy(listos.data)
    }
    fetchData()
  }, [sucursal])

  // Búsqueda en tiempo real con debounce
  useEffect(() => {
    if (query.trim().length === 0) { setBusqResultados([]); return }
    const timer = setTimeout(async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const sb = createClient()
      const q  = query.trim()
      const { data } = await sb
        .from('pacientes')
        .select('id,nombre,apellido,telefono')
        .or(`nombre.ilike.%${q}%,apellido.ilike.%${q}%,telefono.ilike.%${q}%`)
        .order('nombre', { ascending: true })
        .limit(8)
      setBusqResultados(data ?? [])
    }, 200)
    return () => clearTimeout(timer)
  }, [query])

  const nombreDisplay = (p: PacienteReal) => `${p.nombre} ${p.apellido}`.trim()
  const iniciales     = (p: PacienteReal) => `${p.nombre[0] ?? ''}${p.apellido?.[0] ?? ''}`.toUpperCase() || '?'

  const seleccionar = (p: PacienteReal) => { setPaciente(p); setQuery(''); setMostrarNuevo(false) }

  const irAVenta = (p?: PacienteReal) => {
    const target = p ?? paciente
    if (target?.id) router.push(`/dashboard/ventas/nueva?pacienteId=${target.id}`)
    else             router.push('/dashboard/ventas/nueva')
  }

  const limpiar = () => { setPaciente(null); setQuery(''); setMostrarNuevo(false); setNuevoForm({ nombre: '', telefono: '' }) }

  const inIdle   = !query && !paciente && !mostrarNuevo
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
            <p className="text-sm font-bold text-zinc-800">${ventasHoy.toLocaleString('es-MX', { minimumFractionDigits: 0 })}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-400">Listos</p>
            <p className="text-sm font-bold text-emerald-600">{listosHoy.length}</p>
          </div>
        </div>
      </div>

      {/* ── Barra de búsqueda ── */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setPaciente(null) }}
          placeholder="Buscar paciente por nombre o teléfono..."
          className="w-full border border-zinc-200 rounded-xl pl-10 pr-10 py-3.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-200 placeholder:text-zinc-400 shadow-sm"
        />
        {query && (
          <button onClick={() => setQuery('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-300 hover:text-zinc-500 text-lg leading-none">×</button>
        )}
      </div>

      {/* ── Resultados de búsqueda ── */}
      {query.trim().length > 0 && (
        <div className="border border-zinc-100 rounded-xl overflow-hidden bg-white shadow-sm divide-y divide-zinc-50">
          {busqResultados.length > 0
            ? busqResultados.map(p => (
                <button key={p.id} onClick={() => seleccionar(p)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-zinc-50 transition-colors group">
                  <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center flex-shrink-0 text-xs font-bold text-zinc-500 group-hover:bg-zinc-200 transition-colors">
                    {iniciales(p)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-800">{nombreDisplay(p)}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">{p.telefono}</p>
                  </div>
                  <span className="text-zinc-300 text-sm">›</span>
                </button>
              ))
            : (
              <div className="px-4 py-4 text-center">
                <p className="text-sm text-zinc-500 mb-3">No se encontró &ldquo;{query}&rdquo;</p>
                <button onClick={() => { setNuevoForm({ nombre: query, telefono: '' }); setMostrarNuevo(true); setQuery('') }}
                  className="text-sm font-medium text-zinc-900 underline underline-offset-2">
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
                {iniciales(paciente)}
              </div>
              <div>
                <p className="text-base font-semibold text-zinc-900">{nombreDisplay(paciente)}</p>
                {paciente.telefono && <p className="text-xs text-zinc-400">{paciente.telefono}</p>}
              </div>
            </div>
            <button onClick={limpiar} className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors">
              Cambiar ×
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={() => irAVenta()}
              className="flex-1 py-3.5 bg-zinc-900 text-white text-sm font-semibold rounded-xl hover:bg-zinc-800 active:scale-[0.98] transition-all">
              Crear venta →
            </button>
            <button onClick={() => router.push(`/dashboard/expedientes?paciente=${paciente.id}`)}
              className="px-4 py-3.5 border border-zinc-200 text-zinc-600 text-sm font-medium rounded-xl hover:bg-zinc-50 transition-all">
              Expediente
            </button>
          </div>
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
              onClick={() => router.push(`/dashboard/expedientes?nuevo=true&nombre=${encodeURIComponent(nuevoForm.nombre)}&telefono=${encodeURIComponent(nuevoForm.telefono)}`)}
              className="flex-1 py-2 bg-zinc-900 text-white rounded-lg text-sm font-semibold hover:bg-zinc-800 disabled:opacity-40 transition-colors">
              Registrar →
            </button>
          </div>
        </div>
      )}

      {/* ── Dashboard idle: recientes + listos ── */}
      {inIdle && (
        <div className="grid grid-cols-2 gap-4">

          {/* Recientes */}
          <div className="bg-white border border-zinc-100 rounded-xl p-4 shadow-sm">
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Recientes</h2>
            <div className="space-y-0.5">
              {recientes.length > 0 ? recientes.map(p => (
                <button key={p.id} onClick={() => seleccionar(p)}
                  className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-zinc-50 transition-colors text-left group">
                  <div className="w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center text-xs font-bold text-zinc-500 flex-shrink-0 group-hover:bg-zinc-200 transition-colors">
                    {iniciales(p)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-800 truncate">{nombreDisplay(p)}</p>
                  </div>
                  <span className="text-zinc-200 group-hover:text-zinc-400 text-sm transition-colors">›</span>
                </button>
              )) : (
                <p className="text-xs text-zinc-400 px-2 py-2">Sin pacientes aún.</p>
              )}
            </div>
          </div>

          {/* Listos para entregar */}
          <div className="bg-white border border-zinc-100 rounded-xl p-4 shadow-sm">
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Listos para entregar</h2>
            {listosHoy.length > 0 ? (
              <div className="space-y-0.5">
                {listosHoy.map(l => (
                  <div key={l.id} className="flex items-center gap-3 px-2 py-2.5 rounded-lg">
                    <FlaskConical className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-800 truncate">{l.paciente}</p>
                      <p className="text-xs text-zinc-400">{l.folio}</p>
                    </div>
                    <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex-shrink-0">Listo</span>
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
            <ShoppingCart className="w-4 h-4" /> Nueva venta
          </button>
          <button onClick={() => router.push('/dashboard/expedientes?nuevo=true')}
            className="flex items-center justify-center gap-2 py-3 border border-zinc-200 text-zinc-700 text-sm font-medium rounded-xl hover:bg-zinc-50 active:scale-[0.98] transition-all">
            <UserPlus className="w-4 h-4" /> Paciente nuevo
          </button>
        </div>
      )}

    </div>
  )
}

// ─────────────────────────────────────────
export default function DashboardPage() {
  const [usuario, setUsuario] = useState<{ nombre: string; rol: string; sucursal: string } | null>(null)
  const router = useRouter()

  const [kpis, setKpis] = useState({ ventasHoy: 0, ventasAyer: 0, labTotal: 0, labListos: 0, porCobrar: 0, cuentasPendientes: 0 })
  const [chartData, setChartData] = useState<{ semana: string; ventas: number }[]>([])
  const [totalMes, setTotalMes] = useState(0)
  const [ventasRealesPorSucursal, setVentasRealesPorSucursal] = useState<Record<string, number>>({})

  useEffect(() => {
    try {
      const raw = localStorage.getItem('optios_demo_user')
      if (raw) {
        const u = JSON.parse(raw)
        setUsuario(u)
        if (u.rol === 'repartidor') {
          router.replace('/dashboard/laboratorio')
        }
      }
    } catch { /* noop */ }
  }, [router])

  // Fetch datos reales de Supabase para el dashboard admin/gerente
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const sb = createClient()
        const now = new Date()
        const hoy = now.toISOString().split('T')[0]
        const ayer = new Date(now.getTime() - 86400000).toISOString().split('T')[0]
        const primerDia = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

        const [vHoy, vAyer, lab, cuentas, ventasMes] = await Promise.all([
          sb.from('ventas').select('total,saldo').eq('estado','activa')
            .gte('created_at',`${hoy}T00:00:00`).lte('created_at',`${hoy}T23:59:59`),
          sb.from('ventas').select('total,saldo').eq('estado','activa')
            .gte('created_at',`${ayer}T00:00:00`).lt('created_at',`${hoy}T00:00:00`),
          sb.from('ordenes_lab').select('estado'),
          sb.from('ventas').select('saldo').eq('estado','activa').gt('saldo',0),
          sb.from('ventas').select('created_at,total,saldo,sucursal').eq('estado','activa')
            .gte('created_at',`${primerDia}T00:00:00`),
        ])

        const calcNet = (arr: { total: unknown; saldo: unknown }[]) =>
          arr.reduce((s, v) => s + Number(v.total) - Number(v.saldo ?? 0), 0)

        const totalHoy  = calcNet(vHoy.data  ?? [])
        const totalAyer = calcNet(vAyer.data ?? [])

        setKpis({
          ventasHoy:          totalHoy,
          ventasAyer:         totalAyer,
          labTotal:           (lab.data ?? []).filter(o => !['listo','entregado'].includes(o.estado)).length,
          labListos:          (lab.data ?? []).filter(o => o.estado === 'listo').length,
          porCobrar:          (cuentas.data ?? []).reduce((s,v) => s + Number(v.saldo ?? 0), 0),
          cuentasPendientes:  (cuentas.data ?? []).length,
        })

        // Agrupar ventas del mes por semana y por sucursal
        const semMap: Record<number, number> = {}
        const sucMap: Record<string, number> = {}
        for (const v of (ventasMes.data ?? [])) {
          const net = Number(v.total) - Number(v.saldo ?? 0)
          const dia = new Date(v.created_at).getDate()
          const sem = Math.ceil(dia / 7)
          semMap[sem] = (semMap[sem] ?? 0) + net
          sucMap[v.sucursal] = (sucMap[v.sucursal] ?? 0) + net
        }
        const lbls = ['Sem 1\n1–7','Sem 2\n8–14','Sem 3\n15–21','Sem 4\n22–28','Sem 5\n29+']
        setChartData([1,2,3,4,5].filter(k => semMap[k] !== undefined).map(k => ({ semana: lbls[k-1], ventas: semMap[k] })))
        setTotalMes(Object.values(sucMap).reduce((s, v) => s + v, 0))
        setVentasRealesPorSucursal(sucMap)
      } catch { /* noop */ }
    }
    fetchDashboardData()
  }, [])

  const esAdmin    = !usuario || usuario.rol === 'administrador' || usuario.rol === 'gerente'
  const esVendedor = usuario?.rol === 'vendedor'
  const sucursalFiltro = esAdmin ? null : usuario?.sucursal ?? null
  const nombreUsuario = usuario?.nombre ?? 'Usuario'
  const apodoUsuario  = (usuario as { apodo?: string } | null)?.apodo ?? nombreUsuario.split(' ')[0]

  // Vendedor: flujo guiado de atención
  if (esVendedor) {
    return <VistaVendedor nombre={apodoUsuario} sucursal={usuario?.sucursal ?? ''} />
  }

  // Repartidor: redirigido a laboratorio (no renderizar nada mientras)
  if (usuario?.rol === 'repartidor') return null

  return (
    <div className="space-y-5">

      {/* Greeting */}
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Hola, {apodoUsuario}</h1>
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
          value={`$${kpis.ventasHoy.toLocaleString('es-MX')}`}
          icon={ShoppingCart}
          iconBg="bg-[#0D9488]/10"
          iconColor="text-[#0D9488]"
          trend={kpis.ventasAyer > 0 ? (kpis.ventasHoy >= kpis.ventasAyer ? 'up' : 'down') : 'neutral'}
          trendLabel={kpis.ventasAyer > 0
            ? `${kpis.ventasHoy >= kpis.ventasAyer ? '+' : ''}${Math.round(((kpis.ventasHoy - kpis.ventasAyer) / kpis.ventasAyer) * 100)}% vs ayer`
            : 'Sin ventas ayer'}
        />
        <CajaCard sucursalFiltro={sucursalFiltro} />
        <StatCard
          label="En laboratorio"
          value={String(kpis.labTotal)}
          icon={Package}
          iconBg="bg-amber-50"
          iconColor="text-amber-500"
          trend="neutral"
          trendLabel={`${kpis.labListos} listo${kpis.labListos !== 1 ? 's' : ''} para entregar`}
        />
        <StatCard
          label="Por cobrar"
          value={`$${kpis.porCobrar.toLocaleString('es-MX')}`}
          icon={DollarSign}
          iconBg="bg-rose-50"
          iconColor="text-rose-500"
          trend={kpis.cuentasPendientes > 0 ? 'down' : 'neutral'}
          trendLabel={`${kpis.cuentasPendientes} cuenta${kpis.cuentasPendientes !== 1 ? 's' : ''} pendiente${kpis.cuentasPendientes !== 1 ? 's' : ''}`}
        />
      </div>

      {/* Metas del mes */}
      <MetasCard sucursalFiltro={sucursalFiltro} esAdmin={esAdmin} ventasReales={ventasRealesPorSucursal} />

      {/* Main grid */}
      <div className="grid grid-cols-3 gap-4">

        {/* Sales chart — spans 2 cols */}
        <div className="col-span-2 bg-white rounded-lg p-5 border border-zinc-200/80">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-zinc-800">Ventas del mes — {monthLabel}</h2>
              <p className="text-xs text-zinc-400 mt-0.5">Total acumulado: ${totalMes.toLocaleString('es-MX')} MXN</p>
            </div>
            <span className="text-xs font-medium text-[#0D9488] bg-[#0D9488]/10 px-3 py-1 rounded-full">
              Mes actual
            </span>
          </div>
          {chartData.length === 0 && (
            <div className="h-[200px] flex items-center justify-center text-zinc-300 text-sm">
              Sin ventas registradas este mes
            </div>
          )}
          {chartData.length > 0 && <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
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
          </ResponsiveContainer>}
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
