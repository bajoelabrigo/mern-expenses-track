const nodemailer = require("nodemailer");
const {
  BREVO_API_KEY,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  MAIL_FROM,
  isTest,
} = require("../config/env");

//! Dos formas de enviar, en este orden:
//!   1. Brevo por su API HTTP (BREVO_API_KEY). Es la que se usa en Render: el
//!      plan gratuito bloquea los puertos SMTP (25, 465 y 587) desde sept. 2025.
//!   2. SMTP con nodemailer (SMTP_HOST), para un hosting que sí lo permita.
//! Sin ninguna de las dos, el enlace se escribe en el log del servidor.

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";
const BREVO_TIMEOUT_MS = 10_000;

const isMailConfigured = () => Boolean((BREVO_API_KEY || SMTP_HOST) && MAIL_FROM);

//! "Control de Gastos <a@b.com>" -> { name, email }; "a@b.com" -> { email }
const parseAddress = (value) => {
  const match = String(value || "").match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (match) {
    const name = match[1].trim();
    return name ? { name, email: match[2].trim() } : { email: match[2].trim() };
  }
  return { email: String(value || "").trim() };
};

//! Cuerpo de la petición a Brevo (función pura: se prueba sin red)
const buildBrevoPayload = ({ from, to, subject, text, html }) => ({
  sender: parseAddress(from),
  to: [{ email: to }],
  subject,
  textContent: text,
  htmlContent: html,
});

//! Envío por la API de Brevo. `fetchImpl` se inyecta en las pruebas.
const sendViaBrevo = async (message, { apiKey, from, fetchImpl = fetch }) => {
  const res = await fetchImpl(BREVO_URL, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(buildBrevoPayload({ ...message, from })),
    signal: AbortSignal.timeout(BREVO_TIMEOUT_MS),
  });

  if (!res.ok) {
    //! Se registra el motivo que da Brevo (p. ej. remitente sin verificar),
    //! nunca la clave
    const body = await res.json().catch(() => ({}));
    throw new Error(`Brevo ${res.status}: ${body.code || ""} ${body.message || ""}`.trim());
  }
  return true;
};

//! Un solo transporte SMTP con pool para toda la app (no uno por correo).
let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      pool: true,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });
  }
  return transporter;
};

//! Correos enviados durante las pruebas (para comprobar enlaces sin red)
const sentInTests = [];

//! Envía un correo. Nunca lanza: devuelve { sent, reason } para que quien
//! llama decida qué decir al usuario. Un fallo del correo no debe tumbar una
//! invitación que ya quedó creada.
const sendMail = async ({ to, subject, text, html }) => {
  if (isTest) {
    sentInTests.push({ to, subject, text, html });
    return { sent: true };
  }

  if (!isMailConfigured()) {
    console.warn(
      `[mail] Correo sin configurar. No se envió "${subject}" a ${to}.\n${text}`
    );
    return { sent: false, reason: "not_configured" };
  }

  try {
    if (BREVO_API_KEY) {
      await sendViaBrevo({ to, subject, text, html }, { apiKey: BREVO_API_KEY, from: MAIL_FROM });
    } else {
      await getTransporter().sendMail({ from: MAIL_FROM, to, subject, text, html });
    }
    return { sent: true };
  } catch (err) {
    console.error(`[mail] Error enviando "${subject}" a ${to}:`, err.message);
    return { sent: false, reason: "error" };
  }
};

//! Escapa texto para meterlo en el HTML del correo
const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

//! Plantilla mínima: un párrafo, un botón y el enlace en texto plano por si el
//! cliente de correo no pinta botones.
const simpleEmail = ({ title, intro, buttonText, url, footer }) => ({
  text: `${title}\n\n${intro}\n\n${buttonText}: ${url}\n\n${footer || ""}`.trim(),
  html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;color:#1f2937">
  <h2 style="margin:0 0 12px">${escapeHtml(title)}</h2>
  <p style="line-height:1.5">${escapeHtml(intro)}</p>
  <p style="margin:24px 0"><a href="${escapeHtml(url)}" style="background:#2563eb;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">${escapeHtml(buttonText)}</a></p>
  <p style="font-size:13px;color:#6b7280;word-break:break-all">${escapeHtml(url)}</p>
  ${footer ? `<p style="font-size:13px;color:#6b7280">${escapeHtml(footer)}</p>` : ""}
</div>`,
});

module.exports = {
  sendMail,
  simpleEmail,
  isMailConfigured,
  sentInTests,
  //! Expuestas para las pruebas
  parseAddress,
  buildBrevoPayload,
  sendViaBrevo,
};
