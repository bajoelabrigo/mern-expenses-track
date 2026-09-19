const nodemailer = require("nodemailer");
const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  MAIL_FROM,
  isTest,
} = require("../config/env");

//! Un solo transporte con pool para toda la app (no uno por correo).
let transporter = null;

const isMailConfigured = () => Boolean(SMTP_HOST && MAIL_FROM);

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

//! Correos enviados durante las pruebas (para comprobar enlaces sin SMTP)
const sentInTests = [];

//! Envía un correo. Nunca lanza: devuelve { sent, reason } para que quien
//! llama decida qué decir al usuario. Un fallo de SMTP no debe tumbar una
//! invitación que ya quedó creada.
const sendMail = async ({ to, subject, text, html }) => {
  if (isTest) {
    sentInTests.push({ to, subject, text, html });
    return { sent: true };
  }

  if (!isMailConfigured()) {
    console.warn(
      `[mail] SMTP sin configurar. No se envió "${subject}" a ${to}.\n${text}`
    );
    return { sent: false, reason: "not_configured" };
  }

  try {
    await getTransporter().sendMail({ from: MAIL_FROM, to, subject, text, html });
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

module.exports = { sendMail, simpleEmail, isMailConfigured, sentInTests };
