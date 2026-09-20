import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { LuImagePlus, LuTrash2 } from "react-icons/lu";
import { getErrorMessage } from "../../lib/axios";
import { Button, Card, Notice } from "../ui";

//! Los mismos formatos que acepta el servidor: son los únicos que caben
//! dentro de un PDF
const ACCEPT = "image/png,image/jpeg";
const MAX_BYTES = 2 * 1024 * 1024;

//! El logo del espacio, que sale impreso en informes y constancias
const LogoCard = ({ workspace, onDone, upload, remove }) => {
  const fileInput = useRef(null);
  const [error, setError] = useState("");

  const subir = useMutation({
    mutationFn: (file) => upload({ id: workspace._id, file }),
    onSuccess: onDone,
  });
  const quitar = useMutation({
    mutationFn: () => remove(workspace._id),
    onSuccess: onDone,
  });

  const elegir = (event) => {
    const file = event.target.files?.[0];
    //! El input se limpia siempre, para poder reintentar con el mismo archivo
    event.target.value = "";
    if (!file) return;

    setError("");
    subir.reset();
    quitar.reset();

    if (file.size > MAX_BYTES) {
      setError("El logo no puede pasar de 2 MB.");
      return;
    }
    subir.mutate(file);
  };

  //! Solo hay mensaje si de verdad falló algo: getErrorMessage(undefined)
  //! devuelve un texto genérico y saldría un error nada más abrir la página
  const fallo = subir.error || quitar.error;
  const mensaje = error || (fallo ? getErrorMessage(fallo) : "");
  const trabajando = subir.isPending || quitar.isPending;

  return (
    <Card as="section" aria-labelledby="logo-espacio" className="p-5 space-y-4">
      <div>
        <h2 id="logo-espacio" className="text-lg font-extrabold text-ink">
          Logo
        </h2>
        <p className="mt-1 text-sm text-muted leading-relaxed">
          Sale impreso arriba en los informes y en las constancias de aportes. PNG o JPG, hasta
          2 MB. Un PNG con fondo transparente es el que mejor queda.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="h-20 w-20 shrink-0 rounded-2xl bg-surface-2 grid place-items-center overflow-hidden">
          {workspace.logo ? (
            <img
              src={workspace.logo}
              alt={`Logo de ${workspace.name}`}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <LuImagePlus aria-hidden="true" className="text-2xl text-muted" />
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPT}
            onChange={elegir}
            className="sr-only"
            id="logo-archivo"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => fileInput.current?.click()}
            disabled={trabajando}
          >
            {subir.isPending ? "Subiendo…" : workspace.logo ? "Cambiar logo" : "Elegir logo"}
          </Button>

          {workspace.logo && (
            <Button
              type="button"
              variant="danger-ghost"
              onClick={() => quitar.mutate()}
              disabled={trabajando}
            >
              <LuTrash2 aria-hidden="true" />
              {quitar.isPending ? "Quitando…" : "Quitar"}
            </Button>
          )}
        </div>
      </div>

      {mensaje && <Notice tone="danger">{mensaje}</Notice>}
      {subir.isSuccess && !mensaje && (
        <Notice tone="success">Listo: los informes que saques ahora ya lo llevan.</Notice>
      )}
    </Card>
  );
};

export default LogoCard;
