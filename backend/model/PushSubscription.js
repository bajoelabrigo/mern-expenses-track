const mongoose = require("mongoose");

//! Un aparato suscrito a los avisos. La suscripción la crea el navegador (Web
//! Push) y es única por `endpoint`: si la misma persona vuelve a activarlos en
//! el mismo aparato, se actualiza en vez de duplicarse.
//!
//! Va por USUARIO, no por espacio: el mismo teléfono recibe los avisos de todas
//! las iglesias en las que está, y el aviso ya dice de cuál es.
const pushSubscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    endpoint: { type: String, required: true, unique: true },
    //! Las dos claves con las que se cifra el aviso para ese aparato
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
    //! Para que la persona reconozca el aparato en la lista ("Chrome en Android")
    userAgent: { type: String, default: "" },
    lastSentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

pushSubscriptionSchema.index({ user: 1 });

module.exports = mongoose.model("PushSubscription", pushSubscriptionSchema);
