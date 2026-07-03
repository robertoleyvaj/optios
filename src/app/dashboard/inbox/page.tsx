'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Mail, Send, Plus, X, ChevronRight, Clock, MapPin, User, Users } from 'lucide-react'

const SUCURSALES = ['Baja Visión', '5 de Mayo', 'Plaza Laureles']

type Mensaje = {
  id: string
  created_at: string
  de: string
  para_tipo: string
  para_valor: string
  asunto: string
  cuerpo: string
  parent_id: string | null
  leido: boolean
  tipo: string
  respuestas?: Mensaje[]
}

function tiempoRelativo(fecha: string) {
  const diff = Date.now() - new Date(fecha).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min}m`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h}h`
  return new Date(fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

export default function InboxPage() {
  const [mensajes, setMensajes]       = useState<Mensaje[]>([])
  const [seleccionado, setSeleccionado] = useState<Mensaje | null>(null)
  const [cargando, setCargando]       = useState(true)
  const [showCompose, setShowCompose] = useState(false)
  const [respuesta, setRespuesta]     = useState('')
  const [usuario, setUsuario]         = useState<{ nombre: string; sucursal: string; rol: string }>({ nombre: '', sucursal: '', rol: '' })

  // Compose form
  const [compForm, setCompForm] = useState({
    para_tipo: 'sucursal' as 'sucursal' | 'usuario',
    para_valor: '',
    asunto: '',
    cuerpo: '',
  })

  useEffect(() => {
    try {
      const raw = localStorage.getItem('optios_demo_user')
      if (raw) setUsuario(JSON.parse(raw))
    } catch { /* noop */ }
  }, [])

  const fetchMensajes = useCallback(async () => {
    if (!usuario.nombre) return
    try {
      const sb = createClient()
      // Mensajes recibidos: para mi sucursal o para mí directamente
      const { data } = await sb
        .from('mensajes')
        .select('*')
        .or(`para_valor.eq.${usuario.nombre},para_valor.eq.${usuario.sucursal}`)
        .is('parent_id', null)
        .order('created_at', { ascending: false })

      // También mensajes enviados por mí
      const { data: enviados } = await sb
        .from('mensajes')
        .select('*')
        .eq('de', usuario.nombre)
        .is('parent_id', null)
        .order('created_at', { ascending: false })

      const todos = [...(data ?? []), ...(enviados ?? [])]
      const unicos = Array.from(new Map(todos.map(m => [m.id, m])).values())
      unicos.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setMensajes(unicos)
    } catch { /* noop */ }
    setCargando(false)
  }, [usuario.nombre, usuario.sucursal])

  useEffect(() => { fetchMensajes() }, [fetchMensajes])

  const abrirMensaje = async (m: Mensaje) => {
    setSeleccionado(m)
    setRespuesta('')
    // Marcar como leído
    if (!m.leido && m.de !== usuario.nombre) {
      const sb = createClient()
      await sb.from('mensajes').update({ leido: true }).eq('id', m.id)
      setMensajes(prev => prev.map(x => x.id === m.id ? { ...x, leido: true } : x))
    }
    // Cargar respuestas
    const sb = createClient()
    const { data } = await sb
      .from('mensajes')
      .select('*')
      .eq('parent_id', m.id)
      .order('created_at', { ascending: true })
    setSeleccionado({ ...m, respuestas: data ?? [] })
  }

  const enviarRespuesta = async () => {
    if (!respuesta.trim() || !seleccionado) return
    const sb = createClient()
    await sb.from('mensajes').insert({
      de: usuario.nombre,
      para_tipo: seleccionado.de === usuario.nombre ? seleccionado.para_tipo : 'usuario',
      para_valor: seleccionado.de === usuario.nombre ? seleccionado.para_valor : seleccionado.de,
      asunto: `Re: ${seleccionado.asunto}`,
      cuerpo: respuesta.trim(),
      parent_id: seleccionado.id,
    })
    setRespuesta('')
    abrirMensaje(seleccionado)
  }

  const enviarMensaje = async () => {
    if (!compForm.para_valor || !compForm.asunto || !compForm.cuerpo) return
    const sb = createClient()
    await sb.from('mensajes').insert({
      de: usuario.nombre,
      para_tipo: compForm.para_tipo,
      para_valor: compForm.para_valor,
      asunto: compForm.asunto,
      cuerpo: compForm.cuerpo,
    })
    setShowCompose(false)
    setCompForm({ para_tipo: 'sucursal', para_valor: '', asunto: '', cuerpo: '' })
    fetchMensajes()
  }

  const noLeidos = mensajes.filter(m => !m.leido && m.de !== usuario.nombre).length

  return (
    <div className="flex h-full gap-0 -mx-6 -my-5">

      {/* ── Lista de mensajes ── */}
      <div className="w-80 flex-shrink-0 bg-white border-r border-zinc-100 flex flex-col">
        <div className="px-4 py-4 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-zinc-500" />
            <h1 className="font-semibold text-zinc-800">Inbox</h1>
            {noLeidos > 0 && (
              <span className="bg-[#0D9488] text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                {noLeidos}
              </span>
            )}
          </div>
          <button
            onClick={() => setShowCompose(true)}
            className="flex items-center gap-1.5 bg-[#0B0E14] text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-[#1B3A6B] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Nuevo
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-zinc-50">
          {cargando ? (
            <div className="p-6 text-center text-sm text-zinc-400">Cargando...</div>
          ) : mensajes.length === 0 ? (
            <div className="p-8 text-center">
              <Mail className="w-8 h-8 text-zinc-200 mx-auto mb-2" />
              <p className="text-sm text-zinc-400">Sin mensajes</p>
            </div>
          ) : mensajes.map(m => {
            const esPropio = m.de === usuario.nombre
            const noLeido = !m.leido && !esPropio
            return (
              <button
                key={m.id}
                onClick={() => abrirMensaje(m)}
                className={`w-full text-left px-4 py-3.5 hover:bg-zinc-50 transition-colors ${seleccionado?.id === m.id ? 'bg-zinc-50' : ''}`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {noLeido && <div className="w-1.5 h-1.5 rounded-full bg-[#0D9488] flex-shrink-0 mt-0.5" />}
                    <p className={`text-sm truncate ${noLeido ? 'font-semibold text-zinc-900' : 'text-zinc-600'}`}>
                      {esPropio ? `→ ${m.para_valor}` : m.de}
                    </p>
                  </div>
                  <span className="text-xs text-zinc-400 flex-shrink-0">{tiempoRelativo(m.created_at)}</span>
                </div>
                <p className={`text-sm truncate ${noLeido ? 'font-medium text-zinc-800' : 'text-zinc-500'}`}>{m.asunto}</p>
                <p className="text-xs text-zinc-400 truncate mt-0.5">{m.cuerpo}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Vista del mensaje ── */}
      <div className="flex-1 flex flex-col bg-[#F8FAFC]">
        {seleccionado ? (
          <>
            <div className="bg-white border-b border-zinc-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-zinc-900">{seleccionado.asunto}</h2>
              <div className="flex items-center gap-4 mt-1 text-xs text-zinc-400">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" /> De: {seleccionado.de}
                </span>
                <span className="flex items-center gap-1">
                  {seleccionado.para_tipo === 'sucursal'
                    ? <><MapPin className="w-3 h-3" /> Para: {seleccionado.para_valor}</>
                    : <><User className="w-3 h-3" /> Para: {seleccionado.para_valor}</>
                  }
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {new Date(seleccionado.created_at).toLocaleString('es-MX')}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {/* Mensaje original */}
              <div className="bg-white rounded-xl border border-zinc-100 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-full bg-[#0B0E14] flex items-center justify-center">
                    <span className="text-white text-xs font-bold">{seleccionado.de[0]}</span>
                  </div>
                  <span className="text-sm font-medium text-zinc-700">{seleccionado.de}</span>
                </div>
                <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">{seleccionado.cuerpo}</p>
              </div>

              {/* Respuestas */}
              {seleccionado.respuestas?.map(r => (
                <div key={r.id} className={`rounded-xl border p-5 ${r.de === usuario.nombre ? 'bg-[#0D9488]/5 border-[#0D9488]/20 ml-6' : 'bg-white border-zinc-100'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-zinc-200 flex items-center justify-center">
                        <span className="text-zinc-600 text-xs font-bold">{r.de[0]}</span>
                      </div>
                      <span className="text-sm font-medium text-zinc-700">{r.de}</span>
                    </div>
                    <span className="text-xs text-zinc-400">{tiempoRelativo(r.created_at)}</span>
                  </div>
                  <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">{r.cuerpo}</p>
                </div>
              ))}
            </div>

            {/* Caja de respuesta */}
            <div className="bg-white border-t border-zinc-100 px-6 py-4">
              <div className="flex gap-3">
                <textarea
                  value={respuesta}
                  onChange={e => setRespuesta(e.target.value)}
                  placeholder="Escribe una respuesta..."
                  rows={2}
                  className="flex-1 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
                />
                <button
                  onClick={enviarRespuesta}
                  disabled={!respuesta.trim()}
                  className="px-4 py-2 bg-[#0B0E14] text-white rounded-xl hover:bg-[#1B3A6B] disabled:opacity-40 transition-colors flex items-center gap-2 text-sm font-medium"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <Mail className="w-12 h-12 text-zinc-200 mb-3" />
            <p className="text-zinc-400 text-sm">Selecciona un mensaje para leerlo</p>
          </div>
        )}
      </div>

      {/* ── Modal Compose ── */}
      {showCompose && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
              <h3 className="font-semibold text-zinc-800">Nuevo mensaje</h3>
              <button onClick={() => setShowCompose(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {/* Para: tipo */}
              <div className="flex gap-2">
                <button
                  onClick={() => setCompForm(f => ({ ...f, para_tipo: 'sucursal', para_valor: '' }))}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-colors ${compForm.para_tipo === 'sucursal' ? 'bg-[#0B0E14] text-white border-[#0B0E14]' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}
                >
                  <MapPin className="w-3.5 h-3.5" /> Sucursal
                </button>
                <button
                  onClick={() => setCompForm(f => ({ ...f, para_tipo: 'usuario', para_valor: '' }))}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-colors ${compForm.para_tipo === 'usuario' ? 'bg-[#0B0E14] text-white border-[#0B0E14]' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}
                >
                  <User className="w-3.5 h-3.5" /> Persona
                </button>
              </div>

              {/* Para: valor */}
              {compForm.para_tipo === 'sucursal' ? (
                <div className="grid grid-cols-3 gap-2">
                  {SUCURSALES.map(s => (
                    <button
                      key={s}
                      onClick={() => setCompForm(f => ({ ...f, para_valor: s }))}
                      className={`py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${compForm.para_valor === s ? 'bg-[#0D9488]/10 border-[#0D9488] text-[#0D9488]' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  type="text"
                  placeholder="Nombre de la persona..."
                  value={compForm.para_valor}
                  onChange={e => setCompForm(f => ({ ...f, para_valor: e.target.value }))}
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
                />
              )}

              <input
                type="text"
                placeholder="Asunto"
                value={compForm.asunto}
                onChange={e => setCompForm(f => ({ ...f, asunto: e.target.value }))}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
              />
              <textarea
                placeholder="Escribe tu mensaje..."
                value={compForm.cuerpo}
                onChange={e => setCompForm(f => ({ ...f, cuerpo: e.target.value }))}
                rows={4}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
              />
            </div>
            <div className="flex gap-3 px-6 pb-5">
              <button onClick={() => setShowCompose(false)} className="flex-1 border border-zinc-200 text-zinc-600 rounded-xl py-2.5 text-sm hover:bg-zinc-50 transition-colors">
                Cancelar
              </button>
              <button
                onClick={enviarMensaje}
                disabled={!compForm.para_valor || !compForm.asunto || !compForm.cuerpo}
                className="flex-1 bg-[#0B0E14] text-white rounded-xl py-2.5 text-sm font-medium hover:bg-[#1B3A6B] disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" /> Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
