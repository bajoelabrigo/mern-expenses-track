//! Concepto de un pago a una persona: POR QUÉ se le pagó. A diferencia de los
//! tipos de ingreso (que viven en la categoría), este va en el movimiento,
//! porque el mismo concepto cambia de un pago a otro: a la misma hermana un mes
//! se le paga un jornal por cocinar y otro un reembolso de pasajes.
const PAYMENT_KINDS = ["honorarios", "jornal", "servicio", "reembolso", "otro"];

const PAYMENT_KIND_LABELS = {
  honorarios: "Honorarios",
  jornal: "Jornal",
  servicio: "Servicio",
  reembolso: "Reembolso",
  otro: "Otro",
};

const isValidPaymentKind = (value) => PAYMENT_KINDS.includes(value);

module.exports = { PAYMENT_KINDS, PAYMENT_KIND_LABELS, isValidPaymentKind };
