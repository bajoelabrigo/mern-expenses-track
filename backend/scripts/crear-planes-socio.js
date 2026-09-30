//! Crea en PayPal los planes de suscripción de "Hazte socio": $5, $10 y $20 al
//! mes. Se ejecuta UNA VEZ, a mano, y su resultado son tres identificadores que
//! se pegan en las variables de entorno. No lo llama la aplicación.
//!
//! Uso:
//!   node scripts/crear-planes-socio.js              (solo enseña lo que haría)
//!   node scripts/crear-planes-socio.js --crear      (lo crea de verdad)
//!
//! Lee PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET y PAYPAL_MODE del entorno, así que
//! con PAYPAL_MODE=sandbox crea los de prueba y con "live" los de verdad.
//!
//! Es repetible sin miedo: antes de crear nada busca por nombre, y si el
//! producto o un plan ya existen los reutiliza en vez de duplicarlos. Un plan
//! de PayPal no se puede borrar —solo desactivar—, así que duplicarlos ensucia
//! la cuenta para siempre.
//!
//! POR QUÉ NO SE REUTILIZAN LOS DE chat-app: los suyos se llaman "Ofrenda
//! mensual $5". Ese nombre es lo que el socio ve al aprobar la suscripción y en
//! cada recibo mensual, y esta app evita la palabra "ofrenda" a propósito: lo
//! que se aporta aquí sostiene el servicio, no es dinero de la iglesia.

const {
  PAYPAL_CLIENT_ID,
  PAYPAL_CLIENT_SECRET,
  PAYPAL_MODE,
} = require("../config/env");

const BASE =
  PAYPAL_MODE === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

const PRODUCTO = "Control de Gastos para Iglesias";
const MONTOS = [5, 10, 20];
const nombrePlan = (monto) => `Socio de Control de Gastos — $${monto} al mes`;

const token = async () => {
  const credenciales = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString(
    "base64"
  );
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credenciales}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal no dio el token (${res.status})`);
  return (await res.json()).access_token;
};

const llamar = async (t, ruta, opciones = {}) => {
  const res = await fetch(`${BASE}${ruta}`, {
    ...opciones,
    headers: {
      Authorization: `Bearer ${t}`,
      "Content-Type": "application/json",
      ...(opciones.headers || {}),
    },
  });
  const cuerpo = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`PayPal ${res.status} en ${ruta}: ${JSON.stringify(cuerpo)}`);
  }
  return cuerpo;
};

//! Busca el producto por nombre entre los que ya hay
const buscarProducto = async (t) => {
  const { products = [] } = await llamar(t, "/v1/catalogs/products?page_size=20");
  return products.find((p) => p.name === PRODUCTO) || null;
};

const buscarPlan = async (t, nombre) => {
  const { plans = [] } = await llamar(t, "/v1/billing/plans?page_size=20");
  return plans.find((p) => p.name === nombre) || null;
};

const crearProducto = (t) =>
  llamar(t, "/v1/catalogs/products", {
    method: "POST",
    body: JSON.stringify({
      name: PRODUCTO,
      description: "Cuentas claras para iglesias y ministerios",
      //! SERVICE y SOFTWARE: es un servicio en línea, no un bien físico
      type: "SERVICE",
      category: "SOFTWARE",
    }),
  });

const crearPlan = (t, productId, monto) =>
  llamar(t, "/v1/billing/plans", {
    method: "POST",
    body: JSON.stringify({
      product_id: productId,
      name: nombrePlan(monto),
      description: `Aporte mensual de $${monto} para sostener Control de Gastos`,
      billing_cycles: [
        {
          tenure_type: "REGULAR",
          sequence: 1,
          //! 0 = sin fin: se cobra hasta que la persona cancele
          total_cycles: 0,
          frequency: { interval_unit: "MONTH", interval_count: 1 },
          pricing_scheme: {
            fixed_price: { value: monto.toFixed(2), currency_code: "USD" },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee: { value: "0", currency_code: "USD" },
        setup_fee_failure_action: "CONTINUE",
        //! Tras 3 intentos fallidos PayPal suspende la suscripción en vez de
        //! seguir reintentando para siempre
        payment_failure_threshold: 3,
      },
    }),
  });

const main = async () => {
  const deVerdad = process.argv.includes("--crear");

  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    console.error("Faltan PAYPAL_CLIENT_ID y PAYPAL_CLIENT_SECRET en el entorno.");
    process.exit(1);
  }

  console.log(`\nCuenta de PayPal: ${PAYPAL_MODE === "live" ? "LIVE (dinero real)" : "sandbox"}`);
  console.log(`Producto:         ${PRODUCTO}`);
  console.log(`Planes:           ${MONTOS.map((m) => `$${m}`).join(", ")} al mes\n`);

  if (!deVerdad) {
    console.log("Esto es solo un ensayo; no se ha creado nada.");
    console.log("Para crearlos de verdad:  node scripts/crear-planes-socio.js --crear\n");
    return;
  }

  const t = await token();

  let producto = await buscarProducto(t);
  if (producto) {
    console.log(`Producto ya existía:  ${producto.id}`);
  } else {
    producto = await crearProducto(t);
    console.log(`Producto creado:      ${producto.id}`);
  }

  const ids = {};
  for (const monto of MONTOS) {
    const nombre = nombrePlan(monto);
    let plan = await buscarPlan(t, nombre);
    if (plan) {
      console.log(`Plan $${monto} ya existía:  ${plan.id}`);
    } else {
      plan = await crearPlan(t, producto.id, monto);
      console.log(`Plan $${monto} creado:      ${plan.id}`);
    }
    ids[monto] = plan.id;
  }

  console.log("\nPega esto en backend/.env y en Render:\n");
  for (const monto of MONTOS) {
    console.log(`PAYPAL_PLAN_SOCIO_${monto}=${ids[monto]}`);
  }
  console.log("");
};

main().catch((err) => {
  console.error("\nNo se pudieron crear los planes:", err.message, "\n");
  process.exit(1);
});
