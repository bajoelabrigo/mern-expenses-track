const mongoose = require("mongoose");

//! Enlace de solo lectura para la congregación.
//!
//! Con él, cualquiera que tenga la dirección ve un resumen de las cuentas SIN
//! cuenta ni contraseña. Por eso, y aunque parezca poco, es la parte más
//! delicada de la app: lo que se publica aquí ya no se puede "despublicar" de
//! la cabeza de quien lo vio.
//!
//! Decisiones para que sea seguro por defecto:
//!   - El enlace lleva un token largo y al azar, guardado como hash: si
//!     alguien roba la base de datos, no obtiene enlaces que funcionen.
//!   - Solo se publican TOTALES (lo que entró, en qué se fue, el saldo).
//!     Nunca aparecen aportantes, ni comprobantes, ni el detalle de cada
//!     movimiento, ni quién registró qué.
//!   - Se puede apagar o volver a crear en cualquier momento; al volver a
//!     crearlo, el enlace viejo deja de funcionar.
const publicReportSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      unique: true,
    },
    //! Nunca se guarda el token en claro
    tokenHash: { type: String, required: true, index: true },
    //! Los últimos caracteres, solo para que el propietario reconozca cuál es
    hint: { type: String, default: "" },

    active: { type: Boolean, default: true },
    //! Qué se publica: "mes" (el mes en curso) o "anio" (el año en curso)
    period: { type: String, enum: ["mes", "anio"], default: "mes" },
    //! Mostrar también cómo está repartido entre los fondos
    showFunds: { type: Boolean, default: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    //! Para que el propietario sepa si alguien lo está usando
    views: { type: Number, default: 0 },
    lastViewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PublicReport", publicReportSchema);
