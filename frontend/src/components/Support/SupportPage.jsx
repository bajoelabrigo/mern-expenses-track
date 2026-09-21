import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LuHeart, LuServer, LuShieldCheck, LuUsers } from "react-icons/lu";
import {
  captureSupportAPI,
  createSupportOrderAPI,
  getSupportStatusAPI,
} from "../../services/support/supportService";
import { isAndroidApp } from "../../lib/platform";
import { getErrorMessage } from "../../lib/axios";
import AlertMessage from "../Alert/AlertMessage";
import { Card, Notice, PageHeader } from "../ui";
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

  return <div ref={contenedor} />;
};

//! /socio — aporte voluntario para sostener la app
const SupportPage = () => {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(10);
  const [otro, setOtro] = useState("");
  const [fallo, setFallo] = useState("");
  const [gracias, setGracias] = useState(null);

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

  //! Los botones de PayPal se pintan una vez: el importe se lee al crear la
  //! orden (`amountRef`), así que no hay que rehacerlos al cambiarlo. El manejador
  //! de error va memorizado a propósito: si cambiara en cada pintado, el efecto
  //! de abajo volvería a ejecutarse y destruiría los botones con cada tecla.
  const onPaypalError = useCallback((err) => setFallo(getErrorMessage(err)), []);

  if (enAppAndroid) return <Navigate to="/dashboard" replace />;

  if (estado.isLoading) return <AlertMessage type="loading" message="Cargando…" />;

  const disponible = estado.data?.disponible && clientId();
  const yaAportado = estado.data?.total > 0;

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
        </Card>
      )}
    </div>
  );
};

export default SupportPage;
