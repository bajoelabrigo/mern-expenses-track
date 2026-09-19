import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFundAPI, updateFundAPI } from "../../services/funds/fundService";
import { FUNDS_KEY, useFunds } from "../../hooks/useFunds";
import { useWorkspace } from "../../hooks/useWorkspace";
import { getErrorMessage } from "../../lib/axios";
import { parseTypedAmount } from "../../lib/money";
import AlertMessage from "../Alert/AlertMessage";
import { Button, Card, Field, Input, PageHeader, Textarea } from "../ui";
import { cx } from "../ui/styles";

//! Íconos que suelen tener los fondos de una iglesia (Unicode 6-8: se ven en
//! cualquier teléfono)
const ICONS = ["🏦", "🌍", "⛪", "🔨", "🤝", "🎵", "👶", "📚", "🍞", "🎁", "💒", "🚌"];

//! Formulario de un fondo nuevo o existente (con la clave `fund`)
const FundForm = ({ fund }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const editing = Boolean(fund);

  const [name, setName] = useState(fund?.name || "");
  const [icon, setIcon] = useState(fund?.icon || ICONS[0]);
  const [description, setDescription] = useState(fund?.description || "");
  const [goalText, setGoalText] = useState(fund?.goal ? String(fund.goal) : "");
  const [touched, setTouched] = useState(false);

  const goal = goalText.trim() ? parseTypedAmount(goalText) : null;
  const nameError = touched && !name.trim() ? "Escribe el nombre del fondo" : "";
  const goalError = touched && goalText.trim() && goal === null ? "Escribe un monto, por ejemplo 5000" : "";

  const mutation = useMutation({
    mutationFn: (values) => (editing ? updateFundAPI({ id: fund._id, ...values }) : createFundAPI(values)),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: FUNDS_KEY });
      navigate(`/fondos/${saved._id}`, { replace: true });
    },
  });

  const submit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!name.trim() || (goalText.trim() && goal === null)) return;
    mutation.mutate({ name: name.trim(), icon, description: description.trim(), goal });
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {mutation.isError && <AlertMessage type="error" message={getErrorMessage(mutation.error)} />}

      <Card className="p-5 space-y-5">
        <Field label="Nombre" htmlFor="fund-name" error={nameError}>
          <Input
            id="fund-name"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            placeholder="Misiones, Construcción del templo…"
          />
        </Field>

        <fieldset>
          <legend className="text-sm font-semibold text-ink-2 mb-2">Ícono</legend>
          <div className="flex flex-wrap gap-2">
            {ICONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-pressed={icon === emoji}
                aria-label={`Ícono ${emoji}`}
                onClick={() => setIcon(emoji)}
                className={cx(
                  "h-11 w-11 rounded-xl text-xl grid place-items-center transition",
                  icon === emoji ? "bg-ink" : "bg-surface-2 hover:bg-line"
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
        </fieldset>

        <Field label="Para qué es" htmlFor="fund-description" hint="Opcional. Lo verán todos los del espacio.">
          <Textarea
            id="fund-description"
            value={description}
            maxLength={200}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ofrendas para enviar a los misioneros de la iglesia"
            className="min-h-20"
          />
        </Field>

        <Field
          label="Meta"
          htmlFor="fund-goal"
          error={goalError}
          hint="Opcional. Si quieren juntar una cifra (una campaña), verás cuánto falta."
        >
          <Input
            id="fund-goal"
            inputMode="decimal"
            value={goalText}
            onChange={(e) => setGoalText(e.target.value)}
            placeholder="Sin meta"
          />
        </Field>
      </Card>

      <Button type="submit" size="lg" block disabled={mutation.isPending}>
        {mutation.isPending ? "Guardando…" : editing ? "Guardar cambios" : "Crear fondo"}
      </Button>
    </form>
  );
};

//! /fondos/nuevo y /fondos/:id/editar
const FundEditor = () => {
  const { id } = useParams();
  const { workspace, can } = useWorkspace();
  const { findFund, isLoading } = useFunds();

  if (!workspace) return <AlertMessage type="loading" message="Cargando…" />;
  if (!can("fund:manage")) return <Navigate to="/fondos" replace />;
  const fund = id ? findFund(id) : null;
  if (id && isLoading) return <AlertMessage type="loading" message="Cargando…" />;
  if (id && (!fund || fund.general)) return <Navigate to="/fondos" replace />;

  return (
    <div className="max-w-md mx-auto">
      <PageHeader
        title={fund ? "Editar fondo" : "Nuevo fondo"}
        subtitle={fund ? fund.name : "Dinero apartado para un fin: misiones, construcción, ayuda social."}
      />
      {/* key: si llega otro fondo, el formulario empieza de cero */}
      <FundForm key={fund?._id || "nuevo"} fund={fund} />
    </div>
  );
};

export default FundEditor;
