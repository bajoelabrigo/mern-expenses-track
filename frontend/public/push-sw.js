//! Avisos al teléfono.
//!
//! VitePWA genera el service worker de la app (workbox `generateSW`) y este
//! archivo se le pega con `importScripts`, que es la forma de añadirle
//! manejadores propios sin pasar a `injectManifest`. Aquí solo hay dos: recibir
//! el aviso y abrir la pantalla que toca al tocarlo.

//! Aviso recibido con la app cerrada (o abierta: el navegador decide)
self.addEventListener("push", (event) => {
  let datos = {};
  try {
    datos = event.data ? event.data.json() : {};
  } catch {
    //! Un aviso que no venga en JSON se muestra igual, con lo que se pueda leer
    datos = { body: event.data ? event.data.text() : "" };
  }

  const titulo = datos.title || "Control de Gastos";

  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: datos.body || "",
      icon: "/pwa-192x192.png",
      badge: "/pwa-64x64.png",
      //! `tag`: los cambios del mismo movimiento se reemplazan en vez de apilarse
      tag: datos.tag || "control-de-gastos",
      renotify: Boolean(datos.tag),
      data: { url: datos.url || "/avisos" },
    })
  );
});

//! Al tocar el aviso: se abre la app (o se trae al frente) en la pantalla del
//! cambio. Si ya hay una pestaña abierta se reutiliza: abrir otra dejaría dos
//! sesiones de la misma app.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = event.notification.data?.url || "/avisos";

  event.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      const abierta = ventanas.find(
        (ventana) => new URL(ventana.url).origin === self.location.origin
      );

      if (abierta) {
        await abierta.focus();
        if ("navigate" in abierta) await abierta.navigate(destino);
        return;
      }

      await self.clients.openWindow(destino);
    })()
  );
});
