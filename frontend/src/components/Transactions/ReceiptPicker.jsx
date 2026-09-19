import { useEffect, useMemo, useRef, useState } from "react";
import { LuCamera, LuFileText, LuX } from "react-icons/lu";
import { compressImage, RECEIPT_ACCEPT, RECEIPT_MAX_BYTES } from "../../lib/image";
import { formatBytes } from "./receipt";

//! Elegir el comprobante: en el móvil el selector ofrece cámara o galería. La
//! foto se reduce aquí mismo antes de entregarla.
const ReceiptPicker = ({ value, onChange, label = "Foto del comprobante", disabled }) => {
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
      {value ? (
        <div className="flex items-center gap-3 p-2 pr-3 rounded-2xl bg-surface shadow-card">
          {isPdf ? (
            <span className="h-12 w-12 shrink-0 rounded-xl bg-danger-soft text-danger grid place-items-center">
              <LuFileText aria-hidden="true" className="text-xl" />
            </span>
          ) : (
            <img
              src={previewUrl}
              alt="Vista previa del comprobante"
              className="h-12 w-12 object-cover rounded-xl"
            />
          )}
          <span className="text-sm text-ink-2 truncate flex-1">
            <span className="block font-semibold text-ink truncate">{label}</span>
            {value.name} · {formatBytes(value.size)}
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="p-2 text-muted hover:text-danger"
            aria-label="Quitar el comprobante elegido"
            disabled={disabled}
          >
            <LuX aria-hidden="true" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || processing}
          className="w-full h-12 rounded-2xl bg-surface shadow-card text-sm font-semibold text-ink inline-flex items-center justify-center gap-2 hover:bg-surface-2 disabled:opacity-60"
        >
          <LuCamera aria-hidden="true" className="text-lg" />
          {processing ? "Preparando la foto…" : label}
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
      {error && <p className="text-xs font-medium text-danger px-1">{error}</p>}
    </div>
  );
};

export default ReceiptPicker;
