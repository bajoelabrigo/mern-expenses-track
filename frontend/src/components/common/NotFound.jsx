import { Link } from "react-router-dom";

const NotFound = () => (
  <div className="max-w-md mx-auto my-20 text-center space-y-4">
    <h1 className="text-4xl font-bold text-gray-800">404</h1>
    <p className="text-gray-600">La página que buscas no existe.</p>
    <Link
      to="/"
      className="inline-block bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
    >
      Volver al inicio
    </Link>
  </div>
);

export default NotFound;
