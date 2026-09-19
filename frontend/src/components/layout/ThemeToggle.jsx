import { LuMonitor, LuMoon, LuSun } from "react-icons/lu";
import { useTheme } from "../../lib/theme";

const OPTIONS = [
  { value: "light", label: "Claro", icon: LuSun },
  { value: "dark", label: "Oscuro", icon: LuMoon },
  { value: "system", label: "Sistema", icon: LuMonitor },
];

//! Claro / Oscuro / Según el teléfono
const ThemeToggle = () => {
  const { mode, setMode } = useTheme();

  return (
    <div role="radiogroup" aria-label="Tema" className="flex p-1 rounded-full bg-surface-2">
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const selected = mode === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setMode(value)}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-full text-xs font-semibold transition ${
              selected ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink"
            }`}
          >
            <Icon aria-hidden="true" /> {label}
          </button>
        );
      })}
    </div>
  );
};

export default ThemeToggle;
