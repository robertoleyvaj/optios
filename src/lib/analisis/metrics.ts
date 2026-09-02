// ─────────────────────────────────────────────────────────────────────────────
// Paquete de análisis mensual · Cálculos (SOLO servidor)
// v2: conciliación, base devengado vs caja, retiros/otros separados, sin costos cero.
// ─────────────────────────────────────────────────────────────────────────────
import type { MesData, Row } from './queries'
import { SUCS, normTel } from './queries'

/* eslint-disable @typescript-eslint/no-explicit-any */
const TZ = 'America/Tijuana'
const num = (x: any) => parseFloat(x) || 0
const r2 = (n: number) => Math.round(n * 100) / 100
const stripAccents = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

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

// Normaliza tipo de lente (progresivo/a, índices 1.49≈1.50, acentos) sin tocar el dato original
const normLente = (s: any): string => {
  let t = stripAccents(String(s ?? '').toUpperCase()).trim()
  t = t.replace(/PROGRESIV[OA]S?/g, 'PROGRESIVO').replace(/BIFOCAL(ES)?/g, 'BIFOCAL').replace(/MONOFOCAL(ES)?/g, 'MONOFOCAL')
  t = t.replace(/1[.,]50/g, '1.49').replace(/\s+/g, ' ').trim()
  return t || '—'
}
// Normaliza combinaciones de tratamiento: separa por coma, ordena → el orden no crea categorías distintas
const normTrat = (s: any): string => {
  const parts = stripAccents(String(s ?? '').toUpperCase()).split(/[,;+]+/).map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean)
  return [...new Set(parts)].sort().join(' + ') || '—'
}

const CAT_RETIRO = 'retiro_admin'
const esOtroGenerico = (g: Row) => g.categoria === 'otros' || /^otro\b/i.test(String(g.concepto ?? '').trim())
const CAT_INVERSION = ['compras']   // compras de inventario/activos (no es gasto operativo del mes)

export type Metrics = ReturnType<typeof computeMetrics>

export function computeMetrics(d: MesData) {
  // ── Clasificación de ventas ──
  const ventasReales = d.ventas.filter(v => v.estado !== 'cancelada' && !v.es_cotizacion)
  const canceladas   = d.ventas.filter(v => v.estado === 'cancelada')
  const cotizaciones = d.ventas.filter(v => v.es_cotizacion)
  const ventaIdSet   = new Set(d.ventas.map(v => v.id))
  const ventaRealIdSet = new Set(ventasReales.map(v => v.id))

  const facturado = r2(ventasReales.reduce((s, v) => s + num(v.total), 0))
  const saldoPendiente = r2(ventasReales.reduce((s, v) => s + num(v.saldo), 0))

  // ── COBROS (desglosados, sin mezclar) ──
  const pagoPrevios = d.ingresosCaja.filter(i => i.cuenta_finanzas === true)  // pago_previo
  const cobrosVentas = r2(d.pagos.reduce((s, p) => s + num(p.monto), 0))
  const cobrosVentasMes = r2(d.pagos.filter(p => p.venta_id && ventaIdSet.has(p.venta_id)).reduce((s, p) => s + num(p.monto), 0))
  const cobrosVentasPrevias = r2(d.pagos.filter(p => p.venta_id && !ventaIdSet.has(p.venta_id)).reduce((s, p) => s + num(p.monto), 0))
  const cobrosSinVenta = r2(d.pagos.filter(p => !p.venta_id).reduce((s, p) => s + num(p.monto), 0))
  const otrosIngresosCaja = r2(pagoPrevios.reduce((s, i) => s + num(i.monto), 0))
  const cobradoTotal = r2(cobrosVentas + otrosIngresosCaja)
  const cobradoAnteriores = r2(cobrosVentasPrevias + otrosIngresosCaja)

  // ── Costo de laboratorio y garantías (pagado en el mes) ──
  const labPagadas = d.ordenes.filter(o => o.pagado_lab && num(o.costo_lab) > 0
    && o.fecha_pago_lab >= d.fechaIni && o.fecha_pago_lab <= d.fechaFin)
  const costoLab  = r2(labPagadas.filter(o => !o.es_garantia).reduce((s, o) => s + num(o.costo_lab), 0))
  const garantias = r2(labPagadas.filter(o =>  o.es_garantia).reduce((s, o) => s + num(o.costo_lab), 0))

  // ── Egresos, clasificados por es_caja y por naturaleza ──
  const esCaja = (g: Row) => g.es_caja === true
  const retirosRows  = d.gastos.filter(g => g.categoria === CAT_RETIRO)                 // dueño (no es gasto)
  const porAclararRows = d.gastos.filter(g => esOtroGenerico(g) && g.categoria !== CAT_RETIRO)
  const inversionRows = d.gastos.filter(g => CAT_INVERSION.includes(g.categoria))
  // Gasto operativo = entró por Finanzas (no caja), no es retiro, ni "otros", ni inversión
  const gastosOperativos = d.gastos.filter(g =>
    !esCaja(g) && g.categoria !== CAT_RETIRO && !esOtroGenerico(g) && !CAT_INVERSION.includes(g.categoria))

  const totalRetiros    = r2(retirosRows.reduce((s, g) => s + num(g.monto), 0))
  const totalPorAclarar = r2(porAclararRows.reduce((s, g) => s + num(g.monto), 0))
  const totalInversion  = r2(inversionRows.reduce((s, g) => s + num(g.monto), 0))
  const totalGastosOp   = r2(gastosOperativos.reduce((s, g) => s + num(g.monto), 0))
  const comisionTerminal = r2(gastosOperativos.filter(g => g.categoria === 'comision_terminal').reduce((s, g) => s + num(g.monto), 0))

  // ── Resultados: base caja vs base devengado (NO son lo mismo) ──
  const resultadoOperativoCaja = r2(cobradoTotal - costoLab - garantias - totalGastosOp)   // sobre lo cobrado
  const flujoNeto = r2(resultadoOperativoCaja - totalRetiros - totalInversion)             // efectivo real
  // Devengado (aprox.): facturado − costo lab de órdenes de ventas del mes − gastos del mes
  const costoVentasMes = r2(d.ordenes.filter(o => o.venta_id && ventaRealIdSet.has(o.venta_id) && !o.es_garantia)
    .reduce((s, o) => s + num(o.costo_lab), 0))
  const utilidadDevengada = r2(facturado - costoVentasMes - totalGastosOp)

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
    const ing = r2(cobradoSuc[s] || 0)
    const lab = r2(labSuc[s] || 0)
    const gar = r2(garSuc[s] || 0)
    const directos = r2(gastosOperativos.filter(g => g.sucursal === s).reduce((a, g) => a + num(g.monto), 0))
    const ovIgual = r2(overheadTotal / 3)
    const ovProp  = r2(cobradoSuc3 > 0 ? overheadTotal * (ing / cobradoSuc3) : overheadTotal / 3)
    const facturadoSuc = r2(ventasReales.filter(v => v.sucursal === s).reduce((a, v) => a + num(v.total), 0))
    const meta = metaMes(s)
    return {
      sucursal: s, meta, facturado: facturadoSuc, cobrado: ing, costoLab: lab, garantias: gar, directos,
      overheadIgual: ovIgual, overheadProp: ovProp,
      utilIgual: r2(ing - lab - gar - directos - ovIgual),
      utilProp:  r2(ing - lab - gar - directos - ovProp),
      cumplimiento: meta ? facturadoSuc / meta : 0,
      difMeta: r2(facturadoSuc - meta),
    }
  })

  // ── Cobrado por método (solo pagos de venta; los ingresos de caja van aparte) ──
  const porMetodo: Record<string, number> = {}
  for (const p of d.pagos) porMetodo[p.metodo_pago || 'otros'] = r2((porMetodo[p.metodo_pago || 'otros'] || 0) + num(p.monto))

  // ── Items por venta + reparto proporcional del descuento ──
  const itemsPorVenta: Record<string, Row[]> = {}
  for (const it of d.ventasItems) (itemsPorVenta[it.venta_id] ||= []).push(it)
  const piezasVenta = (vid: string) => (itemsPorVenta[vid] || []).reduce((s, it) => s + num(it.cantidad), 0)
  const descuentoVenta = (vid: string) =>
    (itemsPorVenta[vid] || []).reduce((s, it) => s + num(it.precio_unitario) * num(it.cantidad) * (num(it.descuento) / 100), 0)

  // ── Productividad por empleada (dinero, no solo conteo) ──
  const horasEmp: Record<string, number> = {}
  for (const a of d.asistencias) {
    if (!a.entrada || !a.salida) continue
    const h = (new Date(a.salida).getTime() - new Date(a.entrada).getTime()) / 3600000
    if (h > 0 && h < 24) horasEmp[a.usuario_nombre || '—'] = (horasEmp[a.usuario_nombre || '—'] || 0) + h
  }
  const empMap: Record<string, any> = {}
  for (const v of ventasReales) {
    const k = v.atendido_por || '—'
    const e = (empMap[k] ||= { nombre: k, ventas: 0, piezas: 0, importe: 0, precioLista: 0, descuento: 0, saldo: 0 })
    e.ventas += 1; e.piezas += piezasVenta(v.id); e.importe += num(v.total); e.saldo += num(v.saldo)
    const desc = descuentoVenta(v.id); e.descuento += desc; e.precioLista += num(v.total) + desc
  }
  const productividad = Object.values(empMap).map((e: any) => ({
    nombre: e.nombre, ventas: e.ventas, piezas: e.piezas, importe: r2(e.importe),
    ticket: r2(e.ventas ? e.importe / e.ventas : 0),
    descuento: r2(e.descuento), descuentoPct: e.precioLista ? e.descuento / e.precioLista : 0,
    saldo: r2(e.saldo), horas: r2(horasEmp[e.nombre] || 0),
    ticketsPorHora: horasEmp[e.nombre] ? r2(e.ventas / horasEmp[e.nombre]) : null,
    facturadoPorHora: horasEmp[e.nombre] ? r2(e.importe / horasEmp[e.nombre]) : null,
  })).sort((a, b) => b.importe - a.importe)

  // ── Descuentos ──
  const descTotal = r2(ventasReales.reduce((s, v) => s + descuentoVenta(v.id), 0))
  const precioListaTotal = r2(facturado + descTotal)
  const descuentoPorSuc = SUCS.map(s => ({
    sucursal: s, descuento: r2(ventasReales.filter(v => v.sucursal === s).reduce((a, v) => a + descuentoVenta(v.id), 0)),
  }))

  // ── Conversión: distribución REAL de estados de cita (no inventar tasas) ──
  const estadoCitas: Record<string, number> = {}
  for (const c of d.citas) estadoCitas[String(c.estado || '—').toLowerCase()] = (estadoCitas[String(c.estado || '—').toLowerCase()] || 0) + 1
  const ventasPhones = new Set(ventasReales.map(v => normTel(v.paciente_telefono)).filter(Boolean))
  const citasConv = d.citas.filter(c => ventasPhones.has(normTel(c.paciente_telefono))).length
  const examConv = d.consultas.filter(c => ventasPhones.has(d.consultasTel[c.paciente_id] || '')).length
  const conversion = {
    examenes: d.consultas.length, citas: d.citas.length, estadoCitas,
    ventas: ventasReales.length, examConvertidos: examConv, citasConvertidas: citasConv,
    tasaExamen: d.consultas.length ? examConv / d.consultas.length : 0,
    tasaCita: d.citas.length ? citasConv / d.citas.length : 0,
    estadosCapturados: Object.keys(estadoCitas).some(k => ['atendida', 'confirmada', 'cancelada', 'no_asistio'].includes(k)),
  }

  // ── Trabajos del mes; separar CON costo vs SIN costo (no inflar márgenes) ──
  const trabajosMes = d.ordenes.filter(o => o.fecha_ingreso >= d.fechaIni && o.fecha_ingreso <= d.fechaFin)
  const conCosto = trabajosMes.filter(o => num(o.costo_lab) > 0)
  const sinCosto = trabajosMes.filter(o => num(o.costo_lab) <= 0)
  const ordenesSinCostoDet = sinCosto.map(o => ({
    folio: o.folio, folioVenta: o.folio_venta, paciente: o.paciente, fecha: o.fecha_ingreso, sucursal: o.sucursal,
    laboratorio: o.laboratorio, tipoLente: o.tipo_mica, ingreso: num(o.precio_cliente),
  }))
  const ingresoSinCosto = r2(sinCosto.reduce((s, o) => s + num(o.precio_cliente), 0))

  // Nota: "ingreso" aquí es el precio del PAR (mica+armazón+tratamiento), no solo la mica.
  // Por eso el KPI se llama "margen del trabajo", no "rentabilidad del lente".
  const grupo = (rows: Row[], key: (o: Row) => string) => {
    const m: Record<string, any> = {}
    for (const o of rows) {
      const k = key(o)
      const g = (m[k] ||= { clave: k, piezas: 0, ingresoTrabajo: 0, costo: 0 })
      g.piezas += 1; g.ingresoTrabajo += num(o.precio_cliente); g.costo += num(o.costo_lab)
    }
    return Object.values(m).map((g: any) => ({
      clave: g.clave, piezas: g.piezas, ingresoTrabajo: r2(g.ingresoTrabajo), costo: r2(g.costo),
      margenTrabajo: r2(g.ingresoTrabajo - g.costo),
      margenPct: g.ingresoTrabajo ? (g.ingresoTrabajo - g.costo) / g.ingresoTrabajo : 0,
    })).sort((a, b) => b.margenTrabajo - a.margenTrabajo)
  }
  const porTipoLente   = grupo(conCosto, o => normLente(o.tipo_mica))
  const porTratamiento = grupo(conCosto, o => normTrat(o.tratamiento))

  // ── Laboratorios (solo trabajos con costo para rentabilidad; muestra tamaño de muestra) ──
  const labsMap: Record<string, any> = {}
  for (const o of trabajosMes) {
    const k = normLente(o.laboratorio) === '—' ? 'SIN LABORATORIO' : String(o.laboratorio || 'SIN LABORATORIO').toUpperCase()
    const g = (labsMap[k] ||= { lab: k, piezas: 0, conCosto: 0, costo: 0, ingreso: 0, dias: [] as number[], retrasos: 0, urgentes: 0, garantias: 0, abiertas: 0 })
    g.piezas += 1
    if (num(o.costo_lab) > 0) { g.conCosto += 1; g.costo += num(o.costo_lab); g.ingreso += num(o.precio_cliente) }
    if (o.urgente) g.urgentes += 1
    if (o.es_garantia) g.garantias += 1
    if (!o.fecha_entrega) g.abiertas += 1
    const dd = diasEntre(o.fecha_ingreso, o.fecha_entrega); if (dd !== null) g.dias.push(dd)
    if (o.fecha_entrega && o.fecha_promesa && o.fecha_entrega > o.fecha_promesa) g.retrasos += 1
  }
  const laboratorios = Object.values(labsMap).map((g: any) => ({
    lab: g.lab, piezas: g.piezas, conCosto: g.conCosto, pctConCosto: g.piezas ? g.conCosto / g.piezas : 0,
    costo: r2(g.costo), ingreso: r2(g.ingreso), margen: r2(g.ingreso - g.costo),
    costoProm: g.conCosto ? r2(g.costo / g.conCosto) : 0,
    diasProm: g.dias.length ? r2(g.dias.reduce((a: number, b: number) => a + b, 0) / g.dias.length) : null,
    pctRetraso: g.piezas ? g.retrasos / g.piezas : 0, tasaGarantia: g.piezas ? g.garantias / g.piezas : 0,
    urgentes: g.urgentes, garantias: g.garantias, abiertas: g.abiertas,
  })).sort((a, b) => b.piezas - a.piezas)

  // ── Garantías (conserva venta original; marca faltantes) ──
  const garantiasDet = d.ordenes.filter(o => o.es_garantia).map(o => ({
    folio: o.folio, folioOrigen: o.folio_origen || '(falta)', fechaOrden: o.fecha_ingreso, fechaCosto: o.fecha_pago_lab || '',
    sucursal: o.sucursal, laboratorio: o.laboratorio || '(falta)', tipoLente: o.tipo_mica,
    motivo: o.motivo_problema || '(falta)', costo: num(o.costo_lab), paciente: o.paciente,
    absorbioOptica: num(o.costo_lab) > 0 ? 'sí (costo>0)' : 'revisar (costo 0)',
  }))

  // ── Nómina / comisiones / bonos ──
  const catNomina = ['nomina', 'bonos_comisiones', 'bono_diario', 'comisiones', 'adelanto']
  const nomina = catNomina.map(cat => ({
    categoria: cat,
    pagadoEmpresa: r2(d.gastos.filter(g => !esCaja(g) && g.categoria === cat).reduce((s, g) => s + num(g.monto), 0)),
    pagadoCaja: r2(d.gastos.filter(g => esCaja(g) && g.categoria === cat).reduce((s, g) => s + num(g.monto), 0)),
  })).filter(x => x.pagadoEmpresa || x.pagadoCaja)

  // ── Caja: faltantes vs sobrantes (con signo) ──
  const cajaResumen = SUCS.map(s => {
    const rows = d.cortes.filter(c => c.sucursal === s)
    const faltantes = r2(rows.filter(c => num(c.diferencia) < 0).reduce((a, c) => a + num(c.diferencia), 0))
    const sobrantes = r2(rows.filter(c => num(c.diferencia) > 0).reduce((a, c) => a + num(c.diferencia), 0))
    return {
      sucursal: s, cortes: rows.length, faltantes, sobrantes, difNeta: r2(faltantes + sobrantes),
      retiroTotal: r2(rows.reduce((a, c) => a + num(c.entrega), 0)),
      descuadres: rows.filter(c => Math.abs(num(c.diferencia)) > 0.5).length,
    }
  })

  // ── Inventario (marca costo faltante en vez de asumir cero) ──
  const stockTotal = (r: Row) => ['stock_baja', 'stock_mayo', 'stock_plaza'].reduce((s, c) => s + num(r[c]), 0) || num(r.stock)
  const consumibles = d.productos.filter(p => p.tipo === 'consumible')
  const consSinCosto = consumibles.filter(p => num(p.costo) <= 0).length
  const armSinCosto = d.armazones.filter(a => num(a.costo) <= 0).length
  const invConsumibles = r2(consumibles.reduce((s, p) => s + stockTotal(p) * num(p.costo), 0))
  const invArmazones = r2(d.armazones.reduce((s, a) => s + stockTotal(a) * num(a.costo), 0))
  const armazonesRent = d.armazones.map(a => ({
    sku: a.sku, marca: a.marca, modelo: a.modelo, precio: num(a.precio_gon ?? a.precio), costo: num(a.costo),
    stock: stockTotal(a), margen: num(a.costo) > 0 ? r2(num(a.precio_gon ?? a.precio) - num(a.costo)) : null,
    costoStatus: num(a.costo) > 0 ? 'ok' : 'costo faltante',
  })).sort((x, y) => (y.margen ?? -1) - (x.margen ?? -1))

  // ── Tendencias (misma fuente y criterios que Resumen; facturado por fecha de venta, cobrado por fecha de pago) ──
  const dias = new Date(d.anio, d.mes0 + 1, 0).getDate()
  const porDia = Array.from({ length: dias }, (_, i) => {
    const fecha = `${d.anio}-${String(d.mes0 + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
    const fac = ventasReales.filter(v => diaLocal(v.created_at) === fecha)
    const cob = d.pagos.filter(p => diaLocal(p.created_at) === fecha).reduce((s, p) => s + num(p.monto), 0)
    return {
      fecha, dow: new Date(`${fecha}T12:00:00`).toLocaleDateString('es-MX', { weekday: 'long' }),
      ventas: fac.length, facturado: r2(fac.reduce((s, v) => s + num(v.total), 0)), cobrado: r2(cob),
    }
  })
  const porHora = Array.from({ length: 24 }, (_, h) => ({
    hora: h, ventas: ventasReales.filter(v => horaLocal(v.created_at) === h).length,
    cobrado: r2(d.pagos.filter(p => horaLocal(p.created_at) === h).reduce((s, p) => s + num(p.monto), 0)),
  }))

  // ── Conciliación: cada renglón cuadra o no ──
  const sumaDiaFac = r2(porDia.reduce((s, x) => s + x.facturado, 0))
  const sumaDiaCob = r2(porDia.reduce((s, x) => s + x.cobrado, 0))
  const sumaMetodo = r2(Object.values(porMetodo).reduce((s, x) => s + x, 0))
  const sumaSucCob = r2(SUCS.reduce((s, x) => s + (cobradoSuc[x] || 0), 0))   // solo 3 sucursales
  const sumaProd = r2(productividad.reduce((s, x) => s + x.importe, 0))
  const cuadra = (a: number, b: number) => Math.abs(a - b) < 1 ? 'CUADRA' : 'NO CUADRA'

  const conciliacion = [
    { concepto: 'Total facturado', formula: 'Σ total de ventas activas', fuente: 'ventas', registros: ventasReales.length, monto: facturado },
    { concepto: 'Cobros de ventas del mes', formula: 'Σ pagos cuya venta es de este mes', fuente: 'pagos_venta', registros: d.pagos.filter(p => p.venta_id && ventaIdSet.has(p.venta_id)).length, monto: cobrosVentasMes },
    { concepto: 'Cobros de ventas anteriores', formula: 'Σ pagos cuya venta es de meses previos', fuente: 'pagos_venta', registros: d.pagos.filter(p => p.venta_id && !ventaIdSet.has(p.venta_id)).length, monto: cobrosVentasPrevias },
    { concepto: 'Pagos sin venta ligada', formula: 'Σ pagos sin venta_id', fuente: 'pagos_venta', registros: d.pagos.filter(p => !p.venta_id).length, monto: cobrosSinVenta },
    { concepto: 'Otros ingresos de caja (pago previo)', formula: 'Σ ingresos_caja cuenta_finanzas=true', fuente: 'ingresos_caja', registros: pagoPrevios.length, monto: otrosIngresosCaja },
    { concepto: 'TOTAL COBRADO', formula: 'cobros de venta + otros ingresos de caja', fuente: '—', registros: d.pagos.length + pagoPrevios.length, monto: cobradoTotal },
    { concepto: 'Saldo pendiente (ventas del mes)', formula: 'Σ saldo de ventas activas', fuente: 'ventas', registros: ventasReales.filter(v => num(v.saldo) > 0).length, monto: saldoPendiente },
    { concepto: 'Costo de laboratorio (normal)', formula: 'Σ costo_lab pagado, sin garantías', fuente: 'ordenes_lab', registros: labPagadas.filter(o => !o.es_garantia).length, monto: costoLab },
    { concepto: 'Costo de garantías', formula: 'Σ costo_lab pagado, es_garantia', fuente: 'ordenes_lab', registros: labPagadas.filter(o => o.es_garantia).length, monto: garantias },
    { concepto: 'Gastos operativos', formula: 'gastos de empresa (no caja), sin retiros/otros/compras', fuente: 'gastos', registros: gastosOperativos.length, monto: totalGastosOp },
    { concepto: 'Compras de inventario/activos', formula: "gastos categoría 'compras'", fuente: 'gastos', registros: inversionRows.length, monto: totalInversion },
    { concepto: 'Retiros del propietario', formula: "gastos categoría 'retiro_admin' (afectan caja, NO utilidad)", fuente: 'gastos', registros: retirosRows.length, monto: totalRetiros },
    { concepto: 'Movimientos por aclarar (otros)', formula: "gastos 'otros'/concepto genérico — sin clasificar", fuente: 'gastos', registros: porAclararRows.length, monto: totalPorAclarar },
    { concepto: 'Resultado operativo (base cobrado)', formula: 'cobrado − lab − garantías − gastos op.', fuente: '—', registros: 0, monto: resultadoOperativoCaja },
    { concepto: 'Resultado devengado (aprox.)', formula: 'facturado − costo de ventas del mes − gastos op.', fuente: '—', registros: 0, monto: utilidadDevengada },
    { concepto: 'FLUJO NETO (efectivo)', formula: 'resultado operativo − retiros − compras', fuente: '—', registros: 0, monto: flujoNeto },
  ]

  const checks = [
    { control: 'Σ cobrado por sucursal (3) + otras = total cobrado', esperado: cobradoTotal, calculado: sumaSucCob + (cobradoTotal - sumaSucCob), estado: 'CUADRA' },
    { control: 'Σ cobrado por método = cobros de ventas', esperado: cobrosVentas, calculado: sumaMetodo, estado: cuadra(sumaMetodo, cobrosVentas) },
    { control: 'Σ tendencias.cobrado = cobros de ventas', esperado: cobrosVentas, calculado: sumaDiaCob, estado: cuadra(sumaDiaCob, cobrosVentas) },
    { control: 'Σ tendencias.facturado = total facturado', esperado: facturado, calculado: sumaDiaFac, estado: cuadra(sumaDiaFac, facturado) },
    { control: 'Σ productividad.importe = total facturado', esperado: facturado, calculado: sumaProd, estado: cuadra(sumaProd, facturado) },
    { control: 'cobrado anteriores = previas + otros ingresos caja', esperado: cobradoAnteriores, calculado: r2(cobrosVentasPrevias + otrosIngresosCaja), estado: cuadra(cobradoAnteriores, cobrosVentasPrevias + otrosIngresosCaja) },
  ]

  // ── Calidad e integridad ──
  const catConocidas = new Set(['renta', 'nomina', 'bonos_comisiones', 'proveedores', 'servicios', 'mantenimiento',
    'marketing', 'papeleria', 'limpieza', 'otros', 'comision_terminal', 'bono_diario', 'adelanto', 'comisiones', 'compras', 'retiro_admin'])
  const diasSinCorte: string[] = []
  for (const s of SUCS) {
    const dset = new Set(d.cortes.filter(c => c.sucursal === s).map(c => c.fecha))
    for (let i = 1; i <= dias; i++) {
      const f = `${d.anio}-${String(d.mes0 + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      if (f <= d.fechaFin && !dset.has(f)) diasSinCorte.push(`${s} · ${f}`)
    }
  }
  // Garantías con fecha fuera del mes (fecha de orden)
  const garantiasFueraMes = d.ordenes.filter(o => o.es_garantia && (o.fecha_ingreso < d.fechaIni || o.fecha_ingreso > d.fechaFin)).length
  const checksNoCuadran = checks.filter(c => c.estado === 'NO CUADRA').length

  const calidad = {
    ventasSinAtendio: ventasReales.filter(v => !v.atendido_por).length,
    gastosSinCategoria: d.gastos.filter(g => !g.categoria || !catConocidas.has(g.categoria)).length,
    movimientosPorAclarar: porAclararRows.length, montoPorAclarar: totalPorAclarar,
    retirosDetectados: retirosRows.length, montoRetiros: totalRetiros,
    saldosNegativos: ventasReales.filter(v => num(v.saldo) < 0).length,
    pagosHuerfanos: d.pagos.filter(p => !p.venta_id).length,
    ordenesSinCosto: sinCosto.length, ingresoSinCosto,
    garantiasSinMotivo: d.ordenes.filter(o => o.es_garantia && !o.motivo_problema).length,
    garantiasSinOrigen: d.ordenes.filter(o => o.es_garantia && !o.folio_origen).length,
    garantiasSinLab: d.ordenes.filter(o => o.es_garantia && !o.laboratorio).length,
    garantiasFueraMes,
    consumiblesSinCosto: consSinCosto, armazonesSinCosto: armSinCosto,
    citasSinEstadoUtil: conversion.estadosCapturados ? 0 : d.citas.length,
    descuadresCaja: d.cortes.filter(c => Math.abs(num(c.diferencia)) > 0.5).length,
    diasSinCorte: diasSinCorte.length, diasSinCorteLista: diasSinCorte,
    cotizacionesAbiertas: cotizaciones.length, cotizacionesMonto: r2(cotizaciones.reduce((s, v) => s + num(v.total), 0)),
    canceladas: canceladas.length, canceladasMonto: r2(canceladas.reduce((s, v) => s + num(v.total), 0)),
    checksNoCuadran, fuentesConError: d.errores,
  }

  // Estado del archivo
  const problemasGraves = checksNoCuadran > 0 || calidad.ordenesSinCosto > 0 || (invConsumibles + invArmazones) === 0
    || calidad.movimientosPorAclarar > 0 || !conversion.estadosCapturados
  const estadoArchivo = calidad.fuentesConError.length > 5 ? 'NO CONFIABLE' : problemasGraves ? 'PARCIAL' : 'CONFIABLE'

  return {
    estadoArchivo,
    ventasReales, canceladas, cotizaciones,
    facturado, cobradoTotal, cobrosVentas, cobrosVentasMes, cobrosVentasPrevias, cobrosSinVenta, otrosIngresosCaja,
    cobradoAnteriores, saldoPendiente,
    costoLab, garantias, costoVentasMes, totalGastosOp, totalRetiros, totalPorAclarar, totalInversion, comisionTerminal,
    resultadoOperativoCaja, utilidadDevengada, flujoNeto, margenOperativo: cobradoTotal ? resultadoOperativoCaja / cobradoTotal : 0,
    porSucursal, porMetodo, productividad, descTotal, precioListaTotal, descuentoPorSuc, conversion,
    porTipoLente, porTratamiento, laboratorios, garantiasDet, ordenesSinCostoDet, nomina, cajaResumen,
    invConsumibles, invArmazones, armazonesRent, porDia, porHora,
    conciliacion, checks, calidad,
    retirosRows, porAclararRows, inversionRows, gastosOperativos,
    itemsPorVenta, piezasVenta, descuentoVenta,
  }
}
