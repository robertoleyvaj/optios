// ─────────────────────────────────────────────────────────────────────────────
// Paquete de análisis mensual · Construcción del Excel con ExcelJS (SOLO servidor)
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
  row.alignment = { vertical: 'middle' }
  row.height = 20
}

/** Agrega una tabla con encabezado formateado. `rows` son objetos con las keys de `cols`. */
function addTable(ws: ExcelJS.Worksheet, cols: Col[], rows: Row[], startRow?: number) {
  const r0 = startRow ?? (ws.rowCount + 1)
  const head = ws.getRow(r0)
  cols.forEach((c, i) => { head.getCell(i + 1).value = c.header })
  styleHeader(head)
  rows.forEach((data, ri) => {
    const row = ws.getRow(r0 + 1 + ri)
    cols.forEach((c, i) => {
      const cell = row.getCell(i + 1)
      cell.value = data[c.key] ?? (c.money || c.int || c.pct ? 0 : '')
      if (c.money) cell.numFmt = MONEY
      else if (c.pct) cell.numFmt = PCT
      else if (c.int) cell.numFmt = '#,##0'
    })
  })
  cols.forEach((c, i) => { ws.getColumn(i + 1).width = c.width ?? 16 })
  ws.views = [{ state: 'frozen', ySplit: r0 }]
  return r0 + rows.length + 1
}

/** Bloque de "métrica: valor" (para hojas tipo resumen). */
function addKpis(ws: ExcelJS.Worksheet, title: string, pairs: [string, any, ('money' | 'pct' | 'int')?][]) {
  const t = ws.addRow([title]); t.font = { bold: true, size: 13 }; ws.addRow([])
  for (const [label, value, fmt] of pairs) {
    const row = ws.addRow([label, value])
    row.getCell(1).font = { bold: false }
    if (fmt === 'money') row.getCell(2).numFmt = MONEY
    else if (fmt === 'pct') row.getCell(2).numFmt = PCT
    else if (fmt === 'int') row.getCell(2).numFmt = '#,##0'
    row.getCell(2).font = { bold: true }
  }
  ws.getColumn(1).width = 42; ws.getColumn(2).width = 20
  ws.addRow([])
}

export function buildWorkbook(d: MesData, m: Metrics): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'OptiOS'; wb.created = new Date()

  // ── 0. Portada ──
  const port = wb.addWorksheet('Portada')
  addKpis(port, `Análisis mensual — ${d.mesLabel}`, [
    ['Generado', new Date().toLocaleString('es-MX', { timeZone: 'America/Tijuana' })],
    ['Periodo (fechas)', `${d.fechaIni} → ${d.fechaFin}`],
    ['Sucursales', SUCS.join(', ')],
  ])
  addKpis(port, 'Cómo usar este archivo', [
    ['1', 'Súbelo a ChatGPT o Claude junto con INSTRUCCIONES_PARA_IA.md'],
    ['2', 'Pídele el análisis usando el prompt incluido en ese archivo'],
    ['Nota', 'Los KPIs marcados "(aprox.)" requieren verificación — ver hoja Calidad'],
  ])

  // ── 1. Resumen mensual ──
  const res = wb.addWorksheet('1. Resumen')
  addKpis(res, `Resumen — ${d.mesLabel}`, [
    ['Total facturado', m.facturado, 'money'],
    ['Total cobrado', m.cobrado, 'money'],
    ['  · de ello, de ventas de meses previos', m.cobradoAnteriores, 'money'],
    ['Saldo pendiente por cobrar (ventas del mes)', m.saldoPendiente, 'money'],
    ['Costo de laboratorio', m.costoLab, 'money'],
    ['Garantías (re-trabajos)', m.garantias, 'money'],
    ['Utilidad bruta', m.utilidadBruta, 'money'],
    ['Gastos operativos', m.totalGastosOp, 'money'],
    ['  · de ello, comisión terminal (banco)', m.comisionTerminal, 'money'],
    ['Utilidad neta', m.utilidadNeta, 'money'],
    ['Margen neto', m.margenNeto, 'pct'],
    ['Retiros del dueño', m.totalRetiros, 'money'],
    ['Flujo neto del período', m.flujoNeto, 'money'],
    ['# Ventas', m.ventasReales.length, 'int'],
    ['# Cotizaciones abiertas', m.cotizaciones.length, 'int'],
    ['# Canceladas', m.canceladas.length, 'int'],
  ])

  // ── 2. Rentabilidad por sucursal ──
  const suc = wb.addWorksheet('2. Por sucursal')
  addTable(suc, [
    { header: 'Sucursal', key: 'sucursal', width: 16 },
    { header: 'Meta', key: 'meta', money: true },
    { header: 'Facturado', key: 'facturado', money: true },
    { header: 'Cobrado', key: 'cobrado', money: true },
    { header: 'Costo lab', key: 'costoLab', money: true },
    { header: 'Garantías', key: 'garantias', money: true },
    { header: 'Gastos directos', key: 'directos', money: true },
    { header: 'Overhead ÷3', key: 'overheadIgual', money: true },
    { header: 'Overhead prop.', key: 'overheadProp', money: true },
    { header: 'Utilidad (÷3)', key: 'utilIgual', money: true },
    { header: 'Utilidad (prop.)', key: 'utilProp', money: true },
  ], m.porSucursal)

  // ── 3. Ventas detalladas ──
  const ven = wb.addWorksheet('3. Ventas')
  addTable(ven, [
    { header: 'Folio', key: 'folio', width: 12 },
    { header: 'Fecha', key: 'fecha', width: 12 },
    { header: 'Sucursal', key: 'sucursal' },
    { header: 'Atendió', key: 'atendio' },
    { header: 'Paciente', key: 'paciente', width: 24 },
    { header: 'Total', key: 'total', money: true },
    { header: 'Descuento', key: 'descuento', money: true },
    { header: 'Anticipo', key: 'anticipo', money: true },
    { header: 'Saldo', key: 'saldo', money: true },
    { header: 'Piezas', key: 'piezas', int: true },
    { header: 'Método', key: 'metodo' },
    { header: 'Estado', key: 'estado' },
  ], d.ventas.map(v => ({
    folio: v.folio, fecha: (v.created_at || '').slice(0, 10), sucursal: v.sucursal, atendio: v.atendido_por,
    paciente: v.paciente_nombre, total: Number(v.total) || 0, descuento: Math.round(m.descuentoVenta(v.id) * 100) / 100,
    anticipo: Number(v.anticipo) || 0, saldo: Number(v.saldo) || 0, piezas: m.piezasVenta(v.id),
    metodo: v.metodo_pago, estado: v.es_cotizacion ? 'cotización' : v.estado,
  })))

  // ── 4. Líneas de venta ──
  const lin = wb.addWorksheet('4. Líneas de venta')
  const folioDe: Record<string, string> = {}
  for (const v of d.ventas) folioDe[v.id] = v.folio
  addTable(lin, [
    { header: 'Folio', key: 'folio', width: 12 },
    { header: 'Producto', key: 'nombre', width: 30 },
    { header: 'SKU', key: 'sku' },
    { header: 'Cantidad', key: 'cantidad', int: true },
    { header: 'Precio unit.', key: 'precio', money: true },
    { header: 'Descuento %', key: 'desc' },
    { header: 'Subtotal', key: 'subtotal', money: true },
    { header: 'Par', key: 'par' },
  ], d.ventasItems.map(it => ({
    folio: folioDe[it.venta_id] ?? it.venta_id, nombre: it.nombre, sku: it.sku,
    cantidad: Number(it.cantidad) || 0, precio: Number(it.precio_unitario) || 0, desc: Number(it.descuento) || 0,
    subtotal: Number(it.subtotal) || 0, par: it.par,
  })))

  // ── 5. Pagos, anticipos y saldos ──
  const pag = wb.addWorksheet('5. Pagos')
  addTable(pag, [
    { header: 'Fecha', key: 'fecha', width: 18 },
    { header: 'Folio venta', key: 'folio' },
    { header: 'Paciente', key: 'paciente', width: 24 },
    { header: 'Monto', key: 'monto', money: true },
    { header: 'Tipo', key: 'tipo' },
    { header: 'Método', key: 'metodo' },
    { header: 'Sucursal', key: 'sucursal' },
    { header: 'De venta del mes', key: 'delMes' },
    { header: 'Registró', key: 'registro' },
  ], d.pagos.map(p => ({
    fecha: (p.created_at || '').slice(0, 16).replace('T', ' '), folio: p.folio_venta, paciente: p.paciente,
    monto: Number(p.monto) || 0, tipo: p.tipo, metodo: p.metodo_pago, sucursal: p.sucursal,
    delMes: d.ventas.some(v => v.id === p.venta_id) ? 'sí' : 'no (previa)', registro: p.registrado_por,
  })))

  // ── 6. Egresos detallados ──
  const egr = wb.addWorksheet('6. Egresos')
  addTable(egr, [
    { header: 'Fecha', key: 'fecha', width: 12 },
    { header: 'Categoría', key: 'categoria', width: 20 },
    { header: 'Concepto', key: 'concepto', width: 34 },
    { header: 'Monto', key: 'monto', money: true },
    { header: 'Método', key: 'metodo' },
    { header: 'Sucursal', key: 'sucursal' },
    { header: 'Es caja', key: 'esCaja' },
  ], d.gastos.map(g => ({
    fecha: g.fecha, categoria: g.categoria, concepto: g.concepto, monto: Number(g.monto) || 0,
    metodo: g.metodo_pago, sucursal: g.sucursal, esCaja: g.es_caja === true ? 'sí' : 'no',
  })))

  // ── 7. Productividad por empleada ──
  const prod = wb.addWorksheet('7. Productividad')
  addTable(prod, [
    { header: 'Empleada', key: 'nombre', width: 22 },
    { header: 'Ventas', key: 'ventas', int: true },
    { header: 'Piezas', key: 'piezas', int: true },
    { header: 'Importe', key: 'importe', money: true },
    { header: 'Ticket prom.', key: 'ticket', money: true },
    { header: 'Descuento dado', key: 'descuento', money: true },
    { header: 'Horas', key: 'horas' },
    { header: 'Ventas/hora', key: 'ventasPorHora' },
  ], m.productividad)

  // ── 8. Exámenes, citas y conversión ──
  const conv = wb.addWorksheet('8. Conversión')
  addKpis(conv, `Conversión (aprox. por teléfono) — ${d.mesLabel}`, [
    ['Exámenes (consultas)', m.conversion.examenes, 'int'],
    ['  · terminaron en venta', m.conversion.examConvertidos, 'int'],
    ['  · tasa de conversión de examen', m.conversion.tasaExamen, 'pct'],
    ['Citas agendadas', m.conversion.citas, 'int'],
    ['  · atendidas', m.conversion.citasAtendidas, 'int'],
    ['  · no-shows', m.conversion.noShows, 'int'],
    ['  · terminaron en venta', m.conversion.citasConvertidas, 'int'],
    ['  · tasa de conversión de cita', m.conversion.tasaCita, 'pct'],
    ['# Ventas del mes', m.conversion.ventas, 'int'],
  ])

  // ── 9. Tipos de lente y tratamientos ──
  const len = wb.addWorksheet('9. Lentes y tratamientos')
  len.addRow(['TIPOS DE LENTE (por tipo_mica · trabajos ingresados en el mes)']).font = { bold: true, size: 12 }
  addTable(len, [
    { header: 'Tipo de mica', key: 'clave', width: 26 },
    { header: 'Piezas', key: 'piezas', int: true },
    { header: 'Ingreso', key: 'ingreso', money: true },
    { header: 'Costo lab', key: 'costo', money: true },
    { header: 'Margen', key: 'margen', money: true },
    { header: 'Margen %', key: 'margenPct', pct: true },
  ], m.porTipoLente, len.rowCount + 1)
  len.addRow([]); len.addRow(['TRATAMIENTOS']).font = { bold: true, size: 12 }
  addTable(len, [
    { header: 'Tratamiento', key: 'clave', width: 26 },
    { header: 'Piezas', key: 'piezas', int: true },
    { header: 'Ingreso', key: 'ingreso', money: true },
    { header: 'Costo lab', key: 'costo', money: true },
    { header: 'Margen', key: 'margen', money: true },
    { header: 'Margen %', key: 'margenPct', pct: true },
  ], m.porTratamiento, len.rowCount + 1)
  len.views = []

  // ── 10. Laboratorios ──
  const lab = wb.addWorksheet('10. Laboratorios')
  addTable(lab, [
    { header: 'Laboratorio', key: 'lab', width: 24 },
    { header: 'Piezas', key: 'piezas', int: true },
    { header: 'Costo total', key: 'costo', money: true },
    { header: 'Costo prom.', key: 'costoProm', money: true },
    { header: 'Ingreso', key: 'ingreso', money: true },
    { header: 'Margen', key: 'margen', money: true },
    { header: 'Días entrega prom.', key: 'diasProm' },
    { header: '% con retraso', key: 'pctRetraso', pct: true },
    { header: 'Urgentes', key: 'urgentes', int: true },
    { header: 'Garantías', key: 'garantias', int: true },
  ], m.laboratorios)

  // ── 11. Garantías ──
  const gar = wb.addWorksheet('11. Garantías')
  addTable(gar, [
    { header: 'Folio', key: 'folio', width: 12 },
    { header: 'Folio origen', key: 'folioOrigen' },
    { header: 'Fecha', key: 'fechaIngreso', width: 12 },
    { header: 'Sucursal', key: 'sucursal' },
    { header: 'Laboratorio', key: 'laboratorio' },
    { header: 'Tipo mica', key: 'tipoMica' },
    { header: 'Motivo', key: 'motivo', width: 34 },
    { header: 'Costo', key: 'costo', money: true },
    { header: 'Paciente', key: 'paciente', width: 24 },
  ], m.garantiasDet)

  // ── 12. Nómina, comisiones y bonos ──
  const nom = wb.addWorksheet('12. Nómina y comisiones')
  addTable(nom, [
    { header: 'Categoría', key: 'categoria', width: 24 },
    { header: 'Pagado (empresa)', key: 'pagadoEmpresa', money: true },
    { header: 'Pagado (caja)', key: 'pagadoCaja', money: true },
  ], m.nomina)

  // ── 13. Caja y métodos de pago ──
  const caja = wb.addWorksheet('13. Caja y métodos')
  caja.addRow(['DIFERENCIAS Y RETIROS POR SUCURSAL']).font = { bold: true, size: 12 }
  addTable(caja, [
    { header: 'Sucursal', key: 'sucursal', width: 16 },
    { header: '# Cortes', key: 'cortes', int: true },
    { header: 'Diferencia total', key: 'difTotal', money: true },
    { header: 'Retiros al sobre', key: 'retiroTotal', money: true },
    { header: '# Descuadres', key: 'descuadres', int: true },
  ], m.cajaResumen, caja.rowCount + 1)
  caja.addRow([]); caja.addRow(['COBRADO POR MÉTODO DE PAGO']).font = { bold: true, size: 12 }
  addTable(caja, [
    { header: 'Método', key: 'metodo', width: 20 },
    { header: 'Monto', key: 'monto', money: true },
  ], Object.entries(m.porMetodo).map(([metodo, monto]) => ({ metodo, monto })), caja.rowCount + 1)
  caja.views = []

  // ── 14. Inventario y armazones ──
  const inv = wb.addWorksheet('14. Inventario')
  addKpis(inv, `Valor de inventario — ${d.mesLabel}`, [
    ['Consumibles (a costo)', m.invConsumibles, 'money'],
    ['Armazones (a costo)', m.invArmazones, 'money'],
    ['Total', m.invConsumibles + m.invArmazones, 'money'],
  ])
  inv.addRow(['ARMAZONES POR MARGEN']).font = { bold: true, size: 12 }
  addTable(inv, [
    { header: 'SKU', key: 'sku' },
    { header: 'Marca', key: 'marca' },
    { header: 'Modelo', key: 'modelo', width: 22 },
    { header: 'Precio', key: 'precio', money: true },
    { header: 'Costo', key: 'costo', money: true },
    { header: 'Margen', key: 'margen', money: true },
    { header: 'Stock', key: 'stock', int: true },
  ], m.armazonesRent, inv.rowCount + 1)
  inv.views = []

  // ── 15. Tendencias día / horario ──
  const ten = wb.addWorksheet('15. Tendencias')
  ten.addRow(['POR DÍA']).font = { bold: true, size: 12 }
  addTable(ten, [
    { header: 'Fecha', key: 'fecha', width: 12 },
    { header: 'Día', key: 'dow' },
    { header: 'Ventas', key: 'ventas', int: true },
    { header: 'Facturado', key: 'facturado', money: true },
    { header: 'Cobrado', key: 'cobrado', money: true },
  ], m.porDia, ten.rowCount + 1)
  ten.addRow([]); ten.addRow(['POR HORARIO']).font = { bold: true, size: 12 }
  addTable(ten, [
    { header: 'Hora', key: 'hora', int: true },
    { header: 'Ventas', key: 'ventas', int: true },
    { header: 'Cobrado', key: 'cobrado', money: true },
  ], m.porHora, ten.rowCount + 1)
  ten.views = []

  // ── 16. Calidad e integridad ──
  const cal = wb.addWorksheet('16. Calidad')
  addKpis(cal, `Calidad e integridad de datos — ${d.mesLabel}`, [
    ['Ventas sin "atendió"', m.calidad.ventasSinAtendio, 'int'],
    ['Gastos sin categoría / desconocida', m.calidad.gastosSinCategoria, 'int'],
    ['Saldos negativos', m.calidad.saldosNegativos, 'int'],
    ['Pagos huérfanos (sin venta)', m.calidad.pagosHuerfanos, 'int'],
    ['Órdenes de lab sin costo capturado', m.calidad.ordenesSinCosto, 'int'],
    ['Garantías sin motivo', m.calidad.garantiasSinMotivo, 'int'],
    ['Descuadres de caja (>$0.5)', m.calidad.descuadresCaja, 'int'],
    ['Días-sucursal sin corte de caja', m.calidad.diasSinCorte, 'int'],
    ['Cotizaciones abiertas', m.calidad.cotizacionesAbiertas, 'int'],
    ['Ventas canceladas', m.calidad.canceladas, 'int'],
    ['Monto cancelado', m.calidad.canceladasMonto, 'money'],
  ])
  if (m.calidad.diasSinCorteLista.length) {
    cal.addRow(['Detalle: días-sucursal sin corte']).font = { bold: true }
    for (const x of m.calidad.diasSinCorteLista) cal.addRow([x])
  }
  if (m.calidad.fuentesConError.length) {
    cal.addRow([]); cal.addRow(['Fuentes con error de lectura']).font = { bold: true, color: { argb: 'FFCC0000' } }
    for (const e of m.calidad.fuentesConError) cal.addRow([e])
  }

  return wb
}
