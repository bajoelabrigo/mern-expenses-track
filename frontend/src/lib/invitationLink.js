//! Del enlace de invitación pegado por el usuario se saca el token, para poder
//! llevarlo a la pantalla de la invitación. Acepta el enlace completo o el
//! token suelto; si no hay nada válido devuelve "".

//! El token son 32 bytes en hexadecimal (64 caracteres); se piden al menos 16
//! para no confundirlo con cualquier otra cosa que venga en la dirección.
const RE = /invitacion\/([A-Za-z0-9]{16,})/;

export const tokenDeInvitacion = (valor) => (String(valor).match(RE) || [])[1] || "";
