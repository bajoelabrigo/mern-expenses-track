//! Datos del APK que se ofrece en /descargas. Al compilar una versión nueva
//! (ver android/README.md) hay que copiar el .apk a public/descargas/ y
//! actualizar esto: es lo único que la página necesita saber.
export const APP_RELEASE = {
  version: "1.1.0",
  file: "/descargas/control-de-gastos-1.1.0.apk",
  size: "949 KB",
  //! Fecha de la compilación, para que se vea que está al día
  date: "2026-09-19",
  //! Cuando esté publicada en Google Play, aquí va su enlace y la página
  //! ofrece ese botón en vez del archivo suelto
  playStore: "",
};

//! "19 de septiembre de 2026"
export const releaseDate = ({ date } = APP_RELEASE) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("es", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
