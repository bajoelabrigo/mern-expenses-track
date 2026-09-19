import { useNavigate } from "react-router-dom";
import { useWorkspace } from "../../hooks/useWorkspace";
import { ROLE_LABELS } from "../../lib/roles";

const NEW_OPTION = "__nuevo__";

//! Selector del espacio en el que se trabaja (barra superior). Es un <select>
//! nativo a propósito: en el móvil abre el selector del sistema, que se usa
//! bien con el pulgar.
const WorkspaceSwitcher = () => {
  const navigate = useNavigate();
  const { workspace, workspaces, switchWorkspace, isSupport } = useWorkspace();

  if (!workspace) {
    return <span className="text-sm text-gray-400">Cargando espacio...</span>;
  }

  const handleChange = (e) => {
    if (e.target.value === NEW_OPTION) {
      navigate("/espacios?nuevo=1");
      return;
    }
    switchWorkspace(e.target.value);
    navigate("/dashboard");
  };

  return (
    <div className="flex flex-col min-w-0">
      <label htmlFor="workspace-switcher" className="sr-only">
        Espacio de trabajo
      </label>
      <select
        id="workspace-switcher"
        value={workspace._id}
        onChange={handleChange}
        className="max-w-[55vw] sm:max-w-xs truncate rounded-md border border-gray-300 bg-white py-1.5 pl-2 pr-8 text-sm font-semibold text-gray-800"
      >
        {isSupport && (
          <option value={workspace._id}>🛟 {workspace.name} (soporte)</option>
        )}
        {workspaces.map((w) => (
          <option key={w._id} value={w._id}>
            {w.kind === "iglesia" ? "⛪" : "👤"} {w.name}
          </option>
        ))}
        <option value={NEW_OPTION}>＋ Crear espacio…</option>
      </select>
      <span className="text-xs text-gray-500 truncate">
        {isSupport ? "Soporte de plataforma" : ROLE_LABELS[workspace.role]}
      </span>
    </div>
  );
};

export default WorkspaceSwitcher;
