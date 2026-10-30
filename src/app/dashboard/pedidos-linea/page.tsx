'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import RequireRol from '@/components/RequireRol'
import { createClient } from '@/lib/supabase/client'
import { getSucursalActual } from '@/lib/session'
import {
  agruparCompras, estadoCompra, compraEnRojo, codigoPedidoGon, limiteAtencion, tel10, normNombre,
  SUCURSAL_POR_UBIC, type CompraLinea, type PedidoLinea, type EstadoLinea,
} from '@/lib/pedidos-linea'
import { Globe, MessageCircle, Check, ShoppingCart, Clock, Unlock, PackageCheck, X, AlertTriangle, Loader2 } from 'lucide-react'

// ─────────────────────────────────────────────────────────────
// Pedidos en línea (gonmx.com) de la sucursal en la que estás trabajando.
// Lo ven y atienden todos (administrador, gerente y vendedores).
// ─────────────────────────────────────────────────────────────

const $$ = (n: number) => `$${Math.round(Number(n) || 0).toLocaleString('es-MX')}`
const MODO: Record<string, string> = { apartar: 'Apartado', anticipo: 'Anticipo', liquidar: 'Pagado completo' }
const ETIQUETA: Record<EstadoLinea, { txt: string; cls: string }> = {
  nuevo:         { txt: 'Nuevo · escríbele',     cls: 'bg-amber-100 text-amber-800' },
  contactado:    { txt: 'Contactado',            cls: 'bg-sky-100 text-sky-800' },
  vencido:       { txt: 'Apartado vencido',      cls: 'bg-red-100 text-red-700' },
  liberado:      { txt: 'Saldo a favor',         cls: 'bg-violet-100 text-violet-800' },
  saldo_vencido: { txt: 'Saldo vencido',         cls: 'bg-zinc-200 text-zinc-600' },
  en_venta:      { txt: 'En venta',              cls: 'bg-emerald-100 text-emerald-800' },
  entregado:     { txt: 'Entregado',             cls: 'bg-zinc-100 text-zinc-500' },
}
const fechaCorta = (iso: string) => new Date(iso).toLocaleString('es-MX', { timeZone: 'America/Tijuana', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
const fechaDia = (f: string) => new Date(f + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })

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
  const [vista, setVista] = useState<'atender' | 'venta' | 'todos'>('atender')
  const [ocupado, setOcupado] = useState<number | null>(null)
  const [pasar, setPasar] = useState<CompraLinea | null>(null)

  useEffect(() => { setSucursal(getSucursalActual()) }, [])

  const cargar = useCallback(async () => {
    if (!sucursal) return
    setCargando(true); setError('')
    try {
      const j = await fetch(`/api/ecomm/pedidos-linea?sucursal=${encodeURIComponent(sucursal)}`, { cache: 'no-store' }).then(r => r.json())
      if (!j.ok) { setError(j.error || 'No se pudieron cargar'); return }
      setCompras(agruparCompras(j.pedidos as PedidoLinea[]))
    } catch { setError('No se pudieron cargar los pedidos') }
    finally { setCargando(false) }
  }, [sucursal])
  useEffect(() => { cargar() }, [cargar])

  const accion = async (c: CompraLinea, accion: string, extra: Record<string, unknown> = {}) => {
    setOcupado(c.principal.id)
    try {
      const j = await fetch('/api/ecomm/pedidos-linea', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: c.principal.id, accion, ...extra }),
      }).then(r => r.json())
      if (!j.ok) alert(j.error || 'No se pudo guardar')
      await cargar()
    } finally { setOcupado(null) }
  }

  const visibles = useMemo(() => compras.filter(c => {
    const e = estadoCompra(c)
    if (vista === 'atender') return ['nuevo', 'contactado', 'vencido', 'liberado'].includes(e)
    if (vista === 'venta') return e === 'en_venta'
    return true
  }), [compras, vista])
  const porAtender = compras.filter(c => ['nuevo', 'contactado', 'vencido', 'liberado'].includes(estadoCompra(c))).length
  const enRojo = compras.filter(compraEnRojo).length

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight flex items-center gap-2"><Globe className="w-5 h-5 text-teal-600" /> Pedidos en línea</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Compras de gonmx.com que recogen en <b>{sucursal || '…'}</b>. Escríbele al cliente el mismo día; si entra después de las 6, a más tardar al día siguiente.</p>
        </div>
        <div className="flex rounded-lg border border-zinc-200 overflow-hidden text-sm">
          {([['atender', `Por atender${porAtender ? ` (${porAtender})` : ''}`], ['venta', 'En venta'], ['todos', 'Todos']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setVista(k)} className={`px-3 py-1.5 font-medium ${vista === k ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-50'}`}>{l}</button>
          ))}
        </div>
      </div>

      {enRojo > 0 && (
        <div className="rounded-lg bg-red-50 ring-1 ring-red-200 px-4 py-2.5 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {enRojo} pedido{enRojo === 1 ? '' : 's'} fuera de tiempo: atiéndelos primero.
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {cargando ? (
        <p className="text-sm text-zinc-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</p>
      ) : visibles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 py-12 text-center text-sm text-zinc-400">No hay pedidos aquí.</div>
      ) : (
        <div className="space-y-3">
          {visibles.map(c => (
            <TarjetaCompra key={c.clave} c={c} ocupado={ocupado === c.principal.id}
              onAccion={(a, extra) => accion(c, a, extra)} onPasar={() => setPasar(c)} />
          ))}
        </div>
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

function TarjetaCompra({ c, ocupado, onAccion, onPasar }: {
  c: CompraLinea; ocupado: boolean
  onAccion: (accion: string, extra?: Record<string, unknown>) => void; onPasar: () => void
}) {
  const p = c.principal
  const cfg = p.configuracion ?? {}
  const pg = cfg.pago
  const l = cfg.linea
  const e = estadoCompra(c)
  const rojo = compraEnRojo(c)
  const nombre = p.clientes?.nombre || 'Cliente'
  const tel = tel10(p.clientes?.telefono || cfg.telefono)
  const wa = tel ? `https://wa.me/52${tel}?text=${encodeURIComponent(`¡Hola ${nombre.split(' ')[0]}! 👋 Te escribimos de GON Ópticas por tu pedido ${codigoPedidoGon(p.id)} de gonmx.com.`)}` : ''
  const traspasos = c.pedidos.map(x => x.configuracion?.inventario).filter(i => i?.ok && i.traspaso && !i.liberado)
  const sinInventario = c.pedidos.some(x => x.configuracion?.inventario && !x.configuracion.inventario.ok)
  const solo = c.pedidos.every(x => x.configuracion?.solo_armazon)
  const faltaExamen = c.pedidos.some(x => x.configuracion?.falta_examen)
  const btn = 'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50'

  return (
    <div className={`rounded-xl border bg-white p-4 ${rojo ? 'border-red-300 ring-1 ring-red-200' : 'border-zinc-200'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-mono text-zinc-400">{codigoPedidoGon(p.id)} · {fechaCorta(p.created_at)}</p>
          <p className="font-semibold text-zinc-900">{nombre}</p>
          <p className="text-xs text-zinc-500">{p.clientes?.telefono || cfg.telefono || 'sin teléfono'}{p.clientes?.email ? ` · ${p.clientes.email}` : ''}</p>
        </div>
        <div className="flex flex-wrap gap-1 justify-end">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${ETIQUETA[e].cls}`}>{ETIQUETA[e].txt}</span>
          {rojo && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-600 text-white">Fuera de tiempo</span>}
          {faltaExamen && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">Falta examen</span>}
          {solo && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">Solo armazón</span>}
        </div>
      </div>

      <ul className="mt-2 space-y-0.5 text-sm text-zinc-700">
        {c.pedidos.map((x, i) => (
          <li key={x.id}>{c.pedidos.length > 1 ? <b>Par {i + 1}: </b> : null}{x.notas_cliente || cfg.armazon_ref}</li>
        ))}
      </ul>

      {pg && (
        <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-zinc-50 p-2.5 text-center text-sm">
          <div><p className="text-[10px] text-zinc-400">{MODO[pg.modo] ?? pg.modo}</p><p className="font-semibold">{$$(pg.total)}</p></div>
          <div><p className="text-[10px] text-zinc-400">Pagó en línea</p><p className="font-semibold text-emerald-700">{$$(pg.pagado)}</p></div>
          <div><p className="text-[10px] text-zinc-400">Debe</p><p className="font-semibold text-rose-700">{$$(pg.saldo)}</p></div>
        </div>
      )}

      <div className="mt-2 space-y-1 text-xs">
        {e === 'nuevo' && <p className={rojo ? 'text-red-600 font-semibold' : 'text-zinc-500'}><Clock className="inline w-3 h-3 mr-1" />Escríbele a más tardar el {fechaDia(limiteAtencion(p.created_at))} antes de las 6 pm.</p>}
        {l?.contactado_at && <p className="text-zinc-500"><Check className="inline w-3 h-3 mr-1" />Contactado por {l.contactado_por} · {fechaCorta(l.contactado_at)}</p>}
        {pg?.modo === 'apartar' && pg.apartado_vence && !l?.venta && !l?.liberado_at && (
          <p className={e === 'vencido' ? 'text-red-600 font-semibold' : 'text-zinc-500'}>Apartado hasta el {fechaDia(pg.apartado_vence)} para completar su anticipo (35% o más).</p>
        )}
        {e === 'vencido' && <p className="text-red-600">Llámale. Si necesita unos días más, dáselos; si ya no lo quiere, libera el armazón (sus {$$(pg?.pagado ?? 0)} quedan como saldo a favor 30 días).</p>}
        {l?.liberado_at && <p className="text-violet-700">Armazón liberado por {l.liberado_por}. Saldo a favor de {$$(pg?.pagado ?? 0)} hasta el {l.saldo_vence ? fechaDia(l.saldo_vence) : '—'}: si regresa, pásalo a venta con el armazón que elija.</p>}
        {traspasos.map((i, k) => <p key={k} className="text-teal-700 font-medium">🚚 {i!.sku} está apartado en {SUCURSAL_POR_UBIC[i!.ubicacion ?? ''] ?? i!.ubicacion}: pide el traspaso a tu sucursal.</p>)}
        {sinInventario && <p className="text-amber-700">⚠ {c.pedidos.map(x => x.configuracion?.inventario?.aviso).filter(Boolean).join(' ')}</p>}
        {faltaExamen && !l?.venta && <p className="text-orange-700">Pagó sin graduación: agenda su examen; pásalo a venta cuando ya tenga su graduación.</p>}
        {l?.venta && <p className="text-emerald-700 font-medium">Venta {l.venta.folio} · la pasó {l.venta.por} · {fechaCorta(l.venta.fecha)}</p>}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className={`${btn} bg-[#25D366] text-white`}><MessageCircle className="w-3.5 h-3.5" /> WhatsApp</a>}
        {!l?.contactado_at && !l?.venta && e !== 'entregado' && (
          <button disabled={ocupado} onClick={() => onAccion('contactado')} className={`${btn} border border-zinc-300 text-zinc-700 hover:bg-zinc-50`}><Check className="w-3.5 h-3.5" /> Ya le escribí</button>
        )}
        {!l?.venta && e !== 'entregado' && e !== 'saldo_vencido' && (
          <button disabled={ocupado} onClick={onPasar} className={`${btn} bg-zinc-900 text-white hover:bg-zinc-800`}><ShoppingCart className="w-3.5 h-3.5" /> Pasar a venta</button>
        )}
        {pg?.modo === 'apartar' && !l?.venta && !l?.liberado_at && (
          <>
            <button disabled={ocupado} onClick={() => {
              const d = prompt('¿Cuántos días más le das? (1 a 30)', '3'); if (!d) return
              onAccion('mas_dias', { dias: Number(d) })
            }} className={`${btn} border border-zinc-300 text-zinc-700 hover:bg-zinc-50`}><Clock className="w-3.5 h-3.5" /> Darle más días</button>
            <button disabled={ocupado} onClick={() => {
              if (!confirm(`¿Liberar el armazón? Regresa al inventario para vender y los ${$$(pg.pagado)} quedan como saldo a favor 30 días.`)) return
              onAccion('liberar')
            }} className={`${btn} border border-red-200 text-red-700 hover:bg-red-50`}><Unlock className="w-3.5 h-3.5" /> Liberar armazón</button>
          </>
        )}
        {l?.venta && p.estado !== 'listo' && p.estado !== 'entregado' && (
          <button disabled={ocupado} onClick={() => { if (confirm('¿Ya están listos para recoger? Se le manda el correo al cliente.')) onAccion('listo') }}
            className={`${btn} border border-emerald-300 text-emerald-700 hover:bg-emerald-50`}><PackageCheck className="w-3.5 h-3.5" /> Listo para recoger</button>
        )}
        {l?.venta && p.estado !== 'entregado' && (
          <button disabled={ocupado} onClick={() => { if (confirm('¿Ya se le entregó? Se le manda el correo de gracias.')) onAccion('entregado') }}
            className={`${btn} border border-zinc-300 text-zinc-700 hover:bg-zinc-50`}><Check className="w-3.5 h-3.5" /> Entregado</button>
        )}
        {ocupado && <Loader2 className="w-4 h-4 animate-spin text-zinc-400 self-center" />}
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
        let q = sb.from('pacientes').select(cols)
        q = q.or(`nombre.ilike.%${palabras[0]}%,apellido.ilike.%${palabras[0]}%`)
        const { data } = await q.limit(80)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3">
          <p className="font-semibold text-zinc-800">¿Este paciente ya existe?</p>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-2 px-5 py-4 text-sm">
          <p className="text-xs text-zinc-500">En la página: <b>{nombre || 'sin nombre'}</b>{tel ? ` · ${tel}` : ''}{email ? ` · ${email}` : ''}</p>
          {compra.pedidos.some(x => x.paciente) && (
            <p className="text-xs text-amber-700">Ojo: los lentes son para <b>{compra.pedidos.map(x => x.paciente).filter(Boolean).join(', ')}</b>. Busca o crea a esa persona en la venta si no es quien compró.</p>
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
                <p className="text-xs text-zinc-500">Solo coincide el nombre: confírmalo con el cliente (fecha de nacimiento o teléfono) antes de elegirlo.</p>
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
