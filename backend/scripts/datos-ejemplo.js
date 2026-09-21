//! Llena con DATOS DE EJEMPLO la API que ya esté corriendo, para probar la app
//! sin tocar la base real. Está pensado para usarse con `dev-memoria.js` (MongoDB
//! en memoria), pero sirve contra cualquier API local.
//!
//! Uso:
//!   1. en una terminal:  npm run dev:memoria     (API + MongoDB en memoria)
//!   2. en otra:          npm run datos-ejemplo   (esto)
//!   3. y en otra:        npm run dev             (el frontend, en frontend/)
//!
//! Deja una iglesia con equipo y roles, personas que aportan y que cobran,
//! movimientos con aportante y con pago a personas, una solicitud para entrar y
//! una invitación pendiente. Se entra con pastor@demo.test / Demo12345.
//!
//! Solo habla por HTTP con la API: no toca ninguna base de datos directamente.

const API = process.env.API_URL || "http://localhost:8000/api/v1";
const CLAVE = "Demo12345";
const PASTOR = "pastor@demo.test";

const pedir = async (metodo, ruta, { cuerpo, token, esperado = 200, ws } = {}) => {
  const res = await fetch(API + ruta, {
    method: metodo,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      //! El espacio se manda explícito (como el frontend): así no depende del
      //! espacio predeterminado de cada usuario, que en los recién registrados
      //! es suyo personal y no la iglesia
      ...(ws ? { "X-Workspace-Id": String(ws) } : {}),
    },
    ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
  });
  const texto = await res.text();
  let datos;
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch {
    datos = texto;
  }
  if (res.status !== esperado) {
    throw new Error(`${metodo} ${ruta} -> ${res.status} (esperaba ${esperado}): ${texto.slice(0, 200)}`);
  }
  return datos;
};

//! La API tarda un momento en escuchar: se espera a que conteste
const esperarApi = async (intentos = 40) => {
  for (let i = 0; i < intentos; i += 1) {
    try {
      const res = await fetch(API.replace("/api/v1", "") + "/health");
      if (res.ok) return true;
    } catch {
      /* todavía no está */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`La API no responde en ${API}. ¿Arrancaste npm run dev:memoria?`);
};

const registrar = (username, email, iglesia) =>
  pedir("post", "/users/register", {
    cuerpo: { username, email, password: CLAVE, iglesia, currency: "PEN" },
    esperado: 201,
  });

const entrar = async (email) =>
  (await pedir("post", "/users/login", { cuerpo: { email, password: CLAVE } })).token;

(async () => {
  console.log(`Sembrando datos de ejemplo en ${API} ...`);
  await esperarApi();

  //! Si ya está sembrado, no se duplica nada
  try {
    await registrar("pastor", PASTOR, "Iglesia Betel");
  } catch (err) {
    if (String(err.message).includes("409")) {
      console.log(`\nYa había datos de ejemplo en esta base (existe ${PASTOR}).`);
      console.log("Si quieres empezar de cero, reinicia dev:memoria.js: la base vive en memoria.");
      return;
    }
    throw err;
  }

  const tokenPastor = await entrar(PASTOR);
  const espacios = await pedir("get", "/workspaces", { token: tokenPastor });
  const iglesia = espacios.find((w) => w.kind === "iglesia");
  console.log(`  Iglesia "${iglesia.name}" creada`);

  //! Equipo, con un rol distinto cada uno
  const invitar = async (username, email, rol) => {
    await registrar(username, email, "");
    const token = await entrar(email);
    const inv = await pedir("post", `/workspaces/${iglesia._id}/invitations`, {
      cuerpo: { email, role: rol },
      token: tokenPastor,
      esperado: 201,
    });
    await pedir("post", `/invitations/${inv.url.split("/invitacion/")[1]}/accept`, { token });
    return token;
  };
  const tokenTesorera = await invitar("tesorera", "tesorera@demo.test", "tesorero");
  await invitar("contador", "contador@demo.test", "contador");
  await invitar("auditor", "auditor@demo.test", "auditor");
  console.log("  Equipo: tesorera, contador y auditor");

  for (const [name, icon] of [["honorarios", "🧾"], ["servicios", "🔧"], ["actividades", "🎉"], ["mantenimiento", "🛠️"]]) {
    await pedir("post", "/categories/create", {
      cuerpo: { name, type: "expense", icon },
      token: tokenPastor,
      esperado: 201,
      ws: iglesia._id,
    });
  }

  //! Personas: unas aportan, otras cobran, y hay quien hace las dos cosas
  const persona = (body) =>
    pedir("post", "/donors", { cuerpo: body, token: tokenPastor, esperado: 201, ws: iglesia._id });

  const ana = await persona({ name: "Ana Torres", document: "45789123", phone: "+51 987 654 321", member: true });
  const luis = await persona({ name: "Luis Paredes", document: "09876543", member: true });
  const betty = await persona({ name: "Betty Ruiz", phone: "+51 999 111 222", member: true });
  const marta = await persona({ name: "Marta Quispe", document: "12345678", member: true });
  const jorge = await persona({ name: "Jorge Ríos", member: true });
  const gasfitero = await persona({
    name: "Pedro el gasfitero",
    phone: "+51 955 443 322",
    notes: "Servicios de mantenimiento, no es miembro",
  });
  console.log("  Personas: 6 (5 miembros y un proveedor de fuera)");

  const mov = (cuerpo, token = tokenPastor) =>
    pedir("post", "/transactions/create", { cuerpo, token, esperado: 201, ws: iglesia._id });

  //! Ingresos de enero a septiembre, con y sin aportante
  const ingresos = [
    ["2026-01-11", 850, "diezmos", marta], ["2026-01-18", 420.5, "ofrendas", null],
    ["2026-02-08", 910, "diezmos", ana], ["2026-02-15", 380, "ofrendas", jorge],
    ["2026-03-08", 1200, "diezmos", marta], ["2026-03-15", 615.25, "ofrendas", null],
    ["2026-04-12", 980, "diezmos", ana], ["2026-04-19", 512, "ofrendas", betty],
    ["2026-05-10", 1040, "diezmos", luis], ["2026-05-17", 470, "ofrendas", null],
    ["2026-06-14", 1330, "diezmos", marta], ["2026-06-21", 690.75, "ofrendas", jorge],
    ["2026-07-12", 890, "primicias", ana], ["2026-07-19", 545, "ofrendas", null],
    ["2026-08-09", 1150, "diezmos", betty], ["2026-08-16", 610, "ofrendas", luis],
    ["2026-09-13", 1260, "diezmos", marta], ["2026-09-14", 725.5, "ofrendas", null],
  ];
  for (const [date, amount, category, donor] of ingresos) {
    await mov({ type: "income", category, amount, date, donor: donor?._id || null });
  }

  //! Gastos que dicen a quién se le pagó y por qué
  const pagos = [
    ["2026-01-25", 250, "honorarios", ana, "jornal", "Cocinó en la actividad de jóvenes"],
    ["2026-02-22", 300, "servicios", gasfitero, "servicio", "Reparación de la instalación de agua"],
    ["2026-03-22", 180, "honorarios", luis, "honorarios", "Predicó el domingo"],
    ["2026-04-26", 420, "actividades", betty, "jornal", "Almuerzo de la campaña"],
    ["2026-05-24", 150, "honorarios", ana, "reembolso", "Pasajes para la visita"],
    ["2026-06-28", 260, "honorarios", luis, "honorarios", "Música del culto"],
    ["2026-07-26", 340, "actividades", betty, "jornal", "Cocina del campamento"],
    ["2026-08-23", 210, "servicios", gasfitero, "servicio", "Pintura del salón"],
    ["2026-09-06", 280, "honorarios", ana, "jornal", "Apoyo en la actividad"],
    ["2025-11-20", 500, "honorarios", ana, "honorarios", "Pago del año pasado"],
  ];
  for (const [date, amount, category, payee, paymentKind, description] of pagos) {
    await mov({ type: "expense", category, amount, date, payee: payee._id, paymentKind, description });
  }

  const gastosSinPersona = [
    ["2026-01-05", 320, "servicios", "Recibo de luz de enero"],
    ["2026-02-05", 280, "servicios", "Recibo de luz de febrero"],
    ["2026-03-03", 900, "mantenimiento", "Arreglo del techo"],
    ["2026-05-05", 310, "servicios", "Recibo de luz de mayo"],
    ["2026-08-05", 295, "servicios", "Recibo de luz de agosto"],
  ];
  for (const [date, amount, category, description] of gastosSinPersona) {
    await mov({ type: "expense", category, amount, date, description });
  }

  //! Uno anulado y uno programado: los dos casos que confunden al revisar
  const anulado = await mov({
    type: "expense", category: "actividades", amount: 999, date: "2026-07-02",
    payee: ana._id, paymentKind: "jornal", description: "Duplicado",
  });
  await pedir("post", `/transactions/${anulado[0]._id}/void`, {
    cuerpo: { reason: "Se registró dos veces" },
    token: tokenPastor,
    ws: iglesia._id,
  });
  await mov({ type: "expense", category: "servicios", amount: 300, date: "2026-10-05", description: "Luz de octubre (programado)" });
  await mov({ type: "income", category: "ofrendas", amount: 275, date: "2026-09-20", donor: betty._id }, tokenTesorera);

  //! Alguien pide entrar (para ver las solicitudes) y queda una invitación viva
  await registrar("nuevo", "nuevo@demo.test", "");
  const tokenNuevo = await entrar("nuevo@demo.test");
  await pedir("post", `/workspaces/${iglesia._id}/solicitudes`, {
    cuerpo: { message: "Soy la tesorera del ministerio, quiero llevar las ofrendas" },
    token: tokenNuevo,
    esperado: 201,
  });
  await pedir("post", `/workspaces/${iglesia._id}/invitations`, {
    cuerpo: { email: "invitado@demo.test", role: "lector" },
    token: tokenPastor,
    esperado: 201,
  });

  console.log("\nListo. Entra en http://localhost:5173 con:");
  console.log(`  ${PASTOR} / ${CLAVE}   (propietario: ve todo)`);
  console.log("  tesorera@demo.test, contador@demo.test, auditor@demo.test (misma clave)");
  console.log("Hay 2 movimientos de ejemplo que no deben sumar: uno anulado y uno programado.");
})().catch((err) => {
  console.error("\nNo se pudieron sembrar los datos:", err.message);
  process.exit(1);
});
