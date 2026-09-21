import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LuChevronDown, LuDelete, LuPlus, LuRepeat, LuX } from "react-icons/lu";
import { listCategoriesAPI } from "../../services/category/categoryService";
import {
  addTransactionAPI,
  attachReceiptAPI,
  updateTransactionAPI,
} from "../../services/transactions/transactionService";
import { getErrorMessage, isNetworkError } from "../../lib/axios";
import { addToOutbox, newClientId } from "../../lib/outbox";
import { formatMoney, formatTypedAmount } from "../../lib/money";
import { PAYMENT_KINDS } from "../../lib/paymentKinds";
import { toISODate } from "../../lib/periods";
import AyudaBoton from "../Ayuda/AyudaBoton";
import { pressKey } from "../../lib/keypad";
import { useWorkspace } from "../../hooks/useWorkspace";
import { useFunds } from "../../hooks/useFunds";
import { useDonors } from "../../hooks/useDonors";
import { useMinistries } from "../../hooks/useMinistries";
import { Button, Chip, ListGroup, Segmented } from "../ui";
import AlertMessage from "../Alert/AlertMessage";
import ReceiptPicker from "./ReceiptPicker";
import { capitalize } from "../ui/styles";

const TYPES = [
  { value: "expense", label: "Gasto" },
  { value: "income", label: "Ingreso" },
];

const RECURRENCE = [
  { value: "weekly", label: "Cada semana" },
  { value: "monthly", label: "Cada mes" },
  { value: "yearly", label: "Cada año" },
];

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"];


//! Registrar un movimiento: monto con teclado propio (como una calculadora),
//! Gasto / Ingreso, categoría en píldoras, fecha, nota, repetición y foto.
//! Con `transaction` es la misma pantalla para EDITAR (sin repetición ni
//! bandeja sin conexión: editar exige conexión). `children` va debajo del
//! teclado (acciones del movimiento en la edición).
const TransactionForm = ({ transaction, children }) => {
  const editing = Boolean(transaction);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const userId = useSelector((state) => state.auth.user?.id);
  const { workspace, currency, can } = useWorkspace();

  const [type, setType] = useState(transaction?.type || "expense");
  //! "150.5" y no "150.50": el teclado lleva el monto como se escribiría
  const [amount, setAmount] = useState(() => (transaction ? String(transaction.amount) : ""));
  const [category, setCategory] = useState(transaction?.category || "");
  const [date, setDate] = useState(() => toISODate(transaction ? new Date(transaction.date) : new Date()));
  const [description, setDescription] = useState(transaction?.description || "");
  const [recurrent, setRecurrent] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState("monthly");
  const [recurrenceCount, setRecurrenceCount] = useState(12);
  const [receiptFile, setReceiptFile] = useState(null);
  //! Fondo: "general" o el id. Desde la página de un fondo llega ya elegido.
  const [fund, setFund] = useState(
    () => (transaction ? transaction.fund || "general" : location.state?.fund || "general")
  );
  const { funds, hasFunds } = useFunds();
  //! Aportante: a nombre de quién entró (diezmo, ofrenda de alguien)
  const [donor, setDonor] = useState(() => transaction?.donor || "");
  //! A quién se le pagó: la hermana que cocinó, el predicador invitado… Misma
  //! ficha que el aportante, pero en un gasto. `paymentKind` dice por qué.
  const [payee, setPayee] = useState(() => transaction?.payee || "");
  const [paymentKind, setPaymentKind] = useState(() => transaction?.paymentKind || "");
  const { donors, activeDonors, canSee: canSeeDonors } = useDonors();
  const donorOptions = donors.filter((d) => !d.archived || d._id === transaction?.donor);
  const showDonor = canSeeDonors && can("donor:write") && type === "income" &&
    (activeDonors.length > 0 || Boolean(donor));
  //! Para pagar se ofrecen las mismas personas (una hermana puede ofrendar y
  //! además trabajar); al editar, también la archivada que ya tenía
  const payeeOptions = donors.filter((d) => !d.archived || d._id === transaction?.payee);
  const showPayee = canSeeDonors && can("donor:write") && type === "expense" &&
    (activeDonors.length > 0 || Boolean(payee));
  //! Al registrar solo los activos; al editar, también el archivado que ya tenía
  const fundOptions = funds.filter((f) => !f.archived || (f._id && f._id === transaction?.fund));
  const showFund = funds.length > 0 && (hasFunds || fund !== "general");
  //! Ministerio al que se le carga el gasto, contra su presupuesto. Se ofrecen
  //! los del año de la fecha elegida: el presupuesto es anual, y un gasto de
  //! diciembre pasado va contra el presupuesto de ese año, no de este.
  const [ministry, setMinistry] = useState(() => transaction?.ministry || "");
  const {
    ministries,
    activeMinistries,
    canSee: canSeeMinistries,
    isFetched: ministriesFetched,
  } = useMinistries({ year: Number(date.slice(0, 4)) || undefined });
  const ministryOptions = ministries.filter(
    (m) => !m.archived || m._id === transaction?.ministry
  );
  //! Al cambiar el año de la fecha, el ministerio elegido puede no existir en
  //! el nuevo (mientras la lista no haya llegado se respeta el que había)
  const selectedMinistry =
    !ministriesFetched || ministryOptions.some((m) => m._id === ministry) ? ministry : "";
  const showMinistry =
    canSeeMinistries &&
    type === "expense" &&
    (activeMinistries.length > 0 || Boolean(selectedMinistry));

  const {
    data: categories = [],
    isError: isCategoriesError,
    error: categoriesError,
  } = useQuery({ queryFn: listCategoriesAPI, queryKey: ["list-categories"] });
  const visibleCategories = useMemo(
    () => categories.filter((c) => c.type === type),
    [categories, type]
  );
  //! Al cambiar Gasto/Ingreso, la categoría elegida puede dejar de valer
  const selectedCategory = visibleCategories.some((c) => c.name === category) ? category : "";

  //! Intenta enviar; sin conexión (o si el servidor no responde) lo guarda en
  //! la bandeja de salida con el espacio actual y se envía solo después. El
  //! mismo clientId en ambos caminos: si el envío llegó pero se perdió la
  //! respuesta, el reenvío no lo duplica.
  const saveTransaction = async (values) => {
    if (editing) {
      await updateTransactionAPI({ ...values, id: transaction._id });
      return { queued: false, receiptError: "" };
    }
    const clientId = newClientId();
    const queue = () => {
      addToOutbox({
        id: clientId,
        userId,
        workspaceId: workspace._id,
        workspaceName: workspace.name,
        payload: values,
      });
      return { queued: true };
    };

    if (!navigator.onLine) return queue();
    let created;
    try {
      created = await addTransactionAPI({ ...values, clientId }, { workspaceId: workspace._id });
    } catch (err) {
      if (isNetworkError(err)) return queue();
      throw err;
    }

    //! El comprobante se sube después del movimiento. Si falla, el movimiento
    //! YA está guardado: se avisa para adjuntarlo después, nunca se presenta
    //! como si no se hubiera guardado nada.
    let receiptError = "";
    if (receiptFile && created?.[0]?._id) {
      try {
        await attachReceiptAPI({ id: created[0]._id, file: receiptFile, workspaceId: workspace._id });
      } catch (err) {
        receiptError = getErrorMessage(err);
      }
    }
    return { queued: false, receiptError };
  };

  const { mutate, isPending, isError, error, isSuccess, data } = useMutation({
    mutationFn: saveTransaction,
    mutationKey: ["add-transaction"],
    //! Sin esto React Query PAUSA la mutación al detectar que no hay conexión
    //! y el botón se queda en "Guardando…" para siempre: saveTransaction ya
    //! decide ella misma qué hacer sin conexión (guardarlo en la bandeja).
    networkMode: "always",
    onSuccess: (result) => {
      if (!result.queued) {
        queryClient.invalidateQueries({ queryKey: ["list-transactions"] });
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
        if (editing) queryClient.invalidateQueries({ queryKey: ["transaction", transaction._id] });
      }
    },
  });
  const queued = Boolean(data?.queued);
  const receiptError = data?.receiptError || "";
  //! Sin conexión el comprobante no viaja en la bandeja de salida
  const receiptLost = queued && Boolean(receiptFile);

  useEffect(() => {
    if (!isSuccess) return undefined;
    const back = editing ? "/movimientos" : "/dashboard";
    const timeout = setTimeout(() => navigate(back), queued || receiptError ? 4000 : 900);
    return () => clearTimeout(timeout);
  }, [isSuccess, navigate, queued, receiptError, editing]);

  const press = useCallback((key) => setAmount((a) => pressKey(a, key)), []);

  //! En el ordenador el monto también se escribe con el teclado físico
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === "." || e.key === ",") press(".");
      else if (e.key === "Backspace") press("back");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  const numeric = Number(amount || 0);
  //! Un anulado no se edita (el servidor lo rechaza): primero se restaura
  const locked = editing && transaction.voided;
  const canSave = numeric > 0 && selectedCategory && !isPending && !isSuccess && !locked;

  const submit = () => {
    if (!canSave) return;
    mutate({
      type,
      category: selectedCategory,
      fund: fund === "general" ? null : fund,
      ...(canSeeDonors ? { donor: type === "income" && donor ? donor : null } : {}),
      ...(canSeeDonors
        ? {
            payee: type === "expense" && payee ? payee : null,
            //! El concepto solo acompaña a un pago
            paymentKind: type === "expense" && payee && paymentKind ? paymentKind : null,
          }
        : {}),
      ...(canSeeMinistries
        ? { ministry: type === "expense" && selectedMinistry ? selectedMinistry : null }
        : {}),
      amount: numeric,
      //! Mediodía local: la fecha no se corre de día por la zona horaria
      date: new Date(`${date}T12:00:00`).toISOString(),
      description: description.trim(),
      ...(editing
        ? {}
        : {
            recurrent,
            recurrenceType: recurrent ? recurrenceType : undefined,
            recurrenceCount: recurrent ? Number(recurrenceCount) : 0,
          }),
    });
  };

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Link
          to={editing ? "/movimientos" : "/dashboard"}
          aria-label={editing ? "Volver" : "Cancelar"}
          className="p-2 -ml-2 text-muted hover:text-ink"
        >
          <LuX aria-hidden="true" className="text-xl" />
        </Link>
        <Segmented
          label="Tipo de movimiento"
          options={TYPES}
          value={type}
          onChange={setType}
          className="flex-1"
        />
        {/* Esta pantalla ocupa todo el ancho y no tiene barra de abajo: si
            alguien se traba acá, el atajo tiene que estar acá. */}
        <AyudaBoton compacto donde={editing ? "Corregir un movimiento" : "Registrar un movimiento"} />
      </div>

      {/* Monto */}
      <div className="text-center py-3">
        <output
          aria-live="polite"
          aria-label="Monto"
          className={`block text-[52px] leading-none font-extrabold tracking-tight tabular ${
            amount ? "text-ink" : "text-muted"
          }`}
        >
          {formatTypedAmount(amount, currency)}
        </output>
        <p className="mt-2 text-sm text-muted">
          {editing
            ? "Corrige lo que haga falta; el cambio queda en el historial."
            : `${type === "income" ? "¿Cuánto entró?" : "¿Cuánto salió?"} Usa el teclado de abajo.`}
        </p>
      </div>

      {isCategoriesError && <AlertMessage type="error" message={getErrorMessage(categoriesError)} />}
      {isError && <AlertMessage type="error" message={getErrorMessage(error)} />}
      {isSuccess && (
        <AlertMessage
          type="success"
          message={
            queued
              ? "Sin conexión: guardado en este teléfono. Se enviará solo al volver la conexión."
              : editing
                ? "Cambios guardados"
                : type === "income"
                  ? "Ingreso registrado"
                  : "Gasto registrado"
          }
        />
      )}
      {isSuccess && receiptLost && (
        <AlertMessage
          type="error"
          message="El comprobante no se guardó sin conexión: adjúntalo desde el movimiento cuando vuelvas a tener señal."
        />
      )}
      {isSuccess && receiptError && (
        <AlertMessage
          type="error"
          message={`El movimiento se guardó, pero el comprobante no: ${receiptError} Adjúntalo desde el movimiento.`}
        />
      )}

      {/* Categoría */}
      <section aria-labelledby="categoria-titulo">
        <h2
          id="categoria-titulo"
          className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted mb-2 px-1"
        >
          Categoría
        </h2>
        <div className="flex flex-wrap gap-2">
          {visibleCategories.map((c) => (
            <Chip key={c._id} selected={selectedCategory === c.name} onClick={() => setCategory(c.name)}>
              {c.icon} {capitalize(c.name)}
            </Chip>
          ))}
          <Link
            to="/add-category"
            state={{ type, returnTo: location.pathname }}
            className="h-9 px-4 rounded-full text-sm font-semibold inline-flex items-center gap-1 border border-dashed border-muted/50 text-muted hover:text-ink"
          >
            <LuPlus aria-hidden="true" /> Nueva
          </Link>
        </div>
        {visibleCategories.length === 0 && (
          <p className="mt-2 text-sm text-muted px-1">
            Aún no hay categorías de {type === "income" ? "ingreso" : "gasto"} en este espacio.
          </p>
        )}
      </section>

      {/* Detalles */}
      <ListGroup>
        <label className="flex items-center justify-between gap-3 px-4 h-13">
          <span className="text-sm font-semibold text-ink-2">Fecha</span>
          <input
            type="date"
            value={date}
            max="9999-12-31"
            onChange={(e) => setDate(e.target.value || toISODate(new Date()))}
            className="text-sm text-right font-semibold focus:outline-none"
          />
        </label>
        {showDonor && (
          <label className="flex items-center justify-between gap-3 px-4 h-13">
            <span className="text-sm font-semibold text-ink-2">Aportante</span>
            <span className="relative min-w-0 flex items-center">
              <select
                value={donor}
                onChange={(e) => setDonor(e.target.value)}
                className="appearance-none bg-transparent text-sm text-right font-semibold pr-6 min-w-0 truncate focus:outline-none"
              >
                <option value="">Sin aportante</option>
                {donorOptions.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                    {d.archived ? " (archivado)" : ""}
                  </option>
                ))}
              </select>
              <LuChevronDown aria-hidden="true" className="pointer-events-none absolute right-0 text-muted" />
            </span>
          </label>
        )}
        {showPayee && (
          <label className="flex items-center justify-between gap-3 px-4 h-13">
            <span className="text-sm font-semibold text-ink-2">Se le pagó a</span>
            <span className="relative min-w-0 flex items-center">
              <select
                value={payee}
                onChange={(e) => setPayee(e.target.value)}
                className="appearance-none bg-transparent text-sm text-right font-semibold pr-6 min-w-0 truncate focus:outline-none"
              >
                <option value="">A nadie en concreto</option>
                {payeeOptions.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                    {d.archived ? " (archivado)" : ""}
                  </option>
                ))}
              </select>
              <LuChevronDown aria-hidden="true" className="pointer-events-none absolute right-0 text-muted" />
            </span>
          </label>
        )}
        {showPayee && payee && (
          <label className="flex items-center justify-between gap-3 px-4 h-13">
            <span className="text-sm font-semibold text-ink-2">Por qué se le pagó</span>
            <span className="relative min-w-0 flex items-center">
              <select
                value={paymentKind}
                onChange={(e) => setPaymentKind(e.target.value)}
                className="appearance-none bg-transparent text-sm text-right font-semibold pr-6 min-w-0 truncate focus:outline-none"
              >
                <option value="">Sin especificar</option>
                {PAYMENT_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
              <LuChevronDown aria-hidden="true" className="pointer-events-none absolute right-0 text-muted" />
            </span>
          </label>
        )}
        {showFund && (
          <label className="flex items-center justify-between gap-3 px-4 h-13">
            <span className="text-sm font-semibold text-ink-2">Fondo</span>
            <span className="relative min-w-0 flex items-center">
              <select
                value={fund}
                onChange={(e) => setFund(e.target.value)}
                className="appearance-none bg-transparent text-sm text-right font-semibold pr-6 min-w-0 truncate focus:outline-none"
              >
                {fundOptions.map((f) => (
                  <option key={f._id || "general"} value={f._id || "general"}>
                    {f.icon} {f.name}
                    {f.archived ? " (archivado)" : ""}
                  </option>
                ))}
              </select>
              <LuChevronDown aria-hidden="true" className="pointer-events-none absolute right-0 text-muted" />
            </span>
          </label>
        )}
        {showMinistry && (
          <label className="flex items-center justify-between gap-3 px-4 h-13">
            <span className="text-sm font-semibold text-ink-2">Ministerio</span>
            <span className="relative min-w-0 flex items-center">
              <select
                value={selectedMinistry}
                onChange={(e) => setMinistry(e.target.value)}
                className="appearance-none bg-transparent text-sm text-right font-semibold pr-6 min-w-0 truncate focus:outline-none"
              >
                <option value="">Sin ministerio</option>
                {ministryOptions.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.icon} {m.name}
                    {m.archived ? " (archivado)" : ""}
                  </option>
                ))}
              </select>
              <LuChevronDown aria-hidden="true" className="pointer-events-none absolute right-0 text-muted" />
            </span>
          </label>
        )}
        <label className="flex items-center justify-between gap-3 px-4 h-13">
          <span className="text-sm font-semibold text-ink-2">Nota</span>
          <input
            type="text"
            value={description}
            maxLength={500}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Añadir una nota"
            className="flex-1 min-w-0 text-sm text-right focus:outline-none"
          />
        </label>
        {!editing && (
        <div className="px-4 py-3">
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-ink-2 inline-flex items-center gap-2">
              <LuRepeat aria-hidden="true" className="text-muted" /> Se repite
            </span>
            <input
              type="checkbox"
              checked={recurrent}
              onChange={(e) => setRecurrent(e.target.checked)}
              className="h-5 w-5 accent-[var(--ink)]"
            />
          </label>
          {recurrent && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <select
                aria-label="Frecuencia"
                value={recurrenceType}
                onChange={(e) => setRecurrenceType(e.target.value)}
                className="h-10 rounded-xl bg-surface-2 px-3 text-sm font-semibold"
              >
                {RECURRENCE.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <label className="h-10 rounded-xl bg-surface-2 px-3 text-sm font-semibold flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={recurrenceCount}
                  onChange={(e) => setRecurrenceCount(e.target.value)}
                  className="w-12 text-right focus:outline-none"
                  aria-label="Cantidad de veces"
                />
                veces
              </label>
            </div>
          )}
        </div>
        )}
      </ListGroup>

      {!editing && (
        <ReceiptPicker value={receiptFile} onChange={setReceiptFile} disabled={isPending || isSuccess} />
      )}

      {/* Teclado */}
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Teclado numérico">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => press(key)}
            aria-label={key === "back" ? "Borrar" : key === "." ? "Decimales" : key}
            className="h-14 rounded-2xl bg-surface shadow-card text-xl font-bold text-ink active:bg-surface-2 transition flex items-center justify-center"
          >
            {key === "back" ? <LuDelete aria-hidden="true" /> : key}
          </button>
        ))}
      </div>

      <Button variant="accent" size="lg" block onClick={submit} disabled={!canSave}>
        {isPending
          ? "Guardando…"
          : locked
            ? "Anulado: restáuralo para editarlo"
            : editing
              ? "Guardar cambios"
              : numeric > 0
                ? `Registrar ${type === "income" ? "ingreso" : "gasto"} de ${formatMoney(numeric, currency)}`
                : "Escribe el monto"}
      </Button>
      {numeric > 0 && !selectedCategory && (
        <p className="text-center text-xs text-muted -mt-2">Elige una categoría para registrar.</p>
      )}

      {children}
    </div>
  );
};

export default TransactionForm;
