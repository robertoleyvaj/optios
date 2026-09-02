// ─────────────────────────────────────────────────────────────────────────────
// Paquete de análisis mensual · Lectura de datos (SOLO servidor)
// Lee todas las fuentes del mes con el service client. Nunca importar en cliente.
// ─────────────────────────────────────────────────────────────────────────────
import { createAdminClient } from '@/lib/supabase/admin'
import { createEcommClient } from '@/lib/supabase/ecomm'
import { rangoMesLocal } from '@/lib/fecha'

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Row = Record<string, any>

export const SUCS = ['Baja Visión', '5 de Mayo', 'Plaza Laureles'] as const

export type MesData = {
  anio: number
  mes0: number
  mesLabel: string
  rango: { start: string; end: string }   // timestamptz (created_at)
  fechaIni: string                          // YYYY-MM-DD (columnas date)
  fechaFin: string
  ventas: Row[]
  ventasItems: Row[]
  pagos: Row[]
  ingresosCaja: Row[]
  gastos: Row[]
  cortes: Row[]
  ordenes: Row[]
  consultas: Row[]
  consultasTel: Record<string, string>     // paciente_id → telefono normalizado
  citas: Row[]
  usuarios: Row[]
  asistencias: Row[]
  metas: Row[]
  productos: Row[]
  armazones: Row[]
  config: Row[]
  errores: string[]                         // fuentes que fallaron (no rompen el paquete)
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio',
  'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

/** Normaliza un teléfono a solo dígitos (para cruzar citas/consultas con ventas). */
export const normTel = (t: any): string => String(t ?? '').replace(/\D/g, '').slice(-10)

/** Divide un arreglo en trozos (para .in() con muchos ids). */
function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

export async function fetchMes(anio: number, mes0: number): Promise<MesData> {
  const sb = createAdminClient()
  const { start, end } = rangoMesLocal(anio, mes0)
  const mm = String(mes0 + 1).padStart(2, '0')
  const diasEnMes = new Date(anio, mes0 + 1, 0).getDate()
  const fechaIni = `${anio}-${mm}-01`
  const fechaFin = `${anio}-${mm}-${String(diasEnMes).padStart(2, '0')}`
  const errores: string[] = []

  const safe = async <T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
    try { return await fn() } catch (e: any) { errores.push(`${label}: ${e?.message ?? e}`); return fallback }
  }

  // ── Ventas del mes (todas: activas, canceladas y cotizaciones; se clasifican en código) ──
  const ventas = await safe('ventas', async () => {
    const { data, error } = await sb.from('ventas')
      .select('id, folio, total, anticipo, saldo, metodo_pago, estado, es_cotizacion, paciente_nombre, paciente_telefono, atendido_por, sucursal, created_at, fecha_entrega, motivo_cancelacion')
      .gte('created_at', start).lte('created_at', end)
      .order('created_at', { ascending: true })
    if (error) throw error
    return data ?? []
  }, [] as Row[])

  const ventaIds = ventas.map(v => v.id).filter(Boolean)

  // ── Líneas de venta (por venta_id, en trozos) ──
  const ventasItems = await safe('ventas_items', async () => {
    const out: Row[] = []
    for (const c of chunk(ventaIds, 200)) {
      const { data, error } = await sb.from('ventas_items')
        .select('venta_id, nombre, sku, precio_unitario, cantidad, descuento, subtotal, par')
        .in('venta_id', c)
      if (error) throw error
      out.push(...(data ?? []))
    }
    return out
  }, [] as Row[])

  // ── Pagos recibidos en el mes (por created_at) ──
  const pagos = await safe('pagos_venta', async () => {
    const { data, error } = await sb.from('pagos_venta')
      .select('venta_id, folio_venta, paciente, monto, metodo_pago, tipo, moneda, monto_origen, tipo_cambio, sucursal, registrado_por, created_at')
      .gte('created_at', start).lte('created_at', end)
      .order('created_at', { ascending: true })
    if (error) throw error
    return data ?? []
  }, [] as Row[])

  // ── Ingresos de caja del mes (por fecha) ──
  const ingresosCaja = await safe('ingresos_caja', async () => {
    const { data, error } = await sb.from('ingresos_caja')
      .select('monto, metodo_pago, categoria, concepto, cuenta_finanzas, sucursal, fecha')
      .gte('fecha', fechaIni).lte('fecha', fechaFin)
    if (error) throw error
    return data ?? []
  }, [] as Row[])

  // ── Gastos del mes (por fecha) ──
  const gastos = await safe('gastos', async () => {
    const { data, error } = await sb.from('gastos')
      .select('fecha, concepto, categoria, monto, metodo_pago, sucursal, empleado_id, es_caja')
      .gte('fecha', fechaIni).lte('fecha', fechaFin)
      .order('fecha', { ascending: true })
    if (error) throw error
    return data ?? []
  }, [] as Row[])

  // ── Cortes de caja del mes ──
  const cortes = await safe('cortes_caja', async () => {
    const { data, error } = await sb.from('cortes_caja')
      .select('fecha, sucursal, usuario, total_ventas, efectivo_sistema, efectivo_contado, diferencia, fondo, entrega, fondo_usd, entrega_usd, cerrado_at')
      .gte('fecha', fechaIni).lte('fecha', fechaFin)
      .order('fecha', { ascending: true })
    if (error) throw error
    return data ?? []
  }, [] as Row[])

  // ── Órdenes de laboratorio: ingresadas, pagadas o entregadas en el mes ──
  const ordenes = await safe('ordenes_lab', async () => {
    const cols = 'folio, folio_venta, venta_id, paciente, sucursal, laboratorio, tipo_mica, tratamiento, color_tratamiento, precio_cliente, costo_lab, pagado_lab, fecha_pago_lab, fecha_ingreso, fecha_promesa, fecha_entrega, estado, urgente, es_garantia, motivo_problema, folio_origen, creado_por'
    const byId: Record<string, Row> = {}
    for (const campo of ['fecha_ingreso', 'fecha_pago_lab', 'fecha_entrega']) {
      const { data, error } = await sb.from('ordenes_lab')
        .select(cols).gte(campo, fechaIni).lte(campo, fechaFin)
      if (error) throw error
      for (const r of data ?? []) byId[r.folio ?? Math.random()] = r
    }
    return Object.values(byId)
  }, [] as Row[])

  // ── Consultas (exámenes) del mes ──
  const consultas = await safe('consultas', async () => {
    const { data, error } = await sb.from('consultas')
      .select('id, paciente_id, motivo, sucursal, atendido_por, created_at')
      .gte('created_at', start).lte('created_at', end)
    if (error) throw error
    return data ?? []
  }, [] as Row[])

  // Teléfonos de los pacientes de esas consultas (para conversión aprox. por teléfono)
  const consultasTel: Record<string, string> = {}
  await safe('pacientes(consultas)', async () => {
    const pids = [...new Set(consultas.map(c => c.paciente_id).filter(Boolean))]
    for (const c of chunk(pids, 200)) {
      const { data } = await sb.from('pacientes').select('id, telefono').in('id', c)
      for (const p of data ?? []) consultasTel[p.id] = normTel(p.telefono)
    }
    return null
  }, null)

  // ── Citas del mes ──
  const citas = await safe('citas', async () => {
    const { data, error } = await sb.from('citas')
      .select('paciente_id, paciente_nombre, paciente_telefono, tipo, fecha, hora, sucursal, estado, seguimiento')
      .gte('fecha', fechaIni).lte('fecha', fechaFin)
    if (error) throw error
    return data ?? []
  }, [] as Row[])

  // ── Catálogos (chicos) ──
  const usuarios = await safe('usuarios', async () => {
    const { data } = await sb.from('usuarios').select('id, nombre, apodo, rol, sucursal, activo')
    return data ?? []
  }, [] as Row[])

  const asistencias = await safe('asistencias', async () => {
    const { data, error } = await sb.from('asistencias')
      .select('usuario_id, usuario_nombre, sucursal, fecha, entrada, salida')
      .gte('fecha', fechaIni).lte('fecha', fechaFin)
    if (error) throw error
    return data ?? []
  }, [] as Row[])

  const metas = await safe('metas', async () => {
    const { data } = await sb.from('metas').select('*')
    return data ?? []
  }, [] as Row[])

  const productos = await safe('productos', async () => {
    const { data } = await sb.from('productos').select('*')
    return data ?? []
  }, [] as Row[])

  const config = await safe('configuracion', async () => {
    const { data } = await sb.from('configuracion').select('clave, valor')
    return data ?? []
  }, [] as Row[])

  // ── Armazones (BD e-commerce, catálogo compartido) ──
  const armazones = await safe('armazones(ecomm)', async () => {
    const ec = createEcommClient()
    const { data } = await ec.from('armazones').select('*')
    return data ?? []
  }, [] as Row[])

  return {
    anio, mes0, mesLabel: `${MESES[mes0]} ${anio}`,
    rango: { start, end }, fechaIni, fechaFin,
    ventas, ventasItems, pagos, ingresosCaja, gastos, cortes, ordenes,
    consultas, consultasTel, citas, usuarios, asistencias, metas, productos, armazones, config,
    errores,
  }
}
