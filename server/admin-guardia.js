'use strict';

/*
 * admin-guardia.js
 * ORDEN-RONDA-23 §2. La marca `administrador: true` (ADB-037: un atributo de
 * persona, NO un rol agregado) gobernaba las rutas del padrón desde
 * padron-administracion.js. Otras puertas necesitan la MISMA pregunta; se
 * extrae acá para que el cruce contra el padrón EN VIVO (el rol no lo elige el
 * cliente) y el mensaje en castellano no se dupliquen ni se desincronicen.
 *
 * La usan padron-administracion.js y pliego-plantillas-api.js. El dueño de la
 * fábrica decide el mensaje del rechazo (cada puerta nombra su operación).
 */

function crearGuardaAdministrador(padronVivo) {
  // Administrador activo autenticado. Contexto para el cruce de autorización:
  // el que arma cada ruta (cuerpo con la sesión ya inyectada, o req.sgcSesion).
  function esAdministrador(contexto, mensaje) {
    const cx = contexto || {};
    const usuarios = padronVivo.usuarios();
    const v = globalThis.SGC.core.autorizacion.verificar(usuarios, cx);
    if (!v.ok) {
      return { ok: false, error: v.error };
    }
    const usuario = usuarios.find((u) => u && u.email === cx.email);
    if (!usuario || usuario.activo === false) {
      return { ok: false, error: 'su cuenta no está activa en el padrón' };
    }
    if (usuario.administrador !== true) {
      return {
        ok: false,
        error: mensaje || 'solo el administrador puede hacer esta operación'
      };
    }
    return { ok: true, usuario };
  }

  return { esAdministrador };
}

module.exports = { crearGuardaAdministrador };
