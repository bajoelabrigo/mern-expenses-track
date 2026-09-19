import { useNavigate } from "react-router-dom";
import { LuChevronDown } from "react-icons/lu";
import { useWorkspace } from "../../hooks/useWorkspace";
import { ROLE_LABELS } from "../../lib/roles";

const NEW_OPTION = "__nuevo__";

//! Nombre del espacio actual que, al tocarlo, abre el selector del sistema
//! (un <select> nativo invisible encima: en el móvil sale la lista del
//! teléfono, cómoda con el pulgar). `size="lg"` es el título del Inicio.
const WorkspacePicker = ({ size = "md" }) => {
  const navigate = useNavigate();
  const { workspace, workspaces, switchWorkspace, isSupport } = useWorkspace();

  if (!workspace) {
    return <span className="text-sm text-muted">Cargando espacio…</span>;
  }

  const handleChange = (e) => {
    if (e.target.value === NEW_OPTION) {
      navigate("/espacios?nuevo=1");
      return;
    }
    switchWorkspace(e.target.value);
    navigate("/dashboard");
  };

  const role = isSupport ? "Soporte de plataforma" : ROLE_LABELS[workspace.role];

  return (
    <div className="relative min-w-0">
      <div className="flex items-center gap-1.5 min-w-0">
        <span
          className={
            size === "lg"
              ? "text-[22px] font-extrabold tracking-tight truncate"
              : "text-[15px] font-bold truncate"
          }
        >
          {workspace.name}
        </span>
        <LuChevronDown aria-hidden="true" className="shrink-0 text-muted" />
      </div>
      <p className="text-xs text-muted truncate">
        {workspace.kind === "iglesia" ? "Iglesia" : "Personal"} · {role}
      </p>
      <label htmlFor={`workspace-picker-${size}`} className="sr-only">
        Cambiar de espacio
      </label>
      <select
        id={`workspace-picker-${size}`}
        value={workspace._id}
        onChange={handleChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      >
        {isSupport && <option value={workspace._id}>{workspace.name} (soporte)</option>}
        {workspaces.map((w) => (
          <option key={w._id} value={w._id}>
            {w.kind === "iglesia" ? "⛪" : "👤"} {w.name}
          </option>
        ))}
        <option value={NEW_OPTION}>＋ Crear espacio…</option>
      </select>
    </div>
  );
};

export default WorkspacePicker;
