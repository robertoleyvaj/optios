# OptiOS — Historial de versiones

Formato mayor.menor.corrección. El código junto a la versión (ej. `· a19bc32`) es el deploy de Vercel.

## v2.0.1 (6 oct 2026)
- **Fotos por color más rápidas**: se pueden escoger las 3 fotos de una vez y se suben al mismo tiempo; ya no se pierde una foto si se toca otra casilla mientras la anterior sigue subiendo.
- Alta de modelo nuevo sin apodo ya no marca error (el apodo queda igual al modelo).

## v2.0 (2 oct 2026)
- **Inventario nuevo activo**: el punto de venta busca y descuenta por SKU de color (VRL-1xxx-xx). Un solo inventario para ópticas, bodega y web. El inventario viejo queda solo como consulta.

## v1.13 (2 oct 2026)
- **Ajustar existencias** desde la ficha (admin y gerente): por color y ubicación, "dice el sistema / hay de verdad", con motivo (error de captura, conteo físico, dañado o perdido). Queda en la bitácora.
- **Corregir errores de dedo** (admin): marca, modelo y nombre de color.

## v1.12.1 (1 oct 2026)
- Inventario cómodo desde el celular: lista en tarjetas, ficha con tablas deslizables y campos apilados, botones de foto visibles sin mouse, teclado numérico en medidas y piezas.
- Las fotos se reducen antes de subir (de 3–5 MB a ~300 KB) para que la web cargue rápido.
- Rol "Web" (antes "Encargado web"); no ve el inventario viejo.

## v1.12 (1 oct 2026)
- **Entrada de armazones nueva**: entra a Bodega por defecto, un solo buscador, marca de lista, medidas en 3 cajitas, varios colores de una vez, aviso de modelos repetidos o parecidos, sin costo.
- **Gamas de precio** por marca (Básico / Estándar / Premium): el precio se pone solo dentro del rango, nunca cerrado. **Precio Verly automático** = pesos ÷ tipo de cambio × 50%.
- **Cola de etiquetas**: cada entrada agrega sus etiquetas; se imprimen todas juntas en tabloide y se marcan como impresas. Reimpresión por color desde la ficha.
- **Ficha reordenada**: primero colores y existencias, datos y precio, movimientos; abajo el bloque **Para la web** (fotos por color con ⭐ portada, datos web y publicar). Se quitó la sección de fotos generales.
- **Pendientes de web en rojo**: modelos con 3+ piezas sin fotos o sin publicar.
- **Rol "Encargado web"**: solo inventario (entradas, etiquetas, fotos, datos web, publicar). Sin ventas, costos ni traspasos.

## v1.11 (1 oct 2026)
- **Datos para la web** en la ficha del armazón (solo admin): nombre en la web (apodo), para quién, forma, tipo de armazón, etiqueta y descripción en español e inglés. La talla se calcula sola de las medidas. Base para que Verly y GON tomen todo de OptiOS.

## v1.10 (1 oct 2026)
- **Colores en la web**: en la ficha del armazón (inventario nuevo) cada color tiene su circulito, hasta 3 fotos y un botón para mostrarlo u ocultarlo en la web.
- Pedidos de la tienda en línea: muestran el color del armazón que eligió el cliente (con su SKU) y el color de los filtros.

## v1.9.2 (30 sep 2026)
- Cupones del ticket: se generan, validan y canjean desde el servidor (antes no se guardaban).

## v1.9.1 (30 sep 2026)
- Catálogo: corrección de marca vacía al guardar productos.

## v1.9 (30 sep 2026)
- **Catálogo de productos por pestañas**: Micas y tratamientos (micas, tratamientos con colores por mica, paquetes), Lentes de contacto (en stock / sobre pedido), Consumibles (con o sin control de stock) y Servicios. Costos solo para administrador.
- Logo e isotipo de OptiOS en menú y login; favicon e íconos nuevos.

## v1.8 (28–29 sep 2026)
- **Inventario nuevo (vista previa)**: SKU por color, ficha de armazón con fotos y publicación, entradas de mercancía, bodega, bitácora de movimientos, traspasos con confirmación y aviso en campanita, POS por color en modo prueba.
- **Seguridad**: todas las rutas del servidor revisan sesión y rol; el costo solo llega al administrador.

## v1.7 (25 sep 2026)
- Botón de **garantía** en expedientes (cambio de producto o de graduación, 60 días).
- **Cupón de descuento** en el ticket según tabulador y canje en ventas.
- Búsqueda de pacientes por todas las palabras en todos los buscadores; sucursales legacy normalizadas.

## v1.6 (sep 2026)
- Laboratorio: nota 4×6, reimprimir entregadas, vista del repartidor, filtro de sucursal.
- Sucursal del día en el encabezado para todos los roles (registra el check-in).
- Cupones de la tienda en línea (fase 1).

## v1.5 (sep 2026)
- **Análisis mensual** de finanzas (Excel de 16 hojas) y pantalla de pendientes del cierre.
- Finanzas con cobrado real, garantías como línea propia y comisiones por método.
- Borrar venta (admin) devolviendo stock; editar método de pago.

## v1.4 (agosto 2026)
- Inventario de armazones por **color/variante**: un SKU por modelo, colores con stock por sucursal, publicación y fotos por color.
- **Bodega central**: piezas guardadas sin exhibir, separadas de lo exhibido por sucursal.
- Fusión de SKU duplicados y reconciliación del catálogo web.
- **Hoja de paciente** rediseñada: logo GON, tipografía Poppins, datos reales de sucursal, ilustración dinámica y diagnóstico refractivo profesional por ojo con recomendación de lente.
- Etiquetas de armazones (PDF tabloide con logo, SKU, precio y color).
- Estabilidad de sesión: middleware con `getSession` + login con timeout (fin del "Verificando" congelado).
- Check-in/out de asistencia solo desde computadora.

## v1.3 — Tienda en línea, finanzas
## v1.2 — RRHH, checador, vacaciones
## v1.1 — Ventas, expedientes, laboratorio, caja
## v1.0 — Primera versión de producción
