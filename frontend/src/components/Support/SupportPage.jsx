import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LuHeart, LuServer, LuShieldCheck, LuUsers } from "react-icons/lu";
import {
  cancelSubscriptionAPI,
  captureSupportAPI,
  createSubscriptionAPI,
  createSupportOrderAPI,
  getSupportStatusAPI,
} from "../../services/support/supportService";
import { isAndroidApp } from "../../lib/platform";
import { getErrorMessage } from "../../lib/axios";
import AlertMessage from "../Alert/AlertMessage";
import { Button, Card, Notice, PageHeader, Segmented } from "../ui";
import { cx } from "../ui/styles";

//! Clave de la consulta; no se exporta para no romper la recarga en caliente
const SUPPORT_KEY = ["socio", "estado"];

//! Se lee al usarla, no al cargar el archivo: así la página reacciona a la
//! configuración de cada despliegue sin depender del orden de importación
const clientId = () => import.meta.env.VITE_PAYPAL_CLIENT_ID || "";
const TIERS = [5, 10, 20];

//! En qué se va el dinero. Sin promesas: un socio no desbloquea nada.
const DESTINOS = [
  { icon: LuServer, text: "El servidor donde viven las cuentas de cada iglesia." },
  { icon: LuShieldCheck, text: "El guardado de los comprobantes y las copias de seguridad." },
  { icon: LuUsers, text: "Que siga siendo gratis para las iglesias que no pueden pagar." },
];

//! Carga el script de PayPal una sola vez para toda la sesión
const usePaypalSdk = (enabled) => {
  const [estado, setEstado] = useState(() => (window.paypal ? "listo" : "cargando"));

  useEffect(() => {
    if (!enabled || !clientId() || window.paypal) return;

    const existente = document.querySelector("script[data-paypal]");
    const script = existente || document.createElement("script");
    const onLoad = () => setEstado("listo");
    const onError = () => setEstado("error");

    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);

    if (!existente) {
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId()}&currency=USD`;
      script.dataset.paypal = "1";
      document.body.appendChild(script);
    }
    return () => {
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
    };
  }, [enabled]);

  return estado;
};

//! Los botones de PayPal, que se vuelven a pintar al cambiar el monto
const PaypalButtons = ({ amount, onPaid, onError }) => {
  const contenedor = useRef(null);
  //! El importe elegido, leído en el momento de crear la orden
  const amountRef = useRef(amount);
  amountRef.current = amount;

  useEffect(() => {
    if (!window.paypal || !contenedor.current) return;
    const nodo = contenedor.current;
    nodo.innerHTML = "";

    const botones = window.paypal.Buttons({
      style: { shape: "pill", label: "paypal", height: 44 },
      createOrder: async () => {
        const { orderId } = await createSupportOrderAPI(amountRef.current);
        return orderId;
      },
      onApprove: async (data) => {
        const resultado = await captureSupportAPI(data.orderID);
        onPaid(resultado);
      },
      onError: (err) => onError(err),
    });

    botones.render(nodo).catch(() => onError(new Error("No se pudieron mostrar los botones")));
    return () => {
      //! Al desmontar, PayPal deja de escuchar
      botones.close?.();
    };
  }, [onPaid, onError]);

  //! `color-scheme: light` a propósito, y solo aquí. La app declara
  //! `color-scheme: dark` en :root (index.css), y eso hace que el navegador deje
  //! de dar lienzo transparente al iframe de PayPal —que es de otro dominio— y
  //! le pinte su fondo propio, que es blanco. El resultado era una banda blanca
  //! en medio de la tarjeta oscura. Devolviendo el esquema claro a este trozo,
  //! el iframe vuelve a ser transparente y los botones se sientan sobre la
  //! tarjeta. No se puede arreglar por dentro: el iframe no es nuestro.
  return <div ref={contenedor} className="[color-scheme:light]" />;
};

//! /socio — aporte voluntario para sostener la app
const SupportPage = () => {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(10);
  const [otro, setOtro] = useState("");
  const [fallo, setFallo] = useState("");
  const [gracias, setGracias] = useState(null);
  //! "una vez" o "cada mes". Se empieza por el de una vez: es el que menos
  //! compromete, y quien quiera el mensual lo va a buscar.
  const [cuando, setCuando] = useState("unico");
  const [params, setParams] = useSearchParams();

  //! Dentro de la app de Android esta sección no existe, así que ni se
  //! pregunta al servidor (ver lib/platform.js)
  const enAppAndroid = isAndroidApp();
  const estado = useQuery({
    queryKey: SUPPORT_KEY,
    queryFn: getSupportStatusAPI,
    enabled: !enAppAndroid,
  });
  const sdk = usePaypalSdk(Boolean(estado.data?.disponible));

  const pagado = useMutation({
    mutationFn: async (resultado) => resultado,
    onSuccess: (resultado) => {
      setGracias(resultado);
      setFallo("");
      queryClient.invalidateQueries({ queryKey: SUPPORT_KEY });
    },
  });

  //! Al volver de aprobar en PayPal. El cobro lo confirma el aviso del
  //! servidor, que puede tardar unos segundos: por eso se vuelve a preguntar el
  //! estado en vez de dar por hecho que ya está activo.
  const volvioDePaypal = params.get("mensual");
  useEffect(() => {
    if (!volvioDePaypal) return;
    if (volvioDePaypal === "listo") queryClient.invalidateQueries({ queryKey: SUPPORT_KEY });
    //! El parámetro se quita para que recargar no vuelva a dar las gracias
    setParams({}, { replace: true });
  }, [volvioDePaypal, queryClient, setParams]);

  const suscribir = useMutation({
    mutationFn: createSubscriptionAPI,
    //! Se sale de la app a aprobarlo: no hay nada que hacer al volver aquí
    onSuccess: ({ approvalUrl }) => {
      window.location.href = approvalUrl;
    },
    onError: (err) => setFallo(getErrorMessage(err)),
  });

  const cancelar = useMutation({
    mutationFn: cancelSubscriptionAPI,
    onSuccess: () => {
      setFallo("");
      queryClient.invalidateQueries({ queryKey: SUPPORT_KEY });
    },
    onError: (err) => setFallo(getErrorMessage(err)),
  });

  //! Los botones de PayPal se pintan una vez: el importe se lee al crear la
  //! orden (`amountRef`), así que no hay que rehacerlos al cambiarlo. El manejador
  //! de error va memorizado a propósito: si cambiara en cada pintado, el efecto
  //! de abajo volvería a ejecutarse y destruiría los botones con cada tecla.
  const onPaypalError = useCallback((err) => setFallo(getErrorMessage(err)), []);

  if (enAppAndroid) return <Navigate to="/dashboard" replace />;

  if (estado.isLoading) return <AlertMessage type="loading" message="Cargando…" />;

  const disponible = estado.data?.disponible && clientId();
  const yaAportado = estado.data?.total > 0;
  const planes = estado.data?.planes || [];
  const suscripcion = estado.data?.suscripcion || null;
  //! El selector solo aparece si hay planes configurados: si no, el aporte de
  //! una vez es lo único que hay y un selector de una sola opción estorba
  const hayMensual = planes.length > 0;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <PageHeader
        title="Hazte socio de la app"
        subtitle="Un aporte voluntario para que esto siga en pie"
      />

      <Card className="p-6">
        <span className="h-11 w-11 rounded-xl bg-accent-soft text-ink grid place-items-center">
          <LuHeart aria-hidden="true" className="text-xl" />
        </span>
        <p className="mt-4 text-ink-2 leading-relaxed">
          Control de Gastos es gratis para cualquier iglesia y va a seguir siéndolo. Pero mantenerla
          cuesta dinero todos los meses. Si te sirve y puedes, échale una mano.
        </p>

        <ul className="mt-5 space-y-3">
          {DESTINOS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex gap-3 text-sm text-ink-2 leading-relaxed">
              <Icon aria-hidden="true" className="mt-0.5 shrink-0 text-muted" />
              {text}
            </li>
          ))}
        </ul>

        <p className="mt-5 text-sm text-muted leading-relaxed">
          Ser socio no desbloquea nada: todas las funciones son iguales para todos, aportes o no.
          Esto no es una ofrenda a tu iglesia — el dinero de tu iglesia se registra en sus
          movimientos, no aquí.
        </p>
      </Card>

      {yaAportado && (
        <Notice tone="success">
          Ya has aportado {estado.data.total} dólares en total. Gracias de verdad.
        </Notice>
      )}

      {/* El compromiso vivo va antes que los botones: quien ya aporta cada mes
          viene a esta página sobre todo a cambiarlo o a pararlo. */}
      {suscripcion && (
        <Card className="p-5">
          <p className="font-semibold text-ink">
            Aportas {suscripcion.amount} dólares cada mes
          </p>
          {suscripcion.status === "suspendida" ? (
            <p className="mt-2 text-sm text-ink-2 leading-relaxed">
              PayPal no pudo hacer el último cobro y lo dejó en pausa. Suele ser una tarjeta
              vencida; si la arreglas en PayPal, el cobro se reanuda solo.
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted leading-relaxed">
              Se cobra automáticamente. Puedes pararlo cuando quieras, sin dar explicaciones.
            </p>
          )}
          <Button
            variant="danger-ghost"
            size="sm"
            className="mt-3"
            disabled={cancelar.isPending}
            onClick={() => cancelar.mutate()}
          >
            {cancelar.isPending ? "Cancelando…" : "Cancelar el aporte mensual"}
          </Button>
        </Card>
      )}

      {volvioDePaypal === "listo" && !suscripcion && (
        <Notice tone="info">
          Estamos confirmando tu aporte mensual con PayPal. Puede tardar unos segundos; recarga la
          página en un momento.
        </Notice>
      )}

      {!disponible ? (
        <Notice tone="info">
          Los aportes todavía no están disponibles. Vuelve a mirar en unos días.
        </Notice>
      ) : gracias ? (
        <Card className="p-6 text-center">
          <p className="text-[32px] leading-none font-extrabold tracking-tight text-ink">
            ¡Gracias!
          </p>
          <p className="mt-3 text-ink-2">
            Se recibieron tus {gracias.amount} dólares. Van directos a mantener esto en pie.
          </p>
        </Card>
      ) : (
        <Card className="p-5 space-y-4">
          {hayMensual && !suscripcion && (
            <Segmented
              label="Cada cuánto quieres aportar"
              value={cuando}
              //! Al pasar a mensual, un monto a medida (que allí sí vale) no
              //! tiene plan: se cae al más cercano en vez de dejar el botón
              //! apagado diciendo "Aportar $35 cada mes" sin explicar nada.
              onChange={(valor) => {
                if (valor === "mensual" && !planes.includes(amount)) {
                  const cercano = planes.reduce((a, b) =>
                    Math.abs(b - amount) < Math.abs(a - amount) ? b : a
                  );
                  setAmount(cercano);
                  setOtro("");
                }
                setCuando(valor);
              }}
              options={[
                { value: "unico", label: "Una vez" },
                { value: "mensual", label: "Cada mes" },
              ]}
              className="bg-surface-2"
            />
          )}

          {cuando === "mensual" && !suscripcion ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-muted mb-2">
                  Cuánto cada mes (dólares)
                </p>
                <div className="flex flex-wrap gap-2">
                  {planes.map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={amount === value}
                      onClick={() => setAmount(value)}
                      className={cx(
                        "h-11 px-5 rounded-full font-bold transition",
                        amount === value
                          ? "bg-ink text-surface"
                          : "bg-surface-2 text-ink-2 hover:text-ink"
                      )}
                    >
                      ${value}
                    </button>
                  ))}
                </div>
                {/* Los montos son fijos porque cada uno es un plan creado en
                    PayPal, y un plan lleva su precio dentro. */}
                <p className="mt-2 text-xs text-muted">
                  Para otra cantidad, usa el aporte de una vez.
                </p>
              </div>

              <Button
                block
                disabled={!planes.includes(amount) || suscribir.isPending}
                onClick={() => suscribir.mutate(amount)}
              >
                {suscribir.isPending
                  ? "Abriendo PayPal…"
                  : `Aportar $${amount} cada mes`}
              </Button>

              {fallo && <Notice tone="danger">{fallo}</Notice>}

              <p className="text-xs text-muted leading-relaxed">
                Te llevamos a PayPal para que lo apruebes, y vuelves aquí. Se cobra cada mes hasta
                que lo canceles, y puedes cancelarlo desde esta misma página.
              </p>
            </div>
          ) : (
          <>
          <div>
            <p className="text-sm font-semibold text-muted mb-2">Cuánto quieres aportar (dólares)</p>
            <div className="flex flex-wrap gap-2">
              {TIERS.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={amount === value && otro === ""}
                  onClick={() => {
                    setAmount(value);
                    setOtro("");
                  }}
                  className={cx(
                    "h-11 px-5 rounded-full font-bold transition",
                    amount === value && otro === ""
                      ? "bg-ink text-surface"
                      : "bg-surface-2 text-ink-2 hover:text-ink"
                  )}
                >
                  ${value}
                </button>
              ))}
              <input
                type="number"
                min="1"
                max="1000"
                step="1"
                value={otro}
                onChange={(e) => {
                  setOtro(e.target.value);
                  const valor = Number(e.target.value);
                  if (valor > 0) setAmount(valor);
                }}
                placeholder="Otro"
                aria-label="Otro monto en dólares"
                className="h-11 w-24 rounded-full bg-surface-2 px-4 font-bold text-ink placeholder:font-normal placeholder:text-muted"
              />
            </div>
          </div>

          {sdk === "error" ? (
            <Notice tone="danger">
              No se pudo cargar el pago de PayPal. Prueba a recargar la página.
            </Notice>
          ) : sdk === "cargando" ? (
            <p className="text-sm text-muted">Cargando el pago…</p>
          ) : (
            <PaypalButtons
              amount={amount}
              onPaid={pagado.mutate}
              onError={onPaypalError}
            />
          )}

          {fallo && <Notice tone="danger">{fallo}</Notice>}

          <p className="text-xs text-muted leading-relaxed">
            El cobro lo hace PayPal; nosotros no vemos ni guardamos los datos de tu tarjeta.
          </p>
          </>
          )}
        </Card>
      )}
    </div>
  );
};

export default SupportPage;
