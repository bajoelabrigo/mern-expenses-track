import { LuCloudOff, LuHistory, LuLock, LuUsers } from "react-icons/lu";
import { ButtonLink, Card, CategoryIcon } from "../ui";

//! Movimientos de ejemplo para la maqueta del teléfono (no son datos reales)
const SAMPLE = [
  { icon: "🙏", name: "diezmos", title: "Diezmos", detail: "Culto del domingo · por Marta", amount: "+S/ 1,240.00", income: true },
  { icon: "💝", name: "ofrendas", title: "Ofrenda del culto", detail: "Ofrendas · por Marta", amount: "+S/ 318.50", income: true },
  { icon: "💡", name: "luz", title: "Recibo de luz", detail: "Luz · por Jorge", amount: "−S/ 185.30" },
  { icon: "🤝", name: "ayuda social", title: "Canasta para familias", detail: "Ayuda social · por Jorge", amount: "−S/ 279.00" },
];

const FEATURES = [
  {
    icon: LuUsers,
    title: "Cada quien con su rol",
    text: "Invita al tesorero, al contador o a la junta con un enlace por WhatsApp. El auditor solo mira; nadie toca lo que no le toca.",
  },
  {
    icon: LuHistory,
    title: "Un historial que no se borra",
    text: "Quién registró, corrigió o anuló cada movimiento y cuándo. Lo anulado se ve tachado con su motivo, nunca desaparece.",
  },
  {
    icon: LuCloudOff,
    title: "Funciona sin señal",
    text: "Registra la ofrenda en el templo aunque no haya internet: se envía sola al volver la conexión, sin duplicarse.",
  },
  {
    icon: LuLock,
    title: "Comprobantes privados",
    text: "Toma la foto de la boleta al registrar el gasto. Solo la ven los miembros de tu iglesia, nunca queda pública.",
  },
];

//! Maqueta del Inicio de la app, hecha con sus propios componentes
const PhonePreview = () => (
  <div
    aria-hidden="true"
    className="mx-auto w-full max-w-[320px] rounded-[2.5rem] bg-ink dark:bg-surface-2 dark:ring-1 dark:ring-line p-2.5 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.35)]"
  >
    <div className="rounded-[2rem] bg-bg px-4 pt-6 pb-5 space-y-4">
      <div>
        <p className="text-[18px] font-extrabold tracking-tight text-ink">Iglesia Betel</p>
        <p className="text-[11px] text-muted">Iglesia · Tesorera</p>
      </div>
      <div>
        <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted">Flujo neto · septiembre</p>
        <p className="text-[32px] leading-none font-extrabold tracking-tight tabular text-ink mt-1">S/ 2,129.80</p>
      </div>
      <svg viewBox="0 0 260 70" className="w-full h-16">
        <path d="M0 55 H40 V40 H95 V48 H140 V30 H190 V22 H260" fill="none" stroke="var(--accent)" strokeWidth="2.5" />
        <path d="M0 55 H40 V40 H95 V48 H140 V30 H190 V22 H260 V70 H0 Z" fill="var(--accent)" opacity="0.15" />
      </svg>
      <div className="grid grid-cols-2 gap-2">
        {[
          ["Entró", "S/ 4,802.00", "bg-income", "100%"],
          ["Salió", "S/ 2,672.20", "bg-expense", "56%"],
        ].map(([label, value, bar, width]) => (
          <div key={label} className="rounded-2xl bg-surface p-3 shadow-card">
            <p className="text-[9px] font-bold uppercase tracking-wider text-muted">{label}</p>
            <p className="text-[13px] font-extrabold tabular text-ink mt-0.5">{value}</p>
            <div className="mt-2 h-1 rounded-full bg-surface-2">
              <div className={`h-full rounded-full ${bar}`} style={{ width }} />
            </div>
          </div>
        ))}
      </div>
      <ul className="rounded-2xl bg-surface shadow-card divide-y divide-line overflow-hidden">
        {SAMPLE.slice(0, 3).map((row) => (
          <li key={row.title} className="flex items-center gap-2.5 px-3 py-2.5">
            <CategoryIcon name={row.name} icon={row.icon} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-ink truncate">{row.title}</p>
              <p className="text-[10px] text-muted truncate">{row.detail}</p>
            </div>
            <span className={`text-[12px] font-bold tabular ${row.income ? "text-income" : "text-ink"}`}>
              {row.amount}
            </span>
          </li>
        ))}
      </ul>
    </div>
  </div>
);

const Homepage = () => (
  <div className="mx-auto max-w-5xl px-4">
    <section className="grid lg:grid-cols-[1.1fr_1fr] gap-12 items-center py-12 lg:py-20">
      <div>
        <h1 className="text-[40px] sm:text-[52px] leading-[1.02] font-extrabold tracking-tight text-ink">
          Las cuentas de tu iglesia, claras para todos.
        </h1>
        <p className="mt-5 text-lg text-ink-2 max-w-[34rem] leading-relaxed">
          Registra diezmos, ofrendas y gastos desde el celular. El tesorero, el pastor y la
          junta ven los mismos números, con el historial de cada cambio.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink to="/register" variant="accent" size="lg">
            Crear cuenta gratis
          </ButtonLink>
          <ButtonLink to="/login" variant="secondary" size="lg">
            Ya tengo cuenta
          </ButtonLink>
        </div>
        <p className="mt-4 text-sm text-muted">
          También sirve para tus finanzas personales: cada cuenta trae su propio espacio.
        </p>
      </div>
      <PhonePreview />
    </section>

    <section aria-labelledby="que-hace" className="py-12 border-t border-line">
      <h2 id="que-hace" className="text-[28px] font-extrabold tracking-tight text-ink max-w-xl">
        Pensada para la tesorería de una iglesia, no para un contador.
      </h2>
      <div className="mt-8 grid sm:grid-cols-2 gap-4">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <Card key={title} className="p-5">
            <span className="h-10 w-10 rounded-xl bg-accent-soft text-ink grid place-items-center">
              <Icon aria-hidden="true" className="text-lg" />
            </span>
            <h3 className="mt-4 font-extrabold text-ink">{title}</h3>
            <p className="mt-1.5 text-sm text-ink-2 leading-relaxed">{text}</p>
          </Card>
        ))}
      </div>
    </section>

    <section className="py-14 border-t border-line text-center">
      <h2 className="text-[28px] font-extrabold tracking-tight text-ink">Empieza con el próximo domingo.</h2>
      <p className="mt-2 text-ink-2">Crea el espacio de tu iglesia e invita a tu tesorero en un minuto.</p>
      <div className="mt-6 flex justify-center">
        <ButtonLink to="/register" variant="accent" size="lg">
          Crear cuenta gratis
        </ButtonLink>
      </div>
    </section>

    <footer className="py-8 border-t border-line text-sm text-muted flex flex-wrap justify-between gap-2">
      <span>Control de Gastos</span>
      <span>Instálala en tu celular desde el navegador.</span>
    </footer>
  </div>
);

export default Homepage;
