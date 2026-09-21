/*
 * limites.js
 * ORDEN-RONDA-23 §4: el límite del presupuesto se escribe UNA sola vez. De este
 * único valor salen los tres consumidores —el control del servidor, el aviso
 * previo del cliente y el texto del mensaje—: cambiar LIMITE_PRESUPUESTO_BYTES
 * alcanza para que cambien los tres, sin tocar ningún otro archivo.
 *
 * No confundir con LIMITE_CUERPO de server/ayudantes.js: ese es el tope general
 * del cuerpo de la API (sigue chico, ORDEN-RONDA-23 §3) y no es éste.
 */
(function (raiz) {
  'use strict';

  if (!raiz.SGC || !raiz.SGC.core) {
    throw new Error('limites.js requiere que namespaces.js se cargue primero');
  }

  var LIMITE_PRESUPUESTO_BYTES = 20 * 1024 * 1024;

  function aMB(bytes) {
    return Math.round((bytes / (1024 * 1024)) * 10) / 10;
  }

  // Se lee el valor vivo (no una copia al cargar): los tres consumidores miran
  // siempre este mismo lugar y el test puede cambiarlo para ver el efecto.
  function limiteBytes() {
    return raiz.SGC.core.limites.LIMITE_PRESUPUESTO_BYTES;
  }

  function textoLimite(bytes) {
    var b = typeof bytes === 'number' ? bytes : limiteBytes();
    return String(aMB(b)) + ' MB';
  }

  function mensajeLimite(recibidos) {
    return 'el presupuesto supera el límite de ' + textoLimite() +
      '; llegaron ' + textoLimite(recibidos);
  }

  raiz.SGC.core.limites = {
    LIMITE_PRESUPUESTO_BYTES: LIMITE_PRESUPUESTO_BYTES,
    aMB: aMB,
    textoLimite: textoLimite,
    mensajeLimite: mensajeLimite
  };
})(typeof window !== 'undefined' ? window : globalThis);
