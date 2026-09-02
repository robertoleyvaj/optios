// ─────────────────────────────────────────────────────────────────────────────
// Paquete de análisis mensual · Cálculos (SOLO servidor)
// Toma MesData y produce todos los agregados. Documentado para auditar cada KPI.
// ─────────────────────────────────────────────────────────────────────────────
import type { MesData, Row } from './queries'
import { SUCS, normTel } from './queries'

/* eslint-disable @typescript-eslint/no-explicit-any */
const TZ = 'America/Tijuana'
const num = (x: any) => parseFloat(x) || 0
const up = (x: any) => String(x ?? '').trim().toUpperCase() || '—'

const diaLocal = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ })
const horaLocal = (iso: string): number => {
  const h = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: '2-digit', hour12: false }).format(new Date(iso))
  return parseInt(h, 10) % 24
}
const diasEntre = (a: string, b: string): number | null => {
  if (!a || !b) return null
  const d = (new Date(b).getTime() - new Date(a).getTime()) / 86400000
  return Number.isFinite(d) ? Math.round(d) : null
}

// Categorías que NO son gasto operativo (retiro del dueño)
const CAT_RETIRO = ['retiro_admin']

export type Metrics = ReturnType<typeof computeMetrics>

export function computeMetrics(d: MesData) {
  // ── Clasificación de ventas ──
  const ventasReales = d.ventas.filter(v => v.estado !== 'cancelada' && !v.es_cotizacion)
  const canceladas   = d.ventas.filter(v => v.estado === 'cancelada')
  const cotizaciones = d.ventas.filter(v => v.es_cotizacion)
  const ventaIdSet   = new Set(d.ventas.map(v => v.id))

  // ── FACTURADO ──
  const facturado = ventasReales.reduce((s, v) => s + num(v.total), 0)
  const saldoPendiente = ventasReales.reduce((s, v) => s + num(v.saldo), 0)

  // ── COBRADO (pagos_venta + ingresos_caja pago_previo) ──
  const pagoPrevios = d.ingresosCaja.filter(i => i.cuenta_finanzas === true)
  const cobradoPagos = d.pagos.reduce((s, p) => s + num(p.monto), 0)
  const cobradoPrevioCaja = pagoPrevios.reduce((s, i) => s + num(i.monto), 0)
  const cobrado = cobradoPagos + cobradoPrevioCaja
  // Cobros que corresponden a ventas de meses anteriores (su venta no se creó este mes)
  const cobradoAnteriores =
    d.pagos.filter(p => p.venta_id && !ventaIdSet.has(p.venta_id)).reduce((s, p) => s + num(p.monto), 0)
    + cobradoPrevioCaja

  // ── Costo de laboratorio y garantías (pagado en el mes) ──
  const labPagadas = d.ordenes.filter(o => o.pagado_lab && num(o.costo_lab) > 0
    && o.fecha_pago_lab >= d.fechaIni && o.fecha_pago_lab <= d.fechaFin)
  const costoLab  = labPagadas.filter(o => !o.es_garantia).reduce((s, o) => s + num(o.costo_lab), 0)
  const garantias = labPagadas.filter(o =>  o.es_garantia).reduce((s, o) => s + num(o.costo_lab), 0)

  // ── Egresos ──
  const gastosEmpresa    = d.gastos.filter(g => g.es_caja !== true)          // finanzas: solo empresa
  const gastosOperativos = gastosEmpresa.filter(g => !CAT_RETIRO.includes(g.categoria))
  const retirosAdmin     = gastosEmpresa.filter(g =>  CAT_RETIRO.includes(g.categoria))
  const totalGastosOp    = gastosOperativos.reduce((s, g) => s + num(g.monto), 0)
  const totalRetiros     = retirosAdmin.reduce((s, g) => s + num(g.monto), 0)

  // ── Utilidad ──
  const utilidadBruta = cobrado - costoLab - garantias
  const utilidadNeta  = utilidadBruta - totalGastosOp
  const flujoNeto     = utilidadNeta - totalRetiros

  // ── Por sucursal ──
  const cobradoSuc: Record<string, number> = {}
  for (const p of d.pagos) cobradoSuc[p.sucursal || '—'] = (cobradoSuc[p.sucursal || '—'] || 0) + num(p.monto)
  for (const i of pagoPrevios) cobradoSuc[i.sucursal || '—'] = (cobradoSuc[i.sucursal || '—'] || 0) + num(i.monto)
  const labSuc: Record<string, number> = {}
  const garSuc: Record<string, number> = {}
  for (const o of labPagadas) {
    const t = o.es_garantia ? garSuc : labSuc
    t[o.sucursal || '—'] = (t[o.sucursal || '—'] || 0) + num(o.costo_lab)
  }
  const overheadTotal = gastosOperativos.filter(g => !SUCS.includes(g.sucursal)).reduce((s, g) => s + num(g.monto), 0)
  const cobradoSuc3 = SUCS.reduce((s, x) => s + (cobradoSuc[x] || 0), 0)
  const metaMes = (suc: string) => {
    const mm = `${d.anio}-${String(d.mes0 + 1).padStart(2, '0')}`
    const m = d.metas.find(x => x.sucursal === suc && String(x.mes).startsWith(mm))
    return m ? num(m.meta) : 0
  }
  const porSucursal = SUCS.map(s => {
    const ing = cobradoSuc[s] || 0
    const lab = labSuc[s] || 0
    const gar = garSuc[s] || 0
    const directos = gastosOperativos.filter(g => g.sucursal === s).reduce((a, g) => a + num(g.monto), 0)
    const ovIgual = overheadTotal / 3
    const ovProp  = cobradoSuc3 > 0 ? overheadTotal * (ing / cobradoSuc3) : overheadTotal / 3
    const facturadoSuc = ventasReales.filter(v => v.sucursal === s).reduce((a, v) => a + num(v.total), 0)
    return {
      sucursal: s, facturado: facturadoSuc, cobrado: ing, costoLab: lab, garantias: gar, directos,
      overheadIgual: ovIgual, overheadProp: ovProp,
      utilIgual: ing - lab - gar - directos - ovIgual,
      utilProp:  ing - lab - gar - directos - ovProp,
      meta: metaMes(s),
    }
  })

  // ── Cobrado por método ──
  const porMetodo: Record<string, number> = {}
  for (const p of d.pagos) porMetodo[p.metodo_pago || 'otros'] = (porMetodo[p.metodo_pago || 'otros'] || 0) + num(p.monto)
  for (const i of pagoPrevios) porMetodo[i.metodo_pago || 'efectivo'] = (porMetodo[i.metodo_pago || 'efectivo'] || 0) + num(i.monto)

  // ── Piezas e items por venta ──
  const itemsPorVenta: Record<string, Row[]> = {}
  for (const it of d.ventasItems) (itemsPorVenta[it.venta_id] ||= []).push(it)
  const piezasVenta = (vid: string) => (itemsPorVenta[vid] || []).reduce((s, it) => s + num(it.cantidad), 0)
  const descuentoVenta = (vid: string) =>
    (itemsPorVenta[vid] || []).reduce((s, it) => s + num(it.precio_unitario) * num(it.cantidad) * (num(it.descuento) / 100), 0)

  // ── Productividad por empleada ──
  const horasEmp: Record<string, number> = {}
  for (const a of d.asistencias) {
    if (!a.entrada || !a.salida) continue
    const h = (new Date(a.salida).getTime() - new Date(a.entrada).getTime()) / 3600000
    if (h > 0 && h < 24) horasEmp[a.usuario_nombre || '—'] = (horasEmp[a.usuario_nombre || '—'] || 0) + h
  }
  const empMap: Record<string, any> = {}
  for (const v of ventasReales) {
    const k = v.atendido_por || '—'
    const e = (empMap[k] ||= { nombre: k, ventas: 0, piezas: 0, importe: 0, descuento: 0 })
    e.ventas += 1; e.piezas += piezasVenta(v.id); e.importe += num(v.total); e.descuento += descuentoVenta(v.id)
  }
  const productividad = Object.values(empMap).map((e: any) => ({
    ...e, ticket: e.ventas ? e.importe / e.ventas : 0,
    horas: Math.round((horasEmp[e.nombre] || 0) * 10) / 10,
    ventasPorHora: horasEmp[e.nombre] ? e.ventas / horasEmp[e.nombre] : 0,
  })).sort((a, b) => b.importe - a.importe)

  // ── Conversión (aprox. por teléfono) ──
  const ventasPhones = new Set(ventasReales.map(v => normTel(v.paciente_telefono)).filter(Boolean))
  const citasAtendidas = d.citas.filter(c => ['atendida', 'completada', 'realizada'].includes(String(c.estado).toLowerCase()))
  const noShows = d.citas.filter(c => ['no_asistio', 'no_show', 'no asistió', 'noshow'].includes(String(c.estado).toLowerCase()))
  const citasConv = d.citas.filter(c => ventasPhones.has(normTel(c.paciente_telefono))).length
  const examConv = d.consultas.filter(c => ventasPhones.has(d.consultasTel[c.paciente_id] || '')).length
  const conversion = {
    examenes: d.consultas.length,
    citas: d.citas.length,
    citasAtendidas: citasAtendidas.length,
    noShows: noShows.length,
    ventas: ventasReales.length,
    examConvertidos: examConv,
    citasConvertidas: citasConv,
    tasaExamen: d.consultas.length ? examConv / d.consultas.length : 0,
    tasaCita: d.citas.length ? citasConv / d.citas.length : 0,
  }

  // ── Tipos de lente / tratamiento / laboratorio (trabajos ingresados en el mes) ──
  const trabajosMes = d.ordenes.filter(o => o.fecha_ingreso >= d.fechaIni && o.fecha_ingreso <= d.fechaFin)
  const grupo = (rows: Row[], key: (o: Row) => string) => {
    const m: Record<string, any> = {}
    for (const o of rows) {
      const k = key(o)
      const g = (m[k] ||= { clave: k, piezas: 0, ingreso: 0, costo: 0 })
      g.piezas += 1; g.ingreso += num(o.precio_cliente); g.costo += num(o.costo_lab)
    }
    return Object.values(m).map((g: any) => ({ ...g, margen: g.ingreso - g.costo,
      margenPct: g.ingreso ? (g.ingreso - g.costo) / g.ingreso : 0 })).sort((a, b) => b.margen - a.margen)
  }
  const porTipoLente   = grupo(trabajosMes, o => up(o.tipo_mica))
  const porTratamiento = grupo(trabajosMes, o => up(o.tratamiento))

  const labsMap: Record<string, any> = {}
  for (const o of trabajosMes) {
    const k = up(o.laboratorio)
    const g = (labsMap[k] ||= { lab: k, piezas: 0, costo: 0, ingreso: 0, dias: [] as number[], retrasos: 0, urgentes: 0, garantias: 0 })
    g.piezas += 1; g.costo += num(o.costo_lab); g.ingreso += num(o.precio_cliente)
    if (o.urgente) g.urgentes += 1
    if (o.es_garantia) g.garantias += 1
    const dd = diasEntre(o.fecha_ingreso, o.fecha_entrega)
    if (dd !== null) g.dias.push(dd)
    if (o.fecha_entrega && o.fecha_promesa && o.fecha_entrega > o.fecha_promesa) g.retrasos += 1
  }
  const laboratorios = Object.values(labsMap).map((g: any) => ({
    lab: g.lab, piezas: g.piezas, costo: g.costo, ingreso: g.ingreso, margen: g.ingreso - g.costo,
    costoProm: g.piezas ? g.costo / g.piezas : 0,
    diasProm: g.dias.length ? g.dias.reduce((a: number, b: number) => a + b, 0) / g.dias.length : null,
    pctRetraso: g.piezas ? g.retrasos / g.piezas : 0, urgentes: g.urgentes, garantias: g.garantias,
  })).sort((a, b) => b.piezas - a.piezas)

  // ── Garantías detalle ──
  const garantiasDet = d.ordenes.filter(o => o.es_garantia).map(o => ({
    folio: o.folio, folioOrigen: o.folio_origen, sucursal: o.sucursal, laboratorio: o.laboratorio,
    tipoMica: o.tipo_mica, motivo: o.motivo_problema, costo: num(o.costo_lab), paciente: o.paciente,
    fechaIngreso: o.fecha_ingreso,
  }))

  // ── Nómina / comisiones / bonos (desde gastos, aprox.) ──
  const catNomina = ['nomina', 'bonos_comisiones', 'bono_diario', 'comisiones', 'adelanto']
  const nomina = catNomina.map(cat => ({
    categoria: cat,
    pagadoEmpresa: gastosEmpresa.filter(g => g.categoria === cat).reduce((s, g) => s + num(g.monto), 0),
    pagadoCaja: d.gastos.filter(g => g.es_caja === true && g.categoria === cat).reduce((s, g) => s + num(g.monto), 0),
  })).filter(x => x.pagadoEmpresa || x.pagadoCaja)
  const comisionTerminal = gastosEmpresa.filter(g => g.categoria === 'comision_terminal').reduce((s, g) => s + num(g.monto), 0)

  // ── Caja: diferencias y retiros ──
  const cajaResumen = SUCS.map(s => {
    const rows = d.cortes.filter(c => c.sucursal === s)
    return {
      sucursal: s, cortes: rows.length,
      difTotal: rows.reduce((a, c) => a + num(c.diferencia), 0),
      retiroTotal: rows.reduce((a, c) => a + num(c.entrega), 0),
      descuadres: rows.filter(c => Math.abs(num(c.diferencia)) > 0.5).length,
    }
  })

  // ── Inventario ──
  const stockTotal = (r: Row) => ['stock_baja', 'stock_mayo', 'stock_plaza']
    .reduce((s, c) => s + num(r[c]), 0) || num(r.stock)
  const consumibles = d.productos.filter(p => (p.tipo === 'consumible' || p.costo != null))
  const invConsumibles = consumibles.reduce((s, p) => s + stockTotal(p) * num(p.costo), 0)
  const invArmazones = d.armazones.reduce((s, a) => s + stockTotal(a) * num(a.costo), 0)
  const armazonesRent = d.armazones.map(a => ({
    sku: a.sku, marca: a.marca, modelo: a.modelo, precio: num(a.precio_gon ?? a.precio), costo: num(a.costo),
    stock: stockTotal(a), margen: num(a.precio_gon ?? a.precio) - num(a.costo),
  })).sort((x, y) => y.margen - x.margen)

  // ── Tendencias día / horario ──
  const dias = new Date(d.anio, d.mes0 + 1, 0).getDate()
  const porDia = Array.from({ length: dias }, (_, i) => {
    const fecha = `${d.anio}-${String(d.mes0 + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
    const fac = ventasReales.filter(v => diaLocal(v.created_at) === fecha)
    const cob = d.pagos.filter(p => diaLocal(p.created_at) === fecha).reduce((s, p) => s + num(p.monto), 0)
    return {
      fecha, dow: new Date(`${fecha}T12:00:00`).toLocaleDateString('es-MX', { weekday: 'long' }),
      ventas: fac.length, facturado: fac.reduce((s, v) => s + num(v.total), 0), cobrado: cob,
    }
  })
  const porHora = Array.from({ length: 24 }, (_, h) => {
    const cob = d.pagos.filter(p => horaLocal(p.created_at) === h).reduce((s, p) => s + num(p.monto), 0)
    const ven = ventasReales.filter(v => horaLocal(v.created_at) === h).length
    return { hora: h, ventas: ven, cobrado: cob }
  })

  // ── Calidad e integridad ──
  const catConocidas = new Set(['renta', 'nomina', 'bonos_comisiones', 'proveedores', 'servicios', 'mantenimiento',
    'marketing', 'papeleria', 'limpieza', 'otros', 'comision_terminal', 'bono_diario', 'adelanto', 'comisiones',
    'compras', 'retiro_admin'])
  const diasSinCorte: string[] = []
  for (const s of SUCS) {
    const dset = new Set(d.cortes.filter(c => c.sucursal === s).map(c => c.fecha))
    for (let i = 1; i <= dias; i++) {
      const f = `${d.anio}-${String(d.mes0 + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      if (f <= d.fechaFin && !dset.has(f)) diasSinCorte.push(`${s} · ${f}`)
    }
  }
  const calidad = {
    ventasSinAtendio: ventasReales.filter(v => !v.atendido_por).length,
    gastosSinCategoria: d.gastos.filter(g => !g.categoria || !catConocidas.has(g.categoria)).length,
    saldosNegativos: ventasReales.filter(v => num(v.saldo) < 0).length,
    pagosHuerfanos: d.pagos.filter(p => !p.venta_id).length,
    ordenesSinCosto: trabajosMes.filter(o => num(o.costo_lab) <= 0).length,
    garantiasSinMotivo: d.ordenes.filter(o => o.es_garantia && !o.motivo_problema).length,
    descuadresCaja: d.cortes.filter(c => Math.abs(num(c.diferencia)) > 0.5).length,
    diasSinCorte: diasSinCorte.length,
    diasSinCorteLista: diasSinCorte,
    cotizacionesAbiertas: cotizaciones.length,
    canceladas: canceladas.length,
    canceladasMonto: canceladas.reduce((s, v) => s + num(v.total), 0),
    fuentesConError: d.errores,
  }

  return {
    ventasReales, canceladas, cotizaciones,
    facturado, cobrado, cobradoAnteriores, saldoPendiente,
    costoLab, garantias, totalGastosOp, totalRetiros, comisionTerminal,
    utilidadBruta, utilidadNeta, flujoNeto, margenNeto: cobrado ? utilidadNeta / cobrado : 0,
    porSucursal, porMetodo, productividad, conversion,
    porTipoLente, porTratamiento, laboratorios, garantiasDet, nomina, cajaResumen,
    invConsumibles, invArmazones, armazonesRent, porDia, porHora, calidad,
    itemsPorVenta, piezasVenta, descuentoVenta,
  }
}
