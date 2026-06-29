'use client'

import { useState } from 'react'
import {
  TrendingUp, TrendingDown, DollarSign, CreditCard,
  Plus, Search, ChevronDown, Filter, X, Save,
  Banknote, Building2, ArrowUpRight, ArrowDownRight,
  BarChart2,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Legend,
} from 'recharts'

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
type TipoMovimiento = 'ingreso' | 'gasto'
type Movimiento = {
  id: number
  tipo: TipoMovimiento
  concepto: string
  categoria: string
  sucursal: string
  metodo: string
  monto: number
  fecha: string
  notas: string
}

// ─────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────
const SUCURSALES = ['Baja Visión', '5 de Mayo', 'Plaza Laureles']

const CATEGORIAS_INGRESO = ['Venta de productos', 'Servicios ópticos', 'Lentes de contacto', 'Anticipos', 'Otros ingresos']
const CATEGORIAS_GASTO   = ['Renta', 'Nómina', 'Laboratorio', 'Compra de mercancía', 'Servicios (luz, agua, internet)', 'Publicidad', 'Mantenimiento', 'Otros gastos']

const METODOS_PAGO = ['Efectivo', 'Tarjeta débito', 'Tarjeta crédito', 'Transferencia', 'Cheque']

const COMISION_DEBITO  = 0.015
const COMISION_CREDITO = 0.029

// ─────────────────────────────────────────
// Mock data — mes actual
// ─────────────────────────────────────────
const dias = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0] }

const MOVIMIENTOS_MOCK: Movimiento[] = [
  { id: 1,  tipo: 'ingreso', concepto: 'Venta V-0041 — María González',  categoria: 'Venta de productos',    sucursal: 'Baja Visión',    metodo: 'Tarjeta crédito',  monto: 4800,  fecha: dias(-1), notas: '' },
  { id: 2,  tipo: 'ingreso', concepto: 'Venta V-0040 — Carlos Ruiz',     categoria: 'Lentes de contacto',    sucursal: '5 de Mayo',      metodo: 'Efectivo',         monto: 1200,  fecha: dias(-1), notas: '' },
  { id: 3,  tipo: 'ingreso', concepto: 'Venta V-0039 — Ana López',       categoria: 'Venta de productos',    sucursal: 'Plaza Laureles', metodo: 'Tarjeta débito',   monto: 6200,  fecha: dias(-1), notas: '' },
  { id: 4,  tipo: 'gasto',   concepto: 'Pago laboratorio — Óptika Lab',  categoria: 'Laboratorio',           sucursal: '5 de Mayo',      metodo: 'Transferencia',    monto: 3200,  fecha: dias(-2), notas: 'Órdenes LAB-0040, LAB-0036' },
  { id: 5,  tipo: 'ingreso', concepto: 'Venta V-0038 — Pedro Sánchez',   categoria: 'Venta de productos',    sucursal: 'Baja Visión',    metodo: 'Efectivo',         monto: 2100,  fecha: dias(-2), notas: '' },
  { id: 6,  tipo: 'gasto',   concepto: 'Renta junio — Baja Visión',      categoria: 'Renta',                 sucursal: 'Baja Visión',    metodo: 'Transferencia',    monto: 12000, fecha: dias(-5), notas: '' },
  { id: 7,  tipo: 'gasto',   concepto: 'Renta junio — 5 de Mayo',        categoria: 'Renta',                 sucursal: '5 de Mayo',      metodo: 'Transferencia',    monto: 9500,  fecha: dias(-5), notas: '' },
  { id: 8,  tipo: 'gasto',   concepto: 'Renta junio — Plaza Laureles',   categoria: 'Renta',                 sucursal: 'Plaza Laureles', metodo: 'Transferencia',    monto: 11000, fecha: dias(-5), notas: '' },
  { id: 9,  tipo: 'ingreso', concepto: 'Venta V-0037 — Laura Martínez',  categoria: 'Lentes de contacto',    sucursal: 'Baja Visión',    metodo: 'Efectivo',         monto: 450,   fecha: dias(-3), notas: '' },
  { id: 10, tipo: 'ingreso', concepto: 'Venta V-0036 — Jorge Herrera',   categoria: 'Venta de productos',    sucursal: 'Plaza Laureles', metodo: 'Tarjeta crédito',  monto: 7400,  fecha: dias(-3), notas: '' },
  { id: 11, tipo: 'gasto',   concepto: 'Nómina quincenal',               categoria: 'Nómina',                sucursal: 'Baja Visión',    metodo: 'Transferencia',    monto: 18000, fecha: dias(-8), notas: 'Primera quincena junio' },
  { id: 12, tipo: 'gasto',   concepto: 'Servicios — Luz y agua',         categoria: 'Servicios (luz, agua, internet)', sucursal: 'Baja Visión', metodo: 'Efectivo', monto: 1800, fecha: dias(-10), notas: '' },
  { id: 13, tipo: 'ingreso', concepto: 'Venta V-0035 — Sofía Ramos',     categoria: 'Venta de productos',    sucursal: 'Baja Visión',    metodo: 'Tarjeta débito',   monto: 3200,  fecha: dias(-4), notas: '' },
  { id: 14, tipo: 'ingreso', concepto: 'Anticipo — Miguel Torres',       categoria: 'Anticipos',             sucursal: 'Plaza Laureles', metodo: 'Efectivo',         monto: 1500,  fecha: dias(0),  notas: 'Anticipo orden LAB-0042' },
  { id: 15, tipo: 'gasto',   concepto: 'Compra armazones — Proveedor',   categoria: 'Compra de mercancía',   sucursal: 'Baja Visión',    metodo: 'Transferencia',    monto: 8500,  fecha: dias(-7), notas: '25 unidades surtido mixto' },
]

// Datos para gráficas — semanas del mes
const DATA_SEMANAL = [
  { semana: 'Sem 1', ingresos: 42000, gastos: 28000 },
  { semana: 'Sem 2', ingresos: 38500, gastos: 22000 },
  { semana: 'Sem 3', ingresos: 51200, gastos: 31000 },
  { semana: 'Sem 4', ingresos: 26150, gastos: 8000  },
]

// Datos por sucursal
const DATA_SUCURSAL = [
  { nombre: 'Baja Visión',    ingresos: 68400, gastos: 42000 },
  { nombre: '5 de Mayo',      ingresos: 44200, gastos: 29500 },
  { nombre: 'Plaza Laureles', ingresos: 45250, gastos: 28000 },
]

const formVacio = (): Omit<Movimiento, 'id'> => ({
  tipo: 'gasto', concepto: '', categoria: CATEGORIAS_GASTO[0],
  sucursal: 'Baja Visión', metodo: 'Efectivo',
  monto: 0, fecha: dias(0), notas: '',
})

function comisionBancaria(monto: number, metodo: string) {
  if (metodo === 'Tarjeta débito')  return monto * COMISION_DEBITO
  if (metodo === 'Tarjeta crédito') return monto * COMISION_CREDITO
  return 0
}

// ─────────────────────────────────────────
// Page
// ─────────────────────────────────────────
export default function FinanzasPage() {
  const [movimientos, setMovimientos] = useState<Movimiento[]>(MOVIMIENTOS_MOCK)
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<'todos' | TipoMovimiento>('todos')
  const [filtroSucursal, setFiltroSucursal] = useState('Todas')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<Omit<Movimiento, 'id'>>(formVacio())
  const [graficaVista, setGraficaVista] = useState<'tendencia' | 'sucursal'>('tendencia')

  const filtrados = movimientos.filter(m => {
    const q = busqueda.toLowerCase()
    const matchQ = m.concepto.toLowerCase().includes(q) || m.categoria.toLowerCase().includes(q)
    const matchT = filtroTipo === 'todos' || m.tipo === filtroTipo
    const matchS = filtroSucursal === 'Todas' || m.sucursal === filtroSucursal
    return matchQ && matchT && matchS
  })

  const totalIngresos   = movimientos.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0)
  const totalGastos     = movimientos.filter(m => m.tipo === 'gasto').reduce((s, m) => s + m.monto, 0)
  const utilidad        = totalIngresos - totalGastos
  const comisiones      = movimientos
    .filter(m => m.tipo === 'ingreso')
    .reduce((s, m) => s + comisionBancaria(m.monto, m.metodo), 0)

  const guardar = () => {
    setMovimientos(prev => [{ id: Date.now(), ...form }, ...prev])
    setModal(false)
  }

  const f = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(prev => ({ ...prev, [k]: v }))

  const cats = form.tipo === 'ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_GASTO

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Finanzas</h1>
          <p className="text-sm text-slate-400 mt-0.5">Ingresos, gastos y flujo de caja — Junio 2026</p>
        </div>
        <button onClick={() => { setForm(formVacio()); setModal(true) }}
          className="flex items-center gap-2 bg-[#0B1A35] text-white px-4 py-2.5 rounded text-sm font-semibold hover:bg-[#0d2145] active:scale-[0.98] transition-all">
          <Plus className="w-4 h-4" /> Registrar movimiento
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {[
          {
            label: 'Ingresos del mes', value: totalIngresos, color: 'text-emerald-600',
            bg: 'bg-emerald-50', icon: ArrowUpRight, trend: '+12% vs mayo',
          },
          {
            label: 'Gastos del mes', value: totalGastos, color: 'text-red-500',
            bg: 'bg-red-50', icon: ArrowDownRight, trend: '-3% vs mayo',
          },
          {
            label: 'Utilidad neta', value: utilidad, color: utilidad >= 0 ? 'text-slate-800' : 'text-red-600',
            bg: 'bg-slate-100', icon: DollarSign, trend: `Margen ${Math.round((utilidad / totalIngresos) * 100)}%`,
          },
          {
            label: 'Comisiones bancarias', value: comisiones, color: 'text-amber-600',
            bg: 'bg-amber-50', icon: CreditCard, trend: 'Débito 1.5% · Crédito 2.9%',
          },
        ].map(k => {
          const Icon = k.icon
          return (
            <div key={k.label} className="bg-white rounded-lg px-5 py-4 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-400">{k.label}</p>
                <div className={`w-8 h-8 rounded ${k.bg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${k.color}`} />
                </div>
              </div>
              <p className={`text-2xl font-bold mt-2 ${k.color}`}>
                ${Math.abs(k.value).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{k.trend}</p>
            </div>
          )
        })}
      </div>

      {/* Gráficas */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-bold text-slate-700">Flujo del mes</h3>
          <div className="flex items-center border border-slate-200 rounded overflow-hidden">
            {[
              { key: 'tendencia', label: 'Por semana' },
              { key: 'sucursal',  label: 'Por sucursal' },
            ].map(v => (
              <button key={v.key} onClick={() => setGraficaVista(v.key as typeof graficaVista)}
                className={`px-4 py-2 text-xs font-medium transition-colors ${graficaVista === v.key ? 'bg-[#0B1A35] text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {graficaVista === 'tendencia' ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={DATA_SEMANAL} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gIngresos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2BBFB3" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2BBFB3" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gGastos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EF4444" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="semana" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false}
                tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: unknown) => [`$${Number(v).toLocaleString('es-MX')}`, '']}
                contentStyle={{ border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="ingresos" name="Ingresos" stroke="#2BBFB3" strokeWidth={2} fill="url(#gIngresos)" />
              <Area type="monotone" dataKey="gastos"   name="Gastos"   stroke="#EF4444" strokeWidth={2} fill="url(#gGastos)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={DATA_SUCURSAL} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="nombre" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false}
                tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: unknown) => [`$${Number(v).toLocaleString('es-MX')}`, '']}
                contentStyle={{ border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
              <Bar dataKey="ingresos" name="Ingresos" fill="#2BBFB3" radius={[4, 4, 0, 0]} />
              <Bar dataKey="gastos"   name="Gastos"   fill="#0B1A35" radius={[4, 4, 0, 0]} opacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Desglose por método de pago */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { metodo: 'Efectivo',         icon: Banknote,  color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { metodo: 'Tarjeta débito',   icon: CreditCard, color: 'text-blue-600',   bg: 'bg-blue-50' },
          { metodo: 'Tarjeta crédito',  icon: CreditCard, color: 'text-purple-600', bg: 'bg-purple-50' },
          { metodo: 'Transferencia',    icon: Building2,  color: 'text-slate-600',  bg: 'bg-slate-100' },
        ].map(({ metodo, icon: Icon, color, bg }) => {
          const total = movimientos.filter(m => m.tipo === 'ingreso' && m.metodo === metodo).reduce((s, m) => s + m.monto, 0)
          const comision = comisionBancaria(total, metodo)
          return (
            <div key={metodo} className="bg-white rounded-lg px-4 py-4 shadow-sm border border-slate-100 flex items-center gap-4">
              <div className={`w-10 h-10 rounded ${bg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-400">{metodo}</p>
                <p className="text-base font-bold text-slate-800">${total.toLocaleString('es-MX')}</p>
                {comision > 0 && (
                  <p className="text-xs text-amber-500">Comisión: ${comision.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Tabla de movimientos */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-100 overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-[#2BBFB3]/30 placeholder:text-slate-400"
              placeholder="Buscar movimiento..." />
          </div>
          <div className="flex items-center border border-slate-200 rounded overflow-hidden">
            {[
              { key: 'todos',    label: 'Todos' },
              { key: 'ingreso',  label: 'Ingresos' },
              { key: 'gasto',    label: 'Gastos' },
            ].map(v => (
              <button key={v.key} onClick={() => setFiltroTipo(v.key as typeof filtroTipo)}
                className={`px-3 py-2 text-xs font-medium transition-colors ${filtroTipo === v.key ? 'bg-[#0B1A35] text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                {v.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <select value={filtroSucursal} onChange={e => setFiltroSucursal(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 text-sm bg-slate-50 border border-slate-200 rounded text-slate-600 focus:outline-none">
              {['Todas', ...SUCURSALES].map(s => <option key={s}>{s}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            {filtrados.length} movimientos
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {['Fecha', 'Concepto', 'Categoría', 'Sucursal', 'Método', 'Monto'].map(h => (
                  <th key={h} className="text-left text-xs text-slate-400 font-medium px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtrados.map(m => {
                const comision = comisionBancaria(m.monto, m.metodo)
                return (
                  <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5 text-xs text-slate-400 whitespace-nowrap">{m.fecha}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${m.tipo === 'ingreso' ? 'bg-emerald-500' : 'bg-red-400'}`} />
                        <span className="text-sm text-slate-700 font-medium">{m.concepto}</span>
                      </div>
                      {m.notas && <p className="text-xs text-slate-400 ml-3.5 mt-0.5">{m.notas}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500">{m.categoria}</td>
                    <td className="px-5 py-3.5 text-xs text-slate-500">{m.sucursal}</td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs text-slate-500">{m.metodo}</span>
                      {comision > 0 && (
                        <p className="text-xs text-amber-500">-${comision.toFixed(0)}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-sm font-bold ${m.tipo === 'ingreso' ? 'text-emerald-600' : 'text-red-500'}`}>
                        {m.tipo === 'ingreso' ? '+' : '-'}${m.monto.toLocaleString('es-MX')}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtrados.length === 0 && (
            <div className="text-center py-16 text-slate-400 text-sm">Sin movimientos con ese criterio</div>
          )}
        </div>

        {/* Totales del filtro */}
        <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between bg-slate-50">
          <span className="text-xs text-slate-400">{filtrados.length} movimientos mostrados</span>
          <div className="flex items-center gap-6 text-sm">
            <span className="text-emerald-600 font-semibold">
              +${filtrados.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0).toLocaleString('es-MX')}
            </span>
            <span className="text-red-500 font-semibold">
              -${filtrados.filter(m => m.tipo === 'gasto').reduce((s, m) => s + m.monto, 0).toLocaleString('es-MX')}
            </span>
          </div>
        </div>
      </div>

      {/* ── MODAL NUEVO MOVIMIENTO ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-800">Registrar movimiento</h2>
              <button onClick={() => setModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">

              {/* Tipo */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Tipo</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { v: 'ingreso', l: 'Ingreso', c: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
                    { v: 'gasto',   l: 'Gasto',   c: 'text-red-600 bg-red-50 border-red-200' },
                  ].map(opt => (
                    <button key={opt.v} onClick={() => { f('tipo', opt.v as TipoMovimiento); f('categoria', opt.v === 'ingreso' ? CATEGORIAS_INGRESO[0] : CATEGORIAS_GASTO[0]) }}
                      className={`py-2.5 rounded text-sm font-bold border transition-all ${form.tipo === opt.v ? opt.c : 'border-slate-200 text-slate-400 hover:bg-slate-50'}`}>
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Concepto *</label>
                <input value={form.concepto} onChange={e => f('concepto', e.target.value)}
                  className="w-full border border-slate-200 rounded px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#2BBFB3]/30"
                  placeholder="Descripción del movimiento" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Categoría</label>
                  <div className="relative">
                    <select value={form.categoria} onChange={e => f('categoria', e.target.value)}
                      className="w-full appearance-none border border-slate-200 rounded px-3 py-2.5 text-sm bg-slate-50 focus:outline-none pr-8">
                      {cats.map(c => <option key={c}>{c}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Sucursal</label>
                  <div className="relative">
                    <select value={form.sucursal} onChange={e => f('sucursal', e.target.value)}
                      className="w-full appearance-none border border-slate-200 rounded px-3 py-2.5 text-sm bg-slate-50 focus:outline-none pr-8">
                      {SUCURSALES.map(s => <option key={s}>{s}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Método de pago</label>
                  <div className="relative">
                    <select value={form.metodo} onChange={e => f('metodo', e.target.value)}
                      className="w-full appearance-none border border-slate-200 rounded px-3 py-2.5 text-sm bg-slate-50 focus:outline-none pr-8">
                      {METODOS_PAGO.map(m => <option key={m}>{m}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Fecha</label>
                  <input type="date" value={form.fecha} onChange={e => f('fecha', e.target.value)}
                    className="w-full border border-slate-200 rounded px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#2BBFB3]/30" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Monto *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">$</span>
                  <input type="number" value={form.monto || ''} onChange={e => f('monto', parseFloat(e.target.value) || 0)}
                    className="w-full border border-slate-200 rounded pl-7 pr-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#2BBFB3]/30"
                    placeholder="0.00" />
                </div>
                {comisionBancaria(form.monto, form.metodo) > 0 && (
                  <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
                    <CreditCard className="w-3 h-3" />
                    Comisión bancaria: ${comisionBancaria(form.monto, form.metodo).toFixed(2)}
                    · Neto: ${(form.monto - comisionBancaria(form.monto, form.metodo)).toFixed(2)}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Notas</label>
                <textarea value={form.notas} onChange={e => f('notas', e.target.value)} rows={3}
                  className="w-full border border-slate-200 rounded px-3 py-3 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#2BBFB3]/30 resize-none placeholder:text-slate-400"
                  placeholder="Referencia, número de factura, observaciones..." />
              </div>
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={() => setModal(false)}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded text-sm font-semibold hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={guardar} disabled={!form.concepto || !form.monto}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#0B1A35] text-white rounded text-sm font-bold hover:bg-[#0d2145] disabled:opacity-40">
                <Save className="w-4 h-4" /> Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
