//! El contenido de la ayuda, en un solo sitio: lo usan la página pública
//! (`/ayuda`, la que se comparte por WhatsApp) y la sección dentro de la app.
//! Así no hay dos textos que se puedan contradecir.
//!
//! Las capturas son de la app de verdad, hechas en el entorno de ejemplo con
//! datos inventados —"Iglesia Ejemplo", Marta, Jorge, Ana…—, NUNCA de la iglesia
//! real: esta página es pública y el enlace se reenvía. El maestro para rehacerlas
//! cuando cambie la pantalla está en scripts/capturas-ayuda.md.

//! Quién atiende las dudas. El nombre de pila va a propósito: la ayuda se lee
//! mejor cuando del otro lado hay una persona y no un "soporte técnico".
export const CONTACTO = {
  nombre: "Jorge",
  //! WhatsApp con código de país, sin "+" ni espacios (Perú: 51987654321).
  //! OJO: esto es PÚBLICO, va en el código de la página y del repositorio — que
  //! es justo lo que se busca, para que cualquiera pueda escribir. No pongas
  //! aquí un número que no quieras que se vea. Vacío = no se muestra el botón.
  whatsapp: "51968796029",
  correo: "",
};

//! El mensaje ya empezado, para que solo tenga que contar qué le pasó. Si se
//! sabe en qué pantalla se trabó, va en el mensaje: del otro lado se enteran por
//! dónde va sin preguntar. La frase queda abierta a propósito ("con: ").
export const TEXTO_DE_AYUDA = ({ nombre = "", donde = "" } = {}) =>
  `Hola${nombre ? ` ${nombre}` : ""}, te escribo por la app de las cuentas de la iglesia.` +
  (donde ? ` Me trabé en «${donde}» con: ` : " Me trabé con: ");

//! Cómo se llama cada pantalla para el mensaje. Por prefijo, porque las de
//! detalle llevan un id detrás (/update-transactions/123).
const PANTALLAS = [
  ["/add-transaction", "Registrar un movimiento"],
  ["/update-transactions", "Corregir un movimiento"],
  ["/movimientos", "Movimientos"],
  ["/conteos", "El conteo de la ofrenda"],
  ["/aportantes", "Personas"],
  ["/fondos", "Fondos"],
  ["/ministerios", "Ministerios"],
  ["/informes", "Informes"],
  ["/categories", "Categorías"],
  ["/espacio/miembros", "Miembros"],
  ["/avisos", "Avisos"],
  ["/ayuda", "La ayuda"],
  ["/dashboard", "El Inicio"],
];

export const pantallaDe = (ruta = "") =>
  (PANTALLAS.find(([prefijo]) => String(ruta).startsWith(prefijo)) || [])[1] || "la app";

//! El enlace de WhatsApp con el mensaje ya escrito. Uno solo para toda la app:
//! si cambia el texto, cambia en los tres sitios donde hay botón.
export const enlaceDeAyuda = ({ donde = "", nombre = CONTACTO.nombre } = {}) =>
  `https://wa.me/${CONTACTO.whatsapp}?text=${encodeURIComponent(
    TEXTO_DE_AYUDA({ nombre, donde })
  )}`;

//! Lo que hay que saber aunque no se lea nada más. Va arriba, en tres líneas.
export const LO_ESENCIAL = [
  "La ofrenda del domingo se cuenta entre dos y la firman los dos.",
  "Un gasto se registra con la foto de la boleta, si la hay.",
  "Si te equivocas, el movimiento se anula con el motivo: nunca se borra, así que no puedes perder nada.",
];

//! Y esto es lo que quita el miedo: casi todo lo que da miedo en una app de
//! cuentas, aquí no puede pasar.
export const TRANQUILA = [
  "Nada se borra. Lo que anulas queda tachado, con tu motivo, y deja de sumar.",
  "Todo queda firmado: el historial dice quién hizo cada cosa y cuándo.",
  "No hay forma de romper las cuentas de meses pasados: cada movimiento guarda su fecha y su categoría.",
  "Si te trabas a mitad, cierra la app y vuelve: no se guarda nada a medias.",
];

export const TEMAS = [
  {
    id: "entrar",
    grupo: "basico",
    titulo: "Entrar por primera vez",
    resumen: "Con tu correo y tu contraseña. Y el detalle que confunde a casi todos.",
    pasos: [
      "Abre la app y escribe el correo con el que creaste tu cuenta, y tu contraseña.",
      "Si no te acuerdas de la contraseña, toca «¿Olvidaste tu contraseña?»: te llega un correo para poner una nueva.",
      "Al entrar, arriba del todo dice el nombre del espacio. Tócalo para cambiar de uno a otro.",
      "Lo más importante: si dice «Mis finanzas», estás en tus cuentas personales, no en las de la iglesia. Toca el nombre y elige la iglesia.",
    ],
    ojo: "Cada cuenta ve sus espacios. Si al entrar no ves la iglesia en la lista, pídele al pastor que te agregue al equipo.",
    imagenes: [
      { src: "/ayuda/ayuda-1-entrar.png", alt: "Pantalla para entrar, con los campos de correo y contraseña." },
    ],
  },
  {
    id: "categorias",
    grupo: "basico",
    titulo: "Las categorías",
    resumen: "Tu espacio ya viene con las de siempre. Esto es por si borras alguna o quieres las tuyas.",
    pasos: [
      "Un espacio nuevo arranca con las de ingreso (Diezmos, Ofrendas, Primicias y Ofrenda especial) y las de gasto (Servicios, Alquiler, Honorarios, Mantenimiento, Actividades y Ayuda social).",
      "Para verlas todas, toca «Más» abajo a la derecha y entra a Categorías.",
      "Si borras alguna de las de ingreso, sale el aviso «Faltan categorías de iglesia»: toca «Ponerlas» y vuelven.",
      "Para las que use tu iglesia y no estén (por ejemplo «Ofrenda de misiones»), toca «Nueva» y créala.",
    ],
    ojo: "Se pueden renombrar: si tu iglesia dice «Ofrenda dominical», cámbiale el nombre y los movimientos se van con ella.",
    imagenes: [
      { src: "/ayuda/ayuda-3-categorias.png", alt: "Pantalla de Categorías con la lista de ingresos y gastos, y el aviso «Faltan categorías de iglesia» con el botón Ponerlas." },
    ],
  },
  {
    id: "ofrenda",
    grupo: "basico",
    titulo: "Registrar la ofrenda del domingo",
    resumen: "El botón amarillo del centro es el que registra todo.",
    pasos: [
      "Toca el botón amarillo «+» del centro, abajo.",
      "Arriba, elige «Ingreso».",
      "Toca la categoría: Ofrendas, Diezmos…",
      "Escribe el monto en el teclado de abajo (el punto es para los céntimos).",
      "Si quien dio tiene ficha en Personas, elígelo en «Aportante». Si es la ofrenda del culto, déjalo en «Sin aportante».",
      "Revisa la fecha y toca «Registrar ingreso».",
    ],
    ojo: "Para la ofrenda del culto hay una forma mejor, que además la firman dos: el conteo. Está más abajo.",
    imagenes: [
      { src: "/ayuda/ayuda-4-registrar.png", alt: "Formulario de registro con Ingreso, la categoría Ofrendas, S/ 485.50 y el teclado numérico." },
    ],
  },
  {
    id: "gasto",
    grupo: "basico",
    titulo: "Registrar un gasto",
    resumen: "Igual, pero con la foto de la boleta y a quién se le pagó.",
    pasos: [
      "Toca el botón amarillo «+» y elige «Gasto».",
      "Elige la categoría (Servicios, Mantenimiento, Honorarios…).",
      "Escribe el monto y revisa la fecha.",
      "Si le pagaron a alguien, elígelo en «Se le pagó a» y di por qué: honorarios, jornal, servicio, reembolso.",
      "Escribe en la nota para qué fue: «Recibo de luz de agosto».",
      "Toca «Foto del comprobante» y tómale una foto a la boleta. Queda guardada con el movimiento y solo la ve el equipo.",
      "Toca «Registrar gasto».",
    ],
    ojo: "La foto es lo que después evita discusiones. Si la boleta llega después, se puede adjuntar desde el movimiento.",
    imagenes: [
      { src: "/ayuda/ayuda-5-gasto.png", alt: "Formulario de registro con Gasto, la categoría Servicios, S/ 185.30 y la nota «Recibo de luz de agosto»." },
    ],
  },
  {
    id: "conteo",
    grupo: "basico",
    titulo: "El conteo de la ofrenda, entre dos",
    resumen: "Lo que hace que las cuentas de la iglesia sean creíbles: nadie firma su propio conteo.",
    pasos: [
      "Entra a «Conteo de ofrenda» (en «Más») y toca «Contar».",
      "Escribe de qué culto es y cuántos billetes y monedas hay de cada uno. La suma sale sola.",
      "Toca «Guardar conteo». Todavía NO entra al libro: queda esperando la segunda firma.",
      "La otra persona entra, revisa el conteo y lo confirma. Ahí recién se registra el movimiento.",
    ],
    ojo: "Quien contó no puede confirmar su propio conteo: la app no lo deja. Para eso son dos.",
    imagenes: [
      { src: "/ayuda/ayuda-6-conteo.png", alt: "Hoja de conteo con los billetes de S/ 200, 100, 50, 20, 10, 5 y la suma de S/ 605.00." },
    ],
  },
  {
    id: "ver",
    grupo: "basico",
    titulo: "Ver cómo va el mes y quién dio",
    resumen: "Tres pantallas: el resumen, el detalle y las personas.",
    pasos: [
      "«Inicio» es el resumen: lo que entró, lo que salió y cuánto queda. Arriba puedes ver la semana, el mes o el año.",
      "«Movimientos» es la lista completa: busca por concepto o por categoría, y filtra por ingresos, gastos o los que se repiten.",
      "«Personas» dice cuánto dio cada uno y cuánto se le pagó, en el año. Desde ahí salen las constancias en PDF para fin de año.",
    ],
    imagenes: [
      { src: "/ayuda/ayuda-2-inicio.png", alt: "Inicio con el flujo neto del mes, la gráfica y los totales de entró y salió." },
      { src: "/ayuda/ayuda-7-movimientos.png", alt: "Lista de movimientos con el buscador, los filtros y los montos por día." },
      { src: "/ayuda/ayuda-9-personas.png", alt: "Pantalla de Personas con el total recibido, lo pagado y la lista con lo que dio cada uno." },
    ],
  },
  {
    id: "corregir",
    grupo: "basico",
    titulo: "Corregir un error, sin miedo",
    resumen: "Un error no se borra: se anula, con el motivo, y queda a la vista.",
    pasos: [
      "Entra al movimiento desde «Movimientos».",
      "Toca «Anular movimiento» y escribe por qué: «estaba duplicado», «era otro monto».",
      "El movimiento queda tachado, con tu motivo, y deja de sumar. El histórico se mantiene.",
      "Si te equivocaste al anular, se puede volver a poner.",
    ],
    ojo: "Solo el propietario del espacio puede borrar algo del todo, y casi nunca hace falta: anular es lo correcto.",
    imagenes: [
      { src: "/ayuda/ayuda-8-anulado.png", alt: "Un movimiento anulado, con el aviso «Este movimiento está anulado: Se registró dos veces. No suma en los totales»." },
    ],
  },

  //! ── Para más adelante: no hacen falta la primera semana ──
  {
    id: "fondos",
    grupo: "avanzado",
    titulo: "Fondos: apartar la plata por destino",
    resumen: "Un fondo es una caja aparte dentro de la misma cuenta. Sirve para saber cuánto hay para misiones y cuánto para la obra.",
    pasos: [
      "Entra a «Fondos» (en «Más»). Arriba está el General: ahí cae todo lo que no tenga otro fondo.",
      "Toca «Nuevo» para crear uno: Misiones, Construcción del templo, Ayuda social. Ponle un ícono y, si quieren juntar una cifra, una meta.",
      "Al registrar un movimiento puedes elegir a qué fondo va. El saldo de cada uno se calcula solo.",
      "Para pasar dinero de un fondo a otro, «Mover». El pase queda en el historial con su nombre y se puede anular.",
    ],
    ojo: "El General no se puede borrar: es donde cae lo que no tiene destino. Un fondo que ya no se usa se archiva, y deja de ofrecerse al registrar.",
    imagenes: [
      { src: "/ayuda/ayuda-10-fondos.png", alt: "Pantalla de Fondos con el General arriba, su saldo y los botones de nuevo fondo y mover." },
    ],
  },
  {
    id: "personas",
    grupo: "avanzado",
    titulo: "Personas: quién dio y a quién se le pagó",
    resumen: "La misma ficha sirve para el que da y para el que cobra. Y de ahí salen las constancias de fin de año.",
    pasos: [
      "En «Personas» está cada uno con lo que dio en el año y lo que se le pagó.",
      "Al registrar un ingreso, elige «Aportante». En un gasto, «Se le pagó a» y el motivo: honorarios, jornal, servicio, reembolso.",
      "A fin de año, «Constancias de aportes» saca un PDF por persona, para entregar. «Constancias de pagos» hace lo mismo con lo que se les pagó.",
      "También está el informe de cuánto del gasto del año se fue en pagos a personas.",
    ],
    ojo: "Quién dio cuánto es dato de la tesorería: el auditor y el lector ven los movimientos, pero no los nombres de los aportantes.",
    imagenes: [
      { src: "/ayuda/ayuda-9-personas.png", alt: "Pantalla de Personas con el total recibido, lo pagado y la lista con lo que dio cada uno." },
    ],
  },
  {
    id: "roles",
    grupo: "avanzado",
    titulo: "Quién puede hacer qué",
    resumen: "Cada uno entra con su correo y su rol. No todos pueden tocar todo, y eso es lo que hace creíble el libro.",
    pasos: [
      "Propietario: todo, incluidos los ajustes del espacio y borrar de verdad un movimiento.",
      "Tesorero: registra y corrige movimientos, maneja fondos e invita al equipo.",
      "Contador: registra y corrige movimientos y categorías, y ve a las personas.",
      "Auditor y lector: solo miran. El auditor además ve el historial de cambios, que es lo que le da sentido a su rol.",
      "Cada alta, cada cambio de rol y cada anulación queda en el historial con el nombre de quien lo hizo.",
    ],
    ojo: "El líder de un ministerio no ve el libro de la iglesia: entra solo a su presupuesto. Es a propósito.",
    imagenes: [
      { src: "/ayuda/ayuda-11-miembros.png", alt: "Pantalla de Miembros con el equipo, el rol de cada uno y el botón para agregar a alguien." },
    ],
  },
  {
    id: "ministerios",
    grupo: "avanzado",
    titulo: "Ministerios y su plan del año",
    resumen: "Ponerle un presupuesto a cada ministerio y ver cuánto se ha ido. Avisa, no bloquea: quién autoriza pasarse lo decide la iglesia.",
    pasos: [
      "En «Ministerios» se crea cada uno con su plan del año.",
      "Al registrar un gasto se elige a qué ministerio se carga.",
      "La pantalla muestra cuánto lleva gastado cada uno y avisa al 80 % y al 100 %.",
      "El líder del ministerio entra con su propia cuenta y ve solo el suyo: su plan y en qué se ha ido.",
    ],
    imagenes: [
      { src: "/ayuda/ayuda-12-ministerios.png", alt: "Pantalla de Ministerios con el plan del año de cada uno y la barra de lo gastado." },
    ],
  },
];

//! Los temas partidos en dos, que es como se leen: primero lo del día a día y
//! después lo que hace falta cuando la iglesia ya va en serio.
export const TEMAS_BASICOS = TEMAS.filter((tema) => tema.grupo !== "avanzado");
export const TEMAS_AVANZADOS = TEMAS.filter((tema) => tema.grupo === "avanzado");

//! Qué se dice al empezar cada grupo
export const GRUPOS = {
  basico: {
    titulo: "Lo del día a día",
    intro: "Con estos siete se lleva la iglesia entera.",
  },
  avanzado: {
    titulo: "Cuando ya sepas lo de arriba",
    intro:
      "No hacen falta la primera semana. Están aquí para cuando toque separar la plata por destino, entregar constancias o repartir presupuestos.",
  },
};

//! El texto que se manda por WhatsApp. Corto, porque nadie lee un mensaje largo.
export const TEXTO_PARA_COMPARTIR = (url) =>
  `Hola, acá está cómo se usa la app de las cuentas de la iglesia, con capturas de cada paso:\n${url}\n\nCualquier cosa me preguntas.`;
