//! PayPal para los aportes de socio. Adaptado del que ya funciona en holy_app:
//! órdenes, captura, comprobación de la firma de los avisos y lectura de la
//! comisión. Lo que no se trae: suscripciones (aquí los aportes son de una vez).

const {
  PAYPAL_CLIENT_ID,
  PAYPAL_CLIENT_SECRET,
  PAYPAL_MODE,
  PAYPAL_WEBHOOK_ID,
} = require("../config/env");

const BASE = () =>
  PAYPAL_MODE === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

const isConfigured = () => Boolean(PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET);

//! El token vale unas horas: se guarda y se renueva un minuto antes de caducar
let cachedToken = null;

const getAccessToken = async () => {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value;

  const credentials = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${BASE()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal no dio el token (${res.status})`);

  const data = await res.json();
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return data.access_token;
};

const call = async (path, options = {}) => {
  const token = await getAccessToken();
  const res = await fetch(`${BASE()}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`PayPal ${res.status}: ${JSON.stringify(err)}`);
  }
  return res.json().catch(() => null);
};

//! Orden "suelta": sin fijar el medio de pago, para que el botón de la página
//! pueda cobrar con PayPal y también con tarjeta.
const createOrder = async ({ amount, currency = "USD", reference }) => {
  const order = await call("/v2/checkout/orders", {
    method: "POST",
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: { currency_code: currency, value: amount },
          //! Vuelve en el aviso: así se sabe a qué aporte corresponde
          custom_id: String(reference),
          description: "Aporte para sostener Control de Gastos",
        },
      ],
    }),
  });
  if (!order?.id) throw new Error("PayPal no devolvió la orden");
  return { orderId: order.id };
};

const captureOrder = (orderId) =>
  call(`/v2/checkout/orders/${orderId}/capture`, { method: "POST", body: JSON.stringify({}) });

//! PayPal nunca deposita el bruto: `paypal_fee` es lo que se queda
const feeCentsFromCapture = (capture) => {
  const fee = capture?.seller_receivable_breakdown?.paypal_fee?.value;
  return fee ? Math.round(parseFloat(fee) * 100) : 0;
};

//! Los datos que interesan de una captura, venga de la respuesta directa o de
//! un aviso: una sola lectura para que no diverjan.
const readCapture = (capture) => ({
  captureId: capture?.id || "",
  orderId: capture?.supplementary_data?.related_ids?.order_id || capture?.id || "",
  reference: capture?.custom_id || "",
  amountCents: Math.round(parseFloat(capture?.amount?.value ?? "0") * 100),
  feeCents: feeCentsFromCapture(capture),
  currency: capture?.amount?.currency_code || "USD",
});

//! La captura dentro de la respuesta de /capture
const captureFromOrder = (order) =>
  order?.purchase_units?.[0]?.payments?.captures?.[0] || null;

//! ¿El aviso viene de verdad de PayPal? Sin esto cualquiera podría avisar de
//! un pago que nunca ocurrió.
const verifyWebhook = async (headers, body) => {
  if (!PAYPAL_WEBHOOK_ID) return false;
  try {
    const result = await call("/v1/notifications/verify-webhook-signature", {
      method: "POST",
      body: JSON.stringify({
        transmission_id: headers["paypal-transmission-id"],
        transmission_time: headers["paypal-transmission-time"],
        cert_url: headers["paypal-cert-url"],
        auth_algo: headers["paypal-auth-algo"],
        transmission_sig: headers["paypal-transmission-sig"],
        webhook_id: PAYPAL_WEBHOOK_ID,
        webhook_event: body,
      }),
    });
    return result?.verification_status === "SUCCESS";
  } catch {
    return false;
  }
};

//! El enlace `up` de un reembolso apunta a la captura que se devolvió
const captureIdFromRefund = (refund) => {
  const up = (refund?.links || []).find((l) => l?.rel === "up")?.href;
  const fromLink = typeof up === "string" ? up.split("/").pop() : undefined;
  return refund?.supplementary_data?.related_ids?.capture_id || fromLink || "";
};

//! Cuánto queda devuelto tras un reembolso, contando los parciales y los
//! avisos repetidos (PayPal reenvía). Separado para poder probarlo.
const applyRefund = (amountCents, alreadyCents, refundedCents) => {
  const total = Math.min((Number(alreadyCents) || 0) + refundedCents, Number(amountCents) || 0);
  return { refundedCents: total, fullyRefunded: total >= (Number(amountCents) || 0) };
};

//! Implementación activa; las pruebas la sustituyen para no llamar a PayPal
let impl = { isConfigured, createOrder, captureOrder, verifyWebhook };

const paypal = new Proxy({}, { get: (target, prop) => impl[prop] });

const setPaypal = (replacement) => {
  impl = replacement;
};

module.exports = {
  paypal,
  setPaypal,
  readCapture,
  captureFromOrder,
  captureIdFromRefund,
  applyRefund,
  feeCentsFromCapture,
};
