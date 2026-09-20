//! ¿La app está corriendo dentro de la aplicación de Android?
//!
//! Importa por una razón concreta: la política de pagos de Google Play prohíbe
//! que una app publicada en su tienda lleve al usuario a pagar por fuera, con
//! botones o enlaces incluidos. La sección de socios se paga con PayPal, así
//! que dentro de la app de Android no se muestra. En el navegador sí.
//!
//! Cómo se reconoce: la app de Android es una "Trusted Web Activity", que abre
//! este mismo sitio y deja su firma en `document.referrer`
//! (android-app://com.controldegastos.app). El referrer solo llega en la
//! primera carga, así que se recuerda durante la sesión.

const CLAVE = "es-app-android";

const leerRecordado = () => {
  try {
    return window.sessionStorage.getItem(CLAVE) === "1";
  } catch {
    //! En navegación privada o con el almacenamiento bloqueado
    return false;
  }
};

const recordar = () => {
  try {
    window.sessionStorage.setItem(CLAVE, "1");
  } catch {
    /* si no se puede guardar, se vuelve a mirar el referrer en cada carga */
  }
};

export const isAndroidApp = () => {
  if (typeof window === "undefined") return false;
  if (document.referrer.startsWith("android-app://")) {
    recordar();
    return true;
  }
  return leerRecordado();
};
