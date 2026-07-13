'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import RequireRol from '@/components/RequireRol'
import {
  TrendingUp, TrendingDown, DollarSign, FlaskConical,
  Plus, X, Save, ChevronDown, Trash2,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

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

const CATEGORIAS_GASTO = ['renta', 'nomina', 'comisiones', 'servicios', 'compras', 'otros']
const CATEGORIAS_LABEL: Record<string, string> = {
  renta:      'Renta',
  nomina:     'Nómina',
  comisiones: 'Comisiones',
  servicios:  'Servicios',
  compras:    'Compras',
  otros:      'Otros',
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

const hoy = () => new Date().toISOString().split('T')[0]

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

  // Modal
  const [modal,       setModal]       = useState(false)
  const [guardando,   setGuardando]   = useState(false)
  const [formGasto,   setFormGasto]   = useState({
    fecha: hoy(), concepto: '', categoria: 'renta',
    monto: '', sucursal: 'General', notas: '',
  })

  const cargar = useCallback(async () => {
    setCargando(true)
    const { inicio, fin } = getDateRange(periodo, desde, hasta)
    const supabase = createClient()

    // Cobrado: lo que efectivamente entró de ventas del período (total - saldo)
    let qVentas = supabase
      .from('ventas')
      .select('total, saldo')
      .eq('es_cotizacion', false)
      .gte('created_at', `${inicio}T00:00:00`)
      .lte('created_at', `${fin}T23:59:59`)
    if (sucursal !== 'Todas') qVentas = qVentas.eq('sucursal', sucursal)
    const { data: ventasData } = await qVentas
    setIngresos((ventasData || []).reduce((s, v) => s + (v.total - v.saldo), 0))

    // Costo lab: órdenes pagadas — usa fecha_pago_lab para reflejar cuándo salió el dinero
    let qLab = supabase
      .from('ordenes_lab')
      .select('costo_lab, laboratorio')
      .eq('pagado_lab', true)
      .gt('costo_lab', 0)
      .gte('fecha_pago_lab', inicio)
      .lte('fecha_pago_lab', fin)
    if (sucursal !== 'Todas') qLab = qLab.eq('sucursal', sucursal)
    const { data: labData } = await qLab
    const labRows = labData || []
    setCostoLab(labRows.reduce((s, r) => s + (r.costo_lab || 0), 0))

    // Agrupado por laboratorio
    const byLab: Record<string, { total: number; count: number }> = {}
    labRows.forEach(r => {
      const lab = r.laboratorio || 'Sin especificar'
      byLab[lab] = byLab[lab] || { total: 0, count: 0 }
      byLab[lab].total += r.costo_lab || 0
      byLab[lab].count += 1
    })
    setPorLab(Object.entries(byLab)
      .map(([nombre, { total, count }]) => ({ nombre, total, count }))
      .sort((a, b) => b.total - a.total))

    // Gastos manuales
    let qGastos = supabase
      .from('gastos')
      .select('*')
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
  const totalGastos    = gastos.reduce((s, g) => s + g.monto, 0)
  const utilidadBruta  = ingresos - costoLab
  const utilidadNeta   = utilidadBruta - totalGastos
  const margen         = ingresos > 0 ? Math.round((utilidadNeta / ingresos) * 100) : 0

  // Gastos por categoría para gráfica
  const porCategoria = CATEGORIAS_GASTO.map(cat => ({
    name: CATEGORIAS_LABEL[cat],
    total: gastos.filter(g => g.categoria === cat).reduce((s, g) => s + g.monto, 0),
  })).filter(c => c.total > 0)

  // ── Guardar gasto ──
  const guardarGasto = async () => {
    if (!formGasto.concepto || !formGasto.monto) return
    setGuardando(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('gastos').insert({
      fecha:     formGasto.fecha,
      concepto:  formGasto.concepto,
      categoria: formGasto.categoria,
      monto:     parseFloat(formGasto.monto),
      sucursal:  formGasto.sucursal,
      notas:     formGasto.notas || null,
    }).select().single()

    if (error) { alert('Error: ' + error.message); setGuardando(false); return }
    setGastos(prev => [data, ...prev])
    setModal(false)
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
            <Plus className="w-3.5 h-3.5" /> Registrar gasto
          </button>
        </div>
      </div>

      {cargando ? (
        <div className="flex items-center justify-center h-64 text-zinc-400 text-sm">Cargando…</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Cobrado (ventas)', value: ingresos,      icon: TrendingUp,   color: 'text-teal-600',    bg: 'bg-teal-50'   },
              { label: 'Costo laboratorio', value: costoLab,    icon: FlaskConical, color: 'text-violet-600',  bg: 'bg-violet-50' },
              { label: 'Gastos operativos', value: totalGastos, icon: TrendingDown, color: 'text-red-500',     bg: 'bg-red-50'    },
              { label: 'Utilidad neta',   value: utilidadNeta,  icon: DollarSign,   color: utilidadNeta >= 0 ? 'text-emerald-600' : 'text-red-600', bg: utilidadNeta >= 0 ? 'bg-emerald-50' : 'bg-red-50' },
            ].map(k => {
              const Icon = k.icon
              return (
                <div key={k.label} className="bg-white rounded-lg px-5 py-4 border border-zinc-200/80">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-zinc-400">{k.label}</p>
                    <div className={`w-8 h-8 rounded ${k.bg} flex items-center justify-center`}>
                      <Icon className={`w-4 h-4 ${k.color}`} />
                    </div>
                  </div>
                  <p className={`text-2xl font-bold mt-2 ${k.color}`}>{$$(k.value)}</p>
                  {k.label === 'Utilidad neta' && (
                    <p className="text-xs text-zinc-400 mt-0.5">Margen {margen}%</p>
                  )}
                </div>
              )
            })}
          </div>

          {/* Estado de resultados + Por laboratorio */}
          <div className="grid md:grid-cols-2 gap-5">

            {/* Estado de resultados */}
            <div className="bg-white rounded-lg border border-zinc-200/80 p-5">
              <h3 className="text-sm font-bold text-zinc-700 mb-3">Estado de resultados</h3>
              <div className="divide-y divide-zinc-100">
                <ResumenRow label="Cobrado en ventas del período" value={ingresos} />
                <ResumenRow label="− Costo de laboratorio"   value={-costoLab} indent color="text-violet-600" />
                <ResumenRow label="Utilidad bruta"            value={utilidadBruta} bold color={utilidadBruta >= 0 ? 'text-zinc-900' : 'text-red-600'} />
                {CATEGORIAS_GASTO.map(cat => {
                  const total = gastos.filter(g => g.categoria === cat).reduce((s, g) => s + g.monto, 0)
                  if (total === 0) return null
                  return <ResumenRow key={cat} label={`− ${CATEGORIAS_LABEL[cat]}`} value={-total} indent color="text-red-500" />
                })}
                <ResumenRow label="Utilidad neta" value={utilidadNeta} bold color={utilidadNeta >= 0 ? 'text-emerald-600' : 'text-red-600'} />
              </div>
            </div>

            {/* Por laboratorio */}
            <div className="bg-white rounded-lg border border-zinc-200/80 p-5">
              <h3 className="text-sm font-bold text-zinc-700 mb-3">Gasto por laboratorio</h3>
              {porLab.length === 0 ? (
                <p className="text-sm text-zinc-400 text-center py-8">Sin órdenes pagadas en este período</p>
              ) : (
                <>
                  <div className="space-y-3 mb-4">
                    {porLab.map(lab => {
                      const pct = costoLab > 0 ? Math.round((lab.total / costoLab) * 100) : 0
                      return (
                        <div key={lab.nombre}>
                          <div className="flex justify-between items-baseline mb-1">
                            <span className="text-sm text-zinc-700 truncate max-w-[60%]">{lab.nombre}</span>
                            <span className="text-xs text-zinc-400">{lab.count} órdenes · {$$(lab.total)}</span>
                          </div>
                          <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                            <div className="h-full bg-violet-500 rounded-full" style={{ width: `${Math.max(pct, 2)}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {porLab.length > 1 && (
                    <ResponsiveContainer width="100%" height={120}>
                      <BarChart data={porLab.map(l => ({ name: l.nombre.split(' ')[0], total: l.total }))}
                        margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(v: unknown) => [$$(Number(v)), 'Costo']}
                          contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                        <Bar dataKey="total" fill="#7C3AED" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Gastos manuales */}
          <div className="bg-white rounded-lg border border-zinc-200/80 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
              <h3 className="text-sm font-bold text-zinc-700">
                Gastos registrados
                <span className="ml-2 text-xs font-normal text-zinc-400">{gastos.length} registros</span>
              </h3>
              {gastos.length > 0 && (
                <span className="text-sm font-semibold text-red-500">{$$(totalGastos)}</span>
              )}
            </div>

            {gastos.length === 0 ? (
              <div className="text-center py-12 text-zinc-400">
                <p className="text-sm">Sin gastos registrados en este período</p>
                <button onClick={() => setModal(true)}
                  className="mt-3 text-xs text-teal-600 hover:underline font-medium">
                  + Registrar primer gasto
                </button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100">
                    {['Fecha', 'Concepto', 'Categoría', 'Sucursal', 'Monto', ''].map(h => (
                      <th key={h} className="text-left text-xs text-zinc-400 font-medium px-5 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {gastos.map(g => (
                    <tr key={g.id} className="hover:bg-zinc-50 transition-colors group">
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
                        <button onClick={() => eliminarGasto(g.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-300 hover:text-red-400">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ── MODAL REGISTRAR GASTO ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100">
              <h2 className="text-base font-bold text-zinc-800">Registrar gasto</h2>
              <button onClick={() => setModal(false)}><X className="w-5 h-5 text-zinc-400" /></button>
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
                    {CATEGORIAS_GASTO.map(c => <option key={c} value={c}>{CATEGORIAS_LABEL[c]}</option>)}
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
              <button onClick={() => setModal(false)}
                className="flex-1 py-2.5 border border-zinc-200 text-zinc-600 rounded-lg text-sm font-semibold hover:bg-zinc-50">
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
    <RequireRol roles={['administrador', 'gerente']}>
      <FinanzasPage />
    </RequireRol>
  )
}
