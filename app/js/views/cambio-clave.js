/*
 * cambio-clave.js
 * ORDEN-RONDA-14 §3.6 (ADR-034). Cambio de clave. La primera vez que se
 * ingresa con una clave provisoria, el servidor no deja operar hasta que se
 * cambia: esta vista pide la clave actual y la nueva. Con claveVieja
 * obligatoria nadie cambia sin saber la actual.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.views) {
    throw new Error('cambio-clave.js requiere que namespaces.js se cargue primero');
  }

  var estado = {
    dominio: null,
    enviando: false
  };

  function montar(contenedor) {
    estado.dominio = {
      panel: document.getElementById('sgc-cambio-clave-forma'),
      vieja: document.getElementById('sgc-cambio-clave-vieja'),
      nueva: document.getElementById('sgc-cambio-clave-nueva'),
      error: document.getElementById('sgc-cambio-clave-error'),
      enviar: document.getElementById('sgc-cambio-clave-enviar')
    };
    var d = estado.dominio;
    if (!d.panel) {
      return;
    }
    function limpiarError() {
      d.error.hidden = true;
      d.error.textContent = '';
    }
    d.vieja.addEventListener('input', limpiarError);
    d.nueva.addEventListener('input', limpiarError);
  }

  function mostrar(flag) {
    if (!estado.dominio) {
      return;
    }
    estado.dominio.panel.hidden = !flag;
    if (flag) {
      estado.dominio.error.hidden = true;
      estado.dominio.vieja.value = '';
      estado.dominio.nueva.value = '';
      estado.dominio.vieja.focus();
    }
  }

  function mostrarError(texto) {
    if (!estado.dominio) {
      return;
    }
    estado.dominio.error.textContent = texto || 'no se pudo cambiar la clave';
    estado.dominio.error.hidden = false;
  }

  // Envía la clave actual y la nueva. Devuelve la promesa de {estado, datos}.
  function enviar() {
    var d = estado.dominio;
    if (!d || estado.enviando) {
      return Promise.reject(new Error('vista de cambio de clave sin montar'));
    }
    var vieja = d.vieja.value;
    var nueva = d.nueva.value;
    if (!vieja || !nueva) {
      return Promise.resolve({ estado: 400, datos: { error: 'clave actual y clave nueva son obligatorias' } });
    }
    estado.enviando = true;
    d.enviar.disabled = true;
    return SGC.adapters.sesion.cambiarClave(vieja, nueva).then(function (resultado) {
      estado.enviando = false;
      d.enviar.disabled = false;
      if (resultado.estado === 200) {
        d.vieja.value = '';
        d.nueva.value = '';
      }
      return resultado;
    }, function (err) {
      estado.enviando = false;
      d.enviar.disabled = false;
      mostrarError('no se pudo contactar al servidor');
      throw err;
    });
  }

  SGC.views.cambioClave = {
    montar: montar,
    mostrar: mostrar,
    mostrarError: mostrarError,
    enviar: enviar
  };
})(typeof window !== 'undefined' ? window : globalThis);