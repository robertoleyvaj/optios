// ─────────────────────────────────────────────────────────────
// Pedidos en línea (gonmx.com) para las sucursales
// Reglas acordadas con Rob (Plan_gonmx_compra.md · Fase 2.5):
//   · Los ve y atiende todo el equipo de la sucursal donde el cliente recoge.
//   · Tiempo para atender: si entra de 10 a 6, ese mismo día antes de cerrar;
//     si entra fuera de horario, a más tardar al cierre del día siguiente.
//   · Lo pagado en línea no es venta de nadie hasta "Pasar a venta".
//   · Apartado vencido: manual (darle más días o liberar el armazón).
//   · Saldo a favor de un apartado liberado: 30 días, en el mismo pedido.
// ─────────────────────────────────────────────────────────────

export const UBIC_POR_SUCURSAL: Record<string, string> = {
  'Baja Visión': 'baja', '5 de Mayo': 'mayo', 'Plaza Laureles': 'plaza',
}
export const SUCURSAL_POR_UBIC: Record<string, string> = {
  baja: 'Baja Visión', mayo: '5 de Mayo', plaza: 'Plaza Laureles', bodega: 'Bodega',
}

export const codigoPedidoGon = (id: number) => `GON-${2846 + id}`

export type PagoLinea = {
  modo: 'apartar' | 'anticipo' | 'liquidar'
  total: number; pagado: number; saldo: number
  sucursal: string; apartado_vence?: string | null
}
export type InvLinea = { ok: boolean; color_id?: number; sku?: string; ubicacion?: string; traspaso?: boolean; aviso?: string; liberado?: boolean }
// Seguimiento de la sucursal (vive en configuracion.linea del pedido)
export type SeguimientoLinea = {
  contactado_at?: string; contactado_por?: string
  liberado_at?: string; liberado_por?: string; saldo_vence?: string
  venta?: { folio: string; id: string; fecha: string; por: string }
}
export type PedidoLinea = {
  id: number
  estado: string
  created_at: string
  precio_venta: number
  notas_cliente: string | null
  notas_admin: string | null
  paciente: string | null
  stripe_session_id: string | null
  cliente_email: string | null
  armazon_id: number | null
  clientes?: { nombre?: string | null; email?: string | null; telefono?: string | null } | null
  recetas?: RecetaLinea[] | null
  configuracion: {
    solo_armazon?: boolean; falta_examen?: boolean; telefono?: string | null; armazon_ref?: string | null
    vision?: string; material?: string; filtros?: string[]
    vision_nombre?: string; material_nombre?: string; filtros_nombres?: string[]
    pago?: PagoLinea | null; inventario?: InvLinea | null; linea?: SeguimientoLinea | null
  } | null
}

export type RecetaLinea = {
  metodo?: string | null; imagen_url?: string | null
  sph_od?: number | string | null; cyl_od?: number | string | null; axis_od?: number | string | null
  sph_os?: number | string | null; cyl_os?: number | string | null; axis_os?: number | string | null
  add_val?: number | string | null; dp?: number | string | null
}

// Una compra puede traer varios pares (un pedido por par, mismo pago de Stripe)
export type CompraLinea = { clave: string; pedidos: PedidoLinea[]; principal: PedidoLinea }
export function agruparCompras(pedidos: PedidoLinea[]): CompraLinea[] {
  const map = new Map<string, PedidoLinea[]>()
  for (const p of pedidos) {
    const k = p.stripe_session_id || `p${p.id}`
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(p)
  }
  return [...map.entries()].map(([clave, ps]) => {
    const orden = [...ps].sort((a, b) => a.id - b.id)
    return { clave, pedidos: orden, principal: orden[0] }
  }).sort((a, b) => b.principal.id - a.principal.id)
}

// Fecha/hora en Tijuana
const partesTJ = (d: Date) => {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Tijuana', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false })
  const p = Object.fromEntries(f.formatToParts(d).map(x => [x.type, x.value]))
  return { fecha: `${p.year}-${p.month}-${p.day}`, hora: Number(p.hour) % 24 }
}
export const hoyTJ = () => partesTJ(new Date()).fecha
export const sumarDias = (fecha: string, dias: number) => {
  const d = new Date(fecha + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

// Fecha (YYYY-MM-DD) límite para atender: cierre (6 pm) de ese día o del siguiente
export function limiteAtencion(createdAt: string): string {
  const { fecha, hora } = partesTJ(new Date(createdAt))
  return hora >= 18 ? sumarDias(fecha, 1) : fecha
}

// ¿Ya se pasó del tiempo para atender? (cierre 6 pm del día límite)
export function atencionVencida(createdAt: string): boolean {
  const lim = limiteAtencion(createdAt)
  const { fecha, hora } = partesTJ(new Date())
  return fecha > lim || (fecha === lim && hora >= 18)
}

export type EstadoLinea = 'nuevo' | 'contactado' | 'vencido' | 'liberado' | 'saldo_vencido' | 'en_venta' | 'entregado'
// Estado de la compra desde el punto de vista de la sucursal
export function estadoCompra(c: CompraLinea): EstadoLinea {
  const p = c.principal
  const l = p.configuracion?.linea
  if (p.estado === 'entregado') return 'entregado'
  if (l?.venta) return 'en_venta'
  if (l?.liberado_at) return l.saldo_vence && l.saldo_vence < hoyTJ() ? 'saldo_vencido' : 'liberado'
  const pg = p.configuracion?.pago
  if (pg?.modo === 'apartar' && pg.apartado_vence && pg.apartado_vence < hoyTJ()) return 'vencido'
  return l?.contactado_at ? 'contactado' : 'nuevo'
}

// ¿En qué sección va la compra? (según lo que sigue)
//   mandar  → pagó todo o dejó anticipo y ya tiene graduación: hay que pasarla a venta y mandar a hacer
//   apartado → solo apartó (con graduación)        examen → pagó sin graduación
//   armazon  → solo armazón, por recoger            saldo  → armazón liberado, saldo a favor
//   venta    → ya se pasó a venta / entregado
export type SeccionLinea = 'mandar' | 'apartado' | 'examen' | 'armazon' | 'saldo' | 'venta'
export function seccionCompra(c: CompraLinea): SeccionLinea {
  const e = estadoCompra(c)
  if (e === 'en_venta' || e === 'entregado') return 'venta'
  if (e === 'liberado' || e === 'saldo_vencido') return 'saldo'
  if (c.pedidos.every(p => p.configuracion?.solo_armazon)) return 'armazon'
  if (c.pedidos.some(p => p.configuracion?.falta_examen)) return 'examen'
  if (c.principal.configuracion?.pago?.modo === 'apartar') return 'apartado'
  return 'mandar'
}

// Urgencia de las que hay que mandar a hacer: 'atrasado' | 'hoy' | 'manana'
export function urgenciaMandar(c: CompraLinea): 'atrasado' | 'hoy' | 'manana' {
  if (atencionVencida(c.principal.created_at)) return 'atrasado'
  return limiteAtencion(c.principal.created_at) === hoyTJ() ? 'hoy' : 'manana'
}

// Rojo: hay que mandar a hacer y ya se pasó el tiempo, o apartado vencido sin resolver
export const compraEnRojo = (c: CompraLinea) => {
  const s = seccionCompra(c)
  return (s === 'mandar' && atencionVencida(c.principal.created_at)) || estadoCompra(c) === 'vencido'
}

// Normaliza teléfono a los últimos 10 dígitos
export const tel10 = (t?: string | null) => String(t ?? '').replace(/\D/g, '').slice(-10)
// Normaliza nombre: sin acentos, minúsculas, espacios simples
export const normNombre = (t?: string | null) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
