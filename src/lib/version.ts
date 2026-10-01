// Versión de OptiOS — mayor.menor.corrección
//   MAYOR       cambios que transforman el sistema (2.0 = inventario nuevo activo)
//   MENOR       cada función nueva (cupones, traspasos, catálogo…)
//   CORRECCIÓN  arreglos chicos
// Se actualiza en cada cambio y se anota en CHANGELOG.md.
export const APP_VERSION = '1.12'

// Código del deploy: Vercel lo pone solo (primeros 7 caracteres del commit).
// En local no existe.
export const APP_BUILD = (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 7)

// En pantalla solo se ve la versión; el código del deploy aparece al pasar el mouse.
export const APP_VERSION_FULL = `v${APP_VERSION}`
export const APP_BUILD_TITLE = APP_BUILD ? `Deploy ${APP_BUILD}` : undefined
