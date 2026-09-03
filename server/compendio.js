'use strict';

/*
 * compendio.js
 * ORDEN-RONDA-18 §2 (ADR-037 §3). Guardia ÚNICA del compendio crudo de
 * eventos y de sugerencias.
 *
 * El compendio es texto libre de desempeño de personas identificadas (R38):
 * lo escribe cualquiera de los compañeros y lo lee exactamente quien tiene la
 * MARCA `administrador` en el padrón vivo, y nadie más. El rol
 * `contrataciones_supervisor` SIN marca NO lo ve, y un administrador con otro
 * rol sí. El `return true` por rol que había en eventos.js/sugerencias.js
 * hacía la marca inalcanzable para el supervisor; esta guardia la reemplaza.
 *
 * El nombre dice lo que hace: `tieneMarcaDeAdministrador`. Se verifica contra
 * el padrón EN VIVO; el cliente no elige ni su rol (ADR-033) ni su marca.
 */

function crearGuardiaCompendio(entorno) {
  const SGC = globalThis.SGC;

  // Contexto del cruce de autorización: primero el del cuerpo (si la sesión se
  // inyectó server-side) y, si la petición es bodyless (GET del compendio),
  // la sesión que la capa de sesión adjuntó en req.sgcSesion. Sin esto, un
  // GET sin cuerpo daba 403 hasta para el administrador (picaporte de la puerta).
  function contextoDe(cuerpo, req) {
    if (cuerpo && cuerpo.contexto) {
      return cuerpo.contexto;
    }
    const s = req && req.sgcSesion;
    return s ? { email: s.email, rol: s.rol } : null;
  }

  function tieneMarcaDeAdministrador(req, cuerpo) {
    const cx = contextoDe(cuerpo, req) || {};
    const usuarios = entorno.padronVivo.usuarios();
    const v = SGC.core.autorizacion.verificar(usuarios, cx);
    if (!v.ok) {
      return false;
    }
    const u = usuarios.find((x) => x && x.email === cx.email);
    return !!(u && u.administrador === true);
  }

  return { tieneMarcaDeAdministrador, contextoDe };
}

module.exports = { crearGuardiaCompendio };