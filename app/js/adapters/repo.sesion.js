/*
 * repo.sesion.js
 * ORDEN-RONDA-14 §3.4-§3.8 (ADR-033). Adaptador del cliente para la sesión
 * del operador. El servidor decide el modo (autenticado o declarado); este
 * módulo sólo habla con /api/salud y /api/sesion/*.
 *
 * En modo autenticado la sesión se mantiene con la cookie HttpOnly
 * (sgc_sesion) que el navegador envía en cada fetch: nada de tokens en el
 * cliente. Toda respuesta pasa por {estado, datos} para que la vista decida.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.adapters) {
    throw new Error('repo.sesion.js requiere que namespaces.js se cargue primero');
  }

  function pedirJson(ruta, metodo, cuerpo) {
    var opciones = {
      method: metodo || 'GET',
      headers: { 'Accept': 'application/json' }
    };
    if (cuerpo !== undefined) {
      opciones.headers['Content-Type'] = 'application/json';
      opciones.body = JSON.stringify(cuerpo);
    }
    return fetch(ruta, opciones).then(function (res) {
      return res.json().then(function (datos) {
        return { estado: res.status, datos: datos };
      });
    });
  }

  // /api/salud es público hasta en modo autenticado: con él el cliente sabe si
  // existe un padrón con credenciales y por lo tanto si debe pedir el ingreso.
  function detectarModo() {
    return pedirJson('/api/salud', 'GET').then(function (r) {
      return !!(r.datos && r.datos.autenticado === true);
    });
  }

  // Sesión actual desde la cookie (para reanudar tras un refresh). Si no hay
  // sesión, el servidor responde 401.
  function actualDeSesion() {
    return pedirJson('/api/sesion/actual', 'GET');
  }

  function ingresar(email, clave) {
    return pedirJson('/api/sesion/login', 'POST', { email: email, clave: clave });
  }

  function cambiarClave(claveVieja, claveNueva) {
    return pedirJson('/api/sesion/cambio-clave', 'POST', {
      claveVieja: claveVieja,
      claveNueva: claveNueva
    });
  }

  function salir() {
    return pedirJson('/api/sesion/salir', 'POST', {});
  }

  SGC.adapters.sesion = {
    detectarModo: detectarModo,
    actualDeSesion: actualDeSesion,
    ingresar: ingresar,
    cambiarClave: cambiarClave,
    salir: salir
  };
})(typeof window !== 'undefined' ? window : globalThis);