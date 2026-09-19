const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
require("./helpers"); //! fija NODE_ENV=test antes de cargar la configuración
const { parseAddress, buildBrevoPayload, sendViaBrevo } = require("../utils/mailer");

//! fetch simulado: guarda la petición y responde lo que se le indique
const fakeFetch = (status, body = {}) => {
  const calls = [];
  const impl = async (url, options) => {
    calls.push({ url, options });
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  return { impl, calls };
};

describe("Correo por Brevo", () => {
  test("interpreta el remitente con y sin nombre", () => {
    assert.deepEqual(parseAddress("Control de Gastos <a@b.com>"), {
      name: "Control de Gastos",
      email: "a@b.com",
    });
    assert.deepEqual(parseAddress('"Iglesia Betel" <x@y.com>'), {
      name: "Iglesia Betel",
      email: "x@y.com",
    });
    assert.deepEqual(parseAddress(" a@b.com "), { email: "a@b.com" });
  });

  test("arma el cuerpo que espera la API", () => {
    const payload = buildBrevoPayload({
      from: "Control de Gastos <a@b.com>",
      to: "tesorera@correo.com",
      subject: "Hola",
      text: "texto",
      html: "<p>html</p>",
    });
    assert.deepEqual(payload, {
      sender: { name: "Control de Gastos", email: "a@b.com" },
      to: [{ email: "tesorera@correo.com" }],
      subject: "Hola",
      textContent: "texto",
      htmlContent: "<p>html</p>",
    });
  });

  test("envía con la clave en la cabecera api-key", async () => {
    const { impl, calls } = fakeFetch(201, { messageId: "<id@brevo>" });

    await sendViaBrevo(
      { to: "t@c.com", subject: "S", text: "T", html: "<p>H</p>" },
      { apiKey: "xkeysib-prueba", from: "a@b.com", fetchImpl: impl }
    );

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://api.brevo.com/v3/smtp/email");
    assert.equal(calls[0].options.method, "POST");
    assert.equal(calls[0].options.headers["api-key"], "xkeysib-prueba");
    assert.equal(JSON.parse(calls[0].options.body).to[0].email, "t@c.com");
  });

  test("un rechazo de Brevo lanza con su motivo y sin exponer la clave", async () => {
    const { impl } = fakeFetch(400, {
      code: "invalid_parameter",
      message: "sender is not valid",
    });

    await assert.rejects(
      sendViaBrevo(
        { to: "t@c.com", subject: "S", text: "T", html: "H" },
        { apiKey: "xkeysib-secreta", from: "a@b.com", fetchImpl: impl }
      ),
      (err) => {
        assert.match(err.message, /Brevo 400: invalid_parameter sender is not valid/);
        assert.doesNotMatch(err.message, /xkeysib/);
        return true;
      }
    );
  });
});
