import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { formatMoney } from "../../lib/money";
import { buttonClass, categoryColor, cx, inputClass } from "./styles";

//! Piezas visuales comunes. Colores por papel (ver index.css): cambiar el tema
//! no exige tocar ningún componente.

export const Card = ({ as: Tag = "div", className = "", children, ...props }) => (
  <Tag className={cx("bg-surface rounded-card shadow-card", className)} {...props}>
    {children}
  </Tag>
);

export const Button = forwardRef(
  ({ variant, size, block, className, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={buttonClass({ variant, size, block, className })}
      {...props}
    />
  )
);
Button.displayName = "Button";

export const ButtonLink = ({ variant, size, block, className, ...props }) => (
  <Link className={buttonClass({ variant, size, block, className })} {...props} />
);

//! Selector de una opción entre pocas (Semana / Mes / Año; Gasto / Ingreso)
export const Segmented = ({ options, value, onChange, label, className = "" }) => (
  <div
    role="radiogroup"
    aria-label={label}
    className={cx("flex p-1 rounded-full bg-surface shadow-card", className)}
  >
    {options.map((option) => {
      const selected = option.value === value;
      return (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={selected}
          onClick={() => onChange(option.value)}
          className={cx(
            "flex-1 h-9 px-3 rounded-full text-sm font-semibold transition",
            selected ? "bg-ink text-surface" : "text-muted hover:text-ink"
          )}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);

//! Píldora seleccionable (filtros, categorías)
export const Chip = ({ selected, className = "", children, ...props }) => (
  <button
    type="button"
    aria-pressed={selected}
    className={cx(
      "h-9 px-4 rounded-full text-sm font-semibold whitespace-nowrap transition",
      selected
        ? "bg-ink text-surface"
        : "bg-surface text-ink-2 shadow-card hover:text-ink",
      className
    )}
    {...props}
  >
    {children}
  </button>
);

//! Etiqueta pequeña sobre una cifra ("ENTRÓ · SEPTIEMBRE")
export const Eyebrow = ({ className = "", children }) => (
  <p className={cx("text-[11px] font-bold tracking-[0.08em] uppercase text-muted", className)}>
    {children}
  </p>
);

export const Field = ({ label, htmlFor, error, hint, children, className = "" }) => (
  <div className={cx("flex flex-col gap-1.5", className)}>
    {label && (
      <label htmlFor={htmlFor} className="text-sm font-semibold text-ink-2">
        {label}
      </label>
    )}
    {children}
    {hint && !error && <p className="text-xs text-muted">{hint}</p>}
    {error && <p className="text-xs font-medium text-danger">{error}</p>}
  </div>
);

export const Input = forwardRef(({ className, ...props }, ref) => (
  <input ref={ref} className={inputClass(className)} {...props} />
));
Input.displayName = "Input";

export const Select = forwardRef(({ className, children, ...props }, ref) => (
  <select ref={ref} className={inputClass(cx("appearance-none pr-10 bg-no-repeat", className))} {...props}>
    {children}
  </select>
));
Select.displayName = "Select";

export const Textarea = forwardRef(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cx(
      "w-full rounded-xl bg-surface border border-line px-4 py-3 text-[15px] min-h-24",
      "focus:outline-none focus:border-ink transition",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

//! Importe con signo y color: + verde lo que entra, − en tinta lo que sale
export const Money = ({ amount, currency, type, signed, className = "" }) => {
  const sign = signed ? (type === "income" ? "+" : "−") : "";
  return (
    <span
      className={cx(
        "tabular font-bold",
        signed && type === "income" ? "text-income" : "text-ink",
        className
      )}
    >
      {sign}
      {formatMoney(Math.abs(amount), currency)}
    </span>
  );
};

//! Cuadro con el ícono de la categoría, tintado con su color
export const CategoryIcon = ({ name, icon, size = "md" }) => {
  const color = categoryColor(name || "");
  const dims = size === "sm" ? "h-9 w-9 text-base" : "h-11 w-11 text-xl";
  return (
    <span
      aria-hidden="true"
      className={cx("inline-flex shrink-0 items-center justify-center rounded-xl", dims)}
      style={{ backgroundColor: `${color}26` }}
    >
      {icon || (name ? name.charAt(0).toUpperCase() : "•")}
    </span>
  );
};

//! Encabezado de pantalla: título, línea de apoyo y acción a la derecha
export const PageHeader = ({ title, subtitle, action, className = "" }) => (
  <header className={cx("flex items-start justify-between gap-4 mb-5", className)}>
    <div className="min-w-0">
      <h1 className="text-[26px] leading-tight font-extrabold tracking-tight text-ink">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </header>
);

//! Lista agrupada tipo ajustes: filas separadas por línea dentro de una tarjeta
export const ListGroup = ({ className = "", children }) => (
  <Card className={cx("divide-y divide-line overflow-hidden", className)}>{children}</Card>
);

export const EmptyState = ({ title, children, action }) => (
  <Card className="p-8 text-center">
    <p className="font-bold text-ink">{title}</p>
    {children && <p className="mt-1 text-sm text-muted">{children}</p>}
    {action && <div className="mt-4 flex justify-center">{action}</div>}
  </Card>
);

export const Notice = ({ tone = "info", children, className = "" }) => {
  const tones = {
    info: "bg-surface-2 text-ink-2",
    success: "bg-income-soft text-income",
    warning: "bg-accent-soft text-ink",
    danger: "bg-danger-soft text-danger",
  };
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cx("rounded-2xl px-4 py-3 text-sm font-medium", tones[tone], className)}
    >
      {children}
    </div>
  );
};
