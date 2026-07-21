'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { hoyLocal, rangoDiaLocal } from '@/lib/fecha'
import RequireRol from '@/components/RequireRol'
import {
  TrendingUp, TrendingDown, DollarSign, FlaskConical,
  Plus, X, Save, ChevronDown, Trash2, Pencil,
} from 'lucide-react'

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────
type Periodo = 'semana' | 'mes' | 'trimestre' | 'anio' | 'personalizado'

type Gasto = {
  id: string
  fecha: string
  concepto: string
  categoria: string
  monto: number
  sucursal: string
  notas: string
}

// ─────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────
const PERIODOS: { key: Periodo; label: string }[] = [
  { key: 'semana',        label: 'Esta semana'   },
  { key: 'mes',           label: 'Este mes'      },
  { key: 'trimestre',     label: 'Trimestre'     },
  { key: 'anio',          label: 'Este año'      },
  { key: 'personalizado', label: 'Personalizado' },
]

// Categorías que captura el admin manualmente (opciones del formulario)
const CATEGORIAS_MANUAL = ['renta', 'nomina', 'bonos_comisiones', 'proveedores', 'servicios', 'mantenimiento', 'marketing', 'papeleria', 'limpieza', 'otros']
// Todas las que pueden aparecer como egreso operativo (para el desglose):
// las manuales + la automática (comisión de terminal) + claves antiguas por compatibilidad
const CATEGORIAS_GASTO = [...CATEGORIAS_MANUAL, 'comision_terminal', 'bono_diario', 'adelanto', 'comisiones', 'compras']
// Movimientos del dueño (no son costos del negocio, se muestran aparte)
const CATEGORIAS_RETIRO = ['retiro_admin']
const CATEGORIAS_LABEL: Record<string, string> = {
  renta:              'Renta',
  nomina:             'Nómina / Sueldos',
  bonos_comisiones:   'Bonos y comisiones',
  proveedores:        'Proveedores / Compras',
  servicios:          'Servicios',
  mantenimiento:      'Mantenimiento y equipo',
  marketing:          'Publicidad / Marketing',
  papeleria:          'Papelería / Administrativo',
  limpieza:           'Artículos de limpieza',
  comision_terminal:  'Comisión terminal (banco)',
  otros:              'Otros',
  // Claves antiguas (datos previos)
  bono_diario:        'Bono diario',
  adelanto:           'Adelanto sueldo',
  comisiones:         'Comisiones',
  compras:            'Compras',
  retiro_admin:       'Retiro admin',
}

const SUCURSALES = ['Baja Visión', '5 de Mayo', 'Plaza Laureles', 'General']

// ─────────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────────
function getDateRange(periodo: Periodo, desde = '', hasta = '') {
  const hoy = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date)   => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
  const fin = fmt(hoy)

  if (periodo === 'personalizado') return { inicio: desde || fin, fin: hasta || fin }
  if (periodo === 'semana') {
    const d = new Date(hoy); const dia = hoy.getDay() || 7
    d.setDate(hoy.getDate() - dia + 1); return { inicio: fmt(d), fin }
  }
  if (periodo === 'mes')       return { inicio: `${hoy.getFullYear()}-${pad(hoy.getMonth()+1)}-01`, fin }
  if (periodo === 'trimestre') {
    const q = Math.floor(hoy.getMonth() / 3)
    return { inicio: `${hoy.getFullYear()}-${pad(q*3+1)}-01`, fin }
  }
  return { inicio: `${hoy.getFullYear()}-01-01`, fin }
}

const $$ = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)

const hoy = () => hoyLocal()

// ─────────────────────────────────────────────
// Sub-componentes
// ─────────────────────────────────────────────
function ResumenRow({ label, value, bold, color, indent }: {
  label: string; value: number; bold?: boolean; color?: string; indent?: boolean
}) {
  const textColor = color || (bold ? 'text-zinc-900' : 'text-zinc-600')
  return (
    <div className={`flex justify-between items-center py-2 ${indent ? 'pl-4' : ''} ${bold ? 'border-t border-zinc-200 mt-1 pt-3' : ''}`}>
      <span className={`text-sm ${bold ? 'font-bold' : 'font-normal'} ${textColor}`}>{label}</span>
      <span className={`text-sm font-semibold ${textColor}`}>{$$(value)}</span>
    </div>
  )
}

// ─────────────────────────────────────────────
// Página
// ─────────────────────────────────────────────
function FinanzasPage() {
  const [periodo,    setPeriodo]    = useState<Periodo>('mes')
  const [desde,      setDesde]      = useState('')
  const [hasta,      setHasta]      = useState('')
  const [sucursal,   setSucursal]   = useState('Todas')

  // Datos
  const [ingresos,   setIngresos]   = useState(0)
  const [costoLab,   setCostoLab]   = useState(0)
  const [gastos,     setGastos]     = useState<Gasto[]>([])
  const [porLab,     setPorLab]     = useState<{ nombre: string; total: number; count: number }[]>([])
  const [cargando,   setCargando]   = useState(true)

  // Detalle por card
  const [cardActiva, setCardActiva] = useState<'facturado' | 'cobrado' | 'costo_lab' | 'gastos' | 'utilidad' | null>(null)
  const [totalVentas,   setTotalVentas]   = useState(0)
  const [ventasDetalle, setVentasDetalle] = useState<{ folio: string; fecha: string; atendidoPor: string; total: number; saldo: number }[]>([])
  const [labDetalle,    setLabDetalle]    = useState<{ folio: string; laboratorio: string; costoLab: number; fechaPago: string; paciente: string }[]>([])

  // Modal
  const [modal,       setModal]       = useState(false)
  const [editandoId,  setEditandoId]  = useState<string | null>(null)
  const [guardando,   setGuardando]   = useState(false)
  const [formGasto,   setFormGasto]   = useState({
    fecha: hoy(), concepto: '', categoria: 'renta',
    monto: '', sucursal: 'General', notas: '',
  })

  const abrirEditar = (g: Gasto) => {
    setEditandoId(g.id)
    setFormGasto({
      fecha:     g.fecha,
      concepto:  g.concepto,
      categoria: g.categoria,
      monto:     String(g.monto),
      sucursal:  g.sucursal,
      notas:     g.notas ?? '',
    })
    setModal(true)
  }

  const cargar = useCallback(async () => {
    setCargando(true)
    const { inicio, fin } = getDateRange(periodo, desde, hasta)
    const rangoInicio = rangoDiaLocal(inicio).start
    const rangoFin    = rangoDiaLocal(fin).end
    const supabase = createClient()

    // Cobrado: lo que efectivamente entró de ventas del período (total - saldo)
    let qVentas = supabase
      .from('ventas')
      .select('folio, total, saldo, created_at, atendido_por')
      .eq('es_cotizacion', false)
      .gte('created_at', rangoInicio)
      .lte('created_at', rangoFin)
      .order('created_at', { ascending: false })
    if (sucursal !== 'Todas') qVentas = qVentas.eq('sucursal', sucursal)
    const { data: ventasData } = await qVentas
    const ventasRows = ventasData || []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setTotalVentas(ventasRows.reduce((s: number, v: any) => s + (parseFloat(v.total) || 0), 0))
    setIngresos(ventasRows.reduce((s, v) => s + (v.total - v.saldo), 0))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setVentasDetalle(ventasRows.map((v: any) => ({
      folio:       v.folio ?? '',
      // Fecha en hora de Tijuana (no UTC): si no, una venta de la tarde/noche
      // se ve como del día siguiente.
      fecha:       v.created_at ? new Date(v.created_at as string).toLocaleDateString('en-CA', { timeZone: 'America/Tijuana' }) : '',
      atendidoPor: v.atendido_por ?? '',
      total:       parseFloat(v.total) || 0,
      saldo:       parseFloat(v.saldo) || 0,
    })))

    // Costo lab: órdenes pagadas — usa fecha_pago_lab para reflejar cuándo salió el dinero
    let qLab = supabase
      .from('ordenes_lab')
      .select('folio, costo_lab, laboratorio, fecha_pago_lab, paciente')
      .eq('pagado_lab', true)
      .gt('costo_lab', 0)
      .gte('fecha_pago_lab', inicio)
      .lte('fecha_pago_lab', fin)
      .order('fecha_pago_lab', { ascending: false })
    if (sucursal !== 'Todas') qLab = qLab.eq('sucursal', sucursal)
    const { data: labData } = await qLab
    const labRows = labData || []
    setCostoLab(labRows.reduce((s, r) => s + (r.costo_lab || 0), 0))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setLabDetalle(labRows.map((r: any) => ({
      folio:       r.folio ?? '',
      laboratorio: r.laboratorio || 'Sin especificar',
      costoLab:    parseFloat(r.costo_lab) || 0,
      fechaPago:   r.fecha_pago_lab ?? '',
      paciente:    r.paciente ?? '',
    })))

    // Agrupado por laboratorio
    const byLab: Record<string, { total: number; count: number }> = {}
    labRows.forEach(r => {
      const lab = (r as { laboratorio?: string }).laboratorio || 'Sin especificar'
      byLab[lab] = byLab[lab] || { total: 0, count: 0 }
      byLab[lab].total += (r as { costo_lab?: number }).costo_lab || 0
      byLab[lab].count += 1
    })
    setPorLab(Object.entries(byLab)
      .map(([nombre, { total, count }]) => ({ nombre, total, count }))
      .sort((a, b) => b.total - a.total))

    // Egresos de empresa: SOLO es_caja = false (o null en datos viejos).
    // Los egresos del cajón (es_caja = true, ej. bono del día) NO entran aquí.
    let qGastos = supabase
      .from('gastos')
      .select('*')
      .or('es_caja.is.null,es_caja.eq.false')
      .gte('fecha', inicio)
      .lte('fecha', fin)
      .order('fecha', { ascending: false })
    if (sucursal !== 'Todas') qGastos = qGastos.eq('sucursal', sucursal)
    const { data: gastosData } = await qGastos
    setGastos(gastosData || [])

    setCargando(false)
  }, [periodo, desde, hasta, sucursal])

  useEffect(() => { cargar() }, [cargar])

  // ── Cálculos ──────────────────────────────
  const gastosOperativos = gastos.filter(g => !CATEGORIAS_RETIRO.includes(g.categoria))
  const retirosAdmin     = gastos.filter(g => CATEGORIAS_RETIRO.includes(g.categoria))
  const totalGastos      = gastosOperativos.reduce((s, g) => s + g.monto, 0)
  const totalRetiros     = retirosAdmin.reduce((s, g) => s + g.monto, 0)
  const utilidadBruta    = ingresos - costoLab
  const utilidadNeta     = utilidadBruta - totalGastos
  const flujoNeto        = utilidadNeta - totalRetiros
  const margen           = ingresos > 0 ? Math.round((utilidadNeta / ingresos) * 100) : 0

  // ── Guardar / editar gasto ──
  const guardarGasto = async () => {
    if (!formGasto.concepto || !formGasto.monto) return
    setGuardando(true)
    const supabase = createClient()
    const payload = {
      fecha:     formGasto.fecha,
      concepto:  formGasto.concepto,
      categoria: formGasto.categoria,
      monto:     parseFloat(formGasto.monto),
      sucursal:  formGasto.sucursal,
      notas:     formGasto.notas || null,
      es_caja:   false,   // egreso de empresa: nunca toca el corte de caja
    }

    if (editandoId) {
      const { error } = await supabase.from('gastos').update(payload).eq('id', editandoId)
      if (error) { alert('Error: ' + error.message); setGuardando(false); return }
      setGastos(prev => prev.map(g => g.id === editandoId ? { ...g, ...payload, notas: payload.notas ?? '' } : g))
    } else {
      const { data, error } = await supabase.from('gastos').insert(payload).select().single()
      if (error) { alert('Error: ' + error.message); setGuardando(false); return }
      setGastos(prev => [data, ...prev])
    }

    setModal(false)
    setEditandoId(null)
    setFormGasto({ fecha: hoy(), concepto: '', categoria: 'renta', monto: '', sucursal: 'General', notas: '' })
    setGuardando(false)
  }

  // ── Eliminar gasto ──
  const eliminarGasto = async (id: string) => {
    if (!confirm('¿Eliminar este gasto?')) return
    const supabase = createClient()
    await supabase.from('gastos').delete().eq('id', id)
    setGastos(prev => prev.filter(g => g.id !== id))
  }

  const { inicio, fin } = getDateRange(periodo, desde, hasta)

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Finanzas</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {inicio === fin ? inicio : `${inicio} → ${fin}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {/* Período */}
          <div className="flex bg-zinc-100 rounded-lg p-1 gap-0.5">
            {PERIODOS.map(p => (
              <button key={p.key} onClick={() => setPeriodo(p.key)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  periodo === p.key ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                }`}>
                {p.label}
              </button>
            ))}
          </div>
          {/* Sucursal */}
          <select value={sucursal} onChange={e => setSucursal(e.target.value)}
            className="border border-zinc-200 rounded-lg px-3 py-1.5 text-xs bg-white text-zinc-700 focus:outline-none">
            {['Todas', 'Baja Visión', '5 de Mayo', 'Plaza Laureles'].map(s => <option key={s}>{s}</option>)}
          </select>
          {/* Rango personalizado */}
          {periodo === 'personalizado' && (
            <div className="flex items-center gap-1.5">
              <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
                className="border border-zinc-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none" />
              <span className="text-zinc-400 text-xs">→</span>
              <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
                className="border border-zinc-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none" />
            </div>
          )}
          {/* Agregar gasto */}
          <button onClick={() => setModal(true)}
            className="flex items-center gap-1.5 bg-[#0B0E14] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#1A1D27]">
            <Plus className="w-3.5 h-3.5" /> Registrar egreso
          </button>
        </div>
      </div>

      {cargando ? (
        <div className="flex items-center justify-center h-64 text-zinc-400 text-sm">Cargando…</div>
      ) : (
        <>
          {/* ── 5 KPI Cards clickeables ── */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {([
              { key: 'facturado' as const, label: 'Total facturado',   value: totalVentas,  icon: TrendingUp,   color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-400'    },
              { key: 'cobrado'   as const, label: 'Ingresó (cobrado)', value: ingresos,     icon: TrendingUp,   color: 'text-teal-600',    bg: 'bg-teal-50',    border: 'border-teal-400'    },
              { key: 'costo_lab' as const, label: 'Costo laboratorio', value: costoLab,     icon: FlaskConical, color: 'text-violet-600',  bg: 'bg-violet-50',  border: 'border-violet-400'  },
              { key: 'gastos'    as const, label: 'Egresos',           value: totalGastos,  icon: TrendingDown, color: 'text-red-500',     bg: 'bg-red-50',     border: 'border-red-400'     },
              { key: 'utilidad'  as const, label: 'Utilidad neta',     value: utilidadNeta, icon: DollarSign,   color: utilidadNeta >= 0 ? 'text-emerald-600' : 'text-red-600', bg: utilidadNeta >= 0 ? 'bg-emerald-50' : 'bg-red-50', border: utilidadNeta >= 0 ? 'border-emerald-400' : 'border-red-400' },
            ]).map(k => {
              const Icon = k.icon
              const activa = cardActiva === k.key
              return (
                <button
                  key={k.key}
                  onClick={() => setCardActiva(prev => prev === k.key ? null : k.key)}
                  className={`bg-white rounded-lg px-5 py-4 border-2 text-left transition-all cursor-pointer w-full ${
                    activa ? `${k.border} shadow-sm` : 'border-transparent outline outline-1 outline-zinc-200/80 hover:outline-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-zinc-400">{k.label}</p>
                    <div className={`w-8 h-8 rounded ${k.bg} flex items-center justify-center`}>
                      <Icon className={`w-4 h-4 ${k.color}`} />
                    </div>
                  </div>
                  <p className={`text-2xl font-bold mt-2 ${k.color}`}>{$$(k.value)}</p>
                  {k.key === 'utilidad' && (
                    <p className="text-xs text-zinc-400 mt-0.5">Margen {margen}%</p>
                  )}
                  {activa && (
                    <p className="text-[10px] text-zinc-400 mt-1">▲ Ver detalle</p>
                  )}
                </button>
              )
            })}
          </div>

          {/* ── Panel de desglose (aparece al picar una card) ── */}
          {cardActiva && (
            <div className="bg-white rounded-lg border border-zinc-200/80 overflow-hidden">

              {/* Facturado / Cobrado → tabla de ventas */}
              {(cardActiva === 'facturado' || cardActiva === 'cobrado') && (
                <>
                  <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200">
                    <h3 className="text-sm font-bold text-zinc-700">
                      Ventas del período
                      <span className="ml-2 text-xs font-normal text-zinc-400">{ventasDetalle.length} registros</span>
                    </h3>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-zinc-400 text-xs">Facturado: <span className="font-bold text-blue-600">{$$(totalVentas)}</span></span>
                      <span className="text-zinc-400 text-xs">Cobrado: <span className="font-bold text-teal-600">{$$(ingresos)}</span></span>
                    </div>
                  </div>
                  {ventasDetalle.length === 0 ? (
                    <p className="text-sm text-zinc-400 text-center py-10">Sin ventas en este período</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-zinc-200">
                        {['Folio', 'Fecha', 'Atendió', 'Total', 'Saldo', 'Cobrado'].map(h => (
                          <th key={h} className="text-left text-xs text-zinc-400 font-medium px-5 py-3">{h}</th>
                        ))}
                      </tr></thead>
                      <tbody className="divide-y divide-zinc-50">
                        {ventasDetalle.map((v, i) => (
                          <tr key={i} className="hover:bg-zinc-100 transition-colors">
                            <td className="px-5 py-3 text-xs font-mono text-zinc-500">{v.folio}</td>
                            <td className="px-5 py-3 text-xs text-zinc-400">{v.fecha}</td>
                            <td className="px-5 py-3 text-xs text-zinc-500">{v.atendidoPor || '—'}</td>
                            <td className="px-5 py-3 text-sm font-semibold text-zinc-700">{$$(v.total)}</td>
                            <td className="px-5 py-3 text-xs text-amber-600">{v.saldo > 0 ? $$(v.saldo) : '—'}</td>
                            <td className="px-5 py-3 text-sm font-bold text-teal-600">{$$(v.total - v.saldo)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}

              {/* Costo lab → por lab + tabla de órdenes */}
              {cardActiva === 'costo_lab' && (
                <>
                  <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200">
                    <h3 className="text-sm font-bold text-zinc-700">
                      Órdenes de laboratorio pagadas
                      <span className="ml-2 text-xs font-normal text-zinc-400">{labDetalle.length} registros</span>
                    </h3>
                    <span className="text-sm font-bold text-violet-600">{$$(costoLab)}</span>
                  </div>
                  {porLab.length > 0 && (
                    <div className="px-5 py-4 border-b border-zinc-200 space-y-2.5">
                      {porLab.map(lab => {
                        const pct = costoLab > 0 ? Math.round((lab.total / costoLab) * 100) : 0
                        return (
                          <div key={lab.nombre}>
                            <div className="flex justify-between items-baseline mb-1">
                              <span className="text-sm text-zinc-700 font-medium">{lab.nombre}</span>
                              <span className="text-xs text-zinc-400">{lab.count} órdenes · {$$(lab.total)}</span>
                            </div>
                            <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                              <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${Math.max(pct, 2)}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {labDetalle.length === 0 ? (
                    <p className="text-sm text-zinc-400 text-center py-10">Sin órdenes pagadas en este período</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-zinc-200">
                        {['Folio', 'Paciente', 'Laboratorio', 'Fecha pago', 'Costo'].map(h => (
                          <th key={h} className="text-left text-xs text-zinc-400 font-medium px-5 py-3">{h}</th>
                        ))}
                      </tr></thead>
                      <tbody className="divide-y divide-zinc-50">
                        {labDetalle.map((r, i) => (
                          <tr key={i} className="hover:bg-zinc-100 transition-colors">
                            <td className="px-5 py-3 text-xs font-mono text-zinc-500">{r.folio}</td>
                            <td className="px-5 py-3 text-sm text-zinc-700">{r.paciente || '—'}</td>
                            <td className="px-5 py-3 text-xs text-zinc-500">{r.laboratorio}</td>
                            <td className="px-5 py-3 text-xs text-zinc-400">{r.fechaPago}</td>
                            <td className="px-5 py-3 text-sm font-bold text-violet-600">{$$(r.costoLab)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}

              {/* Gastos → tabla de gastos con edit/delete */}
              {cardActiva === 'gastos' && (
                <>
                  <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200">
                    <h3 className="text-sm font-bold text-zinc-700">
                      Gastos operativos
                      <span className="ml-2 text-xs font-normal text-zinc-400">{gastos.length} registros</span>
                    </h3>
                    {gastos.length > 0 && <span className="text-sm font-bold text-red-500">{$$(totalGastos)}</span>}
                  </div>
                  {gastos.length === 0 ? (
                    <div className="text-center py-12 text-zinc-400">
                      <p className="text-sm">Sin gastos registrados en este período</p>
                      <button onClick={() => setModal(true)} className="mt-3 text-xs text-teal-600 hover:underline font-medium">
                        + Registrar primer gasto
                      </button>
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-zinc-200">
                        {['Fecha', 'Concepto', 'Categoría', 'Sucursal', 'Monto', ''].map(h => (
                          <th key={h} className="text-left text-xs text-zinc-400 font-medium px-5 py-3">{h}</th>
                        ))}
                      </tr></thead>
                      <tbody className="divide-y divide-zinc-50">
                        {gastos.map(g => (
                          <tr key={g.id} className="hover:bg-zinc-100 transition-colors group">
                            <td className="px-5 py-3 text-xs text-zinc-400 whitespace-nowrap">{g.fecha}</td>
                            <td className="px-5 py-3">
                              <p className="text-sm text-zinc-700 font-medium">{g.concepto}</p>
                              {g.notas && <p className="text-xs text-zinc-400 mt-0.5">{g.notas}</p>}
                            </td>
                            <td className="px-5 py-3">
                              <span className="text-xs bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full">
                                {CATEGORIAS_LABEL[g.categoria] || g.categoria}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-xs text-zinc-500">{g.sucursal}</td>
                            <td className="px-5 py-3 text-sm font-semibold text-red-500">−{$$(g.monto)}</td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => abrirEditar(g)} className="text-zinc-400 hover:text-zinc-600">
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => eliminarGasto(g.id)} className="text-zinc-400 hover:text-red-400">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}

              {/* Utilidad → estado de resultados completo */}
              {cardActiva === 'utilidad' && (
                <div className="px-5 py-5">
                  <h3 className="text-sm font-bold text-zinc-700 mb-4">Estado de resultados</h3>
                  <div className="divide-y divide-zinc-100">
                    <ResumenRow label="Cobrado en ventas del período" value={ingresos} />
                    <ResumenRow label="− Costo de laboratorio" value={-costoLab} indent color="text-violet-600" />
                    <ResumenRow label="Utilidad bruta" value={utilidadBruta} bold color={utilidadBruta >= 0 ? 'text-zinc-900' : 'text-red-600'} />
                    {CATEGORIAS_GASTO.map(cat => {
                      const total = gastosOperativos.filter(g => g.categoria === cat).reduce((s, g) => s + g.monto, 0)
                      if (total === 0) return null
                      return <ResumenRow key={cat} label={`− ${CATEGORIAS_LABEL[cat]}`} value={-total} indent color="text-red-500" />
                    })}
                    <ResumenRow label="Utilidad neta" value={utilidadNeta} bold color={utilidadNeta >= 0 ? 'text-emerald-600' : 'text-red-600'} />
                  </div>

                  {/* Movimientos del dueño — no afectan utilidad */}
                  {totalRetiros > 0 && (
                    <div className="mt-4 pt-4 border-t border-zinc-200">
                      <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Movimientos del dueño</p>
                      <div className="divide-y divide-zinc-100">
                        {CATEGORIAS_RETIRO.map(cat => {
                          const total = retirosAdmin.filter(g => g.categoria === cat).reduce((s, g) => s + g.monto, 0)
                          if (total === 0) return null
                          return <ResumenRow key={cat} label={`− ${CATEGORIAS_LABEL[cat]}`} value={-total} indent color="text-orange-500" />
                        })}
                        <ResumenRow label="Flujo neto del período" value={flujoNeto} bold color={flujoNeto >= 0 ? 'text-teal-600' : 'text-red-600'} />
                      </div>
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-zinc-200">
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span>Margen operativo sobre ventas</span>
                      <span className={`font-bold text-sm ${margen >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{margen}%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Tira resumen compacta siempre visible ── */}
          <div className="bg-white rounded-lg border border-zinc-200/80 px-5 py-3">
            <div className="flex items-center gap-0 divide-x divide-zinc-100 text-center overflow-x-auto">
              {[
                { label: 'Facturado',      value: totalVentas,   color: 'text-blue-600'    },
                { label: 'Cobrado',        value: ingresos,      color: 'text-teal-600'    },
                { label: '− Costo lab',    value: -costoLab,     color: 'text-violet-600'  },
                { label: 'Util. bruta',    value: utilidadBruta, color: utilidadBruta  >= 0 ? 'text-zinc-800' : 'text-red-600' },
                { label: '− Gastos',       value: -totalGastos,  color: 'text-red-500'     },
                { label: 'Util. neta',     value: utilidadNeta,  color: utilidadNeta   >= 0 ? 'text-emerald-600' : 'text-red-600' },
              ].map((item, i) => (
                <div key={i} className="flex-1 min-w-[100px] px-4 py-1">
                  <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wide">{item.label}</p>
                  <p className={`text-sm font-bold mt-0.5 ${item.color}`}>{$$(item.value)}</p>
                </div>
              ))}
              <div className="flex-1 min-w-[80px] px-4 py-1">
                <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wide">Margen</p>
                <p className={`text-sm font-bold mt-0.5 ${margen >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{margen}%</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── MODAL REGISTRAR GASTO ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-200">
              <h2 className="text-base font-bold text-zinc-800">{editandoId ? 'Editar egreso' : 'Registrar egreso'}</h2>
              <button onClick={() => { setModal(false); setEditandoId(null) }}><X className="w-5 h-5 text-zinc-400" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">

              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Concepto *</label>
                <input value={formGasto.concepto}
                  onChange={e => setFormGasto(f => ({ ...f, concepto: e.target.value }))}
                  placeholder="Ej. Renta julio Baja Visión"
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Categoría</label>
                  <select value={formGasto.categoria}
                    onChange={e => setFormGasto(f => ({ ...f, categoria: e.target.value }))}
                    className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none">
                    {CATEGORIAS_MANUAL.map(c => <option key={c} value={c}>{CATEGORIAS_LABEL[c]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Sucursal</label>
                  <select value={formGasto.sucursal}
                    onChange={e => setFormGasto(f => ({ ...f, sucursal: e.target.value }))}
                    className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none">
                    {SUCURSALES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Monto *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">$</span>
                    <input type="number" value={formGasto.monto}
                      onChange={e => setFormGasto(f => ({ ...f, monto: e.target.value }))}
                      placeholder="0.00"
                      className="w-full border border-zinc-200 rounded-lg pl-7 pr-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Fecha</label>
                  <input type="date" value={formGasto.fecha}
                    onChange={e => setFormGasto(f => ({ ...f, fecha: e.target.value }))}
                    className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Notas</label>
                <textarea value={formGasto.notas}
                  onChange={e => setFormGasto(f => ({ ...f, notas: e.target.value }))}
                  rows={2} placeholder="Referencia, observaciones..."
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none resize-none" />
              </div>
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={() => { setModal(false); setEditandoId(null) }}
                className="flex-1 py-2.5 border border-zinc-200 text-zinc-600 rounded-lg text-sm font-semibold hover:bg-zinc-100">
                Cancelar
              </button>
              <button onClick={guardarGasto}
                disabled={!formGasto.concepto || !formGasto.monto || guardando}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#0B0E14] text-white rounded-lg text-sm font-bold hover:bg-[#1A1D27] disabled:opacity-40">
                <Save className="w-4 h-4" />
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function FinanzasPageProtected() {
  return (
    <RequireRol roles={['administrador']}>
      <FinanzasPage />
    </RequireRol>
  )
}
