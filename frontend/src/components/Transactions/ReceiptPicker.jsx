import { useEffect, useMemo, useRef, useState } from "react";
import { FaCamera, FaFilePdf, FaTimes } from "react-icons/fa";
import { compressImage, RECEIPT_ACCEPT, RECEIPT_MAX_BYTES } from "../../lib/image";
import { formatBytes } from "./receipt";

//! Elegir el comprobante: en el móvil el selector ofrece cámara o galería. La
//! foto se reduce aquí mismo antes de entregarla.
const ReceiptPicker = ({ value, onChange, label = "Comprobante (opcional)", disabled }) => {
  const inputRef = useRef(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const handleChange = async (e) => {
    const original = e.target.files?.[0];
    e.target.value = ""; //! permite volver a elegir el mismo archivo
    if (!original) return;

    setError("");
    setProcessing(true);
    try {
      const file = await compressImage(original);
      if (file.size > RECEIPT_MAX_BYTES) {
        setError("El archivo pasa de 8 MB. Prueba con una foto o un PDF más pequeño.");
        return;
      }
      onChange(file);
    } finally {
      setProcessing(false);
    }
  };

  const isPdf = value?.type === "application/pdf";

  //! Una URL de vista previa por archivo, liberada al cambiarlo
  const previewUrl = useMemo(
    () => (value && !isPdf ? URL.createObjectURL(value) : null),
    [value, isPdf]
  );
  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl]);

  return (
    <div className="space-y-2">
      <span className="flex gap-2 items-center text-gray-700 font-medium">
        <FaCamera className="text-blue-500" />
        {label}
      </span>

      {value ? (
        <div className="flex items-center gap-3 p-2 rounded-md border border-gray-200 bg-gray-50">
          {isPdf ? (
            <FaFilePdf className="text-red-500 text-3xl shrink-0" />
          ) : (
            <img
              src={previewUrl}
              alt="Vista previa del comprobante"
              className="h-14 w-14 object-cover rounded"
            />
          )}
          <span className="text-sm text-gray-700 truncate flex-1">
            {value.name} · {formatBytes(value.size)}
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-gray-500 hover:text-red-600"
            aria-label="Quitar el comprobante elegido"
            disabled={disabled}
          >
            <FaTimes />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || processing}
          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-md text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 disabled:opacity-60"
        >
          {processing ? "Preparando la foto..." : "Tomar foto o elegir archivo (foto o PDF)"}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={RECEIPT_ACCEPT}
        onChange={handleChange}
        className="hidden"
        aria-label={label}
      />
      {error && <p className="text-red-500 text-xs">{error}</p>}
    </div>
  );
};

export default ReceiptPicker;
