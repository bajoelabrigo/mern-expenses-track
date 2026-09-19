import { useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import EmojiPicker from "emoji-picker-react";
import { LuSmilePlus } from "react-icons/lu";
import { Button, Card, CategoryIcon, Chip, Field, Input, Segmented } from "../ui";
import { capitalize, cx } from "../ui/styles";
import { INCOME_KINDS, incomeKindLabel, inferIncomeKind } from "../../lib/incomeKinds";

const validationSchema = Yup.object({
  name: Yup.string().trim().required("Escribe el nombre de la categoría"),
  type: Yup.string().oneOf(["income", "expense"], "Elige si es gasto o ingreso"),
  icon: Yup.string().required("Elige un ícono"),
});

const TYPES = [
  { value: "expense", label: "Gasto" },
  { value: "income", label: "Ingreso" },
];

//! Los íconos que más usan las tesorerías; el resto sale del selector completo
const SUGGESTED = ["🙏", "💝", "⛪", "🎵", "💡", "💧", "📚", "🤝", "🚌", "🍞", "🏠", "🔧"];

//! Formulario compartido por "Nueva categoría" y "Editar categoría".
//! `withIncomeKind`: en una iglesia, las de ingreso llevan su tipo (diezmo,
//! ofrenda…); se sugiere por el nombre hasta que se elige uno a mano.
const CategoryForm = ({
  initialValues,
  onSubmit,
  submitLabel,
  pendingLabel,
  isPending,
  disabled,
  withIncomeKind = false,
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [kindChosen, setKindChosen] = useState(Boolean(initialValues?.incomeKind));

  const formik = useFormik({
    initialValues: { type: "expense", name: "", icon: "", incomeKind: "", ...initialValues },
    enableReinitialize: true,
    validationSchema,
    onSubmit: ({ incomeKind: _chosen, ...values }) =>
      onSubmit({
        ...values,
        name: values.name.trim(),
        ...(showKind ? { incomeKind: effectiveKind } : {}),
      }),
  });

  const { values, touched, errors } = formik;
  const showKind = withIncomeKind && values.type === "income";
  const effectiveKind = kindChosen && values.incomeKind ? values.incomeKind : inferIncomeKind(values.name);
  const pickIcon = (emoji) => {
    formik.setFieldValue("icon", emoji);
    setShowPicker(false);
  };
  const theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";

  return (
    <form onSubmit={formik.handleSubmit} className="space-y-4" noValidate>
      <Segmented
        label="Tipo de categoría"
        options={TYPES}
        value={values.type}
        onChange={(type) => formik.setFieldValue("type", type)}
      />

      <Card className="p-5 space-y-5">
        <div className="flex items-center gap-3">
          <CategoryIcon name={values.name} icon={values.icon} />
          <div className="min-w-0">
            <p className="font-bold text-ink truncate">{capitalize(values.name) || "Nueva categoría"}</p>
            <p className="text-sm text-muted">
              {values.type === "income" ? "Ingreso" : "Gasto"}
              {showKind && ` · ${incomeKindLabel(effectiveKind)}`}
            </p>
          </div>
        </div>

        <Field label="Nombre" htmlFor="category-name" error={touched.name && errors.name}>
          <Input
            id="category-name"
            placeholder={values.type === "income" ? "Diezmos, ofrendas…" : "Luz, alquiler, ayuda social…"}
            {...formik.getFieldProps("name")}
          />
        </Field>

        {showKind && (
          <fieldset>
            <legend className="text-sm font-semibold text-ink-2 mb-2">Tipo de ingreso</legend>
            <div className="flex flex-wrap gap-2">
              {INCOME_KINDS.map((kind) => (
                <Chip
                  key={kind.value}
                  selected={effectiveKind === kind.value}
                  onClick={() => {
                    setKindChosen(true);
                    formik.setFieldValue("incomeKind", kind.value);
                  }}
                  className={effectiveKind === kind.value ? "" : "shadow-none bg-surface-2"}
                >
                  {kind.label}
                </Chip>
              ))}
            </div>
            <p className="mt-2 text-sm text-muted">
              {kindChosen ? "Separa los diezmos de las ofrendas en los informes." : "Sugerido por el nombre; tócalo para cambiarlo."}
            </p>
          </fieldset>
        )}

        <fieldset>
          <legend className="text-sm font-semibold text-ink-2 mb-2">Ícono</legend>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-pressed={values.icon === emoji}
                aria-label={`Ícono ${emoji}`}
                onClick={() => pickIcon(emoji)}
                className={cx(
                  "h-11 w-11 rounded-xl text-xl grid place-items-center transition",
                  values.icon === emoji ? "bg-ink" : "bg-surface-2 hover:bg-line"
                )}
              >
                {emoji}
              </button>
            ))}
            <button
              type="button"
              aria-expanded={showPicker}
              onClick={() => setShowPicker((open) => !open)}
              className="h-11 px-3 rounded-xl bg-surface-2 hover:bg-line text-sm font-semibold text-ink-2 inline-flex items-center gap-1.5"
            >
              <LuSmilePlus aria-hidden="true" className="text-lg" /> Más
            </button>
          </div>
          {values.icon && !SUGGESTED.includes(values.icon) && (
            <p className="mt-2 text-sm text-muted">
              Elegido: <span className="text-xl align-middle">{values.icon}</span>
            </p>
          )}
          {touched.icon && errors.icon && (
            <p className="mt-2 text-xs font-medium text-danger">{errors.icon}</p>
          )}
          {showPicker && (
            <div className="mt-3">
              <EmojiPicker
                width="100%"
                theme={theme}
                searchPlaceHolder="Buscar"
                previewConfig={{ showPreview: false }}
                onEmojiClick={(emojiData) => pickIcon(emojiData.emoji)}
              />
            </div>
          )}
        </fieldset>
      </Card>

      <Button type="submit" size="lg" block disabled={isPending || disabled}>
        {isPending ? pendingLabel : submitLabel}
      </Button>
    </form>
  );
};

export default CategoryForm;
