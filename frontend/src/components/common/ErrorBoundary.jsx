import { Component } from "react";
import { Button, EmptyState } from "../ui";
import { clearStoredData } from "../../utils/storage";

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

  //! Recargar solo no siempre arregla nada: si lo que se rompió son los datos
  //! que el navegador tenía guardados (una respuesta que no era la esperada),
  //! vuelve a fallar igual en cada recarga. Se borran esos datos —la sesión no—
  //! y así la app los pide de nuevo, limpios.
  recargar = () => {
    clearStoredData();
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-md mx-auto px-4 py-16">
          <EmptyState
            title="Algo salió mal"
            action={<Button onClick={this.recargar}>Recargar</Button>}
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
