import { Component } from "react";

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
        <div className="max-w-md mx-auto my-20 text-center space-y-4">
          <h1 className="text-2xl font-bold text-gray-800">
            Algo salió mal
          </h1>
          <p className="text-gray-600">
            Ocurrió un error inesperado. Recarga la página para continuar.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
          >
            Recargar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
