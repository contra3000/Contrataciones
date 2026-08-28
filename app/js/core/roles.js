/*
 * roles.js
 * ORDEN-RONDA-14 §3.1 (ADR-033): la jerarquía de roles como DATO, no como una
 * cadena de condiciones. Cada operador tiene un solo rol (el padrón migró de
 * `roles: []` a `rol: ''`) y los roles nacen por herencia: un supervisor
 * incluye a su supervisado. Es transitiva: si mañana hay tres niveles, el de
 * arriba incluye a los dos de abajo sin tocar código. La matriz de 18 × 7 NO
 * se duplica: sigue diciendo qué rol ejecuta cada paso, y lo que cambia es
 * contra qué conjunto se pregunta (config.rolesEfectivos es la fachada).
 */
(function (raiz) {
  'use strict';

  if (!raiz.SGC || !raiz.SGC.core) {
    throw new Error('roles.js requiere que namespaces.js se cargue primero');
  }

  var HERENCIA_ROLES = [
    { rol: 'contrataciones_supervisor', incluye: ['contrataciones'] },
    { rol: 'abastecimiento_supervisor', incluye: ['abastecimiento'] }
  ];

  // Conjunto efectivo de un rol: el propio más los heredados, transitivamente.
  function rolesEfectivos(rolOperador) {
    var conjunto = [];
    var visto = {};
    function extender(rol) {
      if (rol === undefined || rol === null || visto[rol]) {
        return;
      }
      visto[rol] = true;
      conjunto.push(rol);
      for (var i = 0; i < HERENCIA_ROLES.length; i++) {
        if (HERENCIA_ROLES[i].rol === rol) {
          var heredados = HERENCIA_ROLES[i].incluye || [];
          for (var j = 0; j < heredados.length; j++) {
            extender(heredados[j]);
          }
        }
      }
    }
    extender(rolOperador);
    return conjunto;
  }

  raiz.SGC.core.roles = {
    HERENCIA_ROLES: HERENCIA_ROLES,
    rolesEfectivos: rolesEfectivos
  };
})(typeof window !== 'undefined' ? window : globalThis);