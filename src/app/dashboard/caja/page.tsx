'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { hoyLocal, rangoDiaLocal } from '@/lib/fecha'
import { getSucursalActual } from '@/lib/session'
import { useSession } from '@/hooks/useSession'
import {
  Banknote, CreditCard, Building2, CheckCircle2,
  AlertTriangle, Printer, Clock, Lock, RefreshCw, MapPin,
  ChevronDown, ChevronRight, Plus, X,
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
  moneda?: string
  monto_origen?: number
  tipo_cambio?: number
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
  metodo_pago?: string
  created_at?: string
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
  fondo_usd?: number
  entrega_usd?: number
  notas: string
  cerrado: boolean
  cerrado_at?: string | null
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
  { value: 'compras',            label: 'Compras' },
  { value: 'otros',              label: 'Otro' },
]

// finanzas: true = es ingreso real de la óptica y suma a Finanzas.
// finanzas: false = solo dinero para cuadrar el cajón, NO entra a Finanzas.
const CATEGORIAS_INGRESO = [
  { value: 'ajuste',       label: 'Ajuste de caja',              finanzas: false },
  { value: 'fondo',        label: 'Fondo / entrada de efectivo', finanzas: false },
  { value: 'entrada_pago', label: 'Entrada para pago (renta…)',  finanzas: false },
  { value: 'cambio',       label: 'Cambio / feria',              finanzas: false },
  { value: 'pago_previo',  label: 'Pago de paciente (venta previa)', finanzas: true },
  { value: 'otros',        label: 'Otro (solo caja)',            finanzas: false },
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

  // ── Datos del día ──
  const [ventas, setVentas]       = useState<Record<MetodoPago, ResumenMetodo>>(RESUMEN_VACIO)
  const [efectivoUSD, setEfectivoUSD] = useState<ResumenUSD>({ monto: 0, transacciones: 0, tcPromedio: 0 })
  const [pagosHoy, setPagosHoy]   = useState<PagoVenta[]>([])
  const [pagosTardios, setPagosTardios] = useState<PagoVenta[]>([])  // pagos que entraron después del cierre
  const [gastosHoy, setGastosHoy] = useState<GastoHoy[]>([])
  const [historial, setHistorial] = useState<CorteGuardado[]>([])
  const [corteSel, setCorteSel]   = useState<CorteGuardado | null>(null)  // corte abierto en el desglose
  const [corteIngresos, setCorteIngresos] = useState<{ folio: string; monto: number }[]>([])
  const [corteEgresos, setCorteEgresos]   = useState<{ concepto: string; monto: number }[]>([])
  const [corteUSD, setCorteUSD]           = useState(0)
  const [corteHoy, setCorteHoy]   = useState<CorteGuardado | null>(null)
  const [saldoAnterior, setSaldoAnterior] = useState<number | null>(null)
  const [saldoAnteriorUSD, setSaldoAnteriorUSD] = useState(0)  // remanente en dólares del último cierre
  const [efectivoPrevio, setEfectivoPrevio] = useState(0)      // efectivo MXN acumulado antes de hoy (va a saldo inicial)
  const [efectivoUSDPrevio, setEfectivoUSDPrevio] = useState(0) // dólares acumulados antes de hoy (va a saldo inicial)
  const [cargando, setCargando]   = useState(true)
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null)
  const [isClosed, setIsClosed]   = useState(false)
  const [errorGuardado, setErrorGuardado] = useState('')

  // ── UI state ──
  const [expandedMetodo, setExpandedMetodo] = useState<MetodoPago | null>(null)
  const [showEgresoForm, setShowEgresoForm] = useState(false)
  const [showCierreModal, setShowCierreModal] = useState(false)
  const [egresoCategoria, setEgresoCategoria]   = useState('bono_diario')
  const [egresoDescripcion, setEgresoDescripcion] = useState('')
  const [egresoMonto, setEgresoMonto]   = useState('')
  const [egresoMetodoPago, setEgresoMetodoPago] = useState('efectivo')
  const [guardandoEgreso, setGuardandoEgreso] = useState(false)
  // Ingresos manuales (para cuadrar caja)
  const [ingresosCaja, setIngresosCaja] = useState<GastoHoy[]>([])
  const [showIngresoForm, setShowIngresoForm] = useState(false)
  const [ingresoCategoria, setIngresoCategoria]   = useState('ajuste')
  const [ingresoDescripcion, setIngresoDescripcion] = useState('')
  const [ingresoMonto, setIngresoMonto]   = useState('')
  const [ingresoMetodoPago, setIngresoMetodoPago] = useState('efectivo')
  const [guardandoIngreso, setGuardandoIngreso] = useState(false)

  // ── Filtros historial ──
  const [filtroSucursal, setFiltroSucursal] = useState('')
  const [filtroFecha, setFiltroFecha]       = useState('')

  // ── Formulario de corte ──
  const [efectivoContado, setEfectivoContado]       = useState('')
  const [efectivoUSDContado, setEfectivoUSDContado] = useState('')
  const [retiro, setRetiro]   = useState('')
  const [retiroUSD, setRetiroUSD] = useState('')
  const [notas, setNotas]     = useState('')
  const [guardando, setGuardando] = useState(false)

  // ── Ingresos/egresos reales al abrir el desglose de un corte del historial ──
  useEffect(() => {
    if (!corteSel) return
    const cargar = async () => {
      const sb = createClient()
      const r = rangoDiaLocal(corteSel.fecha)
      const [{ data: pagos }, { data: gs }] = await Promise.all([
        sb.from('pagos_venta').select('folio_venta, monto, moneda, monto_origen')
          .eq('sucursal', corteSel.sucursal).eq('metodo_pago', 'efectivo')
          .gte('created_at', r.start).lte('created_at', r.end),
        sb.from('gastos').select('concepto, notas, monto')
          .eq('sucursal', corteSel.sucursal).eq('es_caja', true).eq('fecha', corteSel.fecha),
      ])
      const p = (pagos ?? []) as { folio_venta: string; monto: number; moneda: string; monto_origen: number | null }[]
      setCorteIngresos(p.filter(x => x.moneda !== 'USD').map(x => ({ folio: x.folio_venta ?? '', monto: Number(x.monto) })))
      setCorteUSD(p.filter(x => x.moneda === 'USD').reduce((s, x) => s + Number(x.monto_origen ?? 0), 0))
      setCorteEgresos(((gs ?? []) as { concepto: string; notas: string; monto: number }[])
        .map(g => ({ concepto: g.notas || g.concepto || 'Egreso', monto: Number(g.monto) })))
    }
    cargar()
  }, [corteSel])

  // ── Cálculos ──
  // Rango de HOY (Tijuana) para separar "ingresos/egresos del día" del acumulado previo.
  const rangoHoyTS = rangoDiaLocal(hoyLocal())
  const esHoyTS = (ts?: string) => !!ts && ts >= rangoHoyTS.start && ts <= rangoHoyTS.end

  // Egresos: los de HOY se muestran como "egresos del día"; los previos ya afectaron
  // el saldo inicial. Solo los pagados en efectivo bajan del cajón físico.
  const gastosHoyList = gastosHoy.filter(g => esHoyTS(g.created_at))
  // Egresos en efectivo: los de pesos bajan del cajón de pesos; los de dólares (efectivo_usd)
  // bajan del cajón de dólares. Se cuentan por separado para que cada moneda cuadre.
  const totalEgresos     = gastosHoyList.filter(g => g.metodo_pago !== 'efectivo_usd').reduce((s, g) => s + Number(g.monto), 0)
  const totalEgresosUSD  = gastosHoyList.filter(g => g.metodo_pago === 'efectivo_usd').reduce((s, g) => s + Number(g.monto), 0)
  const egresosEfectivo = gastosHoyList
    .filter(g => (g.metodo_pago ?? 'efectivo') === 'efectivo')
    .reduce((s, g) => s + Number(g.monto), 0)
  const egresosEfectivoUSD = gastosHoyList
    .filter(g => g.metodo_pago === 'efectivo_usd')
    .reduce((s, g) => s + Number(g.monto), 0)
  const egresosEfectivoPrevio = gastosHoy
    .filter(g => !esHoyTS(g.created_at) && (g.metodo_pago ?? 'efectivo') === 'efectivo')
    .reduce((s, g) => s + Number(g.monto), 0)
  const egresosEfectivoUSDPrevio = gastosHoy
    .filter(g => !esHoyTS(g.created_at) && g.metodo_pago === 'efectivo_usd')
    .reduce((s, g) => s + Number(g.monto), 0)

  // ── Ingresos manuales (mismo esquema que egresos, pero suman al cajón) ──
  const ingresosHoyList = ingresosCaja.filter(g => esHoyTS(g.created_at))
  const totalIngresos    = ingresosHoyList.filter(g => g.metodo_pago !== 'efectivo_usd').reduce((s, g) => s + Number(g.monto), 0)
  const totalIngresosUSD = ingresosHoyList.filter(g => g.metodo_pago === 'efectivo_usd').reduce((s, g) => s + Number(g.monto), 0)
  const ingresosEfectivo = ingresosHoyList
    .filter(g => (g.metodo_pago ?? 'efectivo') === 'efectivo')
    .reduce((s, g) => s + Number(g.monto), 0)
  const ingresosEfectivoUSD = ingresosHoyList
    .filter(g => g.metodo_pago === 'efectivo_usd')
    .reduce((s, g) => s + Number(g.monto), 0)
  const ingresosEfectivoPrevio = ingresosCaja
    .filter(g => !esHoyTS(g.created_at) && (g.metodo_pago ?? 'efectivo') === 'efectivo')
    .reduce((s, g) => s + Number(g.monto), 0)
  const ingresosEfectivoUSDPrevio = ingresosCaja
    .filter(g => !esHoyTS(g.created_at) && g.metodo_pago === 'efectivo_usd')
    .reduce((s, g) => s + Number(g.monto), 0)

  // Saldo inicial = remanente del último corte + efectivo acumulado antes de hoy
  // + ingresos manuales previos − egresos en efectivo previos. En operación diaria
  // (corte cada día) esto = remanente de ayer.
  const saldoInicialNum = (saldoAnterior ?? 0) + efectivoPrevio + ingresosEfectivoPrevio - egresosEfectivoPrevio
  const saldoInicialUSD = saldoAnteriorUSD + efectivoUSDPrevio + ingresosEfectivoUSDPrevio - egresosEfectivoUSDPrevio
  // Esperado en caja = saldo inicial + ingresos en efectivo de HOY (ventas + manuales) − egresos de HOY.
  const esperado      = saldoInicialNum + ventas.efectivo.monto + ingresosEfectivo - egresosEfectivo
  const esperadoUSD   = saldoInicialUSD + efectivoUSD.monto + ingresosEfectivoUSD - egresosEfectivoUSD
  const contado       = parseFloat(efectivoContado) || 0
  const contadoUSD    = parseFloat(efectivoUSDContado) || 0
  const retiroNum     = parseFloat(retiro) || 0
  const retiroUSDNum  = parseFloat(retiroUSD) || 0
  // Redondeamos a centavos para evitar que una fracción flotante invisible
  // (ej. 434.0000001) marque "faltante -$0.00" cuando en realidad cuadra.
  const diferencia    = Math.round((contado - esperado) * 100) / 100
  const diferenciaUSD = Math.round((contadoUSD - esperadoUSD) * 100) / 100
  const remanente     = Math.max(0, contado - retiroNum)        // pesos que quedan para mañana
  const remanenteUSD  = Math.max(0, contadoUSD - retiroUSDNum)  // dólares que quedan para mañana
  const totalMXN      = Object.values(ventas).reduce((s, v) => s + v.monto, 0)
  const total         = totalMXN + (efectivoUSD.tcPromedio > 0 ? efectivoUSD.monto * efectivoUSD.tcPromedio : 0)
  const cerrado       = isClosed || corteHoy?.cerrado === true

  // Detalle por método bajo "ingresos del día": todos los métodos solo de HOY.
  // El efectivo acumulado de días previos ya vive en el saldo inicial.
  const pagosPorMetodo = (m: MetodoPago) => pagosHoy.filter(p =>
    p.metodo_pago === m && esHoyTS(p.created_at) &&
    // El efectivo en dólares tiene su propia sección (Efectivo USD): no lo mezclamos
    // en el detalle de efectivo en pesos para que el desglose cuadre con el encabezado.
    !(m === 'efectivo' && p.moneda === 'USD'),
  )

  // ── Leer usuario (legacy localStorage para usuarios sin migrar) ──
  const [sucursalActual, setSucursalActual] = useState('')
  useEffect(() => {
    try {
      const raw = localStorage.getItem('optios_demo_user')
      if (raw) {
        const u = JSON.parse(raw)
        setLegacyUser({ nombre: u.nombre ?? '', sucursal: u.sucursal ?? '', rol: u.rol ?? '' })
      }
    } catch { /* noop */ }
    setSucursalActual(getSucursalActual())
  }, [])
  const usuario = {
    nombre:   sessionUser?.nombre   || legacyUser?.nombre   || '',
    sucursal: sucursalActual,
    rol:      sessionUser?.rol      || legacyUser?.rol      || 'vendedor',
  }

  // ── Cargar datos ──
  const cargarDatos = useCallback(async (sucursal: string, rol?: string) => {
    if (!sucursal) return
    setCargando(true)
    const sb  = createClient()
    const hoy = hoyLocal()

    // Último corte CERRADO antes de hoy → define el inicio del periodo y el saldo que
    // quedó en caja. El dinero se ACUMULA desde ese cierre (pesos y dólares); no se
    // resetea al cambiar de día. Si nunca se ha cerrado, el periodo abarca todo.
    const { data: ultimoCorte } = await sb
      .from('cortes_caja')
      .select('fondo, fondo_usd, cerrado_at, fecha')
      .eq('sucursal', sucursal)
      .eq('cerrado', true)
      .lt('fecha', hoy)
      .order('fecha', { ascending: false })
      .limit(1)
      .maybeSingle()

    const periodStart = ultimoCorte?.cerrado_at ?? '2000-01-01T00:00:00Z'
    setSaldoAnterior(Number(ultimoCorte?.fondo ?? 0))
    setSaldoAnteriorUSD(Number(ultimoCorte?.fondo_usd ?? 0))

    // Rango de HOY (Tijuana): el efectivo acumula todo el periodo, pero tarjeta y
    // transferencia se reinician cada día (van al banco, no se quedan en la caja).
    const { start: inicioDiaTJ, end: finDiaTJ } = rangoDiaLocal(hoy)
    const esHoy = (ts: string) => ts >= inicioDiaTJ && ts <= finDiaTJ

    // 1. Pagos ACUMULADOS desde el último cierre (no solo hoy)
    const { data: pagosData } = await sb
      .from('pagos_venta')
      .select('*')
      .eq('sucursal', sucursal)
      .gt('created_at', periodStart)
      .order('created_at', { ascending: true })

    // 2. Ventas del periodo (fallback: ventas sin registro en pagos_venta)
    const { data: ventasData } = await sb
      .from('ventas')
      .select('id, metodo_pago, total, saldo, moneda, tipo_cambio, created_at')
      .eq('sucursal', sucursal)
      .in('estado', ['activa'])
      .gt('created_at', periodStart)

    const pagosHoyList = pagosData ?? []
    setPagosHoy(pagosHoyList)

    {
      // Ventas con al menos un pago en pagos_venta hoy
      const ventasConPagos = new Set(pagosHoyList.map(p => p.venta_id))

      const resumen = JSON.parse(JSON.stringify(RESUMEN_VACIO)) as Record<MetodoPago, ResumenMetodo>
      let usdMonto = 0, usdTx = 0, usdTCSum = 0
      let efvoPrevioAcc = 0   // efectivo MXN de días previos → saldo inicial
      let usdPrevioAcc = 0    // dólares de días previos → saldo inicial

      // Ingresos del día = SOLO hoy (todos los métodos). El efectivo/dólares de días
      // previos se acumula aparte y se muestra como "saldo inicial en caja".
      for (const p of pagosHoyList) {
        const key = p.metodo_pago as MetodoPago
        const hoyP = esHoy(p.created_at)
        if (key === 'efectivo' && p.moneda === 'USD') {
          if (hoyP) { usdMonto += Number(p.monto_origen ?? 0); usdTx++; usdTCSum += Number(p.tipo_cambio ?? 0) }
          else usdPrevioAcc += Number(p.monto_origen ?? 0)
        } else if (key === 'efectivo') {
          if (hoyP) resumen.efectivo = { monto: resumen.efectivo.monto + Number(p.monto), transacciones: resumen.efectivo.transacciones + 1 }
          else efvoPrevioAcc += Number(p.monto)
        } else if (resumen[key] && hoyP) {
          resumen[key] = { monto: resumen[key].monto + Number(p.monto), transacciones: resumen[key].transacciones + 1 }
        }
      }

      // Fallback: ventas de contado sin registro en pagos_venta (misma regla)
      for (const v of (ventasData ?? [])) {
        if (ventasConPagos.has(v.id)) continue
        const recibido = Math.max(0, Number(v.total) - Number(v.saldo ?? 0))
        if (recibido <= 0) continue
        const key = v.metodo_pago as MetodoPago
        const hoyV = esHoy(v.created_at)
        if (key === 'efectivo' && v.moneda === 'USD') {
          if (hoyV) { usdMonto += recibido; usdTx++; usdTCSum += Number(v.tipo_cambio ?? 0) }
          else usdPrevioAcc += recibido
        } else if (key === 'efectivo') {
          if (hoyV) resumen.efectivo = { monto: resumen.efectivo.monto + recibido, transacciones: resumen.efectivo.transacciones + 1 }
          else efvoPrevioAcc += recibido
        } else if (resumen[key] && hoyV) {
          resumen[key] = { monto: resumen[key].monto + recibido, transacciones: resumen[key].transacciones + 1 }
        }
      }

      setVentas(resumen)
      setEfectivoUSD({ monto: usdMonto, transacciones: usdTx, tcPromedio: usdTx > 0 ? usdTCSum / usdTx : 0 })
      setEfectivoPrevio(efvoPrevioAcc)
      setEfectivoUSDPrevio(usdPrevioAcc)
    }

    // 3. Gastos ACUMULADOS del periodo (desde el último cierre).
    //    Solo los "de caja" (salen del cajón); los de empresa viven en finanzas.
    const { data: gastosData } = await sb
      .from('gastos')
      .select('id, fecha, categoria, concepto, notas, monto, metodo_pago, created_at')
      .eq('sucursal', sucursal)
      .eq('es_caja', true)
      .gt('created_at', periodStart)
      .order('created_at', { ascending: true })
    setGastosHoy(gastosData ?? [])

    // 3b. Ingresos manuales del periodo (para cuadrar). Si la tabla aún no existe,
    //     data llega null y no rompe nada.
    const { data: ingresosData } = await sb
      .from('ingresos_caja')
      .select('id, fecha, categoria, concepto, notas, monto, metodo_pago, created_at')
      .eq('sucursal', sucursal)
      .eq('es_caja', true)
      .gt('created_at', periodStart)
      .order('created_at', { ascending: true })
    setIngresosCaja(ingresosData ?? [])

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
      setRetiro(corteData.entrega ? String(corteData.entrega) : '')
      setRetiroUSD(corteData.entrega_usd ? String(corteData.entrega_usd) : '')
      setNotas(corteData.notas)
      // Pagos que entraron DESPUÉS de la hora de cierre (dinero tardío que el corte no cubrió)
      if (corteData.cerrado && corteData.cerrado_at) {
        setPagosTardios(pagosHoyList.filter(p => p.created_at > corteData.cerrado_at))
      } else {
        setPagosTardios([])
      }
    } else {
      setCorteHoy(null)
      setIsClosed(false)
      setPagosTardios([])
    }

    // (El saldo inicial y el inicio del periodo ya se calcularon arriba con `ultimoCorte`.)

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

  // Sucursal efectiva: siempre viene del header (getSucursalActual / localStorage)
  const sucursalEfectiva = usuario.sucursal

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
      fecha:       hoy,
      categoria:   egresoCategoria,
      concepto:    catLabel,
      notas:       egresoDescripcion || null,
      monto,
      metodo_pago: egresoMetodoPago,
      sucursal:    usuario.sucursal,
      es_caja:     true,   // se agregó desde la caja → sale del cajón
    })
    if (error) {
      setErrorGuardado(`Error al guardar egreso: ${error.message}`)
      setGuardandoEgreso(false)
      return
    }
    setEgresoMonto('')
    setEgresoDescripcion('')
    setShowEgresoForm(false)
    setGuardandoEgreso(false)
    await cargarDatos(usuario.sucursal, usuario.rol)  // refresca respetando periodo + es_caja
  }

  // ── Guardar ingreso manual (para cuadrar caja) ──
  const guardarIngreso = async () => {
    const monto = parseFloat(ingresoMonto)
    if (!monto || monto <= 0) return
    setGuardandoIngreso(true)
    setErrorGuardado('')
    const sb  = createClient()
    const hoy = hoyLocal()
    const cat = CATEGORIAS_INGRESO.find(c => c.value === ingresoCategoria)
    const { error } = await sb.from('ingresos_caja').insert({
      fecha:       hoy,
      categoria:   ingresoCategoria,
      concepto:    cat?.label ?? ingresoCategoria,
      notas:       ingresoDescripcion || null,
      monto,
      metodo_pago: ingresoMetodoPago,
      sucursal:    usuario.sucursal,
      es_caja:     true,
      cuenta_finanzas: cat?.finanzas ?? false,   // solo 'pago_previo' entra a Finanzas
    })
    if (error) {
      setErrorGuardado(`Error al guardar ingreso: ${error.message}`)
      setGuardandoIngreso(false)
      return
    }
    setIngresoMonto('')
    setIngresoDescripcion('')
    setShowIngresoForm(false)
    setGuardandoIngreso(false)
    await cargarDatos(usuario.sucursal, usuario.rol)
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

    const egresosRows = gastosHoyList.length > 0
      ? gastosHoyList.map(g => {
          const esUSD = g.metodo_pago === 'efectivo_usd'
          const m = esUSD ? `USD $${Number(g.monto).toFixed(2)}` : fmt$(Number(g.monto))
          return `<tr><td>${g.notas || g.concepto}${esUSD ? ' (USD)' : ''}</td><td class="r">${m}</td></tr>`
        }).join('')
      : '<tr><td colspan="2">Sin egresos</td></tr>'

    const difClass = diferencia === 0 ? 'ok' : diferencia > 0 ? 'over' : 'short'
    const difLabel = diferencia === 0
      ? 'Sin diferencia'
      : diferencia > 0
      ? `Sobrante: +${fmt$(diferencia)}`
      : `Faltante: -${fmt$(Math.abs(diferencia))}`

    const win = window.open('', '_blank', 'width=230,height=900')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Corte de caja</title>
<style>
  @page { size: 58mm auto; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { height: auto; }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 3.2mm; font-weight: 600; color: #000; background: #fff;
    width: 48mm; padding: 1mm 1.5mm 4mm 1.5mm; overflow: visible; -webkit-font-smoothing: none;
  }
  .hdr { text-align: center; padding-bottom: 2mm; border-bottom: 0.6mm solid #000; margin-bottom: 3mm; }
  .hdr h1 { font-size: 5mm; font-weight: 900; line-height: 1.15; }
  .hdr p  { font-size: 3mm; margin-top: 1mm; }
  .titulo { text-align: center; font-size: 3.4mm; font-weight: 900; text-transform: uppercase;
            border-top: 0.4mm solid #000; border-bottom: 0.4mm solid #000; padding: 1.5mm 0; margin: 3mm 0 2mm; }
  table { width: 100%; border-collapse: collapse; font-size: 3mm; margin-bottom: 2mm; }
  td { padding: 1mm 0.5mm; vertical-align: top; line-height: 1.35; }
  td:first-child { word-break: break-word; overflow-wrap: anywhere; }
  td.r { text-align: right; white-space: nowrap; }
  td.bold { font-weight: 900; }
  .sep { border-top: 0.4mm dashed #000; margin: 2.5mm 0; }
  .row { display: flex; justify-content: space-between; gap: 2mm; font-size: 3.2mm; margin: 1.5mm 0; }
  .row span:last-child { text-align: right; white-space: nowrap; font-weight: 700; }
  .row.big { font-size: 3.8mm; font-weight: 900; border-top: 0.5mm solid #000; border-bottom: 0.5mm solid #000; padding: 2mm 0; margin: 2.5mm 0; }
  .dif-box { border: 0.5mm solid #000; padding: 2mm; text-align: center; margin: 2.5mm 0; font-size: 3.4mm; font-weight: 900; }
  .entrega-box { border: 0.7mm solid #000; padding: 2.5mm; text-align: center; margin: 3mm 0; }
  .entrega-box .num { font-size: 6mm; font-weight: 900; }
  .notas { border: 0.5mm solid #000; padding: 2mm; font-size: 3mm; margin: 2.5mm 0; line-height: 1.4; }
  .firma { margin: 8mm 0 3mm; display: flex; gap: 3mm; }
  .firma-item { flex: 1; text-align: center; }
  .firma-line { display: block; border-top: 0.4mm solid #000; padding-top: 1mm; font-size: 2.8mm; }
  .footer { text-align: center; font-size: 2.8mm; color: #000; border-top: 0.4mm dashed #000; padding-top: 2mm; margin-top: 3mm; }
  * { page-break-inside: avoid; break-inside: avoid; }
  .tip { display: block; background: #fff8e1; border: 1px solid #e5a; padding: 5px 6px; margin-bottom: 8px; font-size: 9px; line-height: 1.5; }
  @media print { .tip { display: none; } }
</style></head><body>
<div class="tip">Configurar impresion: <b>Margenes → Ninguno</b> · Sin encabezados/pies</div>
<div class="hdr">
  <h1>${usuario.sucursal.toUpperCase()}</h1>
  <p>Corte de caja</p>
  <p>${fechaFmt}</p>
  <p>${horaFmt} · ${usuario.nombre}</p>
</div>
<div class="titulo">Saldo inicial en caja</div>
<div class="row"><span>Efectivo</span><span>${fmt$(saldoInicialNum)}</span></div>
${saldoInicialUSD > 0 ? `<div class="row"><span>Dólares</span><span>USD $${saldoInicialUSD.toFixed(2)}</span></div>` : ''}
<div class="sep"></div>
<div class="titulo">Ingresos del día</div>
<table><tbody>${metodosRows}</tbody></table>
<div class="row big"><span>TOTAL INGRESOS DEL DÍA</span><span>${fmt$(total)}</span></div>
${ingresosHoyList.length > 0 ? `
<div class="sep"></div>
<div class="titulo">Ingresos manuales</div>
<table><tbody>${ingresosHoyList.map(g => {
  const esUSD = g.metodo_pago === 'efectivo_usd'
  const m = esUSD ? `USD $${Number(g.monto).toFixed(2)}` : fmt$(Number(g.monto))
  return `<tr><td>${g.notas || g.concepto}${esUSD ? ' (USD)' : ''}</td><td class="r">${m}</td></tr>`
}).join('')}</tbody></table>
<div class="row big"><span>TOTAL INGRESOS MANUALES</span><span>${fmt$(totalIngresos)}</span></div>
${totalIngresosUSD > 0 ? `<div class="row"><span>Ingresos en dólares</span><span>USD $${totalIngresosUSD.toFixed(2)}</span></div>` : ''}
` : ''}
${gastosHoyList.length > 0 ? `
<div class="sep"></div>
<div class="titulo">Egresos del día</div>
<table><tbody>${egresosRows}</tbody></table>
<div class="row big"><span>TOTAL EGRESOS DEL DÍA</span><span>${fmt$(totalEgresos)}</span></div>
${totalEgresosUSD > 0 ? `<div class="row"><span>Egresos en dólares</span><span>USD $${totalEgresosUSD.toFixed(2)}</span></div>` : ''}
` : ''}
<div class="sep"></div>
<div class="titulo">Saldo esperado en caja — PESOS</div>
<div class="row"><span>Saldo inicial + ingresos − egresos</span><span>${fmt$(esperado)}</span></div>
<div class="row"><span>Conteo físico</span><span>${fmt$(contado)}</span></div>
<div class="dif-box ${difClass}">${difLabel}</div>
${(efectivoUSD.transacciones > 0 || esperadoUSD > 0) ? `
<div class="sep"></div>
<div class="titulo">Saldo esperado en caja — USD</div>
<div class="row"><span>Saldo esperado</span><span>USD $${esperadoUSD.toFixed(2)}</span></div>
<div class="row"><span>Conteo físico</span><span>USD $${contadoUSD.toFixed(2)}</span></div>
<div class="dif-box">${diferenciaUSD === 0 ? 'Sin diferencia' : diferenciaUSD > 0 ? `Sobrante: +$${diferenciaUSD.toFixed(2)} USD` : `Faltante: -$${Math.abs(diferenciaUSD).toFixed(2)} USD`}</div>
<div class="row"><span>Retiro (sobre)</span><span>USD $${retiroUSDNum.toFixed(2)}</span></div>
<div class="row"><span>Remanente (mañana)</span><span>USD $${remanenteUSD.toFixed(2)}</span></div>
` : ''}
<div class="sep"></div>
<div class="row"><span>Remanente en caja — pesos (mañana)</span><span>${fmt$(remanente)}</span></div>
<div class="entrega-box">
  <div style="font-size:10px;margin-bottom:2px">RETIRO AL SOBRE (PESOS)</div>
  <div class="num">${fmt$(retiroNum)}</div>
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

    // ── RECALCULAR con datos FRESCOS de la base (evita cerrar con pagos viejos
    //    del navegador y que se salten ventas del día). Esto es la fuente de verdad. ──
    const { data: uCorte } = await sb.from('cortes_caja')
      .select('fondo, fondo_usd, cerrado_at')
      .eq('sucursal', usuario.sucursal).eq('cerrado', true).lt('fecha', hoy)
      .order('fecha', { ascending: false }).limit(1).maybeSingle()
    const pStart = uCorte?.cerrado_at ?? '2000-01-01T00:00:00Z'
    const rango  = rangoDiaLocal(hoy)
    const esHoyF = (ts: string) => ts >= rango.start && ts <= rango.end
    const [{ data: pg }, { data: eg }] = await Promise.all([
      sb.from('pagos_venta').select('metodo_pago, monto, moneda, monto_origen').eq('sucursal', usuario.sucursal).gt('created_at', pStart),
      sb.from('gastos').select('monto, metodo_pago, created_at').eq('sucursal', usuario.sucursal).eq('es_caja', true).gt('created_at', pStart),
    ])
    let efHoy = 0, efPrev = 0, usdHoy = 0, usdPrev = 0
    for (const p of (pg ?? []) as { metodo_pago: string; monto: number; moneda: string; monto_origen: number | null; created_at?: string }[]) {
      const es = esHoyF((p as { created_at?: string }).created_at ?? '')
      if (p.metodo_pago === 'efectivo' && p.moneda === 'USD') { if (es) usdHoy += Number(p.monto_origen ?? 0); else usdPrev += Number(p.monto_origen ?? 0) }
      else if (p.metodo_pago === 'efectivo') { if (es) efHoy += Number(p.monto); else efPrev += Number(p.monto) }
    }
    let egHoy = 0, egPrev = 0, egUsdHoy = 0, egUsdPrev = 0
    for (const g of (eg ?? []) as { monto: number; metodo_pago: string | null; created_at: string }[]) {
      const es = esHoyF(g.created_at)
      if (g.metodo_pago === 'efectivo_usd') { if (es) egUsdHoy += Number(g.monto); else egUsdPrev += Number(g.monto) }
      else if ((g.metodo_pago ?? 'efectivo') === 'efectivo') { if (es) egHoy += Number(g.monto); else egPrev += Number(g.monto) }
    }
    const esperadoF    = Math.round(((Number(uCorte?.fondo ?? 0) + efPrev - egPrev) + efHoy - egHoy) * 100) / 100
    const esperadoUSDF = Math.round(((Number(uCorte?.fondo_usd ?? 0) + usdPrev - egUsdPrev) + usdHoy - egUsdHoy) * 100) / 100
    const contadoF     = parseFloat(efectivoContado) || 0
    const contadoUSDF  = parseFloat(efectivoUSDContado) || 0
    const difF         = Math.round((contadoF - esperadoF) * 100) / 100
    const difUSDF      = Math.round((contadoUSDF - esperadoUSDF) * 100) / 100
    const retiroF      = parseFloat(retiro) || 0
    const retiroUSDF   = parseFloat(retiroUSD) || 0
    const remF         = Math.max(0, contadoF - retiroF)
    const remUSDF      = Math.max(0, contadoUSDF - retiroUSDF)

    const notasConUSD = (usdHoy > 0 || contadoUSDF > 0 || esperadoUSDF > 0)
      ? `[USD] Sistema: $${esperadoUSDF.toFixed(2)} · Contado: $${contadoUSDF.toFixed(2)} · Dif: ${difUSDF >= 0 ? '+' : ''}$${difUSDF.toFixed(2)} | ${notas}`
      : notas

    const payload = {
      fecha:            hoy,
      sucursal:         usuario.sucursal,
      usuario:          usuario.nombre,
      total_ventas:     total,
      efectivo_sistema: esperadoF,
      efectivo_contado: contadoF,
      diferencia:       difF,
      fondo:            remF,          // remanente en pesos que queda para mañana
      entrega:          retiroF,       // retiro en pesos que va al sobre
      fondo_usd:        remUSDF,       // remanente en dólares que queda para mañana
      entrega_usd:      retiroUSDF,    // retiro en dólares que va al sobre
      notas:            notasConUSD,
      cerrado:          true,
      cerrado_at:       new Date().toISOString(),  // momento exacto del cierre
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
      setShowCierreModal(false)
      setTimeout(() => imprimirCorte(), 300)  // imprimir el corte automáticamente
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Corte de caja</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-zinc-500 bg-zinc-100 px-3 py-1.5 rounded-full font-medium">
            <MapPin className="w-3.5 h-3.5" />
            {usuario.sucursal}
          </span>
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
              Cerrada por {corteHoy?.usuario} · Retiro: {fmt$(corteHoy?.entrega ?? 0)} · Queda: {fmt$(corteHoy?.fondo ?? 0)}
              {(corteHoy?.entrega_usd ?? 0) > 0 && ` · USD retiro: $${(corteHoy?.entrega_usd ?? 0).toFixed(2)} · quedan $${(corteHoy?.fondo_usd ?? 0).toFixed(2)}`}
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

      {/* ── Alerta: dinero que entró DESPUÉS del cierre ── */}
      {cerrado && pagosTardios.length > 0 && (
        <div className="px-4 py-3 bg-amber-50 border border-amber-300 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-amber-800">
                Entró dinero después del cierre — {fmt$(pagosTardios.reduce((s, p) => s + Number(p.monto), 0))}
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                {pagosTardios.length} pago{pagosTardios.length > 1 ? 's se registraron' : ' se registró'} después de que cerraste el corte. Reabre para incluirlo en el día.
              </p>
              <div className="mt-2 space-y-1">
                {pagosTardios.map(p => (
                  <div key={p.id} className="flex items-center justify-between gap-2 text-xs bg-white border border-amber-200 rounded px-2.5 py-1.5">
                    <span className="text-zinc-600 truncate">
                      <span className="font-semibold">{p.folio_venta}</span> · {p.paciente} · {fmtHora(p.created_at)}
                    </span>
                    <span className="font-bold text-zinc-800 flex-shrink-0">
                      {fmt$(Number(p.monto))} <span className="font-normal text-zinc-400">{p.metodo_pago}</span>
                    </span>
                  </div>
                ))}
              </div>
              {usuario.rol === 'administrador' && (
                <button
                  onClick={reabrirCaja}
                  className="mt-2 flex items-center gap-1.5 text-xs text-amber-700 bg-amber-100 border border-amber-300 px-3 py-1.5 rounded hover:bg-amber-200 transition-colors font-semibold"
                >
                  🔓 Reabrir e incluir
                </button>
              )}
            </div>
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

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
                <span className="text-sm font-semibold text-zinc-600">Total ingresos del día</span>
                <span className="text-base font-bold text-zinc-800">{fmt$(total)}</span>
              </div>
            </>
          )}
        </div>

        {/* Columna derecha: ingresos manuales + egresos, apilados */}
        <div className="space-y-5">

        {/* ── INGRESOS MANUALES (cuadrar) ── */}
        <div className="bg-white rounded-lg border border-zinc-200/80 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-emerald-100 bg-emerald-50 flex items-center justify-between">
            <h3 className="text-sm font-bold text-emerald-800">Ingresos <span className="font-normal text-emerald-600">· entra dinero al cajón</span></h3>
            <button
              onClick={() => setShowIngresoForm(!showIngresoForm)}
              className="flex items-center gap-1.5 text-xs text-white bg-emerald-600 hover:bg-emerald-700 font-semibold px-3 py-1.5 rounded transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Agregar ingreso
            </button>
          </div>

          {showIngresoForm && (
            <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1">Categoría</label>
                  <select value={ingresoCategoria} onChange={e => setIngresoCategoria(e.target.value)}
                    className="w-full border border-zinc-200 rounded px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30">
                    {CATEGORIAS_INGRESO.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1">Método</label>
                  <select value={ingresoMetodoPago} onChange={e => setIngresoMetodoPago(e.target.value)}
                    className="w-full border border-zinc-200 rounded px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30">
                    <option value="efectivo">Efectivo (pesos)</option>
                    <option value="efectivo_usd">Efectivo (dólares)</option>
                    <option value="debito">Tarjeta débito</option>
                    <option value="credito">Tarjeta crédito</option>
                    <option value="transferencia">Transferencia</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">Descripción (opcional)</label>
                <input type="text" value={ingresoDescripcion} onChange={e => setIngresoDescripcion(e.target.value)}
                  placeholder={ingresoCategoria === 'pago_previo' ? 'Paciente y folio de la venta' : 'ej. Ajuste por sobrante de ayer'}
                  className="w-full border border-zinc-200 rounded px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" />
              </div>
              {ingresoCategoria === 'pago_previo'
                ? <p className="text-[11px] text-emerald-700 bg-emerald-50 rounded px-2.5 py-1.5">Este ingreso SÍ cuenta en Finanzas (es dinero real de la óptica). Pon el paciente y el folio en la descripción.</p>
                : <p className="text-[11px] text-zinc-400">Solo suma al efectivo de la caja. No cuenta como ingreso en Finanzas.</p>}
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-zinc-500 mb-1">Monto</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm font-bold">$</span>
                    <input type="number" value={ingresoMonto} onChange={e => setIngresoMonto(e.target.value)}
                      placeholder="0.00"
                      className="w-full border border-zinc-200 rounded pl-7 pr-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" />
                  </div>
                </div>
                <button onClick={guardarIngreso} disabled={!ingresoMonto || guardandoIngreso}
                  className="px-4 py-2 bg-[#0D9488] text-white rounded text-sm font-bold hover:bg-teal-600 disabled:opacity-40 transition-colors">
                  {guardandoIngreso ? '...' : 'Guardar'}
                </button>
                <button onClick={() => { setShowIngresoForm(false); setErrorGuardado('') }}
                  className="px-4 py-2 border border-zinc-200 text-zinc-500 rounded text-sm hover:bg-zinc-100">
                  Cancelar
                </button>
              </div>
              {errorGuardado && errorGuardado.includes('ingreso') && (
                <div className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 font-medium">
                  {errorGuardado}
                </div>
              )}
            </div>
          )}

          {cargando ? (
            <div className="px-5 py-8 text-center text-sm text-zinc-400">Cargando...</div>
          ) : ingresosHoyList.length === 0 ? (
            <div className="px-5 py-6 text-center text-sm text-zinc-400">Sin ingresos manuales hoy</div>
          ) : (
            <div className="divide-y divide-zinc-50">
              {ingresosHoyList.map(g => {
                const catLabel = CATEGORIAS_INGRESO.find(c => c.value === g.categoria)?.label ?? g.categoria
                const esUSD = g.metodo_pago === 'efectivo_usd'
                return (
                  <div key={g.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-zinc-700">{g.notas || g.concepto}</p>
                      <p className="text-xs text-zinc-400">{catLabel}{esUSD ? ' · USD' : ' · MXN'}</p>
                    </div>
                    <p className="text-sm font-bold text-emerald-600">+{esUSD ? `USD $${Number(g.monto).toFixed(2)}` : fmt$(Number(g.monto))}</p>
                  </div>
                )
              })}
            </div>
          )}

          {(totalIngresos > 0 || totalIngresosUSD > 0) && (
            <div className="px-5 py-3.5 bg-emerald-50 border-t border-emerald-100 space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-emerald-700">Total ingresos manuales</span>
                <span className="text-base font-bold text-emerald-700">{fmt$(totalIngresos)}</span>
              </div>
              {totalIngresosUSD > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-emerald-700">Total ingresos (dólares)</span>
                  <span className="text-base font-bold text-emerald-700">USD ${totalIngresosUSD.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── EGRESOS ── */}
        <div className="bg-white rounded-lg border border-zinc-200/80 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-red-100 bg-red-50 flex items-center justify-between">
            <h3 className="text-sm font-bold text-red-800">Egresos <span className="font-normal text-red-500">· sale dinero del cajón</span></h3>
            <button
              onClick={() => setShowEgresoForm(!showEgresoForm)}
              className="flex items-center gap-1.5 text-xs text-white bg-red-600 hover:bg-red-700 font-semibold px-3 py-1.5 rounded transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Agregar egreso
            </button>
          </div>

          {/* Formulario rápido de egreso */}
          {showEgresoForm && (
            <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    <option value="efectivo">Efectivo (pesos)</option>
                    <option value="efectivo_usd">Efectivo (dólares)</option>
                    <option value="debito">Tarjeta débito</option>
                    <option value="credito">Tarjeta crédito</option>
                    <option value="transferencia">Transferencia</option>
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
          ) : gastosHoyList.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-zinc-400">Sin egresos registrados hoy</div>
          ) : (
            <div className="divide-y divide-zinc-50">
              {gastosHoyList.map(g => {
                const catLabel = CATEGORIAS_EGRESO.find(c => c.value === g.categoria)?.label ?? g.categoria
                const esUSD = g.metodo_pago === 'efectivo_usd'
                return (
                  <div key={g.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-zinc-700">{g.notas || g.concepto}</p>
                      <p className="text-xs text-zinc-400">
                        {catLabel}
                        {esUSD ? ' · USD' : ' · MXN'}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-red-600">{esUSD ? `USD $${Number(g.monto).toFixed(2)}` : fmt$(Number(g.monto))}</p>
                  </div>
                )
              })}
            </div>
          )}

          {/* Total egresos */}
          <div className="px-5 py-3.5 bg-red-50 border-t border-red-100 space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-red-700">Total egresos</span>
              <span className="text-base font-bold text-red-700">{fmt$(totalEgresos)}</span>
            </div>
            {totalEgresosUSD > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-red-700">Total egresos (dólares)</span>
                <span className="text-base font-bold text-red-700">USD ${totalEgresosUSD.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>
        </div>
      </div>

      {/* ── Conteo de efectivo ── */}
      <div className="bg-white rounded-lg border border-zinc-200/80 p-5">
        <h3 className="text-sm font-bold text-zinc-700 mb-4">Conteo de efectivo</h3>

        {/* Pesos MXN */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
          <div className="bg-zinc-50 rounded-lg p-4 border border-zinc-200">
            <p className="text-xs font-semibold text-zinc-400 mb-1">Saldo esperado en caja</p>
            <p className="text-3xl font-bold text-zinc-700">{fmt$(esperado)}</p>
            <div className="mt-2 space-y-0.5 text-xs text-zinc-400">
              <p>Saldo inicial: {fmt$(saldoInicialNum)}</p>
              {saldoAnterior === null && <p className="text-amber-500">Sin corte previo registrado</p>}
              <p>+ Efectivo del día: {fmt$(ventas.efectivo.monto)}</p>
              {ingresosEfectivo > 0 && <p>+ Ingresos manuales: {fmt$(ingresosEfectivo)}</p>}
              {egresosEfectivo > 0 && <p>− Egresos del día: {fmt$(egresosEfectivo)}</p>}
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

        {/* El retiro (pesos y dólares) se pide en la ventanita al cerrar caja */}

        {/* Dólares USD — siempre visible */}
        <div className="border-t border-zinc-200 pt-5">
            <p className="text-xs font-bold text-blue-600 mb-3">🇺🇸 Caja dólares (USD)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <p className="text-xs font-semibold text-blue-400 mb-1">Esperado (sistema)</p>
                <p className="text-3xl font-bold text-blue-700">
                  ${esperadoUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
                {saldoInicialUSD > 0 && (
                  <p className="text-[11px] text-blue-400 mt-0.5">
                    Saldo inicial ${saldoInicialUSD.toFixed(2)} + del día ${efectivoUSD.monto.toFixed(2)}
                  </p>
                )}
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
                onClick={() => { cargarDatos(usuario.sucursal, usuario.rol); setShowCierreModal(true) }}
                disabled={!efectivoContado || guardando}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#0B0E14] text-white rounded text-sm font-bold hover:bg-[#1A1D27] disabled:opacity-40 transition-all"
              >
                <Lock className="w-4 h-4" /> Cerrar caja del día
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
              {usuario.rol === 'administrador' ? 'Historial de cortes — todas las sucursales' : `Cortes anteriores · ${usuario.sucursal}`}
            </h3>
          </div>
          {usuario.rol === 'administrador' && (
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
                <button key={c.id} onClick={() => setCorteSel(c)} className="w-full text-left flex items-center gap-4 px-5 py-3.5 hover:bg-zinc-100 transition-colors">
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
                      {usuario.rol === 'administrador' && <span className="font-medium text-zinc-500 mr-1">{c.sucursal} ·</span>}
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
                </button>
              ))}
            </div>
          )
        })()}
      </div>

      {/* ── Desglose de un corte del historial ── */}
      {corteSel && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setCorteSel(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
              <div>
                <h2 className="text-base font-bold text-zinc-800">Corte de caja</h2>
                <p className="text-xs text-zinc-400">
                  {new Date(corteSel.fecha + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                  {' · '}{corteSel.sucursal} · {corteSel.usuario}
                </p>
              </div>
              <button onClick={() => setCorteSel(null)} className="text-zinc-400 hover:text-zinc-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="flex justify-between text-sm bg-zinc-50 rounded-lg px-4 py-3">
                <span className="text-zinc-500">Saldo inicial (fondo)</span>
                <span className="font-semibold text-zinc-800">{fmt$(corteSel.fondo)}</span>
              </div>

              {/* INGRESOS */}
              <div className="border border-emerald-100 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-emerald-50">
                  <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Ingresos en efectivo</span>
                  <span className="text-sm font-bold text-emerald-700">{fmt$(corteIngresos.reduce((s, p) => s + p.monto, 0))}</span>
                </div>
                <div className="divide-y divide-zinc-50 max-h-40 overflow-y-auto">
                  {corteIngresos.length === 0 ? (
                    <p className="text-xs text-zinc-400 text-center py-3">Sin ingresos en efectivo</p>
                  ) : corteIngresos.map((p, i) => (
                    <div key={i} className="flex justify-between px-4 py-1.5 text-sm">
                      <span className="text-zinc-500 font-mono text-xs">{p.folio || '—'}</span>
                      <span className="text-zinc-700 font-medium">{fmt$(p.monto)}</span>
                    </div>
                  ))}
                </div>
                {corteUSD > 0 && (
                  <div className="flex justify-between px-4 py-2 border-t border-emerald-100 text-sm bg-blue-50">
                    <span className="text-blue-600 font-medium">Dólares (USD)</span>
                    <span className="text-blue-700 font-bold">${corteUSD.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* EGRESOS */}
              <div className="border border-red-100 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-red-50">
                  <span className="text-xs font-bold text-red-600 uppercase tracking-wide">Egresos del cajón</span>
                  <span className="text-sm font-bold text-red-600">−{fmt$(corteEgresos.reduce((s, g) => s + g.monto, 0))}</span>
                </div>
                <div className="divide-y divide-zinc-50 max-h-40 overflow-y-auto">
                  {corteEgresos.length === 0 ? (
                    <p className="text-xs text-zinc-400 text-center py-3">Sin egresos</p>
                  ) : corteEgresos.map((g, i) => (
                    <div key={i} className="flex justify-between gap-3 px-4 py-1.5 text-sm">
                      <span className="text-zinc-500 truncate">{g.concepto}</span>
                      <span className="text-red-500 font-medium flex-shrink-0">−{fmt$(g.monto)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* RECONCILIACIÓN */}
              <div className="bg-zinc-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-zinc-500">Efectivo esperado</span><span className="font-semibold">{fmt$(corteSel.efectivo_sistema)}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Efectivo contado</span><span className="font-semibold">{fmt$(corteSel.efectivo_contado)}</span></div>
                <div className={`flex justify-between font-bold border-t border-zinc-200 pt-2 ${corteSel.diferencia === 0 ? 'text-emerald-700' : corteSel.diferencia > 0 ? 'text-blue-700' : 'text-red-600'}`}>
                  <span>{corteSel.diferencia === 0 ? 'Cuadró perfecto' : corteSel.diferencia > 0 ? 'Sobrante' : 'Faltante'}</span>
                  <span>{corteSel.diferencia === 0 ? '✓' : `${corteSel.diferencia > 0 ? '+' : ''}${fmt$(corteSel.diferencia)}`}</span>
                </div>
              </div>

              {/* RETIRO / REMANENTE */}
              <div className="bg-zinc-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-zinc-500">Retiro al sobre</span><span className="font-bold text-zinc-800">{fmt$(corteSel.entrega)}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Remanente (mañana)</span><span className="font-semibold">{fmt$(corteSel.efectivo_contado - corteSel.entrega)}</span></div>
                {(corteSel.entrega_usd ?? 0) > 0 && (
                  <div className="flex justify-between text-blue-600"><span>Retiro USD</span><span className="font-semibold text-blue-700">${(corteSel.entrega_usd ?? 0).toFixed(2)}</span></div>
                )}
              </div>

              {corteSel.notas && (
                <div className="border border-zinc-200 rounded-lg p-3 text-sm">
                  <p className="text-xs font-semibold text-zinc-400 mb-1">Notas</p>
                  <p className="text-zinc-600">{corteSel.notas}</p>
                </div>
              )}
              <p className="text-xs text-zinc-400 text-center">
                {corteSel.cerrado ? 'Corte cerrado' : 'Corte abierto'}
                {corteSel.cerrado_at ? ` · ${new Date(corteSel.cerrado_at).toLocaleString('es-MX', { timeZone: 'America/Tijuana' })}` : ''}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Ventanita de cierre: retiro + remanente ── */}
      {showCierreModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
              <h2 className="text-base font-bold text-zinc-800">Cerrar caja del día</h2>
              <button onClick={() => setShowCierreModal(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Referencia */}
              <div className="bg-zinc-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-zinc-500">Saldo esperado en caja</span><span className="font-semibold">{fmt$(esperado)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-zinc-500">Conteo físico</span><span className="font-semibold">{fmt$(contado)}</span></div>
                <div className={`flex justify-between text-sm font-bold ${diferencia === 0 ? 'text-emerald-700' : diferencia > 0 ? 'text-blue-700' : 'text-red-600'}`}>
                  <span>{diferencia === 0 ? 'Cuadra perfecto' : diferencia > 0 ? 'Sobrante' : 'Faltante'}</span>
                  <span>{diferencia === 0 ? '✓' : `${diferencia > 0 ? '+' : ''}${fmt$(diferencia)}`}</span>
                </div>
                {esperadoUSD > 0 && (
                  <div className="pt-2 border-t border-zinc-200 flex justify-between text-sm">
                    <span className="text-blue-500">Dólares contados</span>
                    <span className="font-semibold text-blue-700">USD ${contadoUSD.toFixed(2)} <span className="text-blue-400 font-normal">(esperado ${esperadoUSD.toFixed(2)})</span></span>
                  </div>
                )}
              </div>

              {/* Retiro pesos */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">¿Cuánto retiras en pesos? (va al sobre)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">$</span>
                  <input type="number" value={retiro} onChange={e => setRetiro(e.target.value)} autoFocus
                    className="w-full border-2 border-zinc-200 rounded-lg pl-8 pr-4 py-3 text-xl font-bold text-zinc-800 focus:outline-none focus:border-[#0D9488]" placeholder="0.00" />
                </div>
                <p className="text-xs text-emerald-600 mt-1.5 font-medium">Queda en caja para mañana: {fmt$(remanente)}</p>
              </div>

              {/* Retiro dólares */}
              {esperadoUSD > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">¿Cuánto retiras en dólares?</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400 font-bold text-sm">USD</span>
                    <input type="number" value={retiroUSD} onChange={e => setRetiroUSD(e.target.value)}
                      className="w-full border-2 border-blue-200 rounded-lg pl-14 pr-4 py-3 text-xl font-bold text-blue-800 focus:outline-none focus:border-blue-400" placeholder="0.00" />
                  </div>
                  <p className="text-xs text-blue-600 mt-1.5 font-medium">Quedan en dólares para mañana: ${remanenteUSD.toFixed(2)}</p>
                </div>
              )}

              {errorGuardado && (
                <div className="px-4 py-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700 font-medium">⚠️ {errorGuardado}</div>
              )}
            </div>

            <div className="px-6 pb-5 flex gap-3">
              <button onClick={() => setShowCierreModal(false)}
                className="flex-1 py-3 border border-zinc-200 text-zinc-600 rounded-md text-sm font-semibold hover:bg-zinc-100 transition-colors">
                Cancelar
              </button>
              <button onClick={cerrarCaja} disabled={guardando}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#0B0E14] text-white rounded-md text-sm font-bold hover:bg-[#1A1D27] disabled:opacity-40 transition-all">
                {guardando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                {guardando ? 'Guardando...' : 'Cerrar e imprimir corte'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
