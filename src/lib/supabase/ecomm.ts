import { createClient } from '@supabase/supabase-js'

/**
 * Cliente de la base de e-commerce (GON / Verly) — proyecto donde vive el
 * catálogo de armazones (tabla `armazones`, compartida con las webs).
 *
 * Usa la SECRET key, así que este cliente SOLO debe importarse desde código de
 * servidor (route handlers, server actions). Nunca desde un componente cliente.
 */
export function createEcommClient() {
  const url = process.env.SUPABASE_ECOMM_URL
  const key = process.env.SUPABASE_ECOMM_SERVICE_KEY
  if (!url || !key) {
    throw new Error('Faltan SUPABASE_ECOMM_URL o SUPABASE_ECOMM_SERVICE_KEY en el entorno.')
  }
  return createClient(url, key, { auth: { persistSession: false } })
}
