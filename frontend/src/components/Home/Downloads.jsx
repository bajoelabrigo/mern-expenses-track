import { Link } from "react-router-dom";
import { LuDownload, LuMonitor } from "react-icons/lu";
import { FaAndroid, FaApple } from "react-icons/fa6";
import { ButtonLink, Card } from "../ui";
import { APP_RELEASE, releaseDate } from "../../lib/appRelease";

//! Cómo instalarla desde el navegador, según el aparato. Son los pasos reales
//! de cada sistema: en el iPhone no existe "Instalar", hay que compartir.
const BROWSER_STEPS = [
  {
    icon: FaApple,
    device: "iPhone o iPad",
    browser: "Safari",
    steps: [
      "Abre controldegastosiglesia.netlify.app en Safari.",
      "Toca el botón Compartir (el cuadrado con la flecha hacia arriba).",
      'Baja y elige "Añadir a pantalla de inicio".',
    ],
  },
  {
    icon: FaAndroid,
    device: "Android",
    browser: "Chrome",
    steps: [
      "Abre controldegastosiglesia.netlify.app en Chrome.",
      "Toca los tres puntos de arriba a la derecha.",
      'Elige "Instalar aplicación" o "Añadir a pantalla de inicio".',
    ],
  },
  {
    icon: LuMonitor,
    device: "Computadora",
    browser: "Chrome o Edge",
    steps: [
      "Abre controldegastosiglesia.netlify.app.",
      "Toca el icono de instalar que aparece al final de la barra de direcciones.",
      'Confirma con "Instalar".',
    ],
  },
];

const ANDROID_STEPS = [
  "Descarga el archivo con el botón de arriba.",
  "Ábrelo desde las notificaciones o desde la carpeta Descargas.",
  'Android te pedirá permitir "instalar apps de origen desconocido": acepta solo esa vez.',
  "Listo: la app queda en tu pantalla de inicio.",
];

//! Lista de pasos numerados
const Steps = ({ items }) => (
  <ol className="mt-4 space-y-2.5">
    {items.map((step, i) => (
      <li key={step} className="flex gap-3 text-sm text-ink-2 leading-relaxed">
        <span
          aria-hidden="true"
          className="h-6 w-6 shrink-0 rounded-full bg-surface-2 text-ink font-bold text-xs grid place-items-center"
        >
          {i + 1}
        </span>
        {step}
      </li>
    ))}
  </ol>
);

//! /descargas — la página que se comparte con las iglesias
const Downloads = () => (
  <div className="mx-auto max-w-5xl px-4">
    <section className="py-12 lg:py-16 max-w-2xl">
      <h1 className="text-[40px] sm:text-[48px] leading-[1.05] font-extrabold tracking-tight text-ink">
        Lleva las cuentas en el celular.
      </h1>
      <p className="mt-5 text-lg text-ink-2 leading-relaxed">
        La misma app, de dos maneras: instálala desde el navegador en cualquier teléfono o
        computadora, o descarga el archivo para Android. Con las dos entras a la misma cuenta y
        ves los mismos números.
      </p>
    </section>

    <section aria-labelledby="android" className="pb-12">
      <Card className="p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <span className="h-11 w-11 rounded-xl bg-accent-soft text-ink grid place-items-center">
              <FaAndroid aria-hidden="true" className="text-xl" />
            </span>
            <h2 id="android" className="mt-4 text-[26px] font-extrabold tracking-tight text-ink">
              App para Android
            </h2>
            <p className="mt-2 text-ink-2 max-w-lg leading-relaxed">
              El archivo de instalación, directo desde esta página. No necesitas cuenta de Google
              ni pasar por ninguna tienda.
            </p>
            <p className="mt-2 text-sm text-muted">
              Versión {APP_RELEASE.version} · {APP_RELEASE.size} · {releaseDate()}
            </p>
          </div>

          <a
            href={APP_RELEASE.file}
            download
            className="inline-flex items-center gap-2 h-12 px-6 rounded-full bg-accent text-accent-ink font-bold hover:brightness-95 transition"
          >
            <LuDownload aria-hidden="true" /> Descargar para Android
          </a>
        </div>

        <Steps items={ANDROID_STEPS} />

        <p className="mt-5 text-sm text-muted leading-relaxed">
          El aviso de &quot;origen desconocido&quot; es normal: solo significa que el archivo no
          viene de Google Play. La app está firmada con nuestra propia clave y solo abre este sitio.
        </p>
      </Card>
    </section>

    <section aria-labelledby="navegador" className="py-12 border-t border-line">
      <h2 id="navegador" className="text-[28px] font-extrabold tracking-tight text-ink max-w-xl">
        O instálala desde el navegador, sin descargar nada.
      </h2>
      <p className="mt-3 text-ink-2 max-w-2xl leading-relaxed">
        Queda igual que cualquier otra app: con su icono en la pantalla de inicio, a pantalla
        completa y funcionando sin señal. Es la única manera en iPhone.
      </p>

      <div className="mt-8 grid sm:grid-cols-3 gap-4">
        {BROWSER_STEPS.map(({ icon: Icon, device, browser, steps }) => (
          <Card key={device} className="p-5">
            <span className="h-10 w-10 rounded-xl bg-surface-2 text-ink grid place-items-center">
              <Icon aria-hidden="true" className="text-lg" />
            </span>
            <h3 className="mt-4 font-extrabold text-ink">{device}</h3>
            <p className="text-sm text-muted">{browser}</p>
            <Steps items={steps} />
          </Card>
        ))}
      </div>
    </section>

    <section className="py-14 border-t border-line text-center">
      <h2 className="text-[28px] font-extrabold tracking-tight text-ink">
        Ya la tienes. Ahora crea el espacio de tu iglesia.
      </h2>
      <p className="mt-2 text-ink-2">Es gratis, y puedes invitar a tu tesorero en un minuto.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <ButtonLink to="/register" variant="accent" size="lg">
          Crear cuenta gratis
        </ButtonLink>
        <ButtonLink to="/login" variant="secondary" size="lg">
          Ya tengo cuenta
        </ButtonLink>
      </div>
      <p className="mt-5 text-sm text-muted">
        ¿Es para tu tesorera y no sabe por dónde empezar?{" "}
        <Link to="/ayuda" className="font-semibold text-ink underline underline-offset-4">
          Mándale la ayuda paso a paso
        </Link>
        .
      </p>
    </section>
  </div>
);

export default Downloads;
