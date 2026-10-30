'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import RequireRol from '@/components/RequireRol'
import { createClient } from '@/lib/supabase/client'
import { getSucursalActual } from '@/lib/session'
import {
  agruparCompras, estadoCompra, seccionCompra, urgenciaMandar, limiteAtencion, codigoPedidoGon, tel10, normNombre, hoyTJ,
  SUCURSAL_POR_UBIC, type CompraLinea, type PedidoLinea, type SeccionLinea, type RecetaLinea,
} from '@/lib/pedidos-linea'
import { Globe, Flame, Eye, Glasses, Clock, Wallet, CheckCircle2, X, Loader2, ArrowRight, ShoppingCart, Unlock, PackageCheck, Check } from 'lucide-react'

// ─────────────────────────────────────────────────────────────
// Pedidos en línea (gonmx.com) de la sucursal en la que estás trabajando.
// Tarjetas agrupadas por lo que sigue (lo urgente arriba); al picar una sale el detalle.
// Lo ven y atienden todos (administrador, gerente y vendedores).
// ─────────────────────────────────────────────────────────────

const $$ = (n: number) => `$${Math.round(Number(n) || 0).toLocaleString('es-MX')}`
const fechaCorta = (iso: string) => new Date(iso).toLocaleString('es-MX', { timeZone: 'America/Tijuana', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
const fechaDia = (f: string) => new Date(f + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })

const SECCIONES: { k: SeccionLinea; titulo: string; icon: React.ElementType; color: string }[] = [
  { k: 'mandar',   titulo: 'Mandar a hacer',            icon: Flame,   color: 'text-red-600' },
  { k: 'apartado', titulo: 'Apartados',                 icon: Clock,   color: 'text-zinc-500' },
  { k: 'examen',   titulo: 'Esperan examen',            icon: Eye,     color: 'text-zinc-500' },
  { k: 'armazon',  titulo: 'Solo armazón · por recoger', icon: Glasses, color: 'text-zinc-500' },
  { k: 'saldo',    titulo: 'Saldo a favor',             icon: Wallet,  color: 'text-violet-600' },
]

// "apodo · marca modelo · color (SKU)" → "marca modelo"
const modeloDe = (p: PedidoLinea) => {
  const ref = p.configuracion?.armazon_ref || p.notas_cliente || ''
  const partes = ref.split(' · ')
  return (partes.length >= 2 ? partes[1] : partes[0]) || 'Armazón'
}
const micasDe = (p: PedidoLinea) => {
  const c = p.configuracion ?? {}
  if (c.solo_armazon || !c.vision) return ''
  const mica = [c.vision_nombre, c.material_nombre].filter(Boolean).join(' ')
  const fil = (c.filtros_nombres ?? []).join(', ')
  return [mica, fil].filter(Boolean).join(' + ')
}
const resumen = (c: CompraLinea) => c.pedidos.length > 1
  ? `${c.pedidos.length} pares · ${modeloDe(c.principal)}…`
  : [modeloDe(c.principal), micasDe(c.principal)].filter(Boolean).join(' · ')

// Etiqueta de la tarjeta (una sola) y color de la banda
function etiqueta(c: CompraLinea): { txt: string; cls: string; banda: string } {
  const s = seccionCompra(c)
  const p = c.principal
  const pg = p.configuracion?.pago
  const l = p.configuracion?.linea
  if (s === 'mandar') {
    const u = urgenciaMandar(c)
    if (u === 'atrasado') return { txt: `Atrasado · era el ${fechaDia(limiteAtencion(p.created_at))}`, cls: 'bg-red-100 text-red-700', banda: 'bg-red-500' }
    if (u === 'hoy') return { txt: 'Hoy antes de 6 pm', cls: 'bg-red-100 text-red-700', banda: 'bg-red-500' }
    return { txt: 'Mañana antes de 6 pm', cls: 'bg-amber-100 text-amber-800', banda: 'bg-amber-400' }
  }
  if (estadoCompra(c) === 'vencido') return { txt: `Apartado venció ${fechaDia(pg!.apartado_vence!)}`, cls: 'bg-red-100 text-red-700', banda: 'bg-red-500' }
  if (s === 'saldo') return { txt: l?.saldo_vence ? `Saldo hasta ${fechaDia(l.saldo_vence)}` : 'Saldo a favor', cls: 'bg-violet-100 text-violet-800', banda: 'bg-violet-400' }
  if (s === 'venta') return { txt: p.estado === 'entregado' ? 'Entregado' : p.estado === 'listo' ? 'Listo para recoger' : `Venta ${l?.venta?.folio ?? ''}`, cls: 'bg-emerald-100 text-emerald-800', banda: 'bg-emerald-400' }
  if (c.pedidos.some(x => x.configuracion?.inventario?.ok && x.configuracion.inventario.traspaso && !x.configuracion.inventario.liberado))
    return { txt: 'Pedir traspaso', cls: 'bg-sky-100 text-sky-800', banda: 'bg-zinc-300' }
  if (pg?.modo === 'apartar' && pg.apartado_vence) return { txt: `Apartado hasta ${fechaDia(pg.apartado_vence)}`, cls: 'bg-zinc-100 text-zinc-600', banda: 'bg-zinc-300' }
  return { txt: s === 'armazon' ? 'Por recoger' : 'Esperando examen', cls: 'bg-zinc-100 text-zinc-600', banda: 'bg-zinc-300' }
}
const pagoCorto = (c: CompraLinea) => {
  const pg = c.principal.configuracion?.pago
  if (!pg) return ''
  if (pg.saldo <= 0) return 'Pagó todo'
  if (pg.modo === 'anticipo') return `Anticipo ${$$(pg.pagado)}`
  return `Debe ${$$(pg.saldo)}`
}

type Candidato = { id: string; nombre: string; apellido: string; telefono: string | null; email: string | null; motivo: string }

export default function Page() {
  return (
    <RequireRol roles={['administrador', 'gerente', 'vendedor']}>
      <PedidosLinea />
    </RequireRol>
  )
}

function PedidosLinea() {
  const router = useRouter()
  const [sucursal, setSucursal] = useState('')
  const [compras, setCompras] = useState<CompraLinea[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [verVentas, setVerVentas] = useState(false)
  const [abierta, setAbierta] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [pasar, setPasar] = useState<CompraLinea | null>(null)

  useEffect(() => { setSucursal(getSucursalActual()) }, [])

  const cargar = useCallback(async () => {
    if (!sucursal) return
    setError('')
    try {
      const j = await fetch(`/api/ecomm/pedidos-linea?sucursal=${encodeURIComponent(sucursal)}`, { cache: 'no-store' }).then(r => r.json())
      if (!j.ok) { setError(j.error || 'No se pudieron cargar'); return }
      setCompras(agruparCompras(j.pedidos as PedidoLinea[]))
    } catch { setError('No se pudieron cargar los pedidos') }
    finally { setCargando(false) }
  }, [sucursal])
  useEffect(() => { cargar() }, [cargar])

  const accion = async (c: CompraLinea, accion: string, extra: Record<string, unknown> = {}) => {
    setOcupado(true)
    try {
      const j = await fetch('/api/ecomm/pedidos-linea', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: c.principal.id, accion, ...extra }),
      }).then(r => r.json())
      if (!j.ok) alert(j.error || 'No se pudo guardar')
      await cargar()
    } finally { setOcupado(false) }
  }

  const porSeccion = useMemo(() => {
    const m: Record<SeccionLinea, CompraLinea[]> = { mandar: [], apartado: [], examen: [], armazon: [], saldo: [], venta: [] }
    for (const c of compras) m[seccionCompra(c)].push(c)
    // Lo más urgente primero: atrasados/hoy, luego por antigüedad
    m.mandar.sort((a, b) => a.principal.id - b.principal.id)
    m.apartado.sort((a, b) => Number(estadoCompra(b) === 'vencido') - Number(estadoCompra(a) === 'vencido') || a.principal.id - b.principal.id)
    // Saldo vencido de hace más de 30 días ya no se muestra
    m.saldo = m.saldo.filter(c => estadoCompra(c) !== 'saldo_vencido')
    return m
  }, [compras])
  const pendientes = SECCIONES.reduce((s, x) => s + porSeccion[x.k].length, 0)
  const sel = compras.find(c => c.clave === abierta) ?? null

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-zinc-900 tracking-tight flex items-center gap-2">
          <Globe className="w-5 h-5 text-teal-600" /> Pedidos en línea · {sucursal || '…'}
        </h1>
        <div className="flex rounded-lg border border-zinc-200 overflow-hidden text-sm">
          <button onClick={() => setVerVentas(false)} className={`px-3 py-1.5 font-medium ${!verVentas ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-50'}`}>Por atender{pendientes ? ` (${pendientes})` : ''}</button>
          <button onClick={() => setVerVentas(true)} className={`px-3 py-1.5 font-medium ${verVentas ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-50'}`}>En venta{porSeccion.venta.length ? ` (${porSeccion.venta.length})` : ''}</button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {cargando ? (
        <p className="text-sm text-zinc-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</p>
      ) : verVentas ? (
        porSeccion.venta.length === 0
          ? <Vacio txt="Aún no hay pedidos en línea pasados a venta." />
          : <Grid compras={porSeccion.venta} onAbrir={setAbierta} />
      ) : pendientes === 0 ? (
        <Vacio txt="No hay pedidos en línea por atender." />
      ) : (
        SECCIONES.filter(s => porSeccion[s.k].length > 0).map(s => (
          <section key={s.k}>
            <h2 className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 mb-2">
              <s.icon className={`w-3.5 h-3.5 ${s.color}`} /> {s.titulo} · {porSeccion[s.k].length}
            </h2>
            <Grid compras={porSeccion[s.k]} onAbrir={setAbierta} />
          </section>
        ))
      )}

      {sel && (
        <Detalle c={sel} ocupado={ocupado} onClose={() => setAbierta(null)}
          onAccion={(a, extra) => accion(sel, a, extra)} onPasar={() => setPasar(sel)} />
      )}

      {pasar && (
        <ModalPaciente compra={pasar} onClose={() => setPasar(null)}
          onElegir={(pacienteId) => {
            const q = new URLSearchParams({ pedido_web: String(pasar.principal.id) })
            if (pacienteId) q.set('pacienteId', pacienteId)
            router.push(`/dashboard/ventas/nueva?${q.toString()}`)
          }} />
      )}
    </div>
  )
}

function Vacio({ txt }: { txt: string }) {
  return <div className="rounded-xl border border-dashed border-zinc-200 py-12 text-center text-sm text-zinc-400">{txt}</div>
}

function Grid({ compras, onAbrir }: { compras: CompraLinea[]; onAbrir: (k: string) => void }) {
  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {compras.map(c => {
        const et = etiqueta(c)
        const p = c.principal
        return (
          <button key={c.clave} onClick={() => onAbrir(c.clave)}
            className="text-left bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden hover:shadow-md hover:border-zinc-300 transition-all">
            <div className={`h-1 ${et.banda}`} />
            <div className="p-3.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold text-zinc-800 truncate">{p.clientes?.nombre || 'Cliente'}</p>
                <span className="text-[11px] font-mono text-zinc-400 flex-shrink-0">{codigoPedidoGon(p.id)}</span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5 mb-2.5 truncate">{resumen(c)}</p>
              <div className="flex items-center justify-between gap-2">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${et.cls}`}>{et.txt}</span>
                <span className="text-xs text-zinc-600">{pagoCorto(c)}</span>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ── Detalle de la compra ──
function graduacion(r?: RecetaLinea | null): string {
  if (!r) return ''
  if (r.metodo === 'manual') {
    const ojo = (e: unknown, c: unknown, x: unknown) => [e, c, x != null && x !== '' ? `x${x}` : ''].filter(v => v != null && v !== '').join(' ')
    const add = r.add_val != null && r.add_val !== '' ? ` · ADD ${r.add_val}` : ''
    const dp = r.dp != null && r.dp !== '' ? ` · DP ${r.dp}` : ''
    return `OD ${ojo(r.sph_od, r.cyl_od, r.axis_od) || '—'} · OI ${ojo(r.sph_os, r.cyl_os, r.axis_os) || '—'}${add}${dp}`
  }
  if (r.metodo === 'foto') return 'Foto de receta'
  if (r.metodo === 'sin_graduacion') return 'Sin graduación (neutro)'
  return ''
}

function Detalle({ c, ocupado, onClose, onAccion, onPasar }: {
  c: CompraLinea; ocupado: boolean; onClose: () => void
  onAccion: (accion: string, extra?: Record<string, unknown>) => void; onPasar: () => void
}) {
  const p = c.principal
  const cfg = p.configuracion ?? {}
  const pg = cfg.pago
  const l = cfg.linea
  const et = etiqueta(c)
  const s = seccionCompra(c)
  const e = estadoCompra(c)
  const sinInventario = c.pedidos.some(x => x.configuracion?.inventario && !x.configuracion.inventario.ok)
  const btn = 'inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold disabled:opacity-50'

  const verFoto = async (path: string) => {
    const j = await fetch('/api/ecomm/receta-foto?path=' + encodeURIComponent(path)).then(r => r.json()).catch(() => ({ ok: false }))
    if (j.ok) window.open(j.url, '_blank'); else alert('No se pudo abrir la foto')
  }
  const Fila = ({ k, v }: { k: string; v: React.ReactNode }) => (
    <div className="flex justify-between gap-4 py-1 text-sm"><span className="text-zinc-500 flex-shrink-0">{k}</span><span className="text-right text-zinc-800">{v}</span></div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-xl max-h-[92vh] overflow-y-auto rounded-t-xl sm:rounded-xl bg-white shadow-xl" onClick={ev => ev.stopPropagation()}>
        <div className={`h-1 ${et.banda}`} />
        <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3 border-b border-zinc-100">
          <div className="min-w-0">
            <p className="text-lg font-semibold text-zinc-900">{p.clientes?.nombre || 'Cliente'}</p>
            <p className="text-xs text-zinc-400">{codigoPedidoGon(p.id)} · {fechaCorta(p.created_at)}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{p.clientes?.telefono || cfg.telefono || 'sin teléfono'}{p.clientes?.email ? ` · ${p.clientes.email}` : ''}</p>
          </div>
          <div className="flex items-start gap-2">
            <span className={`text-[11px] font-semibold px-2 py-1 rounded ${et.cls}`}>{et.txt}</span>
            <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-3">
          {/* Lo que compró */}
          {c.pedidos.map((x, i) => {
            const r = x.recetas?.[0]
            const grad = graduacion(r)
            const xc = x.configuracion ?? {}
            return (
              <div key={x.id} className="rounded-lg bg-zinc-50 px-3.5 py-2.5">
                <p className="text-[11px] font-semibold text-zinc-400 uppercase mb-1">{c.pedidos.length > 1 ? `Par ${i + 1}` : 'Lo que compró'}</p>
                <Fila k="Armazón" v={xc.armazon_ref?.split(' · ').slice(1).join(' · ') || x.notas_cliente || '—'} />
                {xc.solo_armazon ? <Fila k="Micas" v="Solo armazón" /> : (
                  <>
                    {(xc.vision_nombre || xc.material_nombre) && <Fila k="Micas" v={[xc.vision_nombre, xc.material_nombre].filter(Boolean).join(' ')} />}
                    {(xc.filtros_nombres ?? []).length > 0 && <Fila k="Filtros" v={(xc.filtros_nombres ?? []).join(', ')} />}
                    <Fila k="Graduación" v={xc.falta_examen ? <span className="text-orange-700 font-medium">Necesita examen</span>
                      : r?.metodo === 'foto' && r.imagen_url ? <button onClick={() => verFoto(r.imagen_url!)} className="text-sky-700 font-medium hover:underline">Ver foto de receta</button>
                      : grad || '—'} />
                  </>
                )}
                {x.paciente && <Fila k="Para" v={x.paciente} />}
              </div>
            )
          })}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Pago */}
            {pg && (
              <div className="rounded-lg bg-zinc-50 px-3.5 py-2.5">
                <p className="text-[11px] font-semibold text-zinc-400 uppercase mb-1">Pago</p>
                <Fila k={pg.modo === 'apartar' ? 'Apartado' : 'Total web'} v={$$(pg.total)} />
                <Fila k="Pagó en línea" v={<span className="text-emerald-700 font-semibold">{$$(pg.pagado)}</span>} />
                <Fila k="Debe" v={<span className={pg.saldo > 0 ? 'text-rose-700 font-semibold' : ''}>{$$(pg.saldo)}</span>} />
                {pg.modo === 'apartar' && pg.apartado_vence && !l?.venta && !l?.liberado_at && (
                  <Fila k="Vence" v={<span className={e === 'vencido' ? 'text-red-600 font-semibold' : ''}>{fechaDia(pg.apartado_vence)}</span>} />
                )}
              </div>
            )}
            {/* Armazón (inventario) */}
            <div className="rounded-lg bg-zinc-50 px-3.5 py-2.5">
              <p className="text-[11px] font-semibold text-zinc-400 uppercase mb-1">Armazón</p>
              {c.pedidos.map(x => {
                const inv = x.configuracion?.inventario
                const txt = !inv ? 'Sin dato de inventario'
                  : inv.liberado ? 'Liberado (regresó a inventario)'
                  : inv.ok ? `Apartado en ${SUCURSAL_POR_UBIC[inv.ubicacion ?? ''] ?? inv.ubicacion}${inv.traspaso ? ' · pide el traspaso' : ''}`
                  : 'No se pudo apartar: no hay piezas'
                return <p key={x.id} className={`text-sm ${inv && !inv.ok ? 'text-amber-700' : inv?.traspaso && !inv.liberado ? 'text-sky-700' : 'text-zinc-700'}`}>{txt}</p>
              })}
              {l?.liberado_at && <p className="text-xs text-violet-700 mt-1">Saldo a favor de {$$(pg?.pagado ?? 0)} hasta el {l.saldo_vence ? fechaDia(l.saldo_vence) : '—'}{l.saldo_vence && l.saldo_vence < hoyTJ() ? ' (vencido)' : ''}.</p>}
              {l?.venta && <p className="text-xs text-emerald-700 mt-1">Venta {l.venta.folio} · {l.venta.por}</p>}
            </div>
          </div>

          {e === 'vencido' && <p className="text-sm text-red-700">Se le venció el apartado: llámale. Si necesita unos días, dáselos; si ya no lo quiere, libera el armazón.</p>}
          {s === 'examen' && !l?.venta && <p className="text-sm text-zinc-600">Agenda su examen; pásalo a venta cuando ya tenga su graduación.</p>}
        </div>

        {/* Acciones: una principal y las demás solo si aplican */}
        <div className="px-5 pb-5 flex flex-wrap gap-2">
          {!l?.venta && e !== 'saldo_vencido' && (
            <button disabled={ocupado} onClick={onPasar} className={`${btn} bg-zinc-900 text-white hover:bg-zinc-800`}><ShoppingCart className="w-4 h-4" /> Pasar a venta <ArrowRight className="w-4 h-4" /></button>
          )}
          {l?.venta && p.estado !== 'listo' && p.estado !== 'entregado' && (
            <button disabled={ocupado} onClick={() => { if (confirm('¿Ya están listos para recoger? Se le manda el correo al cliente.')) onAccion('listo') }}
              className={`${btn} bg-zinc-900 text-white hover:bg-zinc-800`}><PackageCheck className="w-4 h-4" /> Listo para recoger</button>
          )}
          {l?.venta && p.estado !== 'entregado' && (
            <button disabled={ocupado} onClick={() => { if (confirm('¿Ya se le entregó? Se le manda el correo de gracias.')) onAccion('entregado') }}
              className={`${btn} border border-zinc-300 text-zinc-700 hover:bg-zinc-50`}><Check className="w-4 h-4" /> Entregado</button>
          )}
          {sinInventario && !l?.venta && !l?.liberado_at && (
            <button disabled={ocupado} onClick={() => onAccion('apartar')} className={`${btn} border border-amber-300 text-amber-800 hover:bg-amber-50`}><CheckCircle2 className="w-4 h-4" /> Apartar armazón</button>
          )}
          {pg?.modo === 'apartar' && !l?.venta && !l?.liberado_at && (
            <>
              <button disabled={ocupado} onClick={() => {
                const d = prompt('¿Cuántos días más le das? (1 a 30)', '3'); if (!d) return
                onAccion('mas_dias', { dias: Number(d) })
              }} className={`${btn} border border-zinc-300 text-zinc-700 hover:bg-zinc-50`}><Clock className="w-4 h-4" /> Darle más días</button>
              <button disabled={ocupado} onClick={() => {
                if (!confirm(`¿Liberar el armazón? Regresa al inventario y los ${$$(pg.pagado)} quedan como saldo a favor 30 días.`)) return
                onAccion('liberar')
              }} className={`${btn} border border-red-200 text-red-700 hover:bg-red-50`}><Unlock className="w-4 h-4" /> Liberar armazón</button>
            </>
          )}
          {ocupado && <Loader2 className="w-4 h-4 animate-spin text-zinc-400 self-center" />}
        </div>
      </div>
    </div>
  )
}

// ── Antes de pasar a venta: ¿el paciente ya existe? (nada se junta solo) ──
function ModalPaciente({ compra, onClose, onElegir }: { compra: CompraLinea; onClose: () => void; onElegir: (pacienteId: string | null) => void }) {
  const p = compra.principal
  const nombre = p.clientes?.nombre || ''
  const email = (p.clientes?.email || p.cliente_email || '').trim().toLowerCase()
  const tel = tel10(p.clientes?.telefono || p.configuracion?.telefono)
  const [cands, setCands] = useState<Candidato[] | null>(null)
  const [sel, setSel] = useState<string>('nuevo')

  useEffect(() => {
    (async () => {
      const sb = createClient()
      const res = new Map<string, Candidato>()
      const add = (r: { id: string; nombre: string; apellido: string; telefono: string | null; email: string | null }, motivo: string) => {
        if (!res.has(r.id)) res.set(r.id, { ...r, motivo })
      }
      const cols = 'id, nombre, apellido, telefono, email'
      if (tel) {
        const { data } = await sb.from('pacientes').select(cols).ilike('telefono', `%${tel.slice(-4)}%`).limit(60)
        for (const r of data ?? []) if (tel10(r.telefono) === tel) add(r, 'coincide teléfono')
      }
      if (email) {
        const { data } = await sb.from('pacientes').select(cols).ilike('email', email).limit(10)
        for (const r of data ?? []) add(r, 'coincide correo')
      }
      const palabras = normNombre(nombre).split(' ').filter(w => w.length > 2)
      if (palabras.length > 0) {
        const { data } = await sb.from('pacientes').select(cols)
          .or(`nombre.ilike.%${palabras[0]}%,apellido.ilike.%${palabras[0]}%`).limit(80)
        for (const r of data ?? []) {
          const full = normNombre(`${r.nombre} ${r.apellido}`)
          const hits = palabras.filter(w => full.includes(w)).length
          if (hits >= Math.min(2, palabras.length)) add(r, 'nombre parecido')
        }
      }
      const lista = [...res.values()].slice(0, 6)
      setCands(lista)
      const fuerte = lista.find(c => c.motivo !== 'nombre parecido')
      if (fuerte) setSel(fuerte.id)
    })().catch(() => setCands([]))
  }, [nombre, email, tel])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3">
          <p className="font-semibold text-zinc-800">¿Este paciente ya existe?</p>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-2 px-5 py-4 text-sm">
          <p className="text-xs text-zinc-500">En la página: <b>{nombre || 'sin nombre'}</b>{tel ? ` · ${tel}` : ''}{email ? ` · ${email}` : ''}</p>
          {compra.pedidos.some(x => x.paciente) && (
            <p className="text-xs text-amber-700">Los lentes son para <b>{compra.pedidos.map(x => x.paciente).filter(Boolean).join(', ')}</b>. Si no es quien compró, búscalo o créalo en la venta.</p>
          )}
          {cands === null ? (
            <p className="text-zinc-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Buscando…</p>
          ) : (
            <>
              {cands.map(c => (
                <label key={c.id} className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 ${sel === c.id ? 'border-teal-500 bg-teal-50' : 'border-zinc-200'}`}>
                  <input type="radio" checked={sel === c.id} onChange={() => setSel(c.id)} className="mt-1" />
                  <span><b>{c.nombre} {c.apellido}</b><br /><span className="text-xs text-zinc-500">{c.telefono || 'sin teléfono'}{c.email ? ` · ${c.email}` : ''} — <i>{c.motivo}</i></span></span>
                </label>
              ))}
              <label className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 ${sel === 'nuevo' ? 'border-teal-500 bg-teal-50' : 'border-zinc-200'}`}>
                <input type="radio" checked={sel === 'nuevo'} onChange={() => setSel('nuevo')} />
                <span>Es nuevo: crear paciente con los datos de la página</span>
              </label>
              {cands.length > 0 && cands.every(c => c.motivo === 'nombre parecido') && (
                <p className="text-xs text-zinc-500">Solo coincide el nombre: confírmalo con el cliente antes de elegirlo.</p>
              )}
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-3">
          <button onClick={onClose} className="rounded-md border border-zinc-200 px-4 py-2 text-sm">Cancelar</button>
          <button disabled={cands === null} onClick={() => onElegir(sel === 'nuevo' ? null : sel)}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Continuar a la venta →</button>
        </div>
      </div>
    </div>
  )
}
