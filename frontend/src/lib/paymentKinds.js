//! Conceptos de un pago a una persona: por qué se le pagó. Los valores tienen
//! que coincidir con los del servidor (backend/utils/paymentKinds.js), que es
//! quien valida; aquí solo se nombran.
export const PAYMENT_KINDS = [
  { value: "honorarios", label: "Honorarios" },
  { value: "jornal", label: "Jornal" },
  { value: "servicio", label: "Servicio" },
  { value: "reembolso", label: "Reembolso" },
  { value: "otro", label: "Otro" },
];

export const PAYMENT_KIND_LABELS = Object.fromEntries(
  PAYMENT_KINDS.map((k) => [k.value, k.label])
);
