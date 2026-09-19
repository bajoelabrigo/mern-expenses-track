import { ButtonLink, EmptyState } from "../ui";

const NotFound = () => (
  <div className="max-w-md mx-auto px-4 py-16">
    <EmptyState
      title="Esta página no existe"
      action={<ButtonLink to="/">Volver al inicio</ButtonLink>}
    >
      Puede que el enlace esté mal escrito o que la página ya no exista.
    </EmptyState>
  </div>
);

export default NotFound;
