import { Component } from "react";
import { Button, EmptyState } from "../ui";

//! Evita que un error de render deje la app en blanco sin explicación.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    //! En producción esto es el lugar para enviar el error a un servicio externo
    console.error("Error no controlado:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-md mx-auto px-4 py-16">
          <EmptyState
            title="Algo salió mal"
            action={<Button onClick={() => window.location.reload()}>Recargar</Button>}
          >
            Ocurrió un error inesperado. Recarga la página para continuar; lo que ya
            guardaste no se pierde.
          </EmptyState>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
