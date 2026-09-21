import { useCallback, useState } from "react";
import {
  LuArrowRight,
  LuCheck,
  LuMessageCircle,
  LuShare2,
  LuTriangleAlert,
} from "react-icons/lu";
import {
  CONTACTO,
  LO_ESENCIAL,
  TEMAS,
  TEXTO_PARA_COMPARTIR,
  TRANQUILA,
} from "../../lib/ayuda";
import { Button, Card, Eyebrow, Notice } from "../ui";

//! El enlace que se comparte: el mismo que está abierto
const enlace = () =>
  typeof window === "undefined" ? "" : `${window.location.origin}/ayuda`;

//! Compartir por WhatsApp: sin número, para que elija a quién. Es la forma en
//! que se pasa esto en la iglesia.
const Compartir = () => {
  const [copiado, setCopiado] = useState(false);

  const copiar = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(enlace());
      setCopiado(true);
    } catch {
      //! Sin permiso de portapapeles el enlace se ve en la barra del navegador
      setCopiado(false);
    }
  }, []);

  const whatsapp = `https://wa.me/?text=${encodeURIComponent(TEXTO_PARA_COMPARTIR(enlace()))}`;

  return (
    <div className="mt-5 flex flex-wrap gap-3">
      <a
        href={whatsapp}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-accent px-5 text-[15px] font-semibold text-accent-ink transition hover:brightness-95"
      >
        <LuMessageCircle aria-hidden="true" /> Compartir por WhatsApp
      </a>
      <Button variant="secondary" onClick={copiar}>
        {copiado ? <LuCheck aria-hidden="true" /> : <LuShare2 aria-hidden="true" />}
        {copiado ? "Enlace copiado" : "Copiar el enlace"}
      </Button>
    </div>
  );
};

//! Las capturas son de un teléfono: se muestran a su ancho, en fila y con
//! desplazamiento si hay más de una. En pantalla grande la fila va centrada,
//! que si no queda pegada a la izquierda con medio ancho vacío al lado.
const Capturas = ({ imagenes }) => (
  <div className="mt-5 flex gap-3 overflow-x-auto pb-2 lg:justify-center">
    {imagenes.map((imagen) => (
      <figure key={imagen.src} className="shrink-0">
        <img
          src={imagen.src}
          alt={imagen.alt}
          width="390"
          height="844"
          loading="lazy"
          className="w-[232px] rounded-3xl border border-line bg-surface sm:w-[260px]"
        />
      </figure>
    ))}
  </div>
);

const Paso = ({ n, children }) => (
  <li className="flex gap-3">
    <span
      aria-hidden="true"
      className="mt-0.5 h-6 w-6 shrink-0 grid place-items-center rounded-full bg-surface-2 text-xs font-bold tabular text-ink-2"
    >
      {n}
    </span>
    <span className="text-[15px] leading-relaxed text-ink-2">{children}</span>
  </li>
);

//! /ayuda — cómo se usa la app, paso a paso. Es pública a propósito: el enlace
//! se manda por WhatsApp y tiene que abrir sin cuenta.
const AyudaPage = () => {
  const hayContacto = Boolean(CONTACTO.whatsapp || CONTACTO.correo);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:py-12">
      <header>
        <Eyebrow>Para el equipo de la iglesia</Eyebrow>
        <h1 className="mt-1 text-[34px] leading-tight font-extrabold tracking-tight text-ink">
          Cómo se usa, paso a paso
        </h1>
        <p className="mt-3 text-lg leading-relaxed text-ink-2">
          Siete cosas y ya. Cada una con una captura de la pantalla, para que la reconozcas en tu
          teléfono. Si solo vas a leer algo, lee lo de abajo.
        </p>
        <Compartir />
      </header>

      <Card as="section" aria-labelledby="lo-esencial" className="mt-8 p-5 sm:p-6">
        <h2 id="lo-esencial" className="text-lg font-extrabold text-ink">
          Lo esencial
        </h2>
        <ul className="mt-3 space-y-2.5">
          {LO_ESENCIAL.map((linea) => (
            <li key={linea} className="flex gap-3">
              <LuCheck aria-hidden="true" className="mt-1 shrink-0 text-income" />
              <span className="text-[15px] leading-relaxed text-ink-2">{linea}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card as="section" aria-labelledby="tranquila" className="mt-4 p-5 sm:p-6">
        <h2 id="tranquila" className="text-lg font-extrabold text-ink">
          Puedes estar tranquila
        </h2>
        <p className="mt-1 text-sm text-muted">
          Lo que más asusta de una app de cuentas, aquí no puede pasar.
        </p>
        <ul className="mt-3 space-y-2.5">
          {TRANQUILA.map((linea) => (
            <li key={linea} className="flex gap-3">
              <LuCheck aria-hidden="true" className="mt-1 shrink-0 text-income" />
              <span className="text-[15px] leading-relaxed text-ink-2">{linea}</span>
            </li>
          ))}
        </ul>
      </Card>

      <nav aria-label="Temas" className="mt-8">
        <Eyebrow>Los siete temas</Eyebrow>
        <ol className="mt-3 divide-y divide-line overflow-hidden rounded-card bg-surface shadow-card">
          {TEMAS.map((tema, i) => (
            <li key={tema.id}>
              <a
                href={`#${tema.id}`}
                className="flex items-center gap-3 px-4 py-3 text-[15px] font-semibold text-ink transition hover:bg-surface-2"
              >
                <span className="tabular text-muted">{i + 1}</span>
                <span className="flex-1">{tema.titulo}</span>
                <LuArrowRight aria-hidden="true" className="text-muted" />
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {TEMAS.map((tema, i) => (
        <section key={tema.id} id={tema.id} className="mt-10 scroll-mt-24">
          <Eyebrow>Tema {i + 1}</Eyebrow>
          <h2 className="mt-1 text-[24px] leading-tight font-extrabold tracking-tight text-ink">
            {tema.titulo}
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">{tema.resumen}</p>

          <ol className="mt-4 space-y-3">
            {tema.pasos.map((paso, n) => (
              <Paso key={paso} n={n + 1}>
                {paso}
              </Paso>
            ))}
          </ol>

          {tema.ojo && (
            <Notice tone="warning" className="mt-4">
              <span className="inline-flex gap-2">
                <LuTriangleAlert aria-hidden="true" className="mt-0.5 shrink-0" />
                <span>{tema.ojo}</span>
              </span>
            </Notice>
          )}

          <Capturas imagenes={tema.imagenes} />
        </section>
      ))}

      <Card as="section" aria-labelledby="trabaste" className="mt-12 p-5 sm:p-6">
        <h2 id="trabaste" className="text-lg font-extrabold text-ink">
          ¿Te trabaste?
        </h2>
        {hayContacto ? (
          <>
            <p className="mt-1 text-[15px] leading-relaxed text-ink-2">
              Escribe y te ayudamos. Si puedes, manda una captura de lo que ves: se resuelve mucho
              más rápido.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {CONTACTO.whatsapp && (
                <a
                  href={`https://wa.me/${CONTACTO.whatsapp}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-accent px-5 text-[15px] font-semibold text-accent-ink transition hover:brightness-95"
                >
                  <LuMessageCircle aria-hidden="true" /> Escribir por WhatsApp
                </a>
              )}
              {CONTACTO.correo && (
                <a
                  href={`mailto:${CONTACTO.correo}`}
                  className="inline-flex h-11 items-center justify-center rounded-full bg-surface px-5 text-[15px] font-semibold text-ink border border-line"
                >
                  Escribir un correo
                </a>
              )}
            </div>
          </>
        ) : (
          <p className="mt-1 text-[15px] leading-relaxed text-ink-2">
            Pregúntale a quien te dio el acceso al espacio: esa persona puede ver el mismo libro
            que tú y sabe qué se hizo cada día.
          </p>
        )}
      </Card>
    </div>
  );
};

export default AyudaPage;
