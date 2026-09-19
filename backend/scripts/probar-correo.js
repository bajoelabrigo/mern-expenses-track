//! Envía un correo de prueba con la configuración del .env (Brevo o SMTP).
//! Uso (desde backend): node scripts/probar-correo.js destinatario@correo.com
const { sendMail, simpleEmail, isMailConfigured } = require("../utils/mailer");
const { APP_URL, BREVO_API_KEY } = require("../config/env");

const to = process.argv[2];

(async () => {
  if (!to) {
    console.error("Indica el destinatario: node scripts/probar-correo.js tu@correo.com");
    process.exit(1);
  }
  if (!isMailConfigured()) {
    console.error("Correo sin configurar: falta BREVO_API_KEY (o SMTP_HOST) y MAIL_FROM en el .env");
    process.exit(1);
  }

  console.log(`Enviando por ${BREVO_API_KEY ? "Brevo (API)" : "SMTP"} a ${to}...`);
  const result = await sendMail({
    to,
    subject: "Prueba de correo — Control de Gastos",
    ...simpleEmail({
      title: "¡El correo funciona!",
      intro:
        "Si lees esto, la app ya puede enviar invitaciones y enlaces para recuperar la contraseña.",
      buttonText: "Abrir la app",
      url: APP_URL,
    }),
  });

  console.log(result.sent ? "Enviado." : `No se envió (${result.reason}). Mira el error de arriba.`);
  process.exit(result.sent ? 0 : 1);
})();
