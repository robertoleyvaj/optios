'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  ShoppingCart,
  UserPlus,
  Calendar,
  FlaskConical,
  Phone,
  CheckCircle2,
  AlertTriangle,
  Banknote,
  ChevronRight,
  ArrowRight,
  Activity,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────
type PacienteResult = { id: string; nombre: string; apellido: string; telefono: string }
type CitaItem       = { id: string; hora: string; paciente: string; tipo: string; estado: string }
type TrabajoItem    = { id: string; folio: string; paciente: string; estado: string; fecha_promesa?: string }
type ActividadItem  = { id: string; tipo: string; descripcion: string; hora: string; folio?: string }

const SUCURSALES = ['Baja Visión', '5 de Mayo', 'Plaza Laureles']

// ─── QuickActionCard ──────────────────────────────────────────────────────────
function QuickActionCard({
  icon: Icon,
  label,
  sublabel,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
}: {
  icon: React.ElementType
  label: string
  sublabel: string
  primaryLabel: string
  secondaryLabel: string
  onPrimary: () => void
  onSecondary: () => void
}) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-zinc-50 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-zinc-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-900 leading-tight">{label}</p>
          <p className="text-[11px] text-zinc-400 leading-tight mt-0.5">{sublabel}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={onPrimary}
          className="flex-1 py-2 bg-zinc-900 text-white text-xs font-semibold rounded-lg hover:bg-zinc-800 active:scale-[0.98] transition-all">
          {primaryLabel}
        </button>
        <button onClick={onSecondary}
          className="flex-1 py-2 border border-zinc-200 text-zinc-600 text-xs font-medium rounded-lg hover:bg-zinc-50 active:scale-[0.98] transition-all">
          {secondaryLabel}
        </button>
      </div>
    </div>
  )
}

// ─── TaskRow ──────────────────────────────────────────────────────────────────
function TaskRow({
  icon,
  label,
  count,
  colorClass,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  count: number
  colorClass: string
  onClick: () => void
}) {
  if (count === 0) return null
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-zinc-50 transition-colors text-left group">
      <span className="flex-shrink-0">{icon}</span>
      <span className="flex-1 text-sm text-zinc-700">{label}</span>
      <span className={`text-sm font-bold ${colorClass}`}>{count}</span>
      <ChevronRight className="w-3.5 h-3.5 text-zinc-300 group-hover:text-zinc-500 transition-colors flex-shrink-0" />
    </button>
  )
}

// ─── PendingBlock ─────────────────────────────────────────────────────────────
function PendingBlock({
  icon: Icon,
  label,
  sublabel,
  bgClass,
  iconClass,
  textClass,
  subClass,
  arrowClass,
  onClick,
}: {
  icon: React.ElementType
  label: string
  sublabel: string
  bgClass: string
  iconClass: string
  textClass: string
  subClass: string
  arrowClass: string
  onClick: () => void
}) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-3 px-3.5 py-3 ${bgClass} rounded-xl transition-opacity hover:opacity-90 text-left`}>
      <Icon className={`w-4 h-4 flex-shrink-0 ${iconClass}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-tight ${textClass}`}>{label}</p>
        <p className={`text-xs mt-0.5 ${subClass}`}>{sublabel}</p>
      </div>
      <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 ${arrowClass}`} />
    </button>
  )
}

// ─── DashboardPage ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const [usuario, setUsuario] = useState<{
    nombre: string; apodo?: string; rol: string; sucursal: string
  } | null>(null)
  const [sucursalActual, setSucursalActual] = useState('Baja Visión')

  // Search
  const [query, setQuery]                   = useState('')
  const [busqResultados, setBusqResultados] = useState<PacienteResult[]>([])
  const [showDropdown, setShowDropdown]     = useState(false)

  // Dashboard data
  const [ventasSucursal, setVentasSucursal]         = useState(0)
  const [ventasPropias, setVentasPropias]           = useState(0)
  const [citasHoy, setCitasHoy]                     = useState<CitaItem[]>([])
  const [trabajosListos, setTrabajosListos]         = useState<TrabajoItem[]>([])
  const [trabajosRetrasados, setTrabajosRetrasados] = useState<TrabajoItem[]>([])
  const [saldosPendientes, setSaldosPendientes]     = useState(0)
  const [actividad, setActividad]                   = useState<ActividadItem[]>([])

  // Auth
  useEffect(() => {
    try {
      const raw = localStorage.getItem('optios_demo_user')
      if (raw) {
        const u = JSON.parse(raw)
        setUsuario(u)
        if (u.rol === 'repartidor') {
          router.replace('/dashboard/laboratorio')
          return
        }
        if (u.sucursal && u.sucursal !== 'Todas') {
          setSucursalActual(u.sucursal)
        }
      }
    } catch { /* noop */ }
  }, [router])

  const sucursalEfectiva = usuario?.sucursal === 'Todas' ? sucursalActual : (usuario?.sucursal ?? 'Baja Visión')

  // Data fetch
  useEffect(() => {
    if (!usuario) return
    const fetchAll = async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const sb       = createClient()
        const now      = new Date()
        const startHoy = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
        const endHoy   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
        const hoyStr   = now.toISOString().split('T')[0]

        const [vSuc, vProp, citas, listos, retrasados, saldos, actVentas] = await Promise.all([
          // Ventas cobradas hoy en la sucursal
          sb.from('ventas').select('total,saldo')
            .eq('sucursal', sucursalEfectiva)
            .gte('created_at', startHoy.toISOString())
            .lte('created_at', endHoy.toISOString()),
          // Ventas cobradas hoy del usuario
          sb.from('ventas').select('total,saldo')
            .eq('atendido_por', usuario.nombre)
            .gte('created_at', startHoy.toISOString())
            .lte('created_at', endHoy.toISOString()),
          // Citas de hoy
          sb.from('citas').select('id,hora,paciente,tipo,estado')
            .eq('fecha', hoyStr)
            .eq('sucursal', sucursalEfectiva)
            .order('hora', { ascending: true })
            .limit(12),
          // Trabajos listos (pacientes por llamar + entregar)
          sb.from('ordenes_lab').select('id,folio,paciente,estado,fecha_promesa')
            .eq('sucursal', sucursalEfectiva)
            .eq('estado', 'listo')
            .order('fecha_promesa', { ascending: true })
            .limit(20),
          // Trabajos retrasados (fecha_promesa vencida y sin entregar)
          sb.from('ordenes_lab').select('id,folio,paciente,estado,fecha_promesa')
            .eq('sucursal', sucursalEfectiva)
            .in('estado', ['recibido', 'en proceso'])
            .not('fecha_promesa', 'is', null)
            .lt('fecha_promesa', hoyStr)
            .order('fecha_promesa', { ascending: true })
            .limit(10),
          // Saldos pendientes (count)
          sb.from('ventas').select('id', { count: 'exact', head: true })
            .eq('sucursal', sucursalEfectiva)
            .gt('saldo', 0),
          // Actividad reciente (ventas de hoy)
          sb.from('ventas').select('id,folio,paciente_nombre,created_at,total')
            .eq('sucursal', sucursalEfectiva)
            .gte('created_at', startHoy.toISOString())
            .order('created_at', { ascending: false })
            .limit(8),
        ])

        const cobrado = (arr: { total: number; saldo: number }[]) =>
          arr.reduce((s, v) => s + Number(v.total) - Number(v.saldo ?? 0), 0)

        setVentasSucursal(cobrado(vSuc.data ?? []))
        setVentasPropias(cobrado(vProp.data ?? []))
        setCitasHoy((citas.data ?? []) as CitaItem[])
        setTrabajosListos((listos.data ?? []) as TrabajoItem[])
        setTrabajosRetrasados((retrasados.data ?? []) as TrabajoItem[])
        setSaldosPendientes(saldos.count ?? 0)

        const act: ActividadItem[] = (actVentas.data ?? []).map((v: {
          id: string; folio: string; paciente_nombre: string; created_at: string; total: number
        }) => ({
          id: v.id,
          tipo: 'venta',
          descripcion: `Venta · ${v.paciente_nombre ?? '—'}`,
          hora: new Date(v.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
          folio: v.folio,
        }))
        setActividad(act)
      } catch { /* noop */ }
    }
    fetchAll()
  }, [usuario, sucursalEfectiva])

  // Búsqueda con debounce
  useEffect(() => {
    if (query.trim().length === 0) { setBusqResultados([]); return }
    const t = setTimeout(async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const sb = createClient()
      const { data } = await sb.from('pacientes')
        .select('id,nombre,apellido,telefono')
        .or(`nombre.ilike.%${query.trim()}%,apellido.ilike.%${query.trim()}%,telefono.ilike.%${query.trim()}%`)
        .limit(6)
      setBusqResultados(data ?? [])
    }, 200)
    return () => clearTimeout(t)
  }, [query])

  if (!usuario) return null

  const esTodas   = usuario.sucursal === 'Todas'
  const apodo     = usuario.apodo ?? usuario.nombre.split(' ')[0]
  const fechaRaw  = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
  const fechaLabel = fechaRaw.charAt(0).toUpperCase() + fechaRaw.slice(1)
  const sinTareas  = trabajosListos.length === 0 && citasHoy.length === 0
                  && trabajosRetrasados.length === 0 && saldosPendientes === 0

  return (
    <div className="flex flex-col gap-4 h-full">

      {/* ── Selector de sucursal (admin/gerente con "Todas") ─────────────── */}
      {esTodas && (
        <div className="flex gap-2">
          {SUCURSALES.map(s => (
            <button key={s} onClick={() => setSucursalActual(s)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                sucursalActual === s
                  ? 'bg-zinc-900 text-white shadow-sm'
                  : 'bg-white border border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-700'
              }`}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Hola, {apodo}</h1>
          <p className="text-sm text-zinc-400 mt-0.5">{fechaLabel}</p>
        </div>
        <div className="flex items-end gap-10 text-right">
          <div>
            <p className="text-xs text-zinc-400 mb-1">Ventas sucursal</p>
            <p className="text-2xl font-bold text-zinc-900 leading-none tabular-nums">
              ${ventasSucursal.toLocaleString('es-MX')}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-400 mb-1">Tus ventas</p>
            <p className="text-2xl font-bold text-zinc-900 leading-none tabular-nums">
              ${ventasPropias.toLocaleString('es-MX')}
            </p>
          </div>
        </div>
      </div>

      {/* ── Buscador ─────────────────────────────────────────────────────── */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setShowDropdown(true) }}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          placeholder="Buscar paciente por nombre, teléfono o expediente..."
          className="w-full bg-white border border-zinc-200 rounded-2xl pl-11 pr-10 py-3.5 text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-300 shadow-sm transition-all"
        />
        {query && (
          <button onClick={() => { setQuery(''); setBusqResultados([]) }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-300 hover:text-zinc-500 text-xl leading-none">×</button>
        )}

        {/* Dropdown de resultados */}
        {showDropdown && busqResultados.length > 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-white border border-zinc-200 rounded-2xl shadow-xl overflow-hidden divide-y divide-zinc-50">
            {busqResultados.map(p => (
              <button key={p.id}
                onClick={() => { router.push(`/dashboard/ventas/nueva?pacienteId=${p.id}`); setQuery('') }}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-zinc-50 text-left transition-colors">
                <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-xs font-bold text-zinc-500 flex-shrink-0">
                  {p.nombre[0]}{p.apellido?.[0] ?? ''}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-800">{p.nombre} {p.apellido}</p>
                  <p className="text-xs text-zinc-400">{p.telefono}</p>
                </div>
                <span className="text-xs text-blue-500 font-medium flex-shrink-0 whitespace-nowrap">
                  Nueva venta ›
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Acciones rápidas ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3">
        <QuickActionCard
          icon={ShoppingCart} label="Ventas" sublabel="Registrar o consultar"
          primaryLabel="Nueva venta" secondaryLabel="Buscar venta"
          onPrimary={() => router.push('/dashboard/ventas/nueva')}
          onSecondary={() => router.push('/dashboard/ventas')}
        />
        <QuickActionCard
          icon={UserPlus} label="Pacientes" sublabel="Expedientes y registros"
          primaryLabel="Nuevo expediente" secondaryLabel="Agendar consulta"
          onPrimary={() => router.push('/dashboard/expedientes?nuevo=true')}
          onSecondary={() => router.push('/dashboard/agenda?nuevo=true')}
        />
        <QuickActionCard
          icon={Calendar} label="Agenda" sublabel="Citas del día"
          primaryLabel="Ver agenda hoy" secondaryLabel="Nueva cita"
          onPrimary={() => router.push('/dashboard/agenda')}
          onSecondary={() => router.push('/dashboard/agenda?nuevo=true')}
        />
        <QuickActionCard
          icon={FlaskConical} label="Laboratorio" sublabel="Órdenes y entregas"
          primaryLabel="Ver trabajos" secondaryLabel="Registrar entrega"
          onPrimary={() => router.push('/dashboard/laboratorio')}
          onSecondary={() => router.push('/dashboard/laboratorio')}
        />
      </div>

      {/* ── Grid principal ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-4 flex-1 min-h-0 pb-1">

        {/* ── Columna izquierda (3/5) ── */}
        <div className="col-span-3 flex flex-col gap-4 min-h-0">

          {/* Mi trabajo de hoy */}
          <div className="bg-white border border-zinc-100 rounded-2xl p-5 shadow-sm">
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Mi trabajo de hoy
            </p>
            {sinTareas ? (
              <p className="text-sm text-zinc-400 py-4 text-center">Todo al día ✓</p>
            ) : (
              <div className="space-y-0.5">
                <TaskRow
                  icon={<Phone className="w-4 h-4 text-blue-500" />}
                  label="Pacientes listos para llamar"
                  count={trabajosListos.length}
                  colorClass="text-blue-600"
                  onClick={() => router.push('/dashboard/laboratorio')}
                />
                <TaskRow
                  icon={<Calendar className="w-4 h-4 text-zinc-500" />}
                  label="Citas programadas hoy"
                  count={citasHoy.length}
                  colorClass="text-zinc-700"
                  onClick={() => router.push('/dashboard/agenda')}
                />
                <TaskRow
                  icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                  label="Trabajos listos para entregar"
                  count={trabajosListos.length}
                  colorClass="text-emerald-600"
                  onClick={() => router.push('/dashboard/laboratorio')}
                />
                <TaskRow
                  icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
                  label="Trabajos retrasados"
                  count={trabajosRetrasados.length}
                  colorClass="text-amber-600"
                  onClick={() => router.push('/dashboard/laboratorio')}
                />
                <TaskRow
                  icon={<Banknote className="w-4 h-4 text-rose-500" />}
                  label="Saldos pendientes de cobro"
                  count={saldosPendientes}
                  colorClass="text-rose-600"
                  onClick={() => router.push('/dashboard/ventas')}
                />
              </div>
            )}
          </div>

          {/* Agenda de hoy */}
          <div className="bg-white border border-zinc-100 rounded-2xl p-5 shadow-sm flex-1 min-h-0 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
              <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Agenda de hoy</p>
              <button onClick={() => router.push('/dashboard/agenda')}
                className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-700 transition-colors">
                Ver todo <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            {citasHoy.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 py-4">
                <Calendar className="w-7 h-7 text-zinc-200 mb-2" />
                <p className="text-sm text-zinc-400">Sin citas hoy</p>
                <button onClick={() => router.push('/dashboard/agenda?nuevo=true')}
                  className="mt-2 text-xs font-medium text-blue-500 hover:underline">
                  Agendar cita →
                </button>
              </div>
            ) : (
              <div className="space-y-0.5 overflow-y-auto flex-1">
                {citasHoy.map(c => (
                  <div key={c.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-zinc-50 transition-colors cursor-pointer">
                    <span className="text-xs font-mono text-zinc-400 w-10 flex-shrink-0">{c.hora?.slice(0,5)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-800 truncate">{c.paciente}</p>
                      <p className="text-xs text-zinc-400 capitalize">{c.tipo}</p>
                    </div>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                      c.estado === 'confirmada' ? 'bg-emerald-50 text-emerald-600' :
                      c.estado === 'cancelada'  ? 'bg-red-50 text-red-400' :
                      'bg-zinc-100 text-zinc-500'
                    }`}>{c.estado}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Columna derecha (2/5) ── */}
        <div className="col-span-2 flex flex-col gap-4 min-h-0">

          {/* Pendientes */}
          <div className="bg-white border border-zinc-100 rounded-2xl p-5 shadow-sm">
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">Pendientes</p>
            <div className="space-y-2">
              {trabajosRetrasados.length > 0 && (
                <PendingBlock
                  icon={AlertTriangle}
                  label="Trabajos retrasados"
                  sublabel={`${trabajosRetrasados.length} orden${trabajosRetrasados.length !== 1 ? 'es' : ''} vencida${trabajosRetrasados.length !== 1 ? 's' : ''}`}
                  bgClass="bg-amber-50 hover:bg-amber-100"
                  iconClass="text-amber-500"
                  textClass="text-amber-800"
                  subClass="text-amber-600"
                  arrowClass="text-amber-300"
                  onClick={() => router.push('/dashboard/laboratorio')}
                />
              )}
              {trabajosListos.length > 0 && (
                <PendingBlock
                  icon={CheckCircle2}
                  label="Listos para entregar"
                  sublabel={`${trabajosListos.length} trabajo${trabajosListos.length !== 1 ? 's' : ''} esperando`}
                  bgClass="bg-emerald-50 hover:bg-emerald-100"
                  iconClass="text-emerald-500"
                  textClass="text-emerald-800"
                  subClass="text-emerald-600"
                  arrowClass="text-emerald-300"
                  onClick={() => router.push('/dashboard/laboratorio')}
                />
              )}
              {saldosPendientes > 0 && (
                <PendingBlock
                  icon={Banknote}
                  label="Saldos pendientes"
                  sublabel={`${saldosPendientes} venta${saldosPendientes !== 1 ? 's' : ''} con saldo`}
                  bgClass="bg-red-50 hover:bg-red-100"
                  iconClass="text-rose-500"
                  textClass="text-rose-800"
                  subClass="text-rose-500"
                  arrowClass="text-rose-300"
                  onClick={() => router.push('/dashboard/ventas')}
                />
              )}
              {trabajosRetrasados.length === 0 && trabajosListos.length === 0 && saldosPendientes === 0 && (
                <p className="text-sm text-zinc-400 text-center py-3">Sin excepciones ✓</p>
              )}
            </div>
          </div>

          {/* Actividad reciente */}
          <div className="bg-white border border-zinc-100 rounded-2xl p-5 shadow-sm flex-1 min-h-0 overflow-hidden flex flex-col">
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex-shrink-0">
              Actividad reciente
            </p>
            {actividad.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 py-4">
                <Activity className="w-7 h-7 text-zinc-200 mb-2" />
                <p className="text-sm text-zinc-400">Sin actividad hoy</p>
              </div>
            ) : (
              <div className="space-y-0.5 overflow-y-auto flex-1">
                {actividad.map(a => (
                  <button key={a.id}
                    onClick={() => router.push('/dashboard/ventas')}
                    className="w-full flex items-start gap-3 px-2 py-2.5 rounded-xl hover:bg-zinc-50 transition-colors text-left">
                    <div className="w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <ShoppingCart className="w-3 h-3 text-zinc-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-zinc-700 truncate">{a.descripcion}</p>
                      {a.folio && <p className="text-xs text-zinc-400">{a.folio}</p>}
                    </div>
                    <span className="text-xs text-zinc-400 flex-shrink-0 mt-0.5">{a.hora}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
