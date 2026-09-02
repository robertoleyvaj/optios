// ─────────────────────────────────────────────────────────────────────────────
// Paquete de análisis mensual · Genera INSTRUCCIONES_PARA_IA.md (v2)
// ─────────────────────────────────────────────────────────────────────────────
import type { MesData } from './queries'
import type { Metrics } from './metrics'

export function buildInstrucciones(d: MesData, m: Metrics): string {
  const cal = m.calidad
  const faltantes: string[] = []
  if (cal.checksNoCuadran) faltantes.push(`- ${cal.checksNoCuadran} control(es) cruzado(s) NO cuadran (ver hoja "0. Conciliación").`)
  if (cal.movimientosPorAclarar) faltantes.push(`- ${cal.movimientosPorAclarar} movimientos "por aclarar" ($${cal.montoPorAclarar.toLocaleString('es-MX')}) sin clasificar; no se contaron como gasto ni retiro.`)
  if (cal.ordenesSinCosto) faltantes.push(`- ${cal.ordenesSinCosto} órdenes de lab sin costo ($${cal.ingresoSinCosto.toLocaleString('es-MX')} de ingreso asociado) → margen incompleto, no asumir costo cero.`)
  if (cal.armazonesSinCosto || cal.consumiblesSinCosto) faltantes.push(`- Inventario sin costo: ${cal.armazonesSinCosto} armazones y ${cal.consumiblesSinCosto} consumibles → no se puede valorar inventario ni margen de armazón.`)
  if (!m.conversion.estadosCapturados) faltantes.push(`- Los estados de cita no se capturan (no reportar tasa de asistencia). La conversión es aproximada por teléfono.`)
  if (cal.garantiasSinOrigen || cal.garantiasSinMotivo || cal.garantiasSinLab) faltantes.push(`- Garantías incompletas: ${cal.garantiasSinOrigen} sin folio origen, ${cal.garantiasSinMotivo} sin motivo, ${cal.garantiasSinLab} sin laboratorio.`)
  if (cal.ventasSinAtendio) faltantes.push(`- ${cal.ventasSinAtendio} ventas sin "atendió" → productividad incompleta.`)
  if (cal.fuentesConError.length) faltantes.push(`- Fuentes con error de lectura: ${cal.fuentesConError.join('; ')}.`)
  if (!faltantes.length) faltantes.push('- Sin faltantes graves detectados este mes.')

  return `# INSTRUCCIONES PARA IA — Análisis mensual OptiOS

## ESTADO DEL ARCHIVO: ${m.estadoArchivo}
${m.estadoArchivo !== 'CONFIABLE' ? 'Hay diferencias o datos faltantes. Trata las cifras marcadas como aproximadas y revisa la hoja "0. Conciliación" y "16. Calidad" antes de concluir.' : 'Los controles cruzados cuadran.'}

## Periodo
**${d.mesLabel}** · ${d.fechaIni} → ${d.fechaFin} · Zona horaria America/Tijuana.
Sucursales: Baja Visión, 5 de Mayo, Plaza Laureles. Acompaña a \`Analisis_${d.anio}-${String(d.mes0 + 1).padStart(2, '0')}.xlsx\`.

## Concepto clave: DEVENGADO vs CAJA (no son lo mismo)
- **Devengado (contable):** facturación del mes − costos de esas ventas − gastos del mes. Mide si el negocio ganó.
- **Caja (efectivo):** cobros recibidos − pagos realizados. Mide cuánto efectivo entró/salió.
El archivo muestra AMBOS por separado. No los llames a los dos "utilidad neta".

## Reglas importantes de este negocio
- **Retiros del propietario** (categoría \`retiro_admin\`): dinero que el dueño saca de la caja para otros fines. **NO es un gasto operativo**; solo reduce el efectivo disponible. Nunca lo restes de la utilidad operativa.
- **Movimientos "por aclarar"** (categoría \`otros\` / concepto genérico "Otro"): sin clasificar. **No se cuentan** como gasto ni como retiro hasta tener categoría válida. Aparecen en "6. Egresos" y en "16. Calidad".
- **Compras de inventario/activos** (categoría \`compras\`): inversión, no gasto operativo del mes.

## Qué significa cada hoja
0. **Conciliación** — cada cifra con su fórmula, tabla origen, # de registros y monto; más controles cruzados CUADRA/NO CUADRA. Empieza aquí.
1. **Resumen** — bloque devengado, bloque caja, y movimientos que no son gasto (retiros/compras/por aclarar).
2. **Por sucursal** — meta, % cumplimiento, y utilidad con overhead ÷3 y proporcional.
3. **Ventas** — una fila por venta (fecha en hora Tijuana).
4. **Líneas de venta** — producto por producto.
5. **Pagos** — cada cobro; columna "Origen" distingue venta del mes / venta previa / otro ingreso de caja.
6. **Egresos** — separado en gastos de empresa, retiros del propietario y movimientos por aclarar.
7. **Productividad** — importe, ticket, % descuento, saldo, horas, facturado/hora por empleada.
8. **Conversión** — aproximada por teléfono; incluye la distribución REAL de estados de cita.
9. **Lentes y tratamientos** — MARGEN DEL TRABAJO (precio del par − costo lab), no rentabilidad aislada del lente; solo trabajos con costo; nombres normalizados.
10. **Laboratorios** — costo, margen, días, % retraso, tasa de garantía y "% con costo" (tamaño de muestra).
11. **Garantías** — conserva folio y fecha de la orden; marca faltantes.
12. **Nómina y comisiones** — pagado por categoría (empresa vs caja).
13. **Caja y métodos** — faltantes vs sobrantes con signo; cobrado por método.
14. **Inventario** — valor a costo; marca "costo faltante" en vez de cero.
15. **Tendencias** — facturado por fecha de venta, cobrado por fecha de pago; con fila TOTAL que cuadra con Resumen.
16. **Calidad** — todos los controles de integridad.

## Fórmulas
- **Facturado** = Σ total de ventas activas (sin canceladas ni cotizaciones).
- **Cobros de ventas** = Σ pagos del mes (por fecha de pago). **Otros ingresos de caja** = ingresos_caja \`pago_previo\` (ventas previas al sistema). **Total cobrado** = suma de ambos.
- **Costo de laboratorio** = Σ costo_lab de órdenes pagadas en el mes (garantías aparte).
- **Resultado operativo (base cobrado)** = Total cobrado − costo lab − garantías − gastos operativos.
- **Resultado devengado (aprox.)** = Facturado − costo de ventas del mes − gastos operativos.
- **Flujo neto** = Resultado operativo − retiros − compras de inventario.
- **Margen del trabajo** = precio al cliente del par − costo de laboratorio (incluye armazón y tratamiento; NO es margen puro del lente).

## KPIs aproximados (no presentar como exactos)
- Conversión examen/cita → venta (cruce por teléfono; se necesita relación por ID paciente–venta para ser confiable).
- Productividad por empleada (la venta guarda el nombre en texto).
- Costo de ventas devengado (se liga la orden a la venta del mes de forma aproximada).
- Margen de armazones y consumibles (requiere costo de adquisición, hoy faltante).

## Qué falta o quedó incompleto este mes
${faltantes.join('\n')}

## Prompt sugerido (pégalo y adjunta el Excel)
> Eres analista financiero y de operaciones de una cadena de 3 ópticas en México (Baja Visión, 5 de Mayo, Plaza Laureles). Te adjunto el Excel de **${d.mesLabel}**. Su ESTADO es **${m.estadoArchivo}**: primero revisa la hoja "0. Conciliación" y "16. Calidad" y dime qué cifras son confiables y cuáles no. Luego analiza:
> 1. Resultado del mes distinguiendo DEVENGADO (ganó el negocio) de CAJA (efectivo que entró/salió). Explica la diferencia entre facturado y cobrado.
> 2. Rentabilidad real por sucursal (overhead ÷3 y proporcional) y punto de equilibrio aproximado.
> 3. Mejores/peores días y horarios.
> 4. Productividad y rentabilidad por empleada considerando sucursal, horas y descuentos otorgados (no concluyas desempeño sin ese contexto).
> 5. Conversión de exámenes y citas (recuerda que es aproximada y que los estados de cita pueden no estar capturados).
> 6. Margen del trabajo por tipo de lente y tratamiento (recuerda que incluye armazón; no es margen puro del lente). Señala los trabajos sin costo capturado.
> 7. Comparación de laboratorios: costo, tiempos, retrasos, garantías y % de datos completos; no hagas ranking si la muestra es chica.
> 8. Garantías: causas y costo; qué genera re-trabajo.
> 9. Fugas de dinero: movimientos "por aclarar", descuadres de caja (separa faltantes de sobrantes), gastos atípicos o duplicados.
> 10. Retiros del propietario: cuánto salió de caja (recuerda que NO es gasto del negocio).
> 11. Inventario y armazones más/menos rentables (marca lo que no tiene costo).
> 12. Con base en "16. Calidad", qué datos deberíamos registrar mejor para el próximo mes.
> Sé concreto con cifras del archivo y termina con las 5 acciones de mayor impacto. No presentes como exactos los KPIs marcados como aproximados ni uses costos en cero como reales.
`
}
