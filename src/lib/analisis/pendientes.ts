// ─────────────────────────────────────────────────────────────────────────────
// Pendientes del cierre · SOLO los registros que impiden cerrar el mes (SOLO servidor)
// ─────────────────────────────────────────────────────────────────────────────
import type { MesData, Row } from './queries'

/* eslint-disable @typescript-eslint/no-explicit-any */
const num = (x: any) => parseFloat(x) || 0
const esOtroGenerico = (g: Row) => g.categoria === 'otros' || /^otro\b/i.test(String(g.concepto ?? '').trim())
const ESTADOS_NO_FINAL = ['agendada', 'confirmada', '', '—']
const RX_ARMAZON = /^(VRL|ARMZ)-/i

export function computePendientes(d: MesData) {
  const hoyTij = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Tijuana' })

  // 1. Movimientos por aclarar (gastos "otros"/genéricos)
  const movAclarar = d.gastos.filter(g => esOtroGenerico(g) && g.categoria !== 'retiro_admin').map(g => ({
    id: g.id, fecha: g.fecha, concepto: g.concepto || '', monto: num(g.monto),
    sucursal: g.sucursal || '', metodo: g.metodo_pago || '', esCaja: g.es_caja === true,
  }))

  // 2. Movimientos en USD (gastos con método efectivo_usd) — confirmar conversión a MXN
  const movUSD = d.gastos.filter(g => String(g.metodo_pago) === 'efectivo_usd').map(g => ({
    id: g.id, fecha: g.fecha, concepto: g.concepto || '', monto: num(g.monto),
    sucursal: g.sucursal || '', categoria: g.categoria || '',
  }))

  // 3. Órdenes de laboratorio del mes sin costo capturado
  const ordenesSinCosto = d.ordenes
    .filter(o => o.fecha_ingreso >= d.fechaIni && o.fecha_ingreso <= d.fechaFin && num(o.costo_lab) <= 0)
    .map(o => ({
      id: o.id, folio: o.folio, folioVenta: o.folio_venta, paciente: o.paciente || '',
      sucursal: o.sucursal || '', laboratorio: o.laboratorio || '', tipoLente: o.tipo_mica || '',
      empleada: o.creado_por || '', ingreso: num(o.precio_cliente),
    }))

  // 4. Armazones vendidos en el mes cuyo costo (catálogo) está en cero
  const costoDe: Record<string, Row> = {}
  for (const a of d.armazones) costoDe[String(a.sku).toUpperCase()] = a
  const armzMap: Record<string, any> = {}
  const ventaDeItem: Record<string, Row> = {}
  for (const v of d.ventas) ventaDeItem[v.id] = v
  for (const it of d.ventasItems) {
    const sku = String(it.sku ?? '')
    if (!RX_ARMAZON.test(sku)) continue
    const venta = ventaDeItem[it.venta_id]
    if (!venta || venta.estado === 'cancelada' || venta.es_cotizacion) continue   // solo ventas reales
    const a = costoDe[sku.toUpperCase()]
    if (a && num(a.costo) > 0) continue                                           // ya tiene costo
    const g = (armzMap[sku.toUpperCase()] ||= { sku: sku.toUpperCase(), marca: a?.marca || '', modelo: a?.modelo || '', piezas: 0, ingreso: 0 })
    g.piezas += num(it.cantidad); g.ingreso += num(it.subtotal)
  }
  const armazonesSinCosto = Object.values(armzMap).map((g: any) => ({ ...g, ingreso: Math.round(g.ingreso * 100) / 100 }))
    .sort((a, b) => b.piezas - a.piezas)

  // 5. Citas vencidas sin estado final (fecha ya pasó y siguen agendada/confirmada)
  const citasVencidas = d.citas
    .filter(c => c.fecha && c.fecha < hoyTij && ESTADOS_NO_FINAL.includes(String(c.estado).toLowerCase()))
    .map(c => ({
      id: c.id, paciente: c.paciente_nombre || '', telefono: c.paciente_telefono || '', tipo: c.tipo || '',
      fecha: c.fecha, sucursal: c.sucursal || '', estado: c.estado || '',
    }))

  // 6. Garantías incompletas (sin folio origen, sin motivo o sin laboratorio)
  const garantiasIncompletas = d.ordenes
    .filter(o => o.es_garantia && (!o.folio_origen || !o.motivo_problema || !o.laboratorio))
    .map(o => ({
      id: o.id, folio: o.folio, paciente: o.paciente || '', fecha: o.fecha_ingreso,
      folioOrigen: o.folio_origen || '', motivo: o.motivo_problema || '', laboratorio: o.laboratorio || '',
      faltaOrigen: !o.folio_origen, faltaMotivo: !o.motivo_problema, faltaLab: !o.laboratorio,
    }))

  const counts = {
    movAclarar: movAclarar.length, movUSD: movUSD.length, ordenesSinCosto: ordenesSinCosto.length,
    armazonesSinCosto: armazonesSinCosto.length, citasVencidas: citasVencidas.length,
    garantiasIncompletas: garantiasIncompletas.length,
  }
  // "Material" para el cierre: lo que impide una utilidad/flujo confiable
  const materialesPendientes = counts.movAclarar + counts.ordenesSinCosto + counts.armazonesSinCosto
  const totalPendientes = Object.values(counts).reduce((s, x) => s + x, 0)

  return {
    anio: d.anio, mes: d.mes0 + 1, mesLabel: d.mesLabel,
    cierre: d.cierre, counts, materialesPendientes, totalPendientes,
    movAclarar, movUSD, ordenesSinCosto, armazonesSinCosto, citasVencidas, garantiasIncompletas,
    montoAclarar: Math.round(movAclarar.reduce((s, x) => s + x.monto, 0) * 100) / 100,
    montoUSD: Math.round(movUSD.reduce((s, x) => s + x.monto, 0) * 100) / 100,
    ingresoOrdenesSinCosto: Math.round(ordenesSinCosto.reduce((s, x) => s + x.ingreso, 0) * 100) / 100,
  }
}
