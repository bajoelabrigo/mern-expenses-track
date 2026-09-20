import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LuCopy, LuExternalLink, LuGlobe, LuTrash2 } from "react-icons/lu";
import {
  createPublicLinkAPI,
  getPublicLinkAPI,
  removePublicLinkAPI,
  updatePublicLinkAPI,
} from "../../services/workspaces/publicLinkService";
import { getErrorMessage } from "../../lib/axios";
import { Button, Card, Field, Notice, Select } from "../ui";

const LINK_KEY = ["enlace-publico"];

//! Enlace de solo lectura para la congregación.
//!
//! Se avisa por todos lados de qué se publica y qué no: quien pulsa este botón
//! está poniendo las cuentas de su iglesia al alcance de cualquiera que tenga
//! la dirección, y eso tiene que quedar claro ANTES de pulsarlo.
const PublicLinkCard = ({ workspace }) => {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");
  const [copiado, setCopiado] = useState(false);

  const link = useQuery({
    queryKey: [...LINK_KEY, workspace._id],
    queryFn: () => getPublicLinkAPI(workspace._id),
  });

  const refrescar = () => queryClient.invalidateQueries({ queryKey: LINK_KEY });

  const crear = useMutation({
    mutationFn: () =>
      createPublicLinkAPI({
        id: workspace._id,
        period: link.data?.period || "mes",
        showFunds: link.data?.showFunds ?? true,
      }),
    onSuccess: (data) => {
      setUrl(data.url);
      setCopiado(false);
      refrescar();
    },
  });

  const cambiar = useMutation({
    mutationFn: (changes) =>
      updatePublicLinkAPI({ id: workspace._id, ...changes }),
    onSuccess: refrescar,
  });

  const quitar = useMutation({
    mutationFn: () => removePublicLinkAPI(workspace._id),
    onSuccess: () => {
      setUrl("");
      refrescar();
    },
  });

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
    } catch {
      //! Sin permiso al portapapeles, queda el texto a la vista para copiarlo a mano
      setCopiado(false);
    }
  };

  const estado = link.data;
  const activo = estado?.active;
  const fallo = [crear, cambiar, quitar].find((m) => m.isError);

  return (
    <Card
      as="section"
      aria-labelledby="enlace-publico"
      className="p-5 space-y-4"
    >
      <div>
        <span className="h-10 w-10 rounded-xl bg-surface-2 text-ink grid place-items-center">
          <LuGlobe aria-hidden="true" />
        </span>
        <h2
          id="enlace-publico"
          className="mt-3 text-lg font-extrabold text-ink"
        >
          Enlace para la congregación
        </h2>
        <p className="mt-1 text-sm text-muted leading-relaxed">
          Una página que muestra{" "}
          <strong className="text-ink-2">solo los totales</strong>: cuánto
          entró, en qué se fue y qué quedó. Nunca aparecen los nombres de
          quienes dieron, ni los comprobantes, ni el detalle de cada movimiento.
        </p>
      </div>

      {fallo && <Notice tone="danger">{getErrorMessage(fallo.error)}</Notice>}

      {/* La dirección recién creada manda: si no, desaparecería mientras se
          recarga el estado, justo cuando hay que copiarla */}
      {!estado && !url ? (
        <>
          <Notice tone="warning">
            Cualquiera que tenga la dirección podrá verla, sin cuenta ni
            contraseña. Compártela solo donde quieras que se vea.
          </Notice>
          <Button
            variant="secondary"
            onClick={() => crear.mutate()}
            disabled={crear.isPending}
          >
            {crear.isPending ? "Creando…" : "Crear el enlace"}
          </Button>
        </>
      ) : (
        <>
          {url ? (
            <div className="rounded-2xl bg-surface-2 p-4 space-y-3">
              <p className="text-sm font-semibold text-ink">
                Esta es la dirección. Cópiala ahora: por seguridad no se vuelve
                a mostrar.
              </p>
              <p className="break-all font-mono text-sm text-ink-2">{url}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={copiar}>
                  <LuCopy aria-hidden="true" /> {copiado ? "Copiada" : "Copiar"}
                </Button>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 h-9 px-3.5 rounded-full text-sm font-semibold text-ink-2 hover:bg-surface"
                >
                  <LuExternalLink aria-hidden="true" /> Verla
                </a>
              </div>
            </div>
          ) : (
            <Notice tone={activo ? "success" : "info"}>
              {activo
                ? `El enlace está activo (termina en …${estado.hint}).`
                : "El enlace está apagado: ahora mismo nadie puede verlo."}{" "}
              {estado.views > 0
                ? `Se ha abierto ${estado.views} ${estado.views === 1 ? "vez" : "veces"}.`
                : "Todavía no lo ha abierto nadie."}
            </Notice>
          )}

          {estado && (
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Qué se publica" htmlFor="enlace-periodo">
                <Select
                  id="enlace-periodo"
                  value={estado.period}
                  onChange={(e) => cambiar.mutate({ period: e.target.value })}
                  disabled={cambiar.isPending}
                >
                  <option value="mes">El mes en curso</option>
                  <option value="anio">El año en curso</option>
                </Select>
              </Field>

              <label className="flex items-center justify-between gap-3 sm:pt-7">
                <span className="text-sm font-semibold text-ink-2">
                  Mostrar los fondos
                </span>
                <input
                  type="checkbox"
                  checked={estado.showFunds}
                  onChange={(e) =>
                    cambiar.mutate({ showFunds: e.target.checked })
                  }
                  disabled={cambiar.isPending}
                  className="h-5 w-5 accent-[var(--ink)]"
                />
              </label>
            </div>
          )}

          {estado && (
            <div className="flex flex-wrap gap-2 pt-1 border-t border-line">
              <Button
                className="mt-3"
                size="sm"
                variant="secondary"
                onClick={() => cambiar.mutate({ active: !activo })}
                disabled={cambiar.isPending}
              >
                {activo ? "Apagar" : "Encender"}
              </Button>
              <Button
                className="mt-3"
                size="sm"
                variant="secondary"
                onClick={() => crear.mutate()}
                disabled={crear.isPending}
              >
                Cambiar la dirección
              </Button>
              <Button
                className="mt-3"
                size="sm"
                variant="danger-ghost"
                onClick={() => {
                  if (
                    window.confirm(
                      "¿Quitar el enlace? Quien lo tenga dejará de ver las cuentas.",
                    )
                  )
                    quitar.mutate();
                }}
                disabled={quitar.isPending}
              >
                <LuTrash2 aria-hidden="true" /> Quitar
              </Button>
            </div>
          )}

          <p className="text-xs text-muted leading-relaxed">
            Si el enlace se fue a donde no debía, usa{" "}
            <strong>Cambiar la dirección</strong>: la anterior deja de funcionar
            al instante.
          </p>
        </>
      )}
    </Card>
  );
};

export default PublicLinkCard;
