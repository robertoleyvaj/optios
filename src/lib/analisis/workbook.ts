// ─────────────────────────────────────────────────────────────────────────────
// Paquete de análisis mensual · Construcción del Excel con ExcelJS (SOLO servidor)
// v2: hoja de conciliación, estado del archivo, egresos separados, sin costos cero.
// ─────────────────────────────────────────────────────────────────────────────
import ExcelJS from 'exceljs'
import type { MesData, Row } from './queries'
import { SUCS } from './queries'
import type { Metrics } from './metrics'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Col = { header: string; key: string; width?: number; money?: boolean; pct?: boolean; int?: boolean }
const MONEY = '"$"#,##0.00'
const PCT = '0.0%'
const HEADER_FILL = 'FF0D9488'

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } } as any
  row.alignment = { vertical: 'middle' }; row.height = 20
}

function addTable(ws: ExcelJS.Worksheet, cols: Col[], rows: Row[], startRow?: number, freeze = true) {
  const r0 = startRow ?? (ws.rowCount + 1)
  const head = ws.getRow(r0)
  cols.forEach((c, i) => { head.getCell(i + 1).value = c.header })
  styleHeader(head)
  rows.forEach((data, ri) => {
    const row = ws.getRow(r0 + 1 + ri)
    cols.forEach((c, i) => {
      const cell = row.getCell(i + 1)
      const v = data[c.key]
      cell.value = v ?? (c.money || c.int || c.pct ? 0 : '')
      if (c.money && typeof cell.value === 'number') cell.numFmt = MONEY
      else if (c.pct && typeof cell.value === 'number') cell.numFmt = PCT
      else if (c.int && typeof cell.value === 'number') cell.numFmt = '#,##0'
    })
  })
  cols.forEach((c, i) => { const col = ws.getColumn(i + 1); if (!col.width || (c.width && c.width > col.width)) col.width = c.width ?? 16 })
  if (freeze) ws.views = [{ state: 'frozen', ySplit: r0 }]
  return r0 + rows.length + 1
}

function addKpis(ws: ExcelJS.Worksheet, title: string, pairs: [string, any, ('money' | 'pct' | 'int')?][]) {
  const t = ws.addRow([title]); t.font = { bold: true, size: 13 }; ws.addRow([])
  for (const [label, value, fmt] of pairs) {
    const row = ws.addRow([label, value])
    if (fmt === 'money' && typeof value === 'number') row.getCell(2).numFmt = MONEY
    else if (fmt === 'pct' && typeof value === 'number') row.getCell(2).numFmt = PCT
    else if (fmt === 'int' && typeof value === 'number') row.getCell(2).numFmt = '#,##0'
    row.getCell(2).font = { bold: true }
  }
  ws.getColumn(1).width = Math.max(ws.getColumn(1).width || 0, 46); ws.getColumn(2).width = 20
  ws.addRow([])
}

export function buildWorkbook(d: MesData, m: Metrics): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'OptiOS'; wb.created = new Date()

  // ── Portada ──
  const port = wb.addWorksheet('Portada')
  const estadoRow = port.addRow([`ESTADO DEL ARCHIVO: ${m.estadoArchivo}`])
  estadoRow.font = { bold: true, size: 14, color: { argb: m.estadoArchivo === 'CONFIABLE' ? 'FF059669' : m.estadoArchivo === 'PARCIAL' ? 'FFB45309' : 'FFCC0000' } }
  port.addRow([])
  addKpis(port, `Análisis mensual — ${d.mesLabel}`, [
    ['Generado', new Date().toLocaleString('es-MX', { timeZone: 'America/Tijuana' })],
    ['Periodo', `${d.fechaIni} → ${d.fechaFin} (America/Tijuana)`],
    ['Sucursales', SUCS.join(', ')],
    ['Controles que NO cuadran', m.calidad.checksNoCuadran, 'int'],
    ['Movimientos por aclarar', m.calidad.movimientosPorAclarar, 'int'],
    ['Órdenes de lab sin costo', m.calidad.ordenesSinCosto, 'int'],
  ])
  addKpis(port, 'Cómo usar este archivo', [
    ['1', 'Súbelo a ChatGPT o Claude con INSTRUCCIONES_PARA_IA.md'],
    ['2', 'Empieza por la hoja "0. Conciliación": ahí se ve si cada cifra cuadra'],
    ['Nota', 'Los KPIs "(aprox.)" y los costos faltantes no son cifras finales'],
  ])

  // ── 0. Conciliación ──
  const con = wb.addWorksheet('0. Conciliación')
  con.addRow([`Conciliación — ${d.mesLabel} · ESTADO: ${m.estadoArchivo}`]).font = { bold: true, size: 13 }
  con.addRow([])
  addTable(con, [
    { header: 'Concepto', key: 'concepto', width: 40 },
    { header: 'Fórmula / definición', key: 'formula', width: 48 },
    { header: 'Tabla origen', key: 'fuente', width: 16 },
    { header: 'Registros', key: 'registros', int: true },
    { header: 'Monto', key: 'monto', money: true },
  ], m.conciliacion, con.rowCount + 1, false)
  con.addRow([]); con.addRow(['CONTROLES CRUZADOS (todo debe CUADRAR)']).font = { bold: true, size: 12 }
  addTable(con, [
    { header: 'Control', key: 'control', width: 52 },
    { header: 'Esperado', key: 'esperado', money: true },
    { header: 'Calculado', key: 'calculado', money: true },
    { header: 'Estado', key: 'estado', width: 14 },
  ], m.checks, con.rowCount + 1, false)

  // ── 1. Resumen ──
  const res = wb.addWorksheet('1. Resumen')
  addKpis(res, `Resumen — ${d.mesLabel}`, [
    ['— DEVENGADO (provisional — faltan costos) —', ''],
    ['Total facturado', m.facturado, 'money'],
    ['Costo de ventas del mes (solo lab, aprox.)', m.costoVentasMes, 'money'],
    ['Gastos operativos', m.totalGastosOp, 'money'],
    ['Resultado operativo provisional', m.utilidadDevengada, 'money'],
    ['  · ventas con armazón sin costo', m.ventasArmazonSinCosto, 'int'],
    ['  · ventas con laboratorio sin costo', m.ventasLabSinCosto, 'int'],
    ['  · ingreso de ventas con costo incompleto', m.ingresoVentasIncompletas, 'money'],
    ['Saldo pendiente por cobrar (ventas del mes)', m.saldoPendiente, 'money'],
    ['— CAJA (efectivo) —', ''],
    ['Cobros de ventas', m.cobrosVentas, 'money'],
    ['  · de meses anteriores', m.cobrosVentasPrevias, 'money'],
    ['Otros ingresos de caja', m.otrosIngresosCaja, 'money'],
    ['Total cobrado', m.cobradoTotal, 'money'],
    ['Costo de laboratorio', m.costoLab, 'money'],
    ['Garantías', m.garantias, 'money'],
    ['Gastos operativos', m.totalGastosOp, 'money'],
    ['Resultado operativo (base cobrado)', m.resultadoOperativoCaja, 'money'],
    ['Margen operativo', m.margenOperativo, 'pct'],
    ['— MOVIMIENTOS QUE NO SON GASTO —', ''],
    ['Retiros del propietario (solo caja)', m.totalRetiros, 'money'],
    ['Compras de inventario/activos', m.totalInversion, 'money'],
    ['Movimientos por aclarar (total)', m.totalPorAclarar, 'money'],
    ['  · que salieron de caja', m.totalAclararCaja, 'money'],
    ['  · que NO tocaron caja', m.totalAclararNoCaja, 'money'],
    ['— FLUJO DE EFECTIVO —', ''],
    ['Flujo identificado (− retiros − compras)', m.flujoIdentificado, 'money'],
    ['Flujo después de salidas por aclarar', m.flujoDespuesAclarar, 'money'],
    ['— DIVISAS —', ''],
    ['Movimientos en USD (verificar tipo de cambio)', m.movimientosUSD.registros, 'int'],
    ['  · monto USD (posible sin convertir a MXN)', m.movimientosUSD.monto, 'money'],
    ['— CONTEOS —', ''],
    ['# Ventas', m.ventasReales.length, 'int'],
    ['# Cotizaciones abiertas', m.cotizaciones.length, 'int'],
    ['# Canceladas', m.canceladas.length, 'int'],
  ])

  // ── 2. Por sucursal ──
  const suc = wb.addWorksheet('2. Por sucursal')
  addTable(suc, [
    { header: 'Sucursal', key: 'sucursal', width: 16 },
    { header: 'Meta', key: 'meta', money: true },
    { header: 'Facturado', key: 'facturado', money: true },
    { header: '% meta', key: 'cumplimiento', pct: true },
    { header: 'Dif. meta', key: 'difMeta', money: true },
    { header: 'Cobrado', key: 'cobrado', money: true },
    { header: 'Costo lab', key: 'costoLab', money: true },
    { header: 'Garantías', key: 'garantias', money: true },
    { header: 'Gastos directos', key: 'directos', money: true },
    { header: 'Overhead ÷3', key: 'overheadIgual', money: true },
    { header: 'Overhead prop.', key: 'overheadProp', money: true },
    { header: 'Utilidad ÷3', key: 'utilIgual', money: true },
    { header: 'Utilidad prop.', key: 'utilProp', money: true },
  ], m.porSucursal)

  // ── 3. Ventas ──
  const ven = wb.addWorksheet('3. Ventas')
  addTable(ven, [
    { header: 'Folio', key: 'folio', width: 12 }, { header: 'Fecha', key: 'fecha', width: 12 },
    { header: 'Sucursal', key: 'sucursal' }, { header: 'Atendió', key: 'atendio' },
    { header: 'Paciente', key: 'paciente', width: 24 }, { header: 'Total', key: 'total', money: true },
    { header: 'Descuento', key: 'descuento', money: true }, { header: 'Anticipo', key: 'anticipo', money: true },
    { header: 'Saldo', key: 'saldo', money: true }, { header: 'Piezas', key: 'piezas', int: true },
    { header: 'Método', key: 'metodo' }, { header: 'Estado', key: 'estado' },
  ], d.ventas.map(v => ({
    folio: v.folio, fecha: v.created_at ? new Date(v.created_at).toLocaleDateString('en-CA', { timeZone: 'America/Tijuana' }) : '',
    sucursal: v.sucursal, atendio: v.atendido_por, paciente: v.paciente_nombre, total: Number(v.total) || 0,
    descuento: Math.round(m.descuentoVenta(v.id) * 100) / 100, anticipo: Number(v.anticipo) || 0, saldo: Number(v.saldo) || 0,
    piezas: m.piezasVenta(v.id), metodo: v.metodo_pago, estado: v.es_cotizacion ? 'cotización' : v.estado,
  })))

  // ── 4. Líneas de venta ──
  const folioDe: Record<string, string> = {}
  for (const v of d.ventas) folioDe[v.id] = v.folio
  const lin = wb.addWorksheet('4. Líneas de venta')
  addTable(lin, [
    { header: 'Folio', key: 'folio', width: 12 }, { header: 'Producto', key: 'nombre', width: 30 },
    { header: 'SKU', key: 'sku' }, { header: 'Cantidad', key: 'cantidad', int: true },
    { header: 'Precio unit.', key: 'precio', money: true }, { header: 'Descuento %', key: 'desc' },
    { header: 'Subtotal', key: 'subtotal', money: true }, { header: 'Par', key: 'par' },
  ], d.ventasItems.map(it => ({
    folio: folioDe[it.venta_id] ?? it.venta_id, nombre: it.nombre, sku: it.sku, cantidad: Number(it.cantidad) || 0,
    precio: Number(it.precio_unitario) || 0, desc: Number(it.descuento) || 0, subtotal: Number(it.subtotal) || 0, par: it.par,
  })))

  // ── 5. Pagos ──
  const pag = wb.addWorksheet('5. Pagos')
  const filasPagos = [
    ...d.pagos.map(p => ({
      fecha: (p.created_at || '').slice(0, 16).replace('T', ' '), folio: p.folio_venta, paciente: p.paciente,
      monto: Number(p.monto) || 0, tipo: p.tipo, metodo: p.metodo_pago, sucursal: p.sucursal,
      origen: p.venta_id && d.ventas.some(v => v.id === p.venta_id) ? 'venta del mes' : (p.venta_id ? 'venta previa' : 'sin venta'),
      registro: p.registrado_por,
    })),
    ...d.ingresosCaja.filter(i => i.cuenta_finanzas === true).map(i => ({
      fecha: i.fecha, folio: '(caja)', paciente: i.concepto || 'pago previo', monto: Number(i.monto) || 0,
      tipo: 'pago_previo', metodo: i.metodo_pago, sucursal: i.sucursal, origen: 'otro ingreso de caja', registro: '',
    })),
  ]
  addTable(pag, [
    { header: 'Fecha', key: 'fecha', width: 18 }, { header: 'Folio venta', key: 'folio' },
    { header: 'Paciente / concepto', key: 'paciente', width: 26 }, { header: 'Monto', key: 'monto', money: true },
    { header: 'Tipo', key: 'tipo' }, { header: 'Método', key: 'metodo' }, { header: 'Sucursal', key: 'sucursal' },
    { header: 'Origen', key: 'origen', width: 18 }, { header: 'Registró', key: 'registro' },
  ], filasPagos)

  // ── 6. Egresos (separados: empresa vs caja/otros) ──
  const egr = wb.addWorksheet('6. Egresos')
  egr.addRow(['GASTOS DE EMPRESA (cuentan como gasto operativo)']).font = { bold: true, size: 12 }
  addTable(egr, [
    { header: 'Fecha', key: 'fecha', width: 12 }, { header: 'Categoría', key: 'categoria', width: 20 },
    { header: 'Concepto', key: 'concepto', width: 34 }, { header: 'Monto', key: 'monto', money: true },
    { header: 'Método', key: 'metodo' }, { header: 'Sucursal', key: 'sucursal' },
  ], m.gastosOperativos.map((g: Row) => ({ fecha: g.fecha, categoria: g.categoria, concepto: g.concepto, monto: Number(g.monto) || 0, metodo: g.metodo_pago, sucursal: g.sucursal })), egr.rowCount + 1, false)
  egr.addRow([]); egr.addRow(['COMPRAS DE INVENTARIO / ACTIVOS (salida de efectivo, NO gasto completo del mes)']).font = { bold: true, size: 12 }
  addTable(egr, [
    { header: 'Fecha', key: 'fecha', width: 12 }, { header: 'Categoría', key: 'categoria', width: 16 },
    { header: 'Concepto', key: 'concepto', width: 34 }, { header: 'Monto', key: 'monto', money: true },
    { header: 'Método', key: 'metodo' }, { header: 'Sucursal', key: 'sucursal' },
  ], m.inversionRows.map((g: Row) => ({ fecha: g.fecha, categoria: g.categoria, concepto: g.concepto, monto: Number(g.monto) || 0, metodo: g.metodo_pago, sucursal: g.sucursal })), egr.rowCount + 1, false)
  egr.addRow([]); egr.addRow(['RETIROS DEL PROPIETARIO (afectan caja, NO son gasto)']).font = { bold: true, size: 12 }
  addTable(egr, [
    { header: 'Fecha', key: 'fecha', width: 12 }, { header: 'Concepto', key: 'concepto', width: 34 },
    { header: 'Monto', key: 'monto', money: true }, { header: 'Sucursal', key: 'sucursal' },
  ], m.retirosRows.map((g: Row) => ({ fecha: g.fecha, concepto: g.concepto, monto: Number(g.monto) || 0, sucursal: g.sucursal })), egr.rowCount + 1, false)
  egr.addRow([]); egr.addRow(['MOVIMIENTOS POR ACLARAR ("otros" / genéricos — sin clasificar)']).font = { bold: true, size: 12, color: { argb: 'FFB45309' } }
  addTable(egr, [
    { header: 'Fecha', key: 'fecha', width: 12 }, { header: 'Concepto', key: 'concepto', width: 30 },
    { header: 'Monto', key: 'monto', money: true }, { header: 'Método', key: 'metodo' },
    { header: 'Sucursal', key: 'sucursal' }, { header: 'Es caja', key: 'esCaja' }, { header: 'Registró', key: 'registro' },
  ], m.porAclararRows.map((g: Row) => ({ fecha: g.fecha, concepto: g.concepto, monto: Number(g.monto) || 0, metodo: g.metodo_pago, sucursal: g.sucursal, esCaja: g.es_caja === true ? 'sí' : 'no', registro: g.empleado_id || '' })), egr.rowCount + 1, false)

  // ── 7. Productividad ──
  const prod = wb.addWorksheet('7. Productividad')
  addTable(prod, [
    { header: 'Empleada', key: 'nombre', width: 22 }, { header: 'Ventas', key: 'ventas', int: true },
    { header: 'Piezas', key: 'piezas', int: true }, { header: 'Importe', key: 'importe', money: true },
    { header: 'Ticket prom.', key: 'ticket', money: true }, { header: 'Descuento', key: 'descuento', money: true },
    { header: '% descuento', key: 'descuentoPct', pct: true }, { header: 'Saldo pend.', key: 'saldo', money: true },
    { header: 'Horas', key: 'horas' }, { header: 'Tickets/hora', key: 'ticketsPorHora' },
    { header: 'Facturado/hora', key: 'facturadoPorHora', money: true },
  ], m.productividad)

  // ── 8. Conversión ──
  const conv = wb.addWorksheet('8. Conversión')
  addKpis(conv, `Conversión (aprox. por teléfono) — ${d.mesLabel}`, [
    ['Exámenes (consultas)', m.conversion.examenes, 'int'],
    ['  · con venta en el mes (aprox.)', m.conversion.examConvertidos, 'int'],
    ['  · tasa aprox. de examen', m.conversion.tasaExamen, 'pct'],
    ['Citas agendadas', m.conversion.citas, 'int'],
    ['  · con venta en el mes (aprox.)', m.conversion.citasConvertidas, 'int'],
    ['  · con examen (aprox.)', m.conversion.citasConExamen, 'int'],
    ['  · canceladas', m.conversion.citasCanceladas, 'int'],
    ['  · VENCIDAS sin estado final (clasificar a mano)', m.conversion.citasVencidasSinFinal, 'int'],
    ['¿Estados de cita usables?', m.conversion.estadosCapturados ? 'sí' : 'NO — hay citas vencidas sin cerrar; no reportar tasa de asistencia'],
  ])
  conv.addRow(['DISTRIBUCIÓN REAL DE ESTADOS DE CITA']).font = { bold: true, size: 12 }
  addTable(conv, [{ header: 'Estado', key: 'estado', width: 20 }, { header: 'Cantidad', key: 'n', int: true }],
    Object.entries(m.conversion.estadoCitas).map(([estado, n]) => ({ estado, n })), conv.rowCount + 1, false)

  // ── 9. Lentes y tratamientos ──
  const len = wb.addWorksheet('9. Lentes y tratamientos')
  len.addRow(['NOTA: "ingreso del trabajo" es el precio del PAR (mica+armazón+tratamiento), no solo la mica.']).font = { italic: true, color: { argb: 'FF6B7280' } }
  len.addRow(['Por eso es MARGEN DEL TRABAJO, no rentabilidad aislada del lente. Solo trabajos CON costo capturado.']).font = { italic: true, color: { argb: 'FF6B7280' } }
  len.addRow([]); len.addRow(['TIPOS DE LENTE (tipo_mica normalizado)']).font = { bold: true, size: 12 }
  const colsLente: Col[] = [
    { header: 'Tipo de lente', key: 'clave', width: 28 }, { header: 'Piezas', key: 'piezas', int: true },
    { header: 'Ingreso trabajo', key: 'ingresoTrabajo', money: true }, { header: 'Costo lab', key: 'costo', money: true },
    { header: 'Margen trabajo', key: 'margenTrabajo', money: true }, { header: 'Margen %', key: 'margenPct', pct: true },
  ]
  addTable(len, colsLente, m.porTipoLente, len.rowCount + 1, false)
  len.addRow([]); len.addRow(['TRATAMIENTOS (orden-independiente)']).font = { bold: true, size: 12 }
  addTable(len, [{ ...colsLente[0], header: 'Tratamiento' }, ...colsLente.slice(1)], m.porTratamiento, len.rowCount + 1, false)
  len.addRow([]); len.addRow(['RENTABILIDAD ESPECÍFICA DE ÓPTICA (mica+tratamientos, SIN armazón)']).font = { bold: true, size: 12 }
  len.addRow(['ingreso óptica = precio del par − precio del armazón en la venta. Si el par ya excluye armazón, coincide con la tabla de arriba.']).font = { italic: true, color: { argb: 'FF6B7280' } }
  addTable(len, [
    { header: 'Tipo de lente', key: 'clave', width: 28 }, { header: 'Piezas', key: 'piezas', int: true },
    { header: 'Ingreso óptica', key: 'ingresoOptica', money: true }, { header: 'Costo lab', key: 'costo', money: true },
    { header: 'Margen óptica', key: 'margenOptica', money: true }, { header: 'Margen %', key: 'margenPct', pct: true },
  ], m.porTipoLenteOptica, len.rowCount + 1, false)
  if (m.ordenesSinCostoDet.length) {
    len.addRow([]); len.addRow([`⚠️ ${m.ordenesSinCostoDet.length} trabajos SIN costo capturado — excluidos del margen (ingreso asociado: $${m.calidad.ingresoSinCosto.toLocaleString('es-MX')})`]).font = { bold: true, color: { argb: 'FFB45309' } }
    addTable(len, [
      { header: 'Folio', key: 'folio' }, { header: 'Venta', key: 'folioVenta' }, { header: 'Fecha', key: 'fecha' },
      { header: 'Sucursal', key: 'sucursal' }, { header: 'Empleada', key: 'empleada' }, { header: 'Laboratorio', key: 'laboratorio' },
      { header: 'Tipo lente', key: 'tipoLente', width: 22 }, { header: 'Paciente', key: 'paciente', width: 22 },
      { header: 'Ingreso', key: 'ingreso', money: true }, { header: 'Estatus', key: 'estatus' }, { header: 'Motivo', key: 'motivo', width: 22 },
    ], m.ordenesSinCostoDet, len.rowCount + 1, false)
  }

  // ── 10. Laboratorios ──
  const lab = wb.addWorksheet('10. Laboratorios')
  lab.addRow(['Rentabilidad solo sobre trabajos con costo. "% con costo" indica qué tan completa es la muestra.']).font = { italic: true, color: { argb: 'FF6B7280' } }
  addTable(lab, [
    { header: 'Laboratorio', key: 'lab', width: 24 }, { header: 'Piezas', key: 'piezas', int: true },
    { header: 'Con costo', key: 'conCosto', int: true }, { header: '% con costo', key: 'pctConCosto', pct: true },
    { header: 'Costo', key: 'costo', money: true }, { header: 'Costo prom.', key: 'costoProm', money: true },
    { header: 'Ingreso', key: 'ingreso', money: true }, { header: 'Margen', key: 'margen', money: true },
    { header: 'Días prom.', key: 'diasProm' }, { header: '% retraso', key: 'pctRetraso', pct: true },
    { header: 'Tasa garantía', key: 'tasaGarantia', pct: true }, { header: 'Urgentes', key: 'urgentes', int: true },
    { header: 'Abiertas', key: 'abiertas', int: true },
  ], m.laboratorios, lab.rowCount + 1, false)

  // ── 11. Garantías ──
  const gar = wb.addWorksheet('11. Garantías')
  addKpis(gar, `Garantías — el COSTO del mes usa la fecha económica (fecha_pago_lab)`, [
    ['Abiertas en el mes', m.garantiasResumen.abiertasMes, 'int'],
    ['Costo reconocido en el mes (# órdenes)', m.garantiasResumen.costoReconocidoMes, 'int'],
    ['Costo reconocido en el mes ($)', m.garantiasResumen.montoCostoMes, 'money'],
    ['De meses previos, resueltas en el mes', m.garantiasResumen.deMesesPreviosResueltas, 'int'],
  ])
  addTable(gar, [
    { header: 'Folio', key: 'folio', width: 12 }, { header: 'Folio origen', key: 'folioOrigen' },
    { header: 'Fecha orden', key: 'fechaOrden', width: 12 }, { header: 'Fecha costo', key: 'fechaCosto', width: 12 },
    { header: 'Periodo', key: 'periodo', width: 26 }, { header: 'Sucursal', key: 'sucursal' }, { header: 'Laboratorio', key: 'laboratorio' },
    { header: 'Tipo lente', key: 'tipoLente' }, { header: 'Motivo', key: 'motivo', width: 30 },
    { header: 'Costo', key: 'costo', money: true }, { header: '¿Absorbió óptica?', key: 'absorbioOptica', width: 18 },
    { header: 'Paciente', key: 'paciente', width: 22 },
  ], m.garantiasDet, gar.rowCount + 1, false)

  // ── 12. Nómina y comisiones ──
  const nom = wb.addWorksheet('12. Nómina y comisiones')
  addTable(nom, [
    { header: 'Categoría', key: 'categoria', width: 24 }, { header: 'Pagado (empresa)', key: 'pagadoEmpresa', money: true },
    { header: 'Pagado (caja)', key: 'pagadoCaja', money: true },
  ], m.nomina)

  // ── 13. Caja y métodos ──
  const caja = wb.addWorksheet('13. Caja y métodos')
  caja.addRow(['DIFERENCIAS DE CAJA (faltantes vs sobrantes, con signo)']).font = { bold: true, size: 12 }
  addTable(caja, [
    { header: 'Sucursal', key: 'sucursal', width: 16 }, { header: '# Cortes', key: 'cortes', int: true },
    { header: 'Faltantes', key: 'faltantes', money: true }, { header: 'Sobrantes', key: 'sobrantes', money: true },
    { header: 'Diferencia neta', key: 'difNeta', money: true }, { header: 'Retiros al sobre', key: 'retiroTotal', money: true },
    { header: '# Descuadres', key: 'descuadres', int: true },
  ], m.cajaResumen, caja.rowCount + 1, false)
  caja.addRow([]); caja.addRow(['COBRADO POR MÉTODO DE PAGO (solo cobros de venta)']).font = { bold: true, size: 12 }
  addTable(caja, [{ header: 'Método', key: 'metodo', width: 20 }, { header: 'Monto', key: 'monto', money: true }],
    Object.entries(m.porMetodo).map(([metodo, monto]) => ({ metodo, monto })), caja.rowCount + 1, false)
  caja.addRow([]); caja.addRow(['OTROS INGRESOS DE CAJA (aparte de cobros de venta — naturaleza a confirmar)']).font = { bold: true, size: 12 }
  addTable(caja, [
    { header: 'Fecha', key: 'fecha', width: 12 }, { header: 'Concepto', key: 'concepto', width: 30 },
    { header: 'Categoría', key: 'categoria' }, { header: 'Sucursal', key: 'sucursal' },
    { header: 'Método', key: 'metodo' }, { header: 'Monto', key: 'monto', money: true },
  ], m.otrosIngresosCajaDet, caja.rowCount + 1, false)

  // ── 14. Inventario ──
  const inv = wb.addWorksheet('14. Inventario')
  addKpis(inv, `Valor de inventario — ${d.mesLabel}`, [
    ['Consumibles (a costo)', m.invConsumibles, 'money'],
    ['  · sin costo capturado', m.calidad.consumiblesSinCosto, 'int'],
    ['Armazones (a costo)', m.invArmazones, 'money'],
    ['  · sin costo capturado', m.calidad.armazonesSinCosto, 'int'],
    ['Total', m.invConsumibles + m.invArmazones, 'money'],
  ])
  if ((m.invConsumibles + m.invArmazones) === 0)
    inv.addRow(['⚠️ Costos en cero: no se puede valorar inventario ni margen de armazón hasta capturar costos.']).font = { bold: true, color: { argb: 'FFB45309' } }
  inv.addRow(['ARMAZONES POR MARGEN (los "costo faltante" no tienen margen real)']).font = { bold: true, size: 12 }
  addTable(inv, [
    { header: 'SKU', key: 'sku' }, { header: 'Marca', key: 'marca' }, { header: 'Modelo', key: 'modelo', width: 22 },
    { header: 'Precio', key: 'precio', money: true }, { header: 'Costo', key: 'costo', money: true },
    { header: 'Margen', key: 'margen', money: true }, { header: 'Stock', key: 'stock', int: true },
    { header: 'Estado costo', key: 'costoStatus', width: 14 },
  ], m.armazonesRent, inv.rowCount + 1, false)

  // ── 15. Tendencias ──
  const ten = wb.addWorksheet('15. Tendencias')
  ten.addRow(['Facturado = por fecha de VENTA (Tijuana). Cobrado = por fecha de PAGO. Solo ventas activas.']).font = { italic: true, color: { argb: 'FF6B7280' } }
  ten.addRow(['POR DÍA']).font = { bold: true, size: 12 }
  addTable(ten, [
    { header: 'Fecha', key: 'fecha', width: 12 }, { header: 'Día', key: 'dow' }, { header: 'Ventas', key: 'ventas', int: true },
    { header: 'Facturado', key: 'facturado', money: true }, { header: 'Cobrado', key: 'cobrado', money: true },
  ], m.porDia, ten.rowCount + 1, false)
  const totDia = ten.addRow(['TOTAL', '', m.porDia.reduce((s, x) => s + x.ventas, 0), m.facturado, m.cobrosVentas])
  totDia.font = { bold: true }; totDia.getCell(4).numFmt = MONEY; totDia.getCell(5).numFmt = MONEY
  ten.addRow(['(debe cuadrar con Resumen: facturado y cobros de ventas)']).font = { italic: true, color: { argb: 'FF6B7280' } }
  ten.addRow([]); ten.addRow(['POR HORARIO']).font = { bold: true, size: 12 }
  addTable(ten, [{ header: 'Hora', key: 'hora', int: true }, { header: 'Ventas', key: 'ventas', int: true }, { header: 'Cobrado', key: 'cobrado', money: true }],
    m.porHora, ten.rowCount + 1, false)

  // ── 16. Calidad ──
  const cal = wb.addWorksheet('16. Calidad')
  addKpis(cal, `Calidad e integridad — ${d.mesLabel} · ESTADO: ${m.estadoArchivo}`, [
    ['Controles cruzados que NO cuadran', m.calidad.checksNoCuadran, 'int'],
    ['Movimientos por aclarar', m.calidad.movimientosPorAclarar, 'int'],
    ['  · monto total', m.calidad.montoPorAclarar, 'money'],
    ['  · que salieron de caja', m.calidad.aclararCaja, 'money'],
    ['  · que NO tocaron caja', m.calidad.aclararNoCaja, 'money'],
    ['Retiros detectados', m.calidad.retirosDetectados, 'int'],
    ['  · monto', m.calidad.montoRetiros, 'money'],
    ['Movimientos en USD (verificar tipo de cambio)', m.calidad.movimientosUSD, 'int'],
    ['  · monto USD sin confirmar conversión', m.calidad.montoUSD, 'money'],
    ['Ventas con armazón sin costo', m.calidad.ventasArmazonSinCosto, 'int'],
    ['Ventas con laboratorio sin costo', m.calidad.ventasLabSinCosto, 'int'],
    ['  · ingreso de ventas con costo incompleto', m.calidad.ingresoVentasIncompletas, 'money'],
    ['Citas vencidas sin estado final', m.calidad.citasVencidasSinFinal, 'int'],
    ['Ventas sin "atendió"', m.calidad.ventasSinAtendio, 'int'],
    ['Gastos sin categoría / desconocida', m.calidad.gastosSinCategoria, 'int'],
    ['Saldos negativos', m.calidad.saldosNegativos, 'int'],
    ['Pagos huérfanos (sin venta)', m.calidad.pagosHuerfanos, 'int'],
    ['Órdenes de lab sin costo', m.calidad.ordenesSinCosto, 'int'],
    ['  · ingreso asociado sin costo', m.calidad.ingresoSinCosto, 'money'],
    ['Garantías sin motivo', m.calidad.garantiasSinMotivo, 'int'],
    ['Garantías sin folio origen', m.calidad.garantiasSinOrigen, 'int'],
    ['Garantías sin laboratorio', m.calidad.garantiasSinLab, 'int'],
    ['Garantías con fecha fuera del mes', m.calidad.garantiasFueraMes, 'int'],
    ['Consumibles sin costo', m.calidad.consumiblesSinCosto, 'int'],
    ['Armazones sin costo', m.calidad.armazonesSinCosto, 'int'],
    ['Citas sin estado útil', m.calidad.citasSinEstadoUtil, 'int'],
    ['Descuadres de caja (>$0.5)', m.calidad.descuadresCaja, 'int'],
    ['Días-sucursal sin corte', m.calidad.diasSinCorte, 'int'],
    ['Cotizaciones abiertas', m.calidad.cotizacionesAbiertas, 'int'],
    ['  · valor nominal (NO es venta perdida)', m.calidad.cotizacionesMonto, 'money'],
    ['Canceladas', m.calidad.canceladas, 'int'],
    ['  · monto', m.calidad.canceladasMonto, 'money'],
  ])
  if (m.calidad.diasSinCorteLista.length) {
    cal.addRow(['Días-sucursal sin corte de caja']).font = { bold: true }
    for (const x of m.calidad.diasSinCorteLista) cal.addRow([x])
  }
  if (m.calidad.fuentesConError.length) {
    cal.addRow([]); cal.addRow(['Fuentes con error de lectura']).font = { bold: true, color: { argb: 'FFCC0000' } }
    for (const e of m.calidad.fuentesConError) cal.addRow([e])
  }

  return wb
}
