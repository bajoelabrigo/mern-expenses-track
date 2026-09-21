# Auditoría — 21 de septiembre de 2026

Revisión completa de la aplicación: código, datos reales, pruebas, seguridad y
accesibilidad. Todo lo que dice este documento se comprobó leyendo el código,
**midiendo** sobre la base real (solo lectura) o ejecutando algo; cuando algo es
una impresión, lo digo.

## 1. Los cinco titulares

1. **La app está viva, sana y en pleno estreno.** Hoy mismo se anotaron 21
   movimientos, se crearon 17 personas, un fondo y 3 miembros. Las funciones
   avanzadas tienen **1 a 3 días de vida** y ya se están usando: de los
   movimientos de septiembre, **17 llevan aportante (44%) y 18 llevan fondo
   (46%)**.
2. **La usa una sola persona**: 417 de los 438 movimientos los anotó el
   propietario. Las tres tesoreras llevan 0 porque **se agregaron hoy**: el
   equipo está creado y todavía no ha entrado. Es el riesgo a vigilar (si esa
   persona para, los libros paran), no un fallo de la app.
3. **La base técnica está sana**: 337 pruebas (200 backend + 137 frontend),
   66 de 67 endpoints con al menos una prueba, 0 vulnerabilidades en
   dependencias, CI en verde, y el aislamiento por espacio funciona.
4. **El tema oscuro cumple contraste AA en todo** (5,1 a 15,4:1). **El claro
   no**: texto secundario 3,17–3,78:1, importes de ingreso 3,57:1, errores
   4,33:1 (AA pide 4,5:1 para texto normal).
5. **Hay tres movimientos huérfanos** de junio de 2025 (ofrendas) que quedaron
   sin espacio ni autor en la migración: son invisibles para la app.

## 2. Lo que está bien (y conviene no romper)

- **Sin secretos en el repositorio.** Ningún `.env` está rastreado, los respaldos
  (`backend/backups/`) están ignorados, y las claves del `.env` nunca entraron en
  un commit. El repositorio es público, así que esto importa.
- **Sin deuda marcada:** cero `TODO`, `FIXME` o `HACK` en el código.
- **Permisos bien puestos.** El panel de administración (`isAuthenticated` +
  `isAdmin`) y los pagos de socio están protegidos; el webhook de PayPal es
  público a propósito y verifica la firma. No encontré rutas sin guarda que
  debieran tenerla.
- **Aislamiento por espacio sólido.** Probado a lo bruto: al sembrar por error un
  movimiento en otro espacio, la API rechazó vincular a una persona de otra
  iglesia. Ningún usuario quedó sin espacio, ningún espacio sin propietario.
- **Datos coherentes:** 0 movimientos sin categoría, las 17 personas del
  directorio aparecen en algún movimiento, y el ritmo de registro es constante
  (19 meses, ~24 movimientos/mes, el último ayer).
- **El tema oscuro, medido:** todos los pares de color cumplen AA, incluido el
  aviso ámbar (11,99:1) y el texto secundario (5,11:1).

## 3. Datos reales: qué se usa y desde cuándo

**Lo primero es la edad de cada función**, porque sin eso los números engañan:
el libro lleva 19 meses de historia, pero casi todo lo demás nació esta semana.

| Función | Nació | Uso |
|---|---|---|
| Registrar movimientos y categorías | base del proyecto | 438 movimientos, último ayer |
| Fondos, personas (aportantes), comprobantes, socios | **19 de septiembre (hace 3 días)** | 1 fondo creado; 18 movimientos con fondo |
| Conteo de ofrenda, ministerios, enlace público | **20 de septiembre (hace 2 días)** | 0 (todavía no ha hecho falta) |
| Pagos a personas, solicitudes para entrar | **21 de septiembre (hoy)** | 2 pagos ya registrados |
| Equipo: propietario + 3 tesoreras + contador + auditor | **hoy** | El propietario anotó 417 movimientos; los demás, 0 |

**La adopción, bien medida.** Comparar contra los 438 movimientos históricos no
dice nada: hay que mirar los movimientos anotados desde que la función existe.
De los **39 movimientos con fecha de septiembre**: **17 llevan aportante (44%)**,
**18 llevan fondo (46%)** y **2 llevan pago a persona**. En agosto, ninguno
llevaba nada, porque las funciones no existían.

**El día de hoy, en el historial:** 21 movimientos, **17 personas creadas**, 1
fondo, 1 categoría, 3 miembros agregados, 2 ediciones y 1 invitación. Es una
iglesia poniendo la app en marcha, no una app abandonada.

> **Corrijo aquí un error de mi primer análisis:** empecé diciendo que estas
> funciones "están sin estrenar" porque las comparé con los 19 meses de historia.
> El usuario me aclaró que son de ayer, y al mirar la edad de cada archivo en git
> (1 a 3 días) y los movimientos del mes, el diagnóstico cambia por completo. Lo
> dejo escrito porque una auditoría que no corrige sus propias conclusiones no
> sirve de nada.

### Lo que sí conviene vigilar

- **Una sola persona anota.** Hoy el 95% de los movimientos son del propietario.
  Es normal recién empezando, pero conviene que las tesoreras entren pronto: si
  esa persona falta, los libros se paran. Un vistazo de "actividad del equipo"
  ayudaría a verlo sin preguntar.
- **Funciones listas y sin estrenar porque el momento no llegó**: el conteo de
  ofrenda con doble firma (el domingo), los ministerios con presupuesto (cuando
  se definan), los comprobantes (cuando se paguen gastos con recibo) y el enlace
  público (cuando se quiera enseñar las cuentas a la congregación). No hay nada
  que arreglar ahí; sí conviene que el primer uso salga bien.

### Otras anomalías de datos

| Qué | Cuántos | Qué propongo |
|---|---|---|
| Movimientos sin espacio (junio 2025, formato viejo de montos) | 3 | Borrar (son invisibles) o asignarlos a mano a la iglesia |
| Usuarios sin espacio predeterminado (entran a su espacio personal) | 3 | Ponérselo a la iglesia desde "Mis espacios" |
| Espacios personales llamados "Mis finanzas" | 5 | Es correcto (uno por persona); en el panel de admin convendría diferenciarlos por nombre |

## 4. Lo que se puede mejorar

### 4.1 Privacidad y permisos

- **[media] Los filtros por persona no están cerrados en el servidor.**
  `GET /transactions/lists?donor=<id>` y `?payee=<id>` aplican el filtro sin
  comprobar `donor:read` (`transactionController.js:124-135`), aunque el
  comentario dice "solo para quien puede verlos": la guarda vive solo en el
  frontend. **Verificado por mí.** Hoy hace falta conocer el id de la persona
  (que tampoco se puede listar sin permiso), así que es defensa en profundidad,
  no una fuga abierta. Arreglo: rechazar esos dos filtros sin el permiso.
- **[media] El correo de los líderes de ministerio se entrega de más.**
  `ministryService.js:58` hace `populate("leader", "username email")`, mientras
  que los correos de los miembros solo los ve `members:manage`. **Verificado.** El
  contador y el auditor ven correos que no les tocan: devolver solo el `username`.
- **[media] El historial deja ver datos personales.** Las entradas de
  `member.add` e `invitation.create` guardan el correo en `after`, y el historial
  lo lee el auditor (`audit:read`). El filtro actual solo oculta `entity: "donor"`
  (`workspaceController.js:601`). Arreglo: no guardar (o no mostrar) el correo en
  esas entradas.

### 4.2 Integridad del dinero

- **[media] El informe de un fondo suma en coma flotante.** `fundController.js:129`
  reduce `item.amount` (unidades ya convertidas) en vez de sumar centavos y
  convertir al final — justo lo que `utils/money.js` existe para evitar.
  **Verificado.** Con 438 movimientos el error es de centavos, pero es
  exactamente el tipo de error que la app dice no permitir.
- **[media] Un conteo de ofrenda se puede asentar dos veces.** `confirm` lee,
  valida y luego crea: dos confirmaciones simultáneas pasan las dos y crean dos
  ingresos (`offeringCountController.js:134-169`). Arreglo: cambiar el estado de
  forma atómica antes de crear el movimiento.
- **[media] Una serie recurrente no es atómica.** `insertMany` de N movimientos:
  si falla a mitad quedan movimientos sueltos y el reintento con el mismo
  `clientId` no los reconoce (`transactionController.js:338-396`). Hoy nadie usa
  recurrentes (0 en los datos), así que el riesgo es teórico.
- **[baja] El pago de socio puede reventar el webhook.** `markPaid` puede
  devolver `null` y el código hace `saved.amount` → 500, y PayPal reintenta el
  mismo aviso en bucle (`supportController.js:128`).

### 4.3 Robustez y silencios

- **[media] Un fallo del enlace público se traga sin rastro:**
  `PublicReport.updateOne(...).catch(() => {})` sin `await`
  (`publicReportController.js:152`). Además la página pública agrega todo el
  histórico en cada visita.
- **[baja] La línea que invalida los fondos al asentar un conteo es inútil.**
  `CountsPage.jsx:125` invalida `["funds"]`, pero la clave real es
  `["transactions","funds"]`. **Verificado que NO es un fallo**: la línea 123 ya
  invalida `["transactions"]`, que es prefijo de la clave real, así que el saldo
  sí se refresca. Es una línea muerta.

### 4.4 Rendimiento y consultas

- **[media] Listados y Excel sin tope.** `getByPeriod` no limita
  (`transactionController.js:805`) y el Excel arma el libro completo en memoria
  (`:893`). Con 438 movimientos no se nota; con 5.000 sí.
- **[media] Índices que faltan:** `FundTransfer` solo tiene `{workspace, date}`,
  pero se filtra por `from` y `to` (pases entre fondos); el listado de
  movimientos ordena solo por `date`, sin desempate, y con fechas repetidas la
  paginación puede repetir u omitir filas.
- **[baja] El paquete de entrada son 425 KB** (+51 KB de React +35 KB de CSS);
  los pesados (gráficos 171 KB, emoji 327 KB) ya van en trozos aparte, pero el
  service worker los pre-cachea todos (1,3 MB en total). En un móvil con mala
  conexión, la primera carga se nota.

### 4.5 Orden y duplicación

- **`transactionController.js` (984 líneas) y `workspaceController.js` (700) son
  los dos grandes.** Ahí conviven listados, exportaciones, anulaciones y
  recibos. Partirlos por responsabilidad ayudaría a trabajar en ellos sin miedo.
- **Cuatro `parseYear` y tres `findInWorkspace` copiados** entre controladores
  (donor, report, ministry, transaction), con 8 repeticiones del par
  "validar año + 404". Candidato claro a `utils/dates.js`.
- **`donorTotals` y `paidTotals` son la misma consulta** cambiando `type` y
  campo (`donor`/`payee`); igual `statementSummaries`/`paymentSummaries`. Es
  duplicación que crece con cada función nueva.
- **Frontend:** cuatro listas de meses distintas, el selector de año copiado
  cinco veces (y solo tres deshabilitan el año futuro), `window.confirm` en 12
  sitios, y dos formas de validar formularios (formik en 5 pantallas, a mano en
  el resto). `Dashboard.jsx` (663 líneas) y `TransactionForm.jsx` (548) piden a
  gritos separarse en piezas.
- **Exports muertos** confirmados por búsqueda: `endOfToday` (`utils/dates.js`),
  `MAX_SIDE` (`logoStorage.js`), `sumAmounts` (`lib/money.js`, solo usado por su
  propia prueba), `contentWidth`/`incomeLabel`/`spentByMinistry`/`periodLine`.

### 4.6 Accesibilidad

- **Contraste del tema claro** (lo más concreto, medido): `--muted` da 3,78:1
  sobre tarjeta y 3,17:1 sobre el fondo; `--income` 3,57:1; `--danger` 4,33:1.
  AA pide 4,5:1. Oscurecer esos tres colores en el tema claro es un cambio de
  cuatro líneas en `index.css`.
- **El importe de un ingreso se distingue solo por color y signo**, y en el tema
  claro ese verde no pasa AA. Añadir algo no cromático (por ejemplo, la palabra
  "ingreso" ya está en el detalle) o subir el contraste.
- **`Segmented` se declara `role="radiogroup"`/`radio` sin navegación por
  flechas** (`ui/index.jsx:33-58`), y se usa en cinco pantallas: o se implementa
  el patrón completo o se usan radios nativos.
- **`window.confirm`** en 12 sitios: no se puede etiquetar ni traducir y bloquea
  la interfaz. La app ya tiene un diálogo propio (`MoreSheet`) que se puede
  reutilizar.

### 4.7 Documentación

- **[media] El README documenta 39 de los 67 endpoints.** Comparado con el código
  (`README.md` contra `backend/routes/`), faltan secciones enteras: **fondos (8
  rutas), ministerios (5), conteo de ofrenda (4), informes en PDF (2), socios con
  PayPal (4) y el enlace público del espacio (4)**. Quien lea el README no sabe
  que existen, aunque el ROADMAP los explique en prosa: falta la tabla de API.
- **[baja] Cinco variables de entorno sin documentar** en la tabla del README:
  `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE`, `PAYPAL_WEBHOOK_ID`
  (están mencionadas en el ROADMAP, no donde se busca al instalar) y
  `COOKIE_MAX_AGE_MS`, que no aparece en ningún documento.
- **[baja] El ROADMAP da por pendiente "datos de ejemplo"** (fase 5) y ya está
  hecho: `npm run datos-ejemplo` con su sección en el README. Toca marcarlo.

### 4.8 Dependencias

**`npm audit`: 0 vulnerabilidades** en backend y frontend (comprobado
ejecutándolo). Hay saltos de versión mayor disponibles, ninguno urgente:

| Paquete | Tiene | Última | Nota |
|---|---|---|---|
| `express` | 4.22.3 | 5.2.1 | Migración grande (cambios en rutas y middlewares). Planificar, no improvisar |
| `mongoose` | 8.24.4 | 9.10.1 | Igual: merece una tanda propia con las 200 pruebas como red |
| `bcryptjs` | 2.4.3 | 3.0.3 | Revisar la API de hashing antes |
| `dotenv` | 16.6.1 | 18.0.1 | Menor riesgo |
| `express-rate-limit` | 7.5.1 | 8.7.0 | Menor riesgo |
| Frontend | — | — | Lo desactualizado es herramienta (eslint 10, plugin-react 6); React 19, React Query y Tailwind 4 están al día |

**Recomendación:** no tocarlas ahora. El CI ya corre `npm audit` en cada push y
está limpio; Express 5 y Mongoose 9 piden una tanda con tiempo y pruebas, no un
hueco entre funciones.

### 4.9 Nota sobre esta auditoría: lo que descarté

Un barrido automático marcó dos cosas como graves que **no lo son**, y merece la
pena decirlo porque una de ellas era un aviso de dinero:

- **"Puede cobrarse un importe distinto del que se ve" (página de socio): falso.**
  Los botones de PayPal leen el importe desde una referencia actualizada en cada
  pintado (`SupportPage.jsx:64-65`), así que el cobro siempre usa el importe
  vigente. El fallo real es menor: `onError` se crea de nuevo en cada pintado, así
  que el efecto se vuelve a ejecutar y **los botones se destruyen y se vuelven a
  crear en cada tecla** que se escribe en el campo de importe. Se arregla
  envolviendo `onError` en `useCallback`.
- **"Al salir de un espacio no se refresca la lista" (Miembros): falso.** Salir de
  un espacio es la rama `isMe`, que sí invalida `WORKSPACES_KEY`
  (`MembersPage.jsx:202-205`); quitar a otro no necesita invalidarla.

## 5. Qué propongo agregar

### 5.1 Que el primer uso salga bien

Las funciones son nuevas (1 a 3 días): lo que decida si se adoptan o se
abandonan es **cómo salga el primer uso**, no una campaña. Tres ideas concretas:

1. **Guía de primeros pasos** (checklist en el Inicio). ✅ **Hecha el 21 de
   septiembre** (el detalle está en la Tanda 2, sección 6). Los pasos que
   quedaron —registrar el primer movimiento, sumar al equipo, crear un fondo,
   cargar a las personas— salen del estado real del espacio y del rol: las
   categorías ya vienen creadas de fábrica y el enlace de la congregación es cosa
   del propietario, así que pedirlos como "paso" sería pedir algo que ya está
   hecho o que no le toca a quien mira.
2. **Ofrecer el conteo con doble firma en el momento natural**: al registrar un
   ingreso de una categoría de ofrendas, preguntar "¿es la ofrenda del culto?
   Hazlo con doble firma". Hoy hay que ir a otra pantalla y, en el primer
   domingo, nadie va a ir.
3. **Pedir el comprobante donde toca**: en gastos por encima de un importe
   configurable, sugerir la foto. La función está lista y todavía no se ha
   estrenado.

### 5.2 Lo que ya está en tu ROADMAP y subiría de prioridad

| Idea | Por qué ahora |
|---|---|
| **Cierre mensual y conciliación bancaria** | Con 19 meses de historia y una sola persona anotando, cerrar cada mes es la única forma de que un error de hace un año no aparezca cuando ya no hay contexto. Bloquear la edición de meses cerrados da tranquilidad y hace el historial creíble |
| **Importar el extracto del banco (CSV/Excel)** | Es el mayor ahorro de tiempo para quien anota ~24 movimientos al mes: se sube el extracto y se marca lo que ya está en el libro |
| **Flujo de aprobación de gastos** | Encaja con el alta de pagos a personas: por encima de un monto, el gasto espera el visto bueno. Es accountability, y la app ya tiene la idea del conteo con doble firma |
| **Copias de seguridad y exportación completa** | Hoy hay respaldos manuales en `backend/backups/`. Un `npm run respaldo` programado y un "descargar todos mis datos" en formato abierto protegen 19 meses de trabajo |
| **2FA para tesoreros** | La app guarda dinero de una iglesia y se entra con correo y contraseña |
| **Centro de ayuda dentro de la app** | Ataca directamente el problema de adopción: cómo registrar, qué es un fondo, cómo se hace un conteo |

### 5.3 Ideas nuevas (no están en el ROADMAP)

| Idea | Para qué sirve | Esfuerzo |
|---|---|---|
| **Recordatorios por correo**: "tienes un conteo pendiente de firmar", "cierra el mes", "hay 3 movimientos programados" | El olvido es lo que deja funciones sin usar; un correo semanal las devuelve a la vista | Medio |
| **Actividad del equipo** (quién registró qué y cuándo, en una pantalla) | Hoy 417 de 438 movimientos son de una persona: verlo ayuda a repartir el trabajo antes de que sea un problema | Bajo |
| **Varias monedas en un mismo espacio** (diezmo desde el extranjero, con tipo de cambio) | Un ministerio con hermanos fuera recibe en dólares y paga en soles | Medio |
| **Recibos numerados con correlativo** para aportes | Muchas iglesias necesitan justificar donaciones ante terceros; hoy la constancia no lleva número | Bajo |
| **Modo auditor útil**: marcar un mes como "revisado" y un informe de diferencias | El rol de auditor existe pero hoy solo mira; darle una tarea concreta lo justifica | Bajo |
| **Consolidado de varias sedes** (si algún día crece) | Un solo informe con todas las sedes y el detalle por sede | Alto |

### 5.4 Lo que yo NO haría ahora

La **fase 4 (núcleo personal)** —cuentas y tarjetas, deudas, presupuestos
personales, metas de ahorro— es un producto distinto: la mitad de las pantallas
nuevas, y el espacio personal apenas se usa. Con los datos en la mano, ese
esfuerzo rinde mucho más del lado iglesia (adopción, cierre, conciliación,
importación).

## 6. Plan propuesto

**Tanda 1 — lo que arreglaría ya (medio día):**
1. Cerrar los filtros `donor`/`payee` sin `donor:read`.
2. Dejar de exponer el correo de líderes.
3. Quitar datos personales del historial que lee el auditor.
4. Sumar en centavos en el informe de fondos.
5. Contraste del tema claro (tres colores).
6. `onError` de PayPal estable (evita repintar los botones en cada tecla).
7. Limpiar los 3 movimientos huérfanos y poner espacio predeterminado a las tres
   tesoreras.

**Tanda 1 — hecha (21 de septiembre).** Los siete puntos, cada uno con su prueba
y verificados con el navegador cuando tocaba:

1. Los filtros `donor`/`payee` ahora exigen `donor:read` (403 sin él) en el
   listado, el balance y el Excel. `backend/tests/privacidad.test.js`.
2. El correo de los líderes de ministerio ya no se entrega. Misma prueba.
3. El historial oculta el correo de personas a quien no gestiona miembros,
   conservando el resto de la entrada (quién, qué rol, cuándo). Misma prueba.
4. Los totales del informe de fondos se suman en centavos: 0,1 + 0,2 + 10×10,07
   da exactamente 101,00 y no 100,99999… Misma prueba.
5. Contraste del tema claro: `--muted`, `--income`, `--expense` y `--danger`
   oscurecidos hasta cumplir AA. **Medido en el navegador** con los fondos
   reales compuestos: texto secundario 4,52:1, importe de ingreso 4,93:1 (sobre
   panel translúcido) y 5,24:1 (sobre tarjeta). El tema oscuro no se tocó.
6. Los botones de PayPal se pintan una vez y no con cada tecla. La prueba falla
   sin el arreglo (los creaba 3 veces); con él, una.
7. Limpieza de datos: los 3 movimientos sin espacio, borrados con copia previa en
   `backend/backups/`, y el espacio predeterminado de las tres tesoreras puesto
   en la iglesia.

**Tanda 2 — acompañar el estreno (esta semana):** guía de primeros pasos, conteo
de ofrenda ofrecido en el flujo de registro, pedir comprobante en gastos grandes,
y recordatorios por correo. Con el equipo recién incorporado, el objetivo es que
las tesoreras anoten sin ayuda la primera semana.

**Tanda 2 — guía de primeros pasos: hecha (21 de septiembre).** Va arriba en el
Inicio y solo la ve quien registra movimientos (`tx:write`): a un lector o a un
auditor no hay nada que pedirle. Los pasos dependen del espacio y del rol:

| Paso | Cuándo se pide | Cuándo está hecho |
|---|---|---|
| Registra el primer movimiento | siempre | hay algún movimiento |
| Suma a tu equipo | `members:manage` | hay más de un miembro |
| Crea tu primer fondo | `fund:manage` | existe un fondo además del General |
| Carga a las personas | iglesia y `donor:read` | hay algún aportante |

Se marca sola con datos que el Inicio ya trae (movimientos, fondos, personas) más
la lista de miembros, que solo se pide si el paso aplica: cuando la guía no se ve
no cuesta ninguna consulta. Se apaga al terminar los pasos, se puede ocultar a
mano, y el Perfil la vuelve a mostrar (el estado guardado distingue "la oculté" de
"la terminé", para que pedirla de nuevo funcione incluso en un espacio ya
armado). Guardado por espacio y por persona: en la computadora compartida de la
iglesia cada quien tiene la suya.

Verificado en el navegador con el demo local: 3 de 4 en la iglesia sembrada (solo
faltaba el fondo), 0 de 3 en un espacio personal (sin el paso de aportantes),
desaparece al crear el fondo que faltaba, aguanta la recarga, y vuelve desde el
Perfil con un "Ya está todo listo". Claro y oscuro revisados. Pruebas:
`guiaBienvenida.test.jsx` (13) y `guiaEnInicio.test.jsx` (2).

Quedan pendientes de la tanda el conteo ofrecido al registrar, el comprobante en
los gastos grandes y los recordatorios por correo.

**Tanda 3 — producto:** cierre mensual + conciliación, importación del extracto,
y aprobación de gastos. Antes de empezar, partir `transactionController.js` y
sacar las duplicaciones (parseYear, totales de personas), que es lo que hace
lento cualquier cambio ahí.

## 7. Lo que necesito que decidas

1. **¿Las tres tesoreras van a anotar movimientos?** Si sí, la guía de primeros
   pasos y los recordatorios son la prioridad; si el trabajo seguirá en una sola
   persona, no conviene invertir en permisos finos ni en pantallas para el equipo.
2. **¿Has probado a adjuntar un comprobante?** Si te da error, falta configurar
   Cloudinary en Render (la subida responde 503 sin las claves). Si funciona, es
   solo que el momento no ha llegado.
3. **¿El conteo de ofrenda con doble firma se va a usar este domingo?** Si sí,
   preparo que el primer uso salga redondo (y con él, el flujo desde el registro
   de la ofrenda). Si tu iglesia no hace conteo con doble firma, mejor saberlo
   para no empujar una función que sobra.
4. **¿Empezamos ya con la Tanda 1?** Son siete arreglos pequeños; los tres de
   privacidad y el de la suma en centavos los haría con prueba, y el contraste
   del tema claro lo verificaría con el navegador.
