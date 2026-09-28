/*
 * sesion-viva.js
 * ORDEN-RONDA-25 pieza 3. La sesión no se corta mientras se trabaja:
 *
 *   - con teclado o mouse en uso, el cliente renueva la sesión cada 5 minutos
 *     (GET /api/sesion/actual, que el servidor usa para tocar la sesión);
 *   - la inactividad vence igual a los 15 minutos: sin actividad no se renueva
 *     y el servidor corta la sesión como antes;
 *   - un 401 (vencimiento o sesión borrada) dispara `alVencer`, el aviso.
 *
 * Onda el documento real (root.document) y timers de root: el navegador lo
 * corre con window; la montura de Node con globalThis (dom-stub + timers).
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.adapters || !SGC.adapters.sesion) {
    throw new Error('sesion-viva.js requiere que repo.sesion.js se cargue primero');
  }

  var INTERVALO_RENOVACION_MS = 5 * 60 * 1000;
  var estado = null;

  function activar() {
    if (estado) {
      estado.huboActividad = true;
    }
  }

  function renovar() {
    return SGC.adapters.sesion.actualDeSesion().then(function (respuesta) {
      if (respuesta.estado === 200) {
        return true;
      }
      if (respuesta.estado === 401 && estado && estado.alVencer) {
        estado.alVencer();
      }
      return false;
    }).catch(function () {
      return false;
    });
  }

  // El pulso del intervalo: sólo renueva si hubo actividad desde el pulso
  // anterior. Inactivo no se toca nada y la sesión vence a los 15 minutos.
  function pulsar() {
    if (!estado || !estado.huboActividad) {
      return;
    }
    estado.huboActividad = false;
    return renovar();
  }

  function montar(opciones) {
    if (estado) {
      detener();
    }
    var ops = opciones || {};
    estado = {
      alVencer: typeof ops.alVencer === 'function' ? ops.alVencer : null,
      huboActividad: false,
      temporizador: null
    };
    var documento = root.document;
    if (documento && typeof documento.addEventListener === 'function') {
      documento.addEventListener('keydown', activar);
      documento.addEventListener('mousedown', activar);
    }
    estado.temporizador = root.setInterval(pulsar,
      typeof ops.intervaloMs === 'number' && ops.intervaloMs > 0
        ? ops.intervaloMs
        : INTERVALO_RENOVACION_MS);
  }

  function detener() {
    if (!estado) {
      return;
    }
    if (estado.temporizador !== null && typeof root.clearInterval === 'function') {
      root.clearInterval(estado.temporizador);
    }
    estado.temporizador = null;
    var documento = root.document;
    if (documento && typeof documento.removeEventListener === 'function') {
      documento.removeEventListener('keydown', activar);
      documento.removeEventListener('mousedown', activar);
    }
    estado = null;
  }

  SGC.sesionViva = {
    activar: activar,
    renovar: renovar,
    pulsar: pulsar,
    montar: montar,
    detener: detener,
    INTERVALO_RENOVACION_MS: INTERVALO_RENOVACION_MS
  };
})(typeof window !== 'undefined' ? window : globalThis);