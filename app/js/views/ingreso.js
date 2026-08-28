/*
 * ingreso.js
 * ORDEN-RONDA-14 §3.4 (ADR-033). Pantalla de ingreso del modo autenticado:
 * reemplaza la lista declarada de operadores. El correo y la clave se
 * verifican contra el padrón real del servidor; la sesión queda en la cookie
 * HttpOnly y el rol sale de la sesión, no de lo que el cliente declare.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.views) {
    throw new Error('ingreso.js requiere que namespaces.js se cargue primero');
  }

  var estado = {
    dominio: null,
    enviando: false
  };

  function montar(contenedor) {
    estado.dominio = {
      panel: document.getElementById('sgc-ingreso'),
      email: document.getElementById('sgc-ingreso-email'),
      clave: document.getElementById('sgc-ingreso-clave'),
      error: document.getElementById('sgc-ingreso-error'),
      enviar: document.getElementById('sgc-ingreso-enviar')
    };
    var d = estado.dominio;
    if (!d.panel) {
      return;
    }
    // El error se limpia apenas el operador vuelve a escribir.
    function limpiarError() {
      d.error.hidden = true;
      d.error.textContent = '';
    }
    d.email.addEventListener('input', limpiarError);
    d.clave.addEventListener('input', limpiarError);
  }

  // autenticado true: la lista declarada no aplica, se ofrece el formulario.
  function mostrar(autenticado) {
    if (!estado.dominio) {
      return;
    }
    estado.dominio.panel.hidden = !autenticado;
  }

  function mostrarError(texto) {
    if (!estado.dominio) {
      return;
    }
    estado.dominio.error.textContent = texto || 'no se pudo ingresar';
    estado.dominio.error.hidden = false;
  }

  // Lee los campos y pide el ingreso. Devuelve la promesa de {estado, datos}
  // del servidor; la vista (app.js) decide si es provisoria o definitiva.
  function enviar() {
    var d = estado.dominio;
    if (!d || estado.enviando) {
      return Promise.reject(new Error('vista de ingreso sin montar'));
    }
    var email = d.email.value.trim();
    var clave = d.clave.value;
    if (!email || !clave) {
      return Promise.resolve({ estado: 400, datos: { error: 'correo y clave son obligatorios' } });
    }
    estado.enviando = true;
    d.enviar.disabled = true;
    return SGC.adapters.sesion.ingresar(email, clave).then(function (resultado) {
      estado.enviando = false;
      d.enviar.disabled = false;
      if (resultado.estado === 200) {
        d.clave.value = '';
      }
      return resultado;
    }, function (err) {
      estado.enviando = false;
      d.enviar.disabled = false;
      mostrarError('no se pudo contactar al servidor');
      throw err;
    });
  }

  SGC.views.ingreso = {
    montar: montar,
    mostrar: mostrar,
    mostrarError: mostrarError,
    enviar: enviar
  };
})(typeof window !== 'undefined' ? window : globalThis);