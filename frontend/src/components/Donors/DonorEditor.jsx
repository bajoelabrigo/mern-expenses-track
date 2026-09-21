import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createDonorAPI, getDonorAPI, updateDonorAPI } from "../../services/donors/donorService";
import { DONORS_KEY } from "../../hooks/useDonors";
import { useWorkspace } from "../../hooks/useWorkspace";
import { getErrorMessage } from "../../lib/axios";
import AlertMessage from "../Alert/AlertMessage";
import { Button, Card, Field, Input, PageHeader, Textarea } from "../ui";

const FIELDS = [
  { name: "document", label: "Documento", hint: "DNI, RUC o el número que uses. Va en la constancia.", maxLength: 20 },
  { name: "phone", label: "Teléfono", maxLength: 30, type: "tel" },
  { name: "email", label: "Correo", maxLength: 120, type: "email" },
];

const DonorForm = ({ donor }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const editing = Boolean(donor);

  const [values, setValues] = useState({
    name: donor?.name || "",
    document: donor?.document || "",
    phone: donor?.phone || "",
    email: donor?.email || "",
    notes: donor?.notes || "",
    member: Boolean(donor?.member),
  });
  const [touched, setTouched] = useState(false);
  const set = (field) => (e) => setValues((v) => ({ ...v, [field]: e.target.value }));
  const nameError = touched && !values.name.trim() ? "Escribe el nombre de la persona" : "";

  const mutation = useMutation({
    mutationFn: (payload) => (editing ? updateDonorAPI({ id: donor._id, ...payload }) : createDonorAPI(payload)),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: DONORS_KEY });
      navigate(`/aportantes/${saved._id}`, { replace: true });
    },
  });

  const submit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!values.name.trim()) return;
    mutation.mutate({ ...values, name: values.name.trim() });
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {mutation.isError && <AlertMessage type="error" message={getErrorMessage(mutation.error)} />}

      <Card className="p-5 space-y-5">
        <Field label="Nombre" htmlFor="donor-name" error={nameError}>
          <Input
            id="donor-name"
            value={values.name}
            maxLength={80}
            onChange={set("name")}
            placeholder="Marta Quispe"
          />
        </Field>

        {FIELDS.map((f) => (
          <Field key={f.name} label={f.label} htmlFor={`donor-${f.name}`} hint={f.hint}>
            <Input
              id={`donor-${f.name}`}
              type={f.type}
              value={values[f.name]}
              maxLength={f.maxLength}
              onChange={set(f.name)}
            />
          </Field>
        ))}

        <label className="flex items-start gap-3 rounded-xl bg-surface-2 p-3 cursor-pointer">
          <input
            type="checkbox"
            checked={values.member}
            onChange={(e) => setValues((v) => ({ ...v, member: e.target.checked }))}
            className="mt-0.5 h-5 w-5 accent-[var(--ink)]"
          />
          <span className="text-sm">
            <span className="font-semibold text-ink">Es miembro de la congregación</span>
            <span className="block text-muted">
              Sirve para los informes: separa lo que se le pagó a los hermanos de lo que se le pagó
              a proveedores de fuera.
            </span>
          </span>
        </label>

        <Field label="Notas" htmlFor="donor-notes" hint="Opcional, para la tesorería.">
          <Textarea
            id="donor-notes"
            value={values.notes}
            maxLength={300}
            onChange={set("notes")}
            className="min-h-20"
          />
        </Field>
      </Card>

      <Button type="submit" size="lg" block disabled={mutation.isPending}>
        {mutation.isPending ? "Guardando…" : editing ? "Guardar cambios" : "Agregar persona"}
      </Button>
    </form>
  );
};

//! /aportantes/nuevo y /aportantes/:id/editar
const DonorEditor = () => {
  const { id } = useParams();
  const { workspace, can } = useWorkspace();
  const { data: donor, isLoading, isError, error } = useQuery({
    queryKey: [...DONORS_KEY, "uno", id],
    queryFn: () => getDonorAPI({ id }),
    enabled: Boolean(id),
  });

  if (!workspace) return <AlertMessage type="loading" message="Cargando…" />;
  if (!can("donor:write")) return <Navigate to="/dashboard" replace />;
  if (id && isLoading) return <AlertMessage type="loading" message="Cargando…" />;
  if (id && isError) return <AlertMessage type="error" message={getErrorMessage(error)} />;

  return (
    <div className="max-w-md mx-auto">
      <PageHeader
        title={donor ? "Editar persona" : "Nueva persona"}
        subtitle={
          donor
            ? donor.name
            : "Quien aporta y quien recibe un pago son la misma ficha. Solo la ve la tesorería."
        }
      />
      <DonorForm key={donor?._id || "nuevo"} donor={donor} />
    </div>
  );
};

export default DonorEditor;
