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
  empleado_id: string | null
}
type EmpleadoLite = { id: string; nombre: string }

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

// Color por sucursal (para el P&L por óptica)
const COLOR_SUC: Record<string, string> = {
  'Baja Visión':    '#0D9488',
  '5 de Mayo':      '#0B0E14',
  'Plaza Laureles': '#6366F1',
}
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
  const [ingresosPorSuc, setIngresosPorSuc] = useState<Record<string, number>>({})
  const [costoLabPorSuc, setCostoLabPorSuc] = useState<Record<string, number>>({})
  // Fase 0 motor corregido
  const [cobradoAnteriores, setCobradoAnteriores] = useState(0)   // cobros del periodo de ventas de periodos previos
  const [porMetodo,   setPorMetodo]   = useState<Record<string, number>>({})
  const [garantias,   setGarantias]   = useState(0)               // costo de lab de órdenes es_garantia (línea propia)
  const [garantiasPorSuc, setGarantiasPorSuc] = useState<Record<string, number>>({})
  const [overheadModo, setOverheadModo] = useState<'igual' | 'proporcional'>('igual')
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
    monto: '', sucursal: 'General', notas: '', empleado_id: '',
  })
  const [empleadosLista, setEmpleadosLista] = useState<EmpleadoLite[]>([])

  const abrirEditar = (g: Gasto) => {
    setEditandoId(g.id)
    setFormGasto({
      fecha:       g.fecha,
      concepto:    g.concepto,
      categoria:   g.categoria,
      monto:       String(g.monto),
      sucursal:    g.sucursal,
      notas:       g.notas ?? '',
      empleado_id: g.empleado_id ?? '',
    })
    setModal(true)
  }

  const cargar = useCallback(async () => {
    setCargando(true)
    const { inicio, fin } = getDateRange(periodo, desde, hasta)
    const rangoInicio = rangoDiaLocal(inicio).start
    const rangoFin    = rangoDiaLocal(fin).end
    const supabase = createClient()

    // ── FACTURADO: ventas creadas en el periodo (por created_at) ──
    let qVentas = supabase
      .from('ventas')
      .select('folio, total, saldo, created_at, atendido_por, sucursal')
      .eq('es_cotizacion', false)
      .neq('estado', 'cancelada')
      .gte('created_at', rangoInicio)
      .lte('created_at', rangoFin)
      .order('created_at', { ascending: false })
    if (sucursal !== 'Todas') qVentas = qVentas.eq('sucursal', sucursal)
    const { data: ventasData } = await qVentas
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ventasRows = (ventasData || []) as any[]
    setTotalVentas(ventasRows.reduce((s: number, v) => s + (parseFloat(v.total) || 0), 0))

    // ── COBRADO: dinero realmente recibido en el periodo (pagos_venta por fecha de pago) ──
    // Se trae la fecha de la venta relacionada para separar los cobros de ventas anteriores.
    let qPagos = supabase
      .from('pagos_venta')
      .select('monto, metodo_pago, sucursal, created_at, tipo, ventas(created_at)')
      .gte('created_at', rangoInicio)
      .lte('created_at', rangoFin)
    if (sucursal !== 'Todas') qPagos = qPagos.eq('sucursal', sucursal)
    const { data: pagosData } = await qPagos
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pagosRows = (pagosData || []) as any[]
    const cobradoTotal = pagosRows.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)
    setIngresos(cobradoTotal)
    const ingSuc: Record<string, number> = {}
    const metSuc: Record<string, number> = {}
    let cobradoPrevias = 0
    for (const p of pagosRows) {
      const s = p.sucursal || '—'
      const monto = parseFloat(p.monto) || 0
      ingSuc[s] = (ingSuc[s] || 0) + monto
      const met = p.metodo_pago || 'otros'
      metSuc[met] = (metSuc[met] || 0) + monto
      const ventaCreated = p.ventas?.created_at
      if (ventaCreated && ventaCreated < rangoInicio) cobradoPrevias += monto
    }
    setIngresosPorSuc(ingSuc)
    setPorMetodo(metSuc)
    setCobradoAnteriores(cobradoPrevias)

    // Detalle de facturado (ventas del periodo)
    setVentasDetalle(ventasRows.map((v) => ({
      folio:       v.folio ?? '',
      fecha:       v.created_at ? new Date(v.created_at as string).toLocaleDateString('en-CA', { timeZone: 'America/Tijuana' }) : '',
      atendidoPor: v.atendido_por ?? '',
      total:       parseFloat(v.total) || 0,
      saldo:       parseFloat(v.saldo) || 0,
    })))

    // Costo lab: órdenes pagadas — usa fecha_pago_lab para reflejar cuándo salió el dinero
    let qLab = supabase
      .from('ordenes_lab')
      .select('folio, costo_lab, laboratorio, fecha_pago_lab, paciente, sucursal, es_garantia')
      .eq('pagado_lab', true)
      .gt('costo_lab', 0)
      .gte('fecha_pago_lab', inicio)
      .lte('fecha_pago_lab', fin)
      .order('fecha_pago_lab', { ascending: false })
    if (sucursal !== 'Todas') qLab = qLab.eq('sucursal', sucursal)
    const { data: labData } = await qLab
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const labRows = (labData || []) as any[]
    // Separar garantías (es_garantia) del costo de laboratorio normal
    const labNormales = labRows.filter(r => !r.es_garantia)
    const labGarantias = labRows.filter(r => r.es_garantia)
    setCostoLab(labNormales.reduce((s, r) => s + (parseFloat(r.costo_lab) || 0), 0))
    setGarantias(labGarantias.reduce((s, r) => s + (parseFloat(r.costo_lab) || 0), 0))
    const labSuc: Record<string, number> = {}
    const garSuc: Record<string, number> = {}
    for (const r of labNormales) { const s = r.sucursal || '—'; labSuc[s] = (labSuc[s] || 0) + (parseFloat(r.costo_lab) || 0) }
    for (const r of labGarantias) { const s = r.sucursal || '—'; garSuc[s] = (garSuc[s] || 0) + (parseFloat(r.costo_lab) || 0) }
    setCostoLabPorSuc(labSuc)
    setGarantiasPorSuc(garSuc)
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

  // Lista de empleados para ligar egresos (nómina, bonos, gasolina, etc.)
  useEffect(() => {
    createClient().from('usuarios').select('id, nombre').eq('activo', true).neq('rol', 'administrador').order('nombre')
      .then(({ data }) => setEmpleadosLista((data ?? []) as EmpleadoLite[]))
  }, [])

  // ── Cálculos ──────────────────────────────
  const gastosOperativos = gastos.filter(g => !CATEGORIAS_RETIRO.includes(g.categoria))
  const retirosAdmin     = gastos.filter(g => CATEGORIAS_RETIRO.includes(g.categoria))
  const totalGastos      = gastosOperativos.reduce((s, g) => s + g.monto, 0)
  const totalRetiros     = retirosAdmin.reduce((s, g) => s + g.monto, 0)
  const utilidadBruta    = ingresos - costoLab - garantias   // garantías = línea propia
  const utilidadNeta     = utilidadBruta - totalGastos
  const flujoNeto        = utilidadNeta - totalRetiros
  const margen           = ingresos > 0 ? Math.round((utilidadNeta / ingresos) * 100) : 0

  // ── Egresos por categoría (para el desglose visible al picar "Egresos") ──
  const egresosPorCat = Object.entries(
    gastosOperativos.reduce((m, g) => { m[g.categoria] = (m[g.categoria] || 0) + g.monto; return m }, {} as Record<string, number>),
  ).map(([cat, monto]) => ({ cat, monto })).sort((a, b) => b.monto - a.monto)

  // ── Rentabilidad por sucursal (P&L por óptica) ──
  // Gastos "generales" = los que no son de una sucursal específica (ej. 'General').
  // Se reparten en partes iguales entre las 3 ópticas (overhead ÷ 3).
  const SUCS_FIN = ['Baja Visión', '5 de Mayo', 'Plaza Laureles']
  const overheadGeneral = gastosOperativos.filter(g => !SUCS_FIN.includes(g.sucursal)).reduce((s, g) => s + g.monto, 0)
  const ingTotal3 = SUCS_FIN.reduce((s, x) => s + (ingresosPorSuc[x] || 0), 0)
  // Overhead: ÷3 (igual) o proporcional a la venta cobrada de cada sucursal
  const overheadDe = (s: string) => overheadModo === 'proporcional'
    ? (ingTotal3 > 0 ? overheadGeneral * ((ingresosPorSuc[s] || 0) / ingTotal3) : overheadGeneral / 3)
    : overheadGeneral / 3
  const finPorSucursal = SUCS_FIN.map(s => {
    const ing      = ingresosPorSuc[s] || 0
    const lab      = costoLabPorSuc[s] || 0
    const gar      = garantiasPorSuc[s] || 0
    const directos = gastosOperativos.filter(g => g.sucursal === s).reduce((a, g) => a + g.monto, 0)
    const overhead = overheadDe(s)
    const util     = ing - lab - gar - directos - overhead
    return { nombre: s, ing, lab, gar, directos, overhead, util, margen: ing > 0 ? Math.round((util / ing) * 100) : 0 }
  }).sort((a, b) => b.util - a.util)

  // ── Guardar / editar gasto ──
  const guardarGasto = async () => {
    if (!formGasto.concepto || !formGasto.monto) return
    setGuardando(true)
    const supabase = createClient()
    const payload = {
      fecha:       formGasto.fecha,
      concepto:    formGasto.concepto,
      categoria:   formGasto.categoria,
      monto:       parseFloat(formGasto.monto),
      sucursal:    formGasto.sucursal,
      notas:       formGasto.notas || null,
      empleado_id: formGasto.empleado_id || null,
      es_caja:     false,   // egreso de empresa: nunca toca el corte de caja
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
    setFormGasto({ fecha: hoy(), concepto: '', categoria: 'renta', monto: '', sucursal: 'General', notas: '', empleado_id: '' })
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Finanzas</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {inicio === fin ? inicio : `${inicio} → ${fin}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {/* Período */}
          <div className="flex bg-zinc-100 rounded-lg p-1 gap-0.5 max-w-full overflow-x-auto">
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

          {/* ── Rentabilidad por sucursal (solo en vista "Todas") ── */}
          {sucursal === 'Todas' && (
            <div className="bg-white rounded-lg border border-zinc-200/80 p-5">
              <div className="flex items-baseline justify-between mb-1">
                <h3 className="text-sm font-bold text-zinc-700">Rentabilidad por sucursal</h3>
                <div className="flex items-center gap-2">
                  {overheadGeneral > 0 && (
                    <span className="text-[11px] text-zinc-400">Overhead general {$$(overheadGeneral)}</span>
                  )}
                  <div className="inline-flex rounded-lg border border-zinc-200 overflow-hidden text-[10px] font-semibold">
                    <button onClick={() => setOverheadModo('igual')} className={`px-2 py-1 ${overheadModo === 'igual' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:bg-zinc-50'}`}>÷3 igual</button>
                    <button onClick={() => setOverheadModo('proporcional')} className={`px-2 py-1 ${overheadModo === 'proporcional' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:bg-zinc-50'}`}>Proporcional</button>
                  </div>
                </div>
              </div>
              <p className="text-xs text-zinc-400 mb-4">Cada óptica como su propio negocio · utilidad real con su parte de gastos generales</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {finPorSucursal.map((s, i) => {
                  const lider = i === 0 && s.util > 0
                  const perdida = s.util < 0
                  return (
                    <div key={s.nombre} className={`rounded-lg border p-4 ${lider ? 'border-emerald-300' : perdida ? 'border-red-300' : 'border-zinc-200'}`}>
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: COLOR_SUC[s.nombre] }} />
                          <span className="text-sm font-bold text-zinc-800">{s.nombre}</span>
                        </div>
                        {lider && <span className="text-[9px] font-bold bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-full">MÁS RENTABLE</span>}
                        {perdida && <span className="text-[9px] font-bold bg-red-50 text-red-600 px-1.5 py-0.5 rounded-full">EN PÉRDIDA</span>}
                      </div>
                      <div className="mt-3 space-y-1.5">
                        <div className="flex justify-between text-xs"><span className="text-zinc-500">Ingresos</span><span className="font-semibold text-zinc-700">{$$(s.ing)}</span></div>
                        <div className="flex justify-between text-xs"><span className="text-zinc-500">− Costo laboratorio</span><span className="text-violet-600">−{$$(s.lab)}</span></div>
                        {s.gar > 0 && <div className="flex justify-between text-xs"><span className="text-zinc-500">− Garantías</span><span className="text-orange-600">−{$$(s.gar)}</span></div>}
                        <div className="flex justify-between text-xs"><span className="text-zinc-500">− Gastos directos</span><span className="text-red-500">−{$$(s.directos)}</span></div>
                        <div className="flex justify-between text-xs"><span className="text-zinc-500">− Overhead ({overheadModo === 'igual' ? '÷3' : 'prop.'})</span><span className="text-amber-600">−{$$(s.overhead)}</span></div>
                        <div className="flex justify-between text-sm pt-2 mt-1 border-t border-zinc-100">
                          <span className="font-bold text-zinc-700">Utilidad neta</span>
                          <span className={`font-bold ${s.util >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{$$(s.util)}</span>
                        </div>
                      </div>
                      <div className={`text-center mt-3 rounded-lg py-2 ${s.util >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                        <span className={`text-lg font-bold ${s.util >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{s.margen}%</span>
                        <span className="text-[10px] text-zinc-400 block -mt-0.5">margen neto</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

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
                  {(Object.keys(porMetodo).length > 0 || cobradoAnteriores > 0) && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5 bg-zinc-50 border-b border-zinc-100 text-[11px] text-zinc-500">
                      <span className="font-semibold text-zinc-400 uppercase tracking-wide">Cobrado por método:</span>
                      {Object.entries(porMetodo).sort((a, b) => b[1] - a[1]).map(([m, v]) => (
                        <span key={m}>{m}: <span className="font-bold text-zinc-700">{$$(v)}</span></span>
                      ))}
                      {cobradoAnteriores > 0 && (
                        <span className="ml-auto text-zinc-400">Incluye {$$(cobradoAnteriores)} de ventas de períodos anteriores</span>
                      )}
                    </div>
                  )}
                  {ventasDetalle.length === 0 ? (
                    <p className="text-sm text-zinc-400 text-center py-10">Sin ventas en este período</p>
                  ) : (
                    <div className="overflow-x-auto"><table className="w-full text-sm min-w-[600px]">
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
                    </table></div>
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
                    <div className="overflow-x-auto"><table className="w-full text-sm min-w-[600px]">
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
                    </table></div>
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
                  {/* Desglose por categoría — en qué se va el dinero */}
                  {egresosPorCat.length > 0 && (
                    <div className="px-5 py-4 border-b border-zinc-200 space-y-2.5">
                      {egresosPorCat.map(({ cat, monto }) => {
                        const pct = totalGastos > 0 ? Math.round((monto / totalGastos) * 100) : 0
                        return (
                          <div key={cat}>
                            <div className="flex justify-between items-baseline mb-1">
                              <span className="text-sm text-zinc-700 font-medium">{CATEGORIAS_LABEL[cat] || cat}</span>
                              <span className="text-xs text-zinc-400">{$$(monto)} · {pct}%</span>
                            </div>
                            <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                              <div className="h-full bg-red-400 rounded-full transition-all" style={{ width: `${Math.max(pct, 2)}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {gastos.length === 0 ? (
                    <div className="text-center py-12 text-zinc-400">
                      <p className="text-sm">Sin gastos registrados en este período</p>
                      <button onClick={() => setModal(true)} className="mt-3 text-xs text-teal-600 hover:underline font-medium">
                        + Registrar primer gasto
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto"><table className="w-full text-sm min-w-[600px]">
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
                    </table></div>
                  )}
                </>
              )}

              {/* Utilidad → estado de resultados completo */}
              {cardActiva === 'utilidad' && (
                <div className="px-5 py-5">
                  <h3 className="text-sm font-bold text-zinc-700 mb-4">Estado de resultados</h3>
                  <div className="divide-y divide-zinc-100">
                    <ResumenRow label="Cobrado en el período" value={ingresos} />
                    <ResumenRow label="− Costo de laboratorio" value={-costoLab} indent color="text-violet-600" />
                    {garantias > 0 && <ResumenRow label="− Garantías (re-trabajos)" value={-garantias} indent color="text-orange-600" />}
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
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Empleado <span className="font-normal text-zinc-400">(opcional · si es de alguien: nómina, bono, gasolina…)</span></label>
                <select value={formGasto.empleado_id}
                  onChange={e => setFormGasto(f => ({ ...f, empleado_id: e.target.value }))}
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none">
                  <option value="">— Ninguno (gasto general) —</option>
                  {empleadosLista.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                </select>
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
