# Hoja de ruta

Una app de control de gastos para uso **personal** y como **servicio a iglesias**,
instalable en el móvil (PWA) y con versión `.apk`.

Cada fase se entrega en su propia rama, con pruebas, y solo pasa a `main` (que
despliega Netlify y Render) cuando está verificada.

## Arreglos pendientes

- [x] **El saldo contaba movimientos con fecha futura.** Al marcar "Se repite",
      la app crea de una vez todas las repeticiones con sus fechas futuras, y
      el "Saldo en caja" las sumaba: quien registraba el alquiler de todo el
      año se veía el saldo descontado de golpe. También afectaba a los fondos
      y a las constancias (una emitida en junio podía incluir diezmos de
      diciembre). Regla nueva: **los saldos y totales cuentan hasta hoy**, y lo
      que tiene fecha posterior aparece marcado como "Programado".

## Fase 1 — Base: espacios, roles y confianza

- [x] **Espacios de trabajo**: cada usuario tiene un espacio personal y puede
      crear o unirse a espacios de iglesia. Todo (movimientos, categorías) vive
      dentro de un espacio, no de un usuario.
- [x] **Roles por espacio**: propietario, tesorero, contador, auditor (solo
      lectura) y lector.
- [x] **Invitaciones** por enlace (se puede mandar por WhatsApp) y por correo.
- [x] **Entrar a una iglesia que ya existe**: el registro avisa si ese nombre ya
      está tomado (y ofrece entrar por el enlace de invitación en vez de crear
      una iglesia gemela), y quien ya tiene cuenta puede **pedir entrar** a una
      iglesia desde "Mis espacios". Entra solo si un propietario o tesorero lo
      aprueba, eligiendo el rol: escribir el nombre de una iglesia nunca da
      acceso a sus cuentas.
- [x] **Montos en centavos** (enteros) y **moneda por espacio**. La API sigue
      hablando en unidades (`150.50`); la conversión vive en un solo sitio.
- [x] **Anular en vez de borrar**: un movimiento anulado se sigue viendo,
      tachado y con su motivo, y deja de sumar. Borrar del todo queda solo para
      el propietario.
- [x] **Historial de auditoría**: quién creó, editó o anuló qué y cuándo.
- [x] **Recuperación de contraseña** por correo.
- [x] **Migración** de los datos existentes: cada usuario actual pasa a ser
      propietario de un espacio de iglesia con sus movimientos
      (`scripts/migrar-espacios.js`, probado con datos de la forma actual).
- [x] **Desplegar**: fusionado en `main` y migración aplicada en producción (2026-09-18).

## Fase 2 — App instalable (PWA) y APK

- [x] Manifest, íconos y pantalla de inicio (`vite-plugin-pwa`).
- [x] Service worker: la app abre sin conexión.
- [x] Registrar movimientos sin conexión y sincronizar al volver, sin duplicados.
- [x] Foto del comprobante con la cámara del móvil (Cloudinary privado, enlaces de 5 min).
- [x] APK como Trusted Web Activity (Bubblewrap) con
      `/.well-known/assetlinks.json` en Netlify (verificado por Google y
      probado en un emulador Android 17). Ver `android/README.md`.
- [ ] Notificaciones push (recordatorios, resumen semanal). Pasan a la fase 4.

## Rediseño visual (entre las fases 2 y 3)

- [x] Paleta nueva (fondo greige, tarjetas blancas, ámbar para registrar) con
      modo claro, oscuro y según el sistema; fuente Manrope. La app abre en
      oscuro mientras no se elija otra cosa.
- [x] Móvil: barra inferior con "+" central, Inicio simplificado, registrar con
      teclado propio, movimientos con búsqueda y filtros.
- [x] Computadora: barra lateral, Inicio con cifras, barras por mes, dona y
      tabla; Movimientos en tabla.
- [x] Portada, acceso, íconos de la app y el resto de pantallas.
- [x] **Desplegar**: fusionado en `main` (2026-09-19).
- [x] APK 1.1.0 (versionCode 2) con los colores y el ícono nuevos; se instala encima de la 1.0.0.
- [x] APK 1.2.0 (versionCode 3) con las barras del sistema y la pantalla de carga en
      oscuro, a juego con el tema con el que abre la app.

## Fase 3 — Núcleo de iglesia

- [x] Tipos de ingreso de iglesia: diezmo, ofrenda, primicia, ofrenda especial
      (cada categoría de ingreso tiene su tipo; ingresos por tipo en el Inicio y
      en el Excel).
- [x] Aportantes con privacidad: quién dio cuánto solo lo ven propietario,
      tesorero y contador (la API lo oculta al auditor y a los lectores).
- [x] Constancias de donación anuales en PDF (por persona o todas de un año;
      total en cifras y en letras, por tipo de aporte y por mes).
- [x] Conteo de ofrenda del culto con doble firma: hoja con los billetes y
      monedas de cada moneda (suma sola), y el movimiento **no entra al libro**
      hasta que una segunda persona lo firma. Quien contó no puede firmar su
      propio conteo. Un conteo pendiente se descarta con motivo; uno ya
      asentado se corrige anulando su movimiento.
- [x] Contabilidad por fondos (general, misiones, construcción, benevolencia):
      saldo por fondo, pases entre fondos (anulables) y fondos archivados.
- [x] Presupuesto anual por ministerio: avance de lo gastado y avisos al 80 %
      y al 100 %. Avisa, **no bloquea**: quién autoriza pasarse del
      presupuesto lo decide la iglesia. Un gasto se carga a un ministerio al
      registrarlo, y cuenta contra el presupuesto del año de su fecha.
- [x] Rol de líder de ministerio: ve el suyo (presupuesto y en qué se ha ido)
      y nada más del libro, ni movimientos, ni saldos, ni fondos, ni
      aportantes, ni informes. Entra a la app por esa pantalla.
- [ ] Que el líder pueda **solicitar** un gasto contra su presupuesto: hoy
      solo lo ve, registrar sigue siendo de la tesorería.
- [x] Campañas con meta y barra de avance (un fondo con meta).
- [x] Informe de una actividad o fondo en PDF: lo que entró (con o sin los
      nombres de quienes dieron, a elección de quien lo emite), lo que salió
      con la marca de qué gastos tienen recibo, lo que se pasó a otros fondos,
      lo que quedó y las firmas de tesorería.
- [x] Informes mensual y anual en PDF: saldo de apertura, lo que entró y en qué
      se fue, saldo de cierre, el reparto por fondos **a esa fecha** y las
      firmas. El anual añade la tabla mes a mes. Comparten las piezas de
      `services/pdfBits.js` con el informe de actividad.
- [x] Logo de la iglesia: se sube desde Ajustes del espacio (solo el
      propietario) y sale impreso en los informes, el de actividad y las
      constancias. Solo PNG y JPG, que son los que pdfkit sabe incrustar. Es
      público, al revés que los comprobantes: va en papeles que se reparten.
- [x] Enlace de solo lectura para la congregación: una página sin sesión con
      **solo totales** (nunca aportantes, comprobantes ni el detalle de cada
      movimiento). Token de 32 bytes guardado con hash, se puede apagar,
      rehacer (el anterior muere al instante) o quitar, y cuenta las visitas.
      Solo el propietario lo maneja. Publica el mes o el año en curso.

## Fase 4 — Núcleo personal

- [ ] Cuentas y tarjetas con saldo real (y fecha de corte).
- [ ] Transferencias entre cuentas.
- [ ] Presupuestos mensuales por categoría y metas de ahorro.
- [ ] Recurrentes que avisan cuando toca y se confirman con el importe real.
- [ ] Deudas y préstamos.
- [ ] Importar el extracto del banco (CSV/Excel).
- [ ] Etiquetas, búsqueda y filtros guardados.

## Fase 5 — Servicio para iglesias

- [x] Página de descargas (`/descargas`): el APK para Android con sus pasos de
      instalación, y cómo instalarla desde el navegador en iPhone, Android y
      computadora. Es la página que se comparte con las iglesias.
- [x] **Hazte Socio de la App**: aporte voluntario con PayPal para sostener el
      servicio (NO son ofrendas a la iglesia: el nombre evita esa confusión).
      Órdenes, captura, webhooks firmados, reembolsos (incluidos los parciales)
      y comisión de PayPal guardada. Tarjeta al final de la barra lateral.
      **Solo en la web**: dentro de la app de Android no se muestra, porque la
      política de pagos de Google Play prohíbe llevar al usuario a pagar por
      fuera (le pasó a AnkiDroid en 2026). Ver `frontend/src/lib/platform.js`.
      Falta: crear la app en PayPal y poner sus claves (PAYPAL_CLIENT_ID,
      PAYPAL_CLIENT_SECRET, PAYPAL_MODE, PAYPAL_WEBHOOK_ID en el backend y
      VITE_PAYPAL_CLIENT_ID en Netlify). Sin ellas la sección avisa de que no
      está disponible.
- [ ] Aporte mensual recurrente (PayPal Subscriptions), si los aportes de una
      vez funcionan.
- [ ] Planes de suscripción para iglesias (PayPal Subscriptions).
- [ ] Flujo de aprobación de gastos (solicitar, aprobar, pagar).
- [ ] Conciliación bancaria y cierre mensual (bloquea editar meses cerrados).
- [ ] Varias sedes con informe consolidado.
- [ ] Landing page, alta guiada y datos de ejemplo.
- [ ] Soporte: centro de ayuda (cómo registrar, roles, fondos, constancias) y
      un botón de "reportar problema" desde la app.
- [ ] Verificación de correo y 2FA para tesoreros.
- [ ] Exportación completa de datos, términos y privacidad.
- [ ] Infraestructura: plan de pago en Render (sin arranque en frío) y copias
      de seguridad de Atlas.
