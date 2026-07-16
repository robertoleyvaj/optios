'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { hoyLocal } from '@/lib/fecha'
import { useSession } from '@/hooks/useSession'
import {
  Banknote, CreditCard, Building2, CheckCircle2,
  AlertTriangle, Printer, Clock, Lock, RefreshCw, MapPin,
  ChevronDown, ChevronRight, Plus,
} from 'lucide-react'

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
type MetodoPago = 'efectivo' | 'debito' | 'credito' | 'transferencia'

type PagoVenta = {
  id: string
  created_at: string
  venta_id: string
  folio_venta: string
  paciente: string
  monto: number
  metodo_pago: MetodoPago
  tipo: 'anticipo' | 'abono' | 'liquidacion'
  sucursal: string
  registrado_por: string
}

type GastoHoy = {
  id: string
  fecha: string
  categoria: string
  concepto: string
  notas: string
  monto: number
}

type ResumenMetodo = { monto: number; transacciones: number }
type ResumenUSD   = { monto: number; transacciones: number; tcPromedio: number }

type CorteGuardado = {
  id: string
  fecha: string
  sucursal: string
  usuario: string
  total_ventas: number
  efectivo_sistema: number
  efectivo_contado: number
  diferencia: number
  fondo: number
  entrega: number
  notas: string
  cerrado: boolean
}

// ─────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────
const METODOS: {
  key: MetodoPago
  label: string
  icon: React.ElementType
  color: string
  bg: string
  border: string
}[] = [
  { key: 'efectivo',      label: 'Efectivo',       icon: Banknote,   color: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200' },
  { key: 'debito',        label: 'Tarjeta débito',  icon: CreditCard, color: 'text-blue-700',    bg: 'bg-blue-50',     border: 'border-blue-200'    },
  { key: 'credito',       label: 'Tarjeta crédito', icon: CreditCard, color: 'text-purple-700',  bg: 'bg-purple-50',   border: 'border-purple-200'  },
  { key: 'transferencia', label: 'Transferencia',   icon: Building2,  color: 'text-zinc-700',    bg: 'bg-zinc-100',    border: 'border-zinc-200'    },
]

const RESUMEN_VACIO: Record<MetodoPago, ResumenMetodo> = {
  efectivo:      { monto: 0, transacciones: 0 },
  debito:        { monto: 0, transacciones: 0 },
  credito:       { monto: 0, transacciones: 0 },
  transferencia: { monto: 0, transacciones: 0 },
}

const CATEGORIAS_EGRESO = [
  { value: 'bono_diario',        label: 'Bono diario' },
  { value: 'adelanto',           label: 'Adelanto sueldo' },
  { value: 'retiro_admin',       label: 'Retiro admin' },
  { value: 'nomina',             label: 'Nómina' },
  { value: 'compras',            label: 'Compras' },
  { value: 'otros',              label: 'Otro' },
]

const TIPO_LABEL: Record<string, string> = {
  anticipo:    'Anticipo',
  abono:       'Abono',
  liquidacion: 'Liquidación',
}

const fmt$ = (n: number) =>
  `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`

const fmtHora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Tijuana',
  })

// ─────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────
export default function CajaPage() {

  // ── Estado usuario / sucursal ──
  const { usuario: sessionUser } = useSession()
  const [legacyUser, setLegacyUser] = useState<{ nombre: string; sucursal: string; rol: string } | null>(null)
  // Admin/gerente pueden seleccionar su sucursal activa en caja
  const [sucursalCaja, setSucursalCaja] = useState('')

  // ── Datos del día ──
  const [ventas, setVentas]       = useState<Record<MetodoPago, ResumenMetodo>>(RESUMEN_VACIO)
  const [efectivoUSD, setEfectivoUSD] = useState<ResumenUSD>({ monto: 0, transacciones: 0, tcPromedio: 0 })
  const [pagosHoy, setPagosHoy]   = useState<PagoVenta[]>([])
  const [gastosHoy, setGastosHoy] = useState<GastoHoy[]>([])
  const [historial, setHistorial] = useState<CorteGuardado[]>([])
  const [corteHoy, setCorteHoy]   = useState<CorteGuardado | null>(null)
  const [saldoAnterior, setSaldoAnterior] = useState<number | null>(null)
  const [fechaCorteAnterior, setFechaCorteAnterior] = useState<string | null>(null)
  const [cargando, setCargando]   = useState(true)
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null)
  const [isClosed, setIsClosed]   = useState(false)
  const [errorGuardado, setErrorGuardado] = useState('')

  // ── UI state ──
  const [expandedMetodo, setExpandedMetodo] = useState<MetodoPago | null>(null)
  const [showEgresoForm, setShowEgresoForm] = useState(false)
  const [egresoCategoria, setEgresoCategoria]   = useState('bono_diario')
  const [egresoDescripcion, setEgresoDescripcion] = useState('')
  const [egresoMonto, setEgresoMonto]   = useState('')
  const [egresoMetodoPago, setEgresoMetodoPago] = useState('efectivo')
  const [guardandoEgreso, setGuardandoEgreso] = useState(false)

  // ── Filtros historial ──
  const [filtroSucursal, setFiltroSucursal] = useState('')
  const [filtroFecha, setFiltroFecha]       = useState('')

  // ── Formulario de corte ──
  const [efectivoContado, setEfectivoContado]       = useState('')
  const [efectivoUSDContado, setEfectivoUSDContado] = useState('')
  const [fondo, setFondo]     = useState('427')
  const [notas, setNotas]     = useState('')
  const [guardando, setGuardando] = useState(false)

  // ── Cálculos ──
  const totalEgresos  = gastosHoy.reduce((s, g) => s + Number(g.monto), 0)
  const saldoInicialNum = saldoAnterior ?? 0
  const esperado      = saldoInicialNum + ventas.efectivo.monto - totalEgresos
  const esperadoUSD   = efectivoUSD.monto
  const contado       = parseFloat(efectivoContado) || 0
  const contadoUSD    = parseFloat(efectivoUSDContado) || 0
  const fondoNum      = parseFloat(fondo) || 0
  const diferencia    = contado - esperado
  const diferenciaUSD = contadoUSD - esperadoUSD
  const entrega       = Math.max(0, contado - fondoNum)
  const totalMXN      = Object.values(ventas).reduce((s, v) => s + v.monto, 0)
  const total         = totalMXN + (efectivoUSD.tcPromedio > 0 ? efectivoUSD.monto * efectivoUSD.tcPromedio : 0)
  const cerrado       = isClosed || corteHoy?.cerrado === true

  const pagosPorMetodo = (m: MetodoPago) => pagosHoy.filter(p => p.metodo_pago === m)

  // ── Leer usuario (legacy localStorage para usuarios sin migrar) ──
  useEffect(() => {
    try {
      const raw = localStorage.getItem('optios_demo_user')
      if (raw) {
        const u = JSON.parse(raw)
        setLegacyUser({ nombre: u.nombre ?? '', sucursal: u.sucursal ?? '', rol: u.rol ?? '' })
      }
    } catch { /* noop */ }
  }, [])
  const usuario = {
    nombre:   sessionUser?.nombre   || legacyUser?.nombre   || '',
    sucursal: sessionUser?.sucursal || legacyUser?.sucursal || '',
    rol:      sessionUser?.rol      || legacyUser?.rol      || 'vendedor',
  }

  // ── Cargar datos ──
  const cargarDatos = useCallback(async (sucursal: string, rol?: string) => {
    if (!sucursal) return
    setCargando(true)
    const sb  = createClient()
    const hoy = hoyLocal()

    // 1. Pagos registrados HOY (por fecha de pago, no de venta)
    //    Incluye anticipos de ventas nuevas Y abonos/liquidaciones de ventas anteriores
    const { data: pagosData } = await sb
      .from('pagos_venta')
      .select('*')
      .eq('sucursal', sucursal)
      .gte('created_at', `${hoy}T00:00:00`)
      .lte('created_at', `${hoy}T23:59:59`)
      .order('created_at', { ascending: true })

    // 2. Ventas creadas hoy (para fallback: ventas sin registro en pagos_venta)
    const { data: ventasData } = await sb
      .from('ventas')
      .select('id, metodo_pago, total, saldo, moneda, tipo_cambio')
      .eq('sucursal', sucursal)
      .in('estado', ['activa'])
      .gte('created_at', `${hoy}T00:00:00`)
      .lte('created_at', `${hoy}T23:59:59`)

    // 3. Para abonos a ventas anteriores, traer info de moneda/tipo_cambio de esas ventas
    const pagosHoyList = pagosData ?? []
    setPagosHoy(pagosHoyList)

    const ventaIdsAbonos = [...new Set(pagosHoyList.map(p => p.venta_id))]
    let ventaMap = new Map((ventasData ?? []).map(v => [v.id, v]))
    if (ventaIdsAbonos.length > 0) {
      const { data: ventasAbonosData } = await sb
        .from('ventas')
        .select('id, moneda, tipo_cambio')
        .in('id', ventaIdsAbonos)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const v of (ventasAbonosData ?? []) as any[]) {
        if (!ventaMap.has(v.id)) ventaMap.set(v.id, v)
      }
    }

    {
      // Ventas con al menos un pago en pagos_venta hoy
      const ventasConPagos = new Set(pagosHoyList.map(p => p.venta_id))

      const resumen = JSON.parse(JSON.stringify(RESUMEN_VACIO)) as Record<MetodoPago, ResumenMetodo>
      let usdMonto = 0, usdTx = 0, usdTCSum = 0

      // Sumar todos los pagos registrados hoy (anticipos + abonos + liquidaciones)
      for (const p of pagosHoyList) {
        const key = p.metodo_pago as MetodoPago
        const vo = ventaMap.get(p.venta_id)
        if (key === 'efectivo' && vo?.moneda === 'USD') {
          usdMonto += Number(p.monto); usdTx++; usdTCSum += Number(vo.tipo_cambio ?? 0)
        } else if (resumen[key]) {
          resumen[key] = { monto: resumen[key].monto + Number(p.monto), transacciones: resumen[key].transacciones + 1 }
        }
      }

      // Fallback: ventas de contado creadas hoy sin registro en pagos_venta
      //    (ventas anteriores a que existiera pagos_venta)
      for (const v of (ventasData ?? [])) {
        if (ventasConPagos.has(v.id)) continue
        const recibido = Math.max(0, Number(v.total) - Number(v.saldo ?? 0))
        if (recibido <= 0) continue
        const key = v.metodo_pago as MetodoPago
        if (key === 'efectivo' && v.moneda === 'USD') {
          usdMonto += recibido; usdTx++; usdTCSum += Number(v.tipo_cambio ?? 0)
        } else if (resumen[key]) {
          resumen[key] = { monto: resumen[key].monto + recibido, transacciones: resumen[key].transacciones + 1 }
        }
      }

      setVentas(resumen)
      setEfectivoUSD({ monto: usdMonto, transacciones: usdTx, tcPromedio: usdTx > 0 ? usdTCSum / usdTx : 0 })
    }

    // 3. Gastos del día
    const { data: gastosData } = await sb
      .from('gastos')
      .select('id, fecha, categoria, concepto, notas, monto')
      .eq('sucursal', sucursal)
      .eq('fecha', hoy)
      .order('created_at', { ascending: true })
    setGastosHoy(gastosData ?? [])

    // 4. Corte hoy
    const { data: corteData } = await sb
      .from('cortes_caja')
      .select('*')
      .eq('sucursal', sucursal)
      .eq('fecha', hoy)
      .maybeSingle()

    if (corteData) {
      setCorteHoy(corteData)
      setIsClosed(!!corteData.cerrado)
      setEfectivoContado(String(corteData.efectivo_contado))
      setFondo(String(corteData.fondo))
      setNotas(corteData.notas)
    } else {
      setCorteHoy(null)
      setIsClosed(false)
    }

    // 5. Saldo anterior (último corte cerrado antes de hoy)
    const { data: corteAnteriorData } = await sb
      .from('cortes_caja')
      .select('efectivo_contado, fecha')
      .eq('sucursal', sucursal)
      .eq('cerrado', true)
      .lt('fecha', hoy)
      .order('fecha', { ascending: false })
      .limit(1)
      .maybeSingle()

    setSaldoAnterior(corteAnteriorData?.efectivo_contado ?? 0)
    setFechaCorteAnterior(corteAnteriorData?.fecha ?? null)

    // 6. Historial — admin ve todas las sucursales
    let histQuery = sb
      .from('cortes_caja')
      .select('*')
      .neq('fecha', hoy)
      .order('fecha', { ascending: false })
      .limit(50)

    if (rol !== 'administrador') {
      histQuery = histQuery.eq('sucursal', sucursal)
    }

    const { data: historialData } = await histQuery
    setHistorial(historialData ?? [])
    setUltimaActualizacion(new Date())
    setCargando(false)
  }, [])

  const esMultiSucursal = ['administrador', 'gerente'].includes(usuario.rol)
  // Sucursal efectiva: si es admin/gerente usan sucursalCaja; si es vendedor usa la suya fija
  const sucursalEfectiva = esMultiSucursal ? sucursalCaja : usuario.sucursal

  useEffect(() => {
    if (sucursalEfectiva) cargarDatos(sucursalEfectiva, usuario.rol)
  }, [sucursalEfectiva, usuario.rol, cargarDatos])

  // ── Guardar egreso rápido ──
  const guardarEgreso = async () => {
    const monto = parseFloat(egresoMonto)
    if (!monto || monto <= 0) return
    setGuardandoEgreso(true)
    setErrorGuardado('')
    const sb  = createClient()
    const hoy = hoyLocal()
    const catLabel = CATEGORIAS_EGRESO.find(c => c.value === egresoCategoria)?.label ?? egresoCategoria
    const { error } = await sb.from('gastos').insert({
      fecha:     hoy,
      categoria: egresoCategoria,
      concepto:  catLabel,
      notas:     egresoDescripcion || null,
      monto,
      sucursal:  usuario.sucursal,
    })
    if (error) {
      setErrorGuardado(`Error al guardar egreso: ${error.message}`)
      setGuardandoEgreso(false)
      return
    }
    const { data } = await sb
      .from('gastos')
      .select('id, fecha, categoria, concepto, notas, monto')
      .eq('sucursal', usuario.sucursal)
      .eq('fecha', hoy)
      .order('created_at', { ascending: true })
    setGastosHoy(data ?? [])
    setEgresoMonto('')
    setEgresoDescripcion('')
    setShowEgresoForm(false)
    setGuardandoEgreso(false)
  }

  // ── Imprimir corte ──
  const imprimirCorte = () => {
    const fechaFmt = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
    const horaFmt  = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    const metodosRows = [
      ...METODOS.map(m => {
        const d = ventas[m.key]
        return `<tr><td>${m.label}</td><td class="r">${d.transacciones} tx</td><td class="r bold">${fmt$(d.monto)}</td></tr>`
      }),
      efectivoUSD.transacciones > 0
        ? `<tr><td>Efectivo USD</td><td class="r">${efectivoUSD.transacciones} tx</td><td class="r bold">USD $${efectivoUSD.monto.toFixed(2)}</td></tr>`
        : '',
    ].join('')

    const egresosRows = gastosHoy.length > 0
      ? gastosHoy.map(g => `<tr><td>${g.notas || g.concepto}</td><td class="r">${fmt$(Number(g.monto))}</td></tr>`).join('')
      : '<tr><td colspan="2">Sin egresos</td></tr>'

    const difClass = diferencia === 0 ? 'ok' : diferencia > 0 ? 'over' : 'short'
    const difLabel = diferencia === 0
      ? 'Sin diferencia'
      : diferencia > 0
      ? `Sobrante: +${fmt$(diferencia)}`
      : `Faltante: -${fmt$(Math.abs(diferencia))}`

    const win = window.open('', '_blank', 'width=380,height=700')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Corte de caja</title>
<style>
  @page { size: 80mm auto; margin: 4mm 3mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Courier New', monospace; font-size: 11px; color: #000; width: 74mm; }
  .hdr { text-align: center; padding-bottom: 8px; border-bottom: 2px solid #000; margin-bottom: 8px; }
  .hdr h1 { font-size: 15px; font-weight: 900; }
  .hdr p  { font-size: 10px; margin-top: 2px; }
  .titulo { text-align: center; font-size: 12px; font-weight: 900; text-transform: uppercase;
            border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 4px 0; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 6px; }
  td { padding: 2px 1px; vertical-align: top; }
  td.r { text-align: right; }
  td.bold { font-weight: 900; }
  .sep { border-top: 1px dashed #000; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; font-size: 11px; margin: 3px 0; }
  .row.big { font-size: 13px; font-weight: 900; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 4px 0; margin: 5px 0; }
  .dif-box { border: 1px solid #000; padding: 4px 6px; text-align: center; margin: 6px 0; font-size: 11px; font-weight: 900; }
  .entrega-box { background: #000; color: #fff; padding: 6px; text-align: center; margin: 6px 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .entrega-box .num { font-size: 18px; font-weight: 900; }
  .notas { border: 1px solid #000; padding: 4px 6px; font-size: 10px; margin: 6px 0; }
  .firma { margin: 16px 0 6px; display: flex; gap: 8px; }
  .firma-item { flex: 1; text-align: center; }
  .firma-line { display: inline-block; border-top: 1px solid #000; width: 100%; padding-top: 3px; font-size: 9px; }
  .footer { text-align: center; font-size: 9px; color: #555; border-top: 1px dashed #000; padding-top: 5px; margin-top: 5px; }
</style></head><body>
<div class="hdr">
  <h1>${usuario.sucursal.toUpperCase()}</h1>
  <p>Corte de caja</p>
  <p>${fechaFmt}</p>
  <p>${horaFmt} · ${usuario.nombre}</p>
</div>
<div class="titulo">Ingresos del día</div>
<table><tbody>${metodosRows}</tbody></table>
<div class="row big"><span>TOTAL INGRESOS</span><span>${fmt$(total)}</span></div>
${gastosHoy.length > 0 ? `
<div class="sep"></div>
<div class="titulo">Egresos del día</div>
<table><tbody>${egresosRows}</tbody></table>
<div class="row big"><span>TOTAL EGRESOS</span><span>${fmt$(totalEgresos)}</span></div>
` : ''}
<div class="sep"></div>
<div class="titulo">Conteo de efectivo — PESOS</div>
<div class="row"><span>Esperado (sistema)</span><span>${fmt$(esperado)}</span></div>
<div class="row"><span>Contado físicamente</span><span>${fmt$(contado)}</span></div>
<div class="dif-box ${difClass}">${difLabel}</div>
${efectivoUSD.transacciones > 0 ? `
<div class="sep"></div>
<div class="titulo">Caja dólares — USD</div>
<div class="row"><span>Esperado</span><span>USD $${esperadoUSD.toFixed(2)}</span></div>
<div class="row"><span>Contado</span><span>USD $${contadoUSD.toFixed(2)}</span></div>
<div class="dif-box">${diferenciaUSD === 0 ? 'Sin diferencia' : diferenciaUSD > 0 ? `Sobrante: +$${diferenciaUSD.toFixed(2)} USD` : `Faltante: -$${Math.abs(diferenciaUSD).toFixed(2)} USD`}</div>
` : ''}
<div class="sep"></div>
<div class="row"><span>Fondo en caja</span><span>${fmt$(fondoNum)}</span></div>
<div class="entrega-box">
  <div style="font-size:10px;margin-bottom:2px">TOTAL A ENTREGAR</div>
  <div class="num">${fmt$(entrega)}</div>
</div>
${notas ? `<div class="notas"><b>Notas:</b> ${notas}</div>` : ''}
<div class="firma">
  <div class="firma-item"><div class="firma-line">Elaboró</div></div>
  <div class="firma-item"><div class="firma-line">Recibió</div></div>
</div>
<div class="footer">OptiOS · Sistema de Gestión</div>
</body></html>`)
    win.document.close()
    setTimeout(() => { win.print() }, 300)
  }

  // ── Reabrir caja (solo admin) ──
  const reabrirCaja = async () => {
    if (!corteHoy) return
    const sb = createClient()
    await sb.from('cortes_caja').update({ cerrado: false }).eq('id', corteHoy.id)
    setCorteHoy({ ...corteHoy, cerrado: false })
    setIsClosed(false)
  }

  // ── Cerrar caja ──
  const cerrarCaja = async () => {
    if (!efectivoContado || guardando) return
    setGuardando(true)
    setErrorGuardado('')
    const sb  = createClient()
    const hoy = hoyLocal()

    const notasConUSD = efectivoUSD.transacciones > 0
      ? `[USD] Sistema: $${esperadoUSD.toFixed(2)} · Contado: $${contadoUSD.toFixed(2)} · Dif: ${diferenciaUSD >= 0 ? '+' : ''}$${diferenciaUSD.toFixed(2)} | ${notas}`
      : notas

    const payload = {
      fecha:            hoy,
      sucursal:         usuario.sucursal,
      usuario:          usuario.nombre,
      total_ventas:     total,
      efectivo_sistema: esperado,
      efectivo_contado: contado,
      diferencia,
      fondo:            0,
      entrega:          0,
      notas:            notasConUSD,
      cerrado:          true,
    }

    const { data, error } = await sb
      .from('cortes_caja')
      .upsert(payload, { onConflict: 'fecha,sucursal' })
      .select()
      .single()

    if (error) {
      setErrorGuardado(`Error al guardar: ${error.message}`)
    } else {
      setIsClosed(true)
      if (data) setCorteHoy(data)
    }
    setGuardando(false)
  }

  // ─────────────────────────────────────────
  // Sin sucursal
  // ─────────────────────────────────────────
  if (!cargando && !usuario.sucursal) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-zinc-400">
        <MapPin className="w-10 h-10" />
        <p className="text-sm font-medium">Necesitas hacer check-in primero</p>
        <p className="text-xs">Recarga la página para seleccionar tu sucursal</p>
      </div>
    )
  }

  // ─────────────────────────────────────────
  // UI
  // ─────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-4xl">

      {/* ── Encabezado ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Corte de caja</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {esMultiSucursal ? (
            /* Admin/gerente: selector de sucursal activa */
            <select
              value={sucursalCaja}
              onChange={e => setSucursalCaja(e.target.value)}
              className="flex items-center gap-1.5 text-xs text-zinc-600 bg-zinc-100 border border-zinc-200 px-3 py-1.5 rounded-full font-medium focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
            >
              <option value="">— Seleccionar sucursal —</option>
              {['Baja Visión', '5 de Mayo', 'Plaza Laureles'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-zinc-500 bg-zinc-100 px-3 py-1.5 rounded-full font-medium">
              <MapPin className="w-3.5 h-3.5" />
              {usuario.sucursal}
            </span>
          )}
          <button
            onClick={() => { if (sucursalEfectiva) cargarDatos(sucursalEfectiva, usuario.rol) }}
            disabled={cargando || !sucursalEfectiva}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 border border-zinc-200 px-3 py-1.5 rounded-full hover:bg-zinc-100 transition-all disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* ── Banner caja cerrada ── */}
      {cerrado && (
        <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-emerald-700">Caja cerrada</p>
            <p className="text-xs text-emerald-600">
              Cerrada por {corteHoy?.usuario} · Entrega: {fmt$(corteHoy?.entrega ?? 0)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={imprimirCorte} className="flex items-center gap-1.5 text-xs text-emerald-600 hover:underline">
              <Printer className="w-3.5 h-3.5" /> Imprimir
            </button>
            {usuario.rol === 'administrador' && (
              <button
                onClick={reabrirCaja}
                className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded hover:bg-amber-100 transition-colors font-semibold"
              >
                🔓 Reabrir
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Banner corte guardado no cerrado ── */}
      {corteHoy && !cerrado && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-700 flex-1">
            Hay un corte guardado hoy pero <b>no está cerrado</b> — puedes modificarlo.
          </p>
        </div>
      )}

      {/* ── Ingresos + Egresos (dos columnas) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ── INGRESOS ── */}
        <div className="bg-white rounded-lg border border-zinc-200/80 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-zinc-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-700">Ingresos del día</h3>
            {ultimaActualizacion && (
              <span className="text-xs text-zinc-400">
                Act. {ultimaActualizacion.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          {cargando ? (
            <div className="px-5 py-8 text-center text-sm text-zinc-400">Cargando...</div>
          ) : (
            <>
              <div className="divide-y divide-zinc-50">
                {METODOS.map(m => {
                  const Icon   = m.icon
                  const data   = ventas[m.key]
                  const pagos  = pagosPorMetodo(m.key)
                  const open   = expandedMetodo === m.key
                  return (
                    <div key={m.key}>
                      {/* Fila del método */}
                      <button
                        onClick={() => setExpandedMetodo(open ? null : m.key)}
                        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-zinc-100 transition-colors text-left"
                      >
                        <div className={`w-7 h-7 rounded ${m.bg} flex items-center justify-center flex-shrink-0`}>
                          <Icon className={`w-3.5 h-3.5 ${m.color}`} />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-zinc-700">{m.label}</p>
                          <p className="text-xs text-zinc-400">
                            {data.transacciones === 0
                              ? 'Sin movimientos'
                              : `${data.transacciones} tx · ${pagos.length} pago${pagos.length !== 1 ? 's' : ''} detallado${pagos.length !== 1 ? 's' : ''}`}
                          </p>
                        </div>
                        <p className={`text-sm font-bold mr-1 ${data.monto > 0 ? 'text-zinc-800' : 'text-zinc-400'}`}>
                          {fmt$(data.monto)}
                        </p>
                        {data.monto > 0
                          ? open
                            ? <ChevronDown className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                            : <ChevronRight className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                          : <div className="w-4" />}
                      </button>

                      {/* Drill-down */}
                      {open && pagos.length > 0 && (
                        <div className={`border-t ${m.border} ${m.bg} divide-y divide-white/60`}>
                          {pagos.map(p => (
                            <div key={p.id} className="flex items-center gap-3 px-5 py-2.5">
                              <div className="flex-1">
                                <p className="text-xs font-semibold text-zinc-700">{p.paciente || 'Sin nombre'}</p>
                                <p className="text-xs text-zinc-400">
                                  {p.folio_venta} · {TIPO_LABEL[p.tipo] ?? p.tipo}
                                  {p.registrado_por ? ` · ${p.registrado_por}` : ''}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className={`text-xs font-bold ${m.color}`}>{fmt$(Number(p.monto))}</p>
                                <p className="text-xs text-zinc-400">{fmtHora(p.created_at)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {open && pagos.length === 0 && data.monto > 0 && (
                        <div className={`px-5 py-2.5 ${m.bg} border-t ${m.border}`}>
                          <p className="text-xs text-zinc-400 italic">Sin detalle disponible (ventas anteriores a este sistema)</p>
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Efectivo USD — siempre visible */}
                <div className="flex items-center gap-3 px-5 py-3.5 bg-blue-50/50">
                  <div className="w-7 h-7 rounded bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Banknote className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-700">Efectivo USD 🇺🇸</p>
                    <p className="text-xs text-blue-400">
                      {efectivoUSD.transacciones === 0
                        ? 'Sin transacciones'
                        : `${efectivoUSD.transacciones} tx${efectivoUSD.tcPromedio > 0 ? ` · TC $${efectivoUSD.tcPromedio.toFixed(2)}` : ''}`}
                    </p>
                  </div>
                  <p className={`text-sm font-bold ${efectivoUSD.monto > 0 ? 'text-blue-700' : 'text-zinc-400'}`}>
                    USD ${efectivoUSD.monto.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {/* Total ingresos */}
              <div className="px-5 py-3.5 bg-zinc-50 border-t border-zinc-200 flex justify-between items-center">
                <span className="text-sm font-semibold text-zinc-600">Total ingresos</span>
                <span className="text-base font-bold text-zinc-800">{fmt$(total)}</span>
              </div>
            </>
          )}
        </div>

        {/* ── EGRESOS ── */}
        <div className="bg-white rounded-lg border border-zinc-200/80 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-zinc-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-700">Egresos del día</h3>
            <button
              onClick={() => setShowEgresoForm(!showEgresoForm)}
              className="flex items-center gap-1.5 text-xs text-[#0D9488] font-semibold hover:opacity-80"
            >
              <Plus className="w-3.5 h-3.5" /> Agregar
            </button>
          </div>

          {/* Formulario rápido de egreso */}
          {showEgresoForm && (
            <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1">Categoría</label>
                  <select
                    value={egresoCategoria}
                    onChange={e => setEgresoCategoria(e.target.value)}
                    className="w-full border border-zinc-200 rounded px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
                  >
                    {CATEGORIAS_EGRESO.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1">Método</label>
                  <select
                    value={egresoMetodoPago}
                    onChange={e => setEgresoMetodoPago(e.target.value)}
                    className="w-full border border-zinc-200 rounded px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
                  >
                    <option value="efectivo">Pesos (MXN)</option>
                    <option value="efectivo_usd">Dólares (USD)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">Descripción (opcional)</label>
                <input
                  type="text"
                  value={egresoDescripcion}
                  onChange={e => setEgresoDescripcion(e.target.value)}
                  placeholder="ej. Bono de Néstor"
                  className="w-full border border-zinc-200 rounded px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
                />
              </div>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-zinc-500 mb-1">Monto</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm font-bold">$</span>
                    <input
                      type="number"
                      value={egresoMonto}
                      onChange={e => setEgresoMonto(e.target.value)}
                      placeholder="0.00"
                      className="w-full border border-zinc-200 rounded pl-7 pr-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
                    />
                  </div>
                </div>
                <button
                  onClick={guardarEgreso}
                  disabled={!egresoMonto || guardandoEgreso}
                  className="px-4 py-2 bg-[#0B0E14] text-white rounded text-sm font-bold hover:bg-[#1A1D27] disabled:opacity-40 transition-colors"
                >
                  {guardandoEgreso ? '...' : 'Guardar'}
                </button>
                <button
                  onClick={() => { setShowEgresoForm(false); setErrorGuardado('') }}
                  className="px-4 py-2 border border-zinc-200 text-zinc-500 rounded text-sm hover:bg-zinc-100"
                >
                  Cancelar
                </button>
              </div>
              {errorGuardado && errorGuardado.includes('egreso') && (
                <div className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 font-medium">
                  ⚠️ {errorGuardado}
                </div>
              )}
            </div>
          )}

          {/* Lista de egresos */}
          {cargando ? (
            <div className="px-5 py-8 text-center text-sm text-zinc-400">Cargando...</div>
          ) : gastosHoy.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-zinc-400">Sin egresos registrados hoy</div>
          ) : (
            <div className="divide-y divide-zinc-50">
              {gastosHoy.map(g => {
                const catLabel = CATEGORIAS_EGRESO.find(c => c.value === g.categoria)?.label ?? g.categoria
                return (
                  <div key={g.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-zinc-700">{g.notas || g.concepto}</p>
                      <p className="text-xs text-zinc-400">
                        {catLabel}
                        {' · MXN'}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-red-600">{fmt$(Number(g.monto))}</p>
                  </div>
                )
              })}
            </div>
          )}

          {/* Total egresos */}
          <div className="px-5 py-3.5 bg-red-50 border-t border-red-100 flex justify-between items-center">
            <span className="text-sm font-semibold text-red-700">Total egresos</span>
            <span className="text-base font-bold text-red-700">{fmt$(totalEgresos)}</span>
          </div>
        </div>
      </div>

      {/* ── Conteo de efectivo ── */}
      <div className="bg-white rounded-lg border border-zinc-200/80 p-5">
        <h3 className="text-sm font-bold text-zinc-700 mb-4">Conteo de efectivo</h3>

        {/* Pesos MXN */}
        <div className="grid grid-cols-2 gap-5 mb-5">
          <div className="bg-zinc-50 rounded-lg p-4 border border-zinc-200">
            <p className="text-xs font-semibold text-zinc-400 mb-1">Esperado en caja (sistema)</p>
            <p className="text-3xl font-bold text-zinc-700">{fmt$(esperado)}</p>
            <div className="mt-2 space-y-0.5 text-xs text-zinc-400">
              {saldoInicialNum > 0 && (
                <p>
                  Saldo {fechaCorteAnterior
                    ? new Date(fechaCorteAnterior + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
                    : 'anterior'}: {fmt$(saldoInicialNum)}
                </p>
              )}
              {saldoAnterior === null && <p className="text-amber-500">Sin corte previo registrado</p>}
              {saldoAnterior === 0 && saldoInicialNum === 0 && <p>Sin saldo de ayer</p>}
              <p>+ Ventas efectivo: {fmt$(ventas.efectivo.monto)}</p>
              {totalEgresos > 0 && <p>− Egresos: {fmt$(totalEgresos)}</p>}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-500 mb-1.5">Pesos contados físicamente *</p>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">$</span>
              <input
                type="number"
                value={efectivoContado}
                onChange={e => setEfectivoContado(e.target.value)}
                disabled={cerrado}
                className="w-full border-2 border-zinc-200 rounded-lg pl-8 pr-4 py-4 text-2xl font-bold text-zinc-800 focus:outline-none focus:border-[#0D9488] disabled:bg-zinc-50 disabled:text-zinc-400"
                placeholder="0.00"
              />
            </div>
            {efectivoContado !== '' && (
              <div className={`mt-3 flex items-center gap-2 px-4 py-3 rounded-lg ${
                diferencia === 0
                  ? 'bg-emerald-50 border border-emerald-200'
                  : diferencia > 0
                  ? 'bg-blue-50 border border-blue-200'
                  : 'bg-red-50 border border-red-200'
              }`}>
                {diferencia === 0
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  : <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />}
                <p className={`text-sm font-bold ${
                  diferencia === 0 ? 'text-emerald-700' : diferencia > 0 ? 'text-blue-700' : 'text-red-700'
                }`}>
                  {diferencia === 0
                    ? 'Sin diferencia — cuadra perfecto'
                    : diferencia > 0
                    ? `Sobrante: +${fmt$(diferencia)}`
                    : `Faltante: -${fmt$(Math.abs(diferencia))}`}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Dólares USD — siempre visible */}
        <div className="border-t border-zinc-200 pt-5">
            <p className="text-xs font-bold text-blue-600 mb-3">🇺🇸 Caja dólares (USD)</p>
            <div className="grid grid-cols-2 gap-5">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <p className="text-xs font-semibold text-blue-400 mb-1">Esperado (sistema)</p>
                <p className="text-3xl font-bold text-blue-700">
                  ${esperadoUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-blue-400 mt-1">
                  {efectivoUSD.transacciones} cobro{efectivoUSD.transacciones !== 1 ? 's' : ''} en USD
                  {efectivoUSD.tcPromedio > 0 ? ` · TC prom. $${efectivoUSD.tcPromedio.toFixed(2)}` : ''}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-500 mb-1.5">Dólares contados físicamente</p>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400 font-bold text-sm">USD</span>
                  <input
                    type="number"
                    value={efectivoUSDContado}
                    onChange={e => setEfectivoUSDContado(e.target.value)}
                    disabled={cerrado}
                    className="w-full border-2 border-blue-200 rounded-lg pl-14 pr-4 py-4 text-2xl font-bold text-blue-800 focus:outline-none focus:border-blue-400 disabled:bg-zinc-50 disabled:text-zinc-400"
                    placeholder="0.00"
                  />
                </div>
                {efectivoUSDContado !== '' && (
                  <div className={`mt-3 flex items-center gap-2 px-4 py-3 rounded-lg ${
                    diferenciaUSD === 0 ? 'bg-emerald-50 border border-emerald-200'
                    : diferenciaUSD > 0 ? 'bg-blue-50 border border-blue-200'
                    : 'bg-red-50 border border-red-200'
                  }`}>
                    {diferenciaUSD === 0
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      : <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />}
                    <p className={`text-sm font-bold ${
                      diferenciaUSD === 0 ? 'text-emerald-700' : diferenciaUSD > 0 ? 'text-blue-700' : 'text-red-700'
                    }`}>
                      {diferenciaUSD === 0
                        ? 'Sin diferencia'
                        : diferenciaUSD > 0
                        ? `Sobrante: +$${diferenciaUSD.toFixed(2)} USD`
                        : `Faltante: -$${Math.abs(diferenciaUSD).toFixed(2)} USD`}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

        {/* Notas */}
        {efectivoContado !== '' && !cerrado && (
          <div className="mt-4">
            <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Notas del corte</label>
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              rows={2}
              className="w-full border border-zinc-200 rounded px-3 py-2.5 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 resize-none placeholder:text-zinc-400"
              placeholder="Observaciones, diferencias, devoluciones en efectivo..."
            />
          </div>
        )}
        {cerrado && corteHoy?.notas && (
          <div className="mt-4 px-4 py-3 bg-zinc-50 rounded-lg border border-zinc-200">
            <p className="text-xs font-semibold text-zinc-400 mb-1">Notas del corte</p>
            <p className="text-sm text-zinc-600">{corteHoy.notas}</p>
          </div>
        )}

        {/* Botón cerrar */}
        {!cerrado && (
          <div className="mt-5 flex gap-3 flex-col">
            {errorGuardado && (
              <div className="px-4 py-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700 font-medium">
                ⚠️ {errorGuardado}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={cerrarCaja}
                disabled={!efectivoContado || guardando}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#0B0E14] text-white rounded text-sm font-bold hover:bg-[#1A1D27] disabled:opacity-40 transition-all"
              >
                {guardando
                  ? <RefreshCw className="w-4 h-4 animate-spin" />
                  : <Lock className="w-4 h-4" />}
                {guardando ? 'Guardando...' : 'Cerrar caja del día'}
              </button>
              <button
                onClick={imprimirCorte}
                disabled={!efectivoContado}
                className="flex items-center gap-2 px-4 py-3 border border-zinc-200 text-zinc-500 rounded text-sm hover:bg-zinc-100 disabled:opacity-40"
              >
                <Printer className="w-4 h-4" /> Imprimir
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Historial de cortes ── */}
      <div className="bg-white rounded-lg border border-zinc-200/80 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-zinc-700 flex items-center gap-2">
              <Clock className="w-4 h-4 text-zinc-400" />
              {usuario.rol === 'admin' ? 'Historial de cortes — todas las sucursales' : `Cortes anteriores · ${usuario.sucursal}`}
            </h3>
          </div>
          {usuario.rol === 'admin' && (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Filtrar sucursal..."
                value={filtroSucursal}
                onChange={e => setFiltroSucursal(e.target.value)}
                className="flex-1 border border-zinc-200 rounded px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
              />
              <input
                type="date"
                value={filtroFecha}
                onChange={e => setFiltroFecha(e.target.value)}
                className="border border-zinc-200 rounded px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
              />
              {(filtroSucursal || filtroFecha) && (
                <button
                  onClick={() => { setFiltroSucursal(''); setFiltroFecha('') }}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-600 border border-zinc-200 rounded"
                >
                  Limpiar
                </button>
              )}
            </div>
          )}
        </div>

        {(() => {
          const filtrados = historial.filter(c => {
            if (filtroSucursal && !c.sucursal.toLowerCase().includes(filtroSucursal.toLowerCase())) return false
            if (filtroFecha && c.fecha !== filtroFecha) return false
            return true
          })
          if (filtrados.length === 0) return (
            <div className="px-5 py-8 text-center text-sm text-zinc-400">
              {cargando ? 'Cargando...' : 'Sin cortes anteriores'}
            </div>
          )
          return (
            <div className="divide-y divide-zinc-50">
              {filtrados.map(c => (
                <div key={c.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-zinc-100 transition-colors">
                  <div className="w-10 h-10 rounded bg-zinc-50 border border-zinc-200 flex items-center justify-center flex-shrink-0">
                    {c.diferencia === 0
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      : <AlertTriangle className="w-4 h-4 text-amber-400" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-zinc-700">
                      {new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-MX', {
                        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {usuario.rol === 'admin' && <span className="font-medium text-zinc-500 mr-1">{c.sucursal} ·</span>}
                      {c.usuario}
                    </p>
                  </div>
                  <div className="text-right">
                    {c.diferencia !== 0 && (
                      <p className={`text-xs font-bold ${c.diferencia > 0 ? 'text-blue-600' : 'text-red-500'}`}>
                        {c.diferencia > 0 ? '+' : ''}{fmt$(c.diferencia)}
                      </p>
                    )}
                    <p className="text-xs font-semibold text-zinc-600">Cierre: {fmt$(c.efectivo_contado)}</p>
                    <p className="text-xs text-zinc-400">Ventas: {fmt$(c.total_ventas)}</p>
                  </div>
                </div>
              ))}
            </div>
          )
        })()}
      </div>

    </div>
  )
}
