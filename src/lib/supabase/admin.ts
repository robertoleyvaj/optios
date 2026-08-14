import { createClient } from '@supabase/supabase-js'

/**
 * Cliente ADMIN del proyecto OptiOS (service_role). SOLO para código de servidor
 * (route handlers). Se usa para subir/borrar archivos en Storage y operaciones que
 * requieren permisos elevados. Nunca importar desde un componente cliente.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.')
  }
  return createClient(url, key, { auth: { persistSession: false } })
}
